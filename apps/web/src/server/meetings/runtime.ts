import type { Kysely } from "kysely";

import { fail, type DomainError } from "~/domain/errors";
import type { MeetingId, OrganizationId, UserId } from "~/domain/ids";
import type { WorkspaceDatabase } from "~/server/platform/database/types";
import { Err, Ok, type Result } from "~/shared/result";

import {
  planChangeInvites,
  settleDraft,
  type MeetingDraft,
  type MeetingGuest,
} from "./domain/meeting";
import {
  createMeetingsRepo,
  type MeetingRecord,
  type MeetingScope,
} from "./infrastructure/meetings-repo";

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

export function createMeetingsRuntime(deps: {
  executor: Kysely<WorkspaceDatabase>;
  now?: () => Date;
}) {
  const repo = createMeetingsRepo(deps.executor);
  const now = deps.now ?? (() => new Date());

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
      const draft = await settle(input, actorUserId);
      if (!draft.ok) return draft;
      const plans = planChangeInvites([], draft.value.guests);
      const meetingId = await repo.create(
        draft.value,
        actorUserId,
        plans,
        now(),
      );
      return Ok({ meetingId });
    },

    async update(
      actorUserId: UserId,
      meetingId: MeetingId,
      input: MeetingInput,
    ): Promise<Result<null, DomainError>> {
      const meeting = await owned(meetingId, actorUserId);
      if (!meeting.ok) return meeting;
      const draft = await settle(input, actorUserId);
      if (!draft.ok) return draft;
      const plans = planChangeInvites(meeting.value.guests, draft.value.guests);
      await repo.update(
        meetingId,
        draft.value,
        meeting.value.sequence + 1,
        plans,
        now(),
      );
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
      return Ok(null);
    },

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
