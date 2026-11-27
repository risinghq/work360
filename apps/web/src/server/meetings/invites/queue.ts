import type { Kysely } from "kysely";

import type { WorkspaceId } from "~/domain/ids";
import { formatAppDateTime } from "~/domain/time/app-time";
import type { MessagingGateway } from "~/server/notifications/channels/messaging-gateway";
import { classifySendReceipt } from "~/server/notifications/channels/send-result";
import type { WorkspaceDatabase } from "~/server/platform/database/types";
import { createJobQueue } from "~/server/platform/jobs/job-queue";
import type { QueueRunner, Settlement } from "~/server/platform/jobs/types";
import { PLATFORM_NAME } from "~/shared/branding";

import { buildIcs, meetingUid } from "../domain/ics";
import { createMeetingInviteStore } from "../infrastructure/invite-store";
import { createMeetingsRepo } from "../infrastructure/meetings-repo";

// The ICS is built at send time from the meeting as it is now, with the
// sequence the invite was planned at. A later change supersedes the pending
// invite in the same transaction, so an invite never carries stale fields
// under a newer sequence.
export function createMeetingInviteQueue(
  db: Kysely<WorkspaceDatabase>,
  messaging: Pick<MessagingGateway, "sendMeetingInvite">,
  // `replyTo` is MEETING_REPLY_ADDRESS, or null to ask for no replies.
  options: { workspaceId: WorkspaceId; replyTo: string | null },
): QueueRunner {
  const meetings = createMeetingsRepo(db);
  return createJobQueue({
    name: "meeting-invites",
    timeoutMs: 30_000,
    maxConcurrency: 4,
    store: createMeetingInviteStore(db),
    handle: async (invite): Promise<Settlement> => {
      const meeting = await meetings.find(invite.meeting_id);
      if (!meeting) {
        return { kind: "done", patch: { error_code: "meeting_missing" } };
      }

      const recipient = meeting.guests.find(
        (guest) => guest.email === invite.recipient_email,
      ) ?? {
        email: invite.recipient_email,
        name: null,
        response: "needs_action" as const,
      };
      // A cancel sent to one removed guest names only that guest; a whole
      // cancelled meeting names everyone, as the request did.
      const attendees =
        invite.method === "cancel" && meeting.status !== "canceled"
          ? [recipient]
          : meeting.guests;
      const ics = buildIcs({
        uid: meetingUid(options.workspaceId, meeting.id),
        method: invite.method,
        sequence: invite.sequence,
        title: meeting.title,
        description: meeting.description,
        location: meeting.location,
        startsAt: meeting.startsAt,
        endsAt: meeting.endsAt,
        stamp: new Date(),
        organizer: {
          email: meeting.organizerEmail,
          name: meeting.organizerName,
        },
        attendees,
        replyTo: options.replyTo,
      });

      const when = `${formatAppDateTime(meeting.startsAt)} – ${formatAppDateTime(meeting.endsAt)}`;
      const receipt = await messaging.sendMeetingInvite({
        to: invite.recipient_email,
        params: {
          heading:
            invite.method === "cancel"
              ? `Reunión cancelada: ${meeting.title}`
              : invite.sequence > 0
                ? `Reunión actualizada: ${meeting.title}`
                : `Invitación: ${meeting.title}`,
          when,
          organizerName: meeting.organizerName,
          platformName: PLATFORM_NAME,
          location: meeting.location ?? undefined,
          description: meeting.description || undefined,
          videoLink:
            invite.method === "cancel"
              ? undefined
              : (meeting.videoLink ?? undefined),
        },
        ics: {
          method: invite.method === "cancel" ? "CANCEL" : "REQUEST",
          content: ics,
        },
      });

      const result = classifySendReceipt(receipt);
      if (result.ok) {
        return {
          kind: "done",
          patch: {
            provider: result.provider,
            provider_message_id: result.providerMessageId,
            error_code: null,
          },
        };
      }
      const patch = {
        provider: result.provider,
        provider_message_id: null,
        error_code: result.code,
      };
      return result.retryable
        ? { kind: "retry", reason: result.message, patch }
        : { kind: "fail", reason: result.message, patch };
    },
  });
}
