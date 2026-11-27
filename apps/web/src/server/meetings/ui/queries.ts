import type {
  MeetingDetailView,
  MeetingGuestOption,
  MeetingSummaryView,
  MeetingVideoOptionsView,
} from "~/contracts/meetings/views";
import { hasPermission } from "~/domain/auth/access/rbac";
import { CaseId, MeetingId, OrganizationId } from "~/domain/ids";
import { getApplication } from "~/server/composition/application";
import { executeSessionServerFunction } from "~/server/platform/action";
import {
  parseObject,
  validationFail,
} from "~/server/platform/action/input-reader";
import { Ok } from "~/shared/result";

import type {
  MeetingRecord,
  MeetingSummary,
} from "../infrastructure/meetings-repo";

function toSummaryView(meeting: MeetingSummary): MeetingSummaryView {
  return {
    id: meeting.id,
    title: meeting.title,
    startsAt: meeting.startsAt.getTime(),
    endsAt: meeting.endsAt.getTime(),
    status: meeting.status,
    organizerUserId: meeting.organizerUserId,
    organizerName: meeting.organizerName,
    organizationId: meeting.organizationId,
    companyName: meeting.companyName,
    caseId: meeting.caseId,
    guestCount: meeting.guestCount,
    videoProvider: meeting.videoProvider,
    videoLink: meeting.videoLink,
  };
}

function toDetailView(
  meeting: MeetingRecord,
  viewerUserId: string,
): MeetingDetailView {
  return {
    ...toSummaryView(meeting),
    description: meeting.description,
    location: meeting.location,
    guests: meeting.guests.map((guest) => ({
      email: guest.email,
      name: guest.name,
      memberUserId: guest.memberUserId,
      response: guest.response,
    })),
    canEdit:
      meeting.organizerUserId === viewerUserId &&
      meeting.status === "scheduled",
  };
}

// Every member sees the meetings they organize or are invited to.
export async function listMeetings(
  input: unknown,
): Promise<MeetingSummaryView[]> {
  return executeSessionServerFunction({
    name: "meetings.list",
    access: { kind: "auth" },
    parse: () =>
      parseObject(input, validationFail, (r) => ({
        organizationId: r.optId("organizationId", OrganizationId),
        caseId: r.optId("caseId", CaseId),
      })),
    execute: async (ctx, filter) => {
      const meetings = await getApplication().meetings.list({
        viewerUserId: ctx.actor.userId,
        viewAll: hasPermission(ctx.actor, "meeting:view:all"),
        ...filter,
      });
      return Ok(meetings.map(toSummaryView));
    },
  });
}

export async function getMeeting(input: unknown): Promise<MeetingDetailView> {
  return executeSessionServerFunction({
    name: "meetings.detail",
    access: { kind: "auth" },
    parse: () =>
      parseObject(input, validationFail, (r) => ({
        meetingId: r.id("meetingId", MeetingId),
      })),
    execute: async (ctx, { meetingId }) => {
      const meeting = await getApplication().meetings.detail(meetingId, {
        userId: ctx.actor.userId,
        viewAll: hasPermission(ctx.actor, "meeting:view:all"),
      });
      return meeting.ok
        ? Ok(toDetailView(meeting.value, ctx.actor.userId))
        : meeting;
    },
  });
}

export async function listMeetingGuestOptions(
  input: unknown,
): Promise<MeetingGuestOption[]> {
  return executeSessionServerFunction({
    name: "meetings.guest_options",
    access: { kind: "permission", permission: "meeting:schedule" },
    parse: () =>
      parseObject(input, validationFail, (r) => ({
        organizationId: r.optId("organizationId", OrganizationId) ?? null,
      })),
    execute: async (_ctx, { organizationId }) =>
      Ok(await getApplication().meetings.guestOptions(organizationId)),
  });
}

// The hosted providers the form offers; the rest show as not connected.
export async function getMeetingVideoOptions(): Promise<MeetingVideoOptionsView> {
  return executeSessionServerFunction({
    name: "meetings.video_options",
    access: { kind: "permission", permission: "meeting:schedule" },
    execute: async (ctx) =>
      Ok({
        available: await getApplication().meetings.videoOptions(
          ctx.actor.userId,
        ),
      }),
  });
}
