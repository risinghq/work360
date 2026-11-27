import { captureException } from "@sentry/core";
import type { Kysely } from "kysely";

import {
  isHostedVideoProvider,
  type HostedVideoProvider,
  type MeetingGuestResponse,
} from "~/contracts/meetings/views";
import { fail, type DomainError } from "~/domain/errors";
import { MeetingId, type OrganizationId, type UserId } from "~/domain/ids";
import type { WorkspaceDatabase } from "~/server/platform/database/types";
import { Err, Ok, type Result } from "~/shared/result";

import {
  planChangeInvites,
  settleAttendees,
  settleDraft,
  type MeetingDraft,
  type MeetingGuest,
} from "./domain/meeting";
import {
  createMeetingsRepo,
  type MeetingRecord,
  type MeetingScope,
} from "./infrastructure/meetings-repo";
import {
  NO_VIDEO_ROOMS,
  type VideoRoomHost,
  type VideoRooms,
  type VideoRoomSpec,
} from "./video/video-rooms";

export type MeetingViewer = { userId: UserId; viewAll: boolean };

// A member guest is named by user id; the store supplies its address, so a
// client cannot attach a member to someone else's mailbox.
export type GuestInput = {
  email: string;
  name: string | null;
  memberUserId: UserId | null;
};

export type MeetingInput = Omit<MeetingDraft, "guests"> & {
  guests: GuestInput[];
};

function canSee(meeting: MeetingRecord, viewer: MeetingViewer): boolean {
  return (
    viewer.viewAll ||
    meeting.organizerUserId === viewer.userId ||
    meeting.guests.some((guest) => guest.memberUserId === viewer.userId)
  );
}

function roomSpec(draft: MeetingDraft): VideoRoomSpec {
  return {
    title: draft.title,
    description: draft.description,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
  };
}

async function callProvider<T>(
  call: () => Promise<T>,
): Promise<Result<T, DomainError>> {
  try {
    return Ok(await call());
  } catch (error) {
    return Err(
      fail("meeting_video_failed", { fields: ["videoProvider"], cause: error }),
    );
  }
}

function sameTime(meeting: MeetingRecord, draft: MeetingDraft): boolean {
  return (
    meeting.startsAt.getTime() === draft.startsAt.getTime() &&
    meeting.endsAt.getTime() === draft.endsAt.getTime()
  );
}

// A hosted room is created before the meeting is saved, so its link goes out
// in the first invite. The provider and the store cannot share a
// transaction: a failed provider call stops the save, and a room the save
// leaves behind is removed afterwards without failing the request.
export function createMeetingsRuntime(deps: {
  executor: Kysely<WorkspaceDatabase>;
  video?: VideoRooms;
  now?: () => Date;
  // Receives a failed cleanup of a provider room the meeting no longer uses.
  report?: (error: unknown) => void;
}) {
  const repo = createMeetingsRepo(deps.executor);
  const video = deps.video ?? NO_VIDEO_ROOMS;
  const now = deps.now ?? (() => new Date());
  const report = deps.report ?? ((error: unknown) => captureException(error));

  async function videoHost(
    provider: HostedVideoProvider,
    userId: UserId,
  ): Promise<Result<VideoRoomHost, DomainError>> {
    const host = await video.host(provider, userId);
    return host
      ? Ok(host)
      : Err(fail("meeting_video_unavailable", { fields: ["videoProvider"] }));
  }

  async function removeRoom(
    provider: HostedVideoProvider,
    userId: UserId,
    externalId: string,
  ): Promise<void> {
    try {
      await (await video.host(provider, userId))?.remove(externalId);
    } catch (error) {
      report(error);
    }
  }

  // Saves, and removes `opened` (a room created for this save) when the save
  // throws.
  async function saveOrRemove(
    save: () => Promise<void>,
    opened: { provider: HostedVideoProvider; externalId: string } | null,
    userId: UserId,
  ): Promise<void> {
    try {
      await save();
    } catch (error) {
      if (opened) await removeRoom(opened.provider, userId, opened.externalId);
      throw error;
    }
  }

  async function resolveGuests(
    guests: readonly GuestInput[],
  ): Promise<Result<MeetingGuest[], DomainError>> {
    const memberIds = guests.flatMap((guest) =>
      guest.memberUserId ? [guest.memberUserId] : [],
    );
    const members = new Map(
      (await repo.members(memberIds)).map((member) => [member.userId, member]),
    );
    const resolved: MeetingGuest[] = [];
    for (const guest of guests) {
      if (guest.memberUserId === null) {
        resolved.push({ ...guest, memberUserId: null });
        continue;
      }
      const member = members.get(guest.memberUserId);
      if (!member)
        return Err(fail("meeting_guest_invalid", { fields: ["guests"] }));
      resolved.push({
        email: member.email,
        name: member.name,
        memberUserId: member.userId,
      });
    }
    return Ok(resolved);
  }

  async function settle(
    input: MeetingInput,
    organizerUserId: UserId,
  ): Promise<Result<MeetingDraft, DomainError>> {
    const [organizer] = await repo.members([organizerUserId]);
    if (!organizer) return Err(fail("meeting_not_organizer"));
    if (
      input.organizationId &&
      !(await repo.exists("organizations", input.organizationId))
    ) {
      return Err(fail("company_not_found", { fields: ["organizationId"] }));
    }
    if (input.caseId && !(await repo.exists("cases", input.caseId))) {
      return Err(fail("case_not_found", { fields: ["caseId"] }));
    }
    const guests = await resolveGuests(input.guests);
    if (!guests.ok) return guests;
    return settleDraft({ ...input, guests: guests.value }, organizer);
  }

  // The meeting, if it exists and the actor organizes it and it still stands.
  async function owned(
    meetingId: MeetingId,
    actorUserId: UserId,
  ): Promise<Result<MeetingRecord, DomainError>> {
    const meeting = await repo.find(meetingId);
    if (!meeting || !canSee(meeting, { userId: actorUserId, viewAll: false })) {
      return Err(fail("meeting_not_found"));
    }
    if (meeting.organizerUserId !== actorUserId) {
      return Err(fail("meeting_not_organizer"));
    }
    if (meeting.status === "canceled") return Err(fail("meeting_canceled"));
    return Ok(meeting);
  }

  return {
    list: (scope: MeetingScope) => repo.list(scope),

    async detail(
      meetingId: MeetingId,
      viewer: MeetingViewer,
    ): Promise<Result<MeetingRecord, DomainError>> {
      const meeting = await repo.find(meetingId);
      return meeting && canSee(meeting, viewer)
        ? Ok(meeting)
        : Err(fail("meeting_not_found"));
    },

    async create(
      actorUserId: UserId,
      input: MeetingInput,
    ): Promise<Result<{ meetingId: MeetingId }, DomainError>> {
      const settled = await settle(input, actorUserId);
      if (!settled.ok) return settled;
      let draft = settled.value;
      let opened: { provider: HostedVideoProvider; externalId: string } | null =
        null;
      const provider = draft.videoProvider;
      if (isHostedVideoProvider(provider)) {
        const host = await videoHost(provider, actorUserId);
        if (!host.ok) return host;
        const room = await callProvider(() =>
          host.value.create(roomSpec(draft)),
        );
        if (!room.ok) return room;
        draft = { ...draft, videoLink: room.value.joinUrl };
        opened = { provider, externalId: room.value.externalId };
      }
      const meetingId = MeetingId.mint();
      const attendees = settleAttendees(draft.guests, actorUserId, [], false);
      const plans = planChangeInvites([], draft.guests);
      await saveOrRemove(
        () =>
          repo.create(
            meetingId,
            { draft, attendees, videoExternalId: opened?.externalId ?? null },
            actorUserId,
            plans,
            now(),
          ),
        opened,
        actorUserId,
      );
      return Ok({ meetingId });
    },

    async update(
      actorUserId: UserId,
      meetingId: MeetingId,
      input: MeetingInput,
    ): Promise<Result<null, DomainError>> {
      const found = await owned(meetingId, actorUserId);
      if (!found.ok) return found;
      const meeting = found.value;
      const settled = await settle(input, actorUserId);
      if (!settled.ok) return settled;
      let draft = settled.value;

      const before =
        isHostedVideoProvider(meeting.videoProvider) && meeting.videoExternalId
          ? {
              provider: meeting.videoProvider,
              externalId: meeting.videoExternalId,
            }
          : null;
      let externalId: string | null = null;
      let opened: { provider: HostedVideoProvider; externalId: string } | null =
        null;
      const provider = draft.videoProvider;
      if (isHostedVideoProvider(provider)) {
        const host = await videoHost(provider, actorUserId);
        if (!host.ok) return host;
        if (before?.provider === provider) {
          const kept = before;
          const moved = await callProvider(() =>
            host.value.update(kept.externalId, roomSpec(draft)),
          );
          if (!moved.ok) return moved;
          draft = { ...draft, videoLink: meeting.videoLink };
          externalId = kept.externalId;
        } else {
          const room = await callProvider(() =>
            host.value.create(roomSpec(draft)),
          );
          if (!room.ok) return room;
          draft = { ...draft, videoLink: room.value.joinUrl };
          externalId = room.value.externalId;
          opened = { provider, externalId };
        }
      }

      const attendees = settleAttendees(
        draft.guests,
        actorUserId,
        meeting.guests,
        !sameTime(meeting, draft),
      );
      const plans = planChangeInvites(meeting.guests, draft.guests);
      await saveOrRemove(
        () =>
          repo.update(
            meetingId,
            { draft, attendees, videoExternalId: externalId },
            meeting.sequence + 1,
            plans,
            now(),
          ),
        opened,
        actorUserId,
      );
      if (before && before.externalId !== externalId) {
        await removeRoom(before.provider, actorUserId, before.externalId);
      }
      return Ok(null);
    },

    async cancel(
      actorUserId: UserId,
      meetingId: MeetingId,
    ): Promise<Result<null, DomainError>> {
      const meeting = await owned(meetingId, actorUserId);
      if (!meeting.ok) return meeting;
      const plans = planChangeInvites(meeting.value.guests, []);
      await repo.cancel(meetingId, meeting.value.sequence + 1, plans, now());
      const { videoProvider, videoExternalId } = meeting.value;
      if (isHostedVideoProvider(videoProvider) && videoExternalId) {
        await removeRoom(videoProvider, actorUserId, videoExternalId);
      }
      return Ok(null);
    },

    // The hosted providers the member can pick for a new room.
    videoOptions: (userId: UserId) => video.available(userId),

    // A guest's iTIP REPLY. The caller has matched the sender to the guest.
    receiveReply: (reply: {
      meetingId: MeetingId;
      email: string;
      response: MeetingGuestResponse;
      sequence: number;
    }) =>
      repo.recordResponse(
        reply.meetingId,
        reply.email,
        reply.response,
        reply.sequence,
        now(),
      ),

    // Members, then the company's contacts when the meeting is about one.
    async guestOptions(organizationId: OrganizationId | null) {
      const members = await repo.activeMembers();
      const contacts = organizationId
        ? await repo.companyContacts(organizationId)
        : [];
      return [
        ...members.map((member) => ({
          email: member.email,
          name: member.name,
          memberUserId: member.userId as string | null,
        })),
        ...contacts.map((contact) => ({
          email: contact.email,
          name: contact.name,
          memberUserId: null,
        })),
      ];
    },
  };
}

export type MeetingsRuntime = ReturnType<typeof createMeetingsRuntime>;
