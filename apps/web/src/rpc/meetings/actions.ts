import {
  isHostedVideoProvider,
  MEETING_VIDEO_PROVIDERS,
  type MeetingVideoProvider,
} from "~/contracts/meetings/views";
import {
  hasPermission,
  type PermissionHolder,
} from "~/domain/auth/access/rbac";
import { fail, type DomainError } from "~/domain/errors";
import { CaseId, MeetingId, OrganizationId, UserId } from "~/domain/ids";
import { getApplication } from "~/server/composition/application";
import { MAX_GUESTS } from "~/server/meetings/domain/meeting";
import { executeSessionServerFunctionResult } from "~/server/platform/action";
import {
  parseObject,
  validationFail,
  type Reader,
} from "~/server/platform/action/input-reader";
import { Err, Ok, type Result } from "~/shared/result";

// Opening a Zoom or Meet room is held back for the roles granted
// `meeting:video:host`; anyone who schedules may paste a link.
function authorizeVideo(
  actor: PermissionHolder,
  provider: MeetingVideoProvider,
): Result<null, DomainError> {
  return isHostedVideoProvider(provider) &&
    !hasPermission(actor, "meeting:video:host")
    ? Err(fail("meeting_video_unavailable", { fields: ["videoProvider"] }))
    : Ok(null);
}

// Times arrive as epoch milliseconds.
function readMeeting(r: Reader<DomainError>) {
  return {
    title: r.str("title", { min: 1, max: 200 }),
    description: r.optStr("description") ?? "",
    startsAt: new Date(r.num("startsAt")),
    endsAt: new Date(r.num("endsAt")),
    location: r.optStr("location"),
    videoProvider: r.enum("videoProvider", MEETING_VIDEO_PROVIDERS),
    videoLink: r.optStr("videoLink"),
    organizationId: r.optId("organizationId", OrganizationId) ?? null,
    caseId: r.optId("caseId", CaseId) ?? null,
    guests: r.list(
      "guests",
      (guest) => ({
        email: guest.str("email", { max: 254 }),
        name: guest.optStr("name"),
        memberUserId: guest.optId("memberUserId", UserId) ?? null,
      }),
      { max: MAX_GUESTS },
    ),
  };
}

export async function createMeeting(input: unknown) {
  "use server";

  return executeSessionServerFunctionResult({
    name: "meetings.create",
    access: { kind: "permission", permission: "meeting:schedule" },
    parse: () => parseObject(input, validationFail, readMeeting),
    telemetry: (meeting) => ({ guests: meeting.guests.length }),
    execute: async (ctx, meeting) => {
      const allowed = authorizeVideo(ctx.actor, meeting.videoProvider);
      if (!allowed.ok) return allowed;
      return getApplication().meetings.create(ctx.actor.userId, meeting);
    },
  });
}

export async function updateMeeting(input: unknown) {
  "use server";

  return executeSessionServerFunctionResult({
    name: "meetings.update",
    access: { kind: "permission", permission: "meeting:schedule" },
    parse: () =>
      parseObject(input, validationFail, (r) => ({
        meetingId: r.id("meetingId", MeetingId),
        meeting: readMeeting(r),
      })),
    telemetry: ({ meetingId }) => ({ meetingId }),
    execute: async (ctx, { meetingId, meeting }) => {
      const allowed = authorizeVideo(ctx.actor, meeting.videoProvider);
      if (!allowed.ok) return allowed;
      const updated = await getApplication().meetings.update(
        ctx.actor.userId,
        meetingId,
        meeting,
      );
      return updated.ok ? Ok({ meetingId }) : updated;
    },
  });
}

export async function cancelMeeting(input: unknown) {
  "use server";

  return executeSessionServerFunctionResult({
    name: "meetings.cancel",
    access: { kind: "permission", permission: "meeting:schedule" },
    parse: () =>
      parseObject(input, validationFail, (r) => ({
        meetingId: r.id("meetingId", MeetingId),
      })),
    telemetry: ({ meetingId }) => ({ meetingId }),
    execute: async (ctx, { meetingId }) => {
      const canceled = await getApplication().meetings.cancel(
        ctx.actor.userId,
        meetingId,
      );
      return canceled.ok ? Ok({ meetingId }) : canceled;
    },
  });
}
