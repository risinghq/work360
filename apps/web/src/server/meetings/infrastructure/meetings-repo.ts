import type { Kysely, Transaction } from "kysely";

import type {
  MeetingGuestResponse,
  MeetingVideoProvider,
} from "~/contracts/meetings/views";
import {
  newRowId,
  type CaseId,
  MeetingId,
  type OrganizationId,
  type UserId,
} from "~/domain/ids";
import type { WorkspaceDatabase } from "~/server/platform/database/types";

import type {
  InvitePlan,
  MeetingAttendee,
  MeetingDraft,
} from "../domain/meeting";

type Db = Kysely<WorkspaceDatabase>;
type Tx = Transaction<WorkspaceDatabase>;

export type MeetingSummary = {
  id: MeetingId;
  title: string;
  startsAt: Date;
  endsAt: Date;
  status: "scheduled" | "canceled";
  organizerUserId: UserId;
  organizerName: string;
  organizationId: OrganizationId | null;
  companyName: string | null;
  caseId: CaseId | null;
  guestCount: number;
  videoProvider: MeetingVideoProvider;
  videoLink: string | null;
};

export type MeetingRecord = MeetingSummary & {
  description: string;
  location: string | null;
  sequence: number;
  organizerEmail: string;
  // The provider's id for a hosted room, used to change or remove it.
  videoExternalId: string | null;
  guests: MeetingAttendee[];
};

// What a save writes: the settled draft, its attendees with their answers,
// and the hosted room's id when the provider opened one.
export type SavedMeeting = {
  draft: MeetingDraft;
  attendees: readonly MeetingAttendee[];
  videoExternalId: string | null;
};

export type MeetingScope = {
  viewerUserId: UserId;
  viewAll: boolean;
  organizationId?: OrganizationId;
  caseId?: CaseId;
};

export type MemberContact = { userId: UserId; email: string; name: string };

function memberName(row: { names: string; first_surname: string }): string {
  return `${row.names} ${row.first_surname}`.trim();
}

function summaryQuery(db: Db | Tx) {
  return db
    .selectFrom("meetings")
    .innerJoin(
      "members as organizer",
      "organizer.user_id",
      "meetings.organizer_user_id",
    )
    .leftJoin("organizations", "organizations.id", "meetings.organization_id")
    .select((eb) => [
      "meetings.id",
      "meetings.title",
      "meetings.description",
      "meetings.starts_at",
      "meetings.ends_at",
      "meetings.location",
      "meetings.video_link",
      "meetings.video_provider",
      "meetings.video_external_id",
      "meetings.status",
      "meetings.sequence",
      "meetings.organizer_user_id",
      "meetings.organization_id",
      "meetings.case_id",
      "organizer.names",
      "organizer.first_surname",
      "organizer.email as organizer_email",
      "organizations.legal_name",
      eb
        .selectFrom("meeting_guests")
        .select(eb.fn.countAll<number>().as("n"))
        .whereRef("meeting_guests.meeting_id", "=", "meetings.id")
        .as("guest_count"),
    ]);
}

type SummaryRow = Awaited<
  ReturnType<ReturnType<typeof summaryQuery>["executeTakeFirstOrThrow"]>
>;

function toSummary(row: SummaryRow): MeetingSummary {
  return {
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    organizerUserId: row.organizer_user_id,
    organizerName: memberName(row),
    organizationId: row.organization_id,
    companyName: row.legal_name,
    caseId: row.case_id,
    guestCount: row.guest_count ?? 0,
    videoProvider: row.video_provider,
    videoLink: row.video_link,
  };
}

async function guestsOf(executor: Db | Tx, id: MeetingId) {
  const rows = await executor
    .selectFrom("meeting_guests")
    .select(["email", "name", "member_user_id", "response", "responded_at"])
    .where("meeting_id", "=", id)
    .orderBy("email")
    .execute();
  return rows.map((row): MeetingAttendee => ({
    email: row.email,
    name: row.name,
    memberUserId: row.member_user_id,
    response: row.response,
    respondedAt: row.responded_at,
  }));
}

async function insertGuests(
  tx: Tx,
  id: MeetingId,
  guests: readonly MeetingAttendee[],
) {
  if (guests.length === 0) return;
  await tx
    .insertInto("meeting_guests")
    .values(
      guests.map((guest) => ({
        meeting_id: id,
        email: guest.email,
        name: guest.name,
        member_user_id: guest.memberUserId,
        response: guest.response,
        responded_at: guest.respondedAt,
      })),
    )
    .execute();
}

// A newer invite to the same address replaces any still waiting to send.
async function enqueueInvites(
  tx: Tx,
  id: MeetingId,
  sequence: number,
  plans: readonly InvitePlan[],
  now: Date,
) {
  if (plans.length === 0) return;
  await tx
    .updateTable("meeting_invites")
    .set({
      queue_state: "done",
      error_code: "superseded",
      completed_at: now,
    })
    .where("meeting_id", "=", id)
    .where("queue_state", "in", ["pending", "processing"])
    .where(
      "recipient_email",
      "in",
      plans.map((plan) => plan.email),
    )
    .execute();
  await tx
    .insertInto("meeting_invites")
    .values(
      plans.map((plan) => ({
        id: newRowId(),
        meeting_id: id,
        recipient_email: plan.email,
        recipient_name: plan.name,
        method: plan.method,
        sequence,
        queue_state: "pending" as const,
        attempt_count: 0,
        max_attempts: 5,
        claimable_at: now,
        provider: null,
        provider_message_id: null,
        error_code: null,
        error_message: null,
        created_at: now,
        completed_at: null,
      })),
    )
    .execute();
}

export function createMeetingsRepo(db: Db) {
  return {
    async list(scope: MeetingScope): Promise<MeetingSummary[]> {
      let query = summaryQuery(db);
      if (!scope.viewAll) {
        query = query.where((eb) =>
          eb.or([
            eb("meetings.organizer_user_id", "=", scope.viewerUserId),
            eb.exists(
              eb
                .selectFrom("meeting_guests")
                .select("meeting_guests.meeting_id")
                .whereRef("meeting_guests.meeting_id", "=", "meetings.id")
                .where(
                  "meeting_guests.member_user_id",
                  "=",
                  scope.viewerUserId,
                ),
            ),
          ]),
        );
      }
      if (scope.organizationId) {
        query = query.where(
          "meetings.organization_id",
          "=",
          scope.organizationId,
        );
      }
      if (scope.caseId) {
        query = query.where("meetings.case_id", "=", scope.caseId);
      }
      const rows = await query
        .orderBy("meetings.starts_at", "desc")
        .limit(500)
        .execute();
      return rows.map(toSummary);
    },

    async find(id: MeetingId): Promise<MeetingRecord | null> {
      const row = await summaryQuery(db)
        .where("meetings.id", "=", id)
        .executeTakeFirst();
      if (!row) return null;
      return {
        ...toSummary(row),
        description: row.description,
        location: row.location,
        sequence: row.sequence,
        organizerEmail: row.organizer_email,
        videoExternalId: row.video_external_id,
        guests: await guestsOf(db, id),
      };
    },

    async members(userIds: readonly UserId[]): Promise<MemberContact[]> {
      if (userIds.length === 0) return [];
      const rows = await db
        .selectFrom("members")
        .select(["user_id", "email", "names", "first_surname"])
        .where("user_id", "in", userIds)
        .execute();
      return rows.map((row) => ({
        userId: row.user_id,
        email: row.email,
        name: memberName(row),
      }));
    },

    async activeMembers(): Promise<MemberContact[]> {
      const rows = await db
        .selectFrom("members")
        .select(["user_id", "email", "names", "first_surname"])
        .where("is_active", "=", true)
        .orderBy("names")
        .execute();
      return rows.map((row) => ({
        userId: row.user_id,
        email: row.email,
        name: memberName(row),
      }));
    },

    async companyContacts(
      organizationId: OrganizationId,
    ): Promise<{ email: string; name: string }[]> {
      const rows = await db
        .selectFrom("contacts")
        .innerJoin("people", "people.id", "contacts.person_id")
        .select([
          "contacts.email as contact_email",
          "people.email as person_email",
          "people.names",
          "people.first_surname",
        ])
        .where("contacts.organization_id", "=", organizationId)
        .execute();
      return rows.flatMap((row) => {
        const email = row.contact_email ?? row.person_email;
        if (!email) return [];
        const name = [row.names, row.first_surname].filter(Boolean).join(" ");
        return [{ email, name }];
      });
    },

    async exists(
      table: "organizations" | "cases",
      id: OrganizationId | CaseId,
    ): Promise<boolean> {
      const row = await db
        .selectFrom(table)
        .select("id")
        .where("id", "=", id)
        .executeTakeFirst();
      return row !== undefined;
    },

    async create(
      id: MeetingId,
      saved: SavedMeeting,
      organizerUserId: UserId,
      plans: readonly InvitePlan[],
      now: Date,
    ): Promise<void> {
      const { draft } = saved;
      await db.transaction().execute(async (tx) => {
        await tx
          .insertInto("meetings")
          .values({
            id,
            title: draft.title,
            description: draft.description,
            starts_at: draft.startsAt,
            ends_at: draft.endsAt,
            location: draft.location,
            video_provider: draft.videoProvider,
            video_link: draft.videoLink,
            video_external_id: saved.videoExternalId,
            organizer_user_id: organizerUserId,
            organization_id: draft.organizationId,
            case_id: draft.caseId,
            created_at: now,
            updated_at: now,
          })
          .execute();
        await insertGuests(tx, id, saved.attendees);
        await enqueueInvites(tx, id, 0, plans, now);
      });
    },

    async update(
      id: MeetingId,
      saved: SavedMeeting,
      sequence: number,
      plans: readonly InvitePlan[],
      now: Date,
    ): Promise<void> {
      const { draft } = saved;
      await db.transaction().execute(async (tx) => {
        await tx
          .updateTable("meetings")
          .set({
            title: draft.title,
            description: draft.description,
            starts_at: draft.startsAt,
            ends_at: draft.endsAt,
            location: draft.location,
            video_provider: draft.videoProvider,
            video_link: draft.videoLink,
            video_external_id: saved.videoExternalId,
            organization_id: draft.organizationId,
            case_id: draft.caseId,
            sequence,
            updated_at: now,
          })
          .where("id", "=", id)
          .execute();
        await tx
          .deleteFrom("meeting_guests")
          .where("meeting_id", "=", id)
          .execute();
        await insertGuests(tx, id, saved.attendees);
        await enqueueInvites(tx, id, sequence, plans, now);
      });
    },

    async cancel(
      id: MeetingId,
      sequence: number,
      plans: readonly InvitePlan[],
      now: Date,
    ): Promise<void> {
      await db.transaction().execute(async (tx) => {
        await tx
          .updateTable("meetings")
          .set({ status: "canceled", sequence, updated_at: now })
          .where("id", "=", id)
          .execute();
        await enqueueInvites(tx, id, sequence, plans, now);
      });
    },

    // Records a guest's answer to the invite at `sequence`. An answer to an
    // older version, or to a cancelled meeting, changes nothing.
    async recordResponse(
      id: MeetingId,
      email: string,
      response: MeetingGuestResponse,
      sequence: number,
      at: Date,
    ): Promise<boolean> {
      const result = await db
        .updateTable("meeting_guests")
        .set({ response, responded_at: at })
        .where("meeting_id", "=", id)
        .where("email", "=", email.toLowerCase())
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom("meetings")
              .select("meetings.id")
              .where("meetings.id", "=", id)
              .where("meetings.status", "=", "scheduled")
              .where("meetings.sequence", "<=", sequence),
          ),
        )
        .executeTakeFirst();
      return Number(result.numUpdatedRows) > 0;
    },
  };
}

export type MeetingsRepo = ReturnType<typeof createMeetingsRepo>;
