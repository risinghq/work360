import { createScriptedMessagingGateway } from "@tests/support/fakes/messaging-gateway";
import {
  cleanupTestDb,
  createIsolatedTestDb,
  resetTestDb,
  TEST_FIXTURES,
  type TestDbContext,
} from "@tests/support/runtime/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { MeetingId } from "~/domain/ids";
import { createMeetingInviteQueue } from "~/server/meetings/invites/queue";
import {
  createMeetingsRuntime,
  type MeetingInput,
} from "~/server/meetings/runtime";

const ORGANIZER = TEST_FIXTURES.users.execOne.id;
const MEMBER = TEST_FIXTURES.users.backOne.id;
const START = new Date("2026-12-01T15:00:00.000Z");
const END = new Date("2026-12-01T16:00:00.000Z");

function input(overrides: Partial<MeetingInput> = {}): MeetingInput {
  return {
    title: "Revisión semanal",
    description: "Avance; pendientes, riesgos",
    startsAt: START,
    endsAt: END,
    location: null,
    videoLink: "https://meet.google.com/abc-defg-hij",
    organizationId: TEST_FIXTURES.organizations.lima.id,
    caseId: null,
    guests: [
      { email: "ignored@example.com", name: null, memberUserId: MEMBER },
      { email: "Cliente@Example.com", name: "Cliente", memberUserId: null },
    ],
    ...overrides,
  };
}

describe("meeting invites", () => {
  let ctx: TestDbContext;

  beforeAll(async () => {
    ctx = await createIsolatedTestDb("meeting-invites");
  });

  afterAll(async () => {
    await cleanupTestDb(ctx);
  });

  beforeEach(async () => {
    await resetTestDb(ctx);
  });

  function setup() {
    const fake = createScriptedMessagingGateway();
    const meetings = createMeetingsRuntime({ executor: ctx.db });
    const queue = createMeetingInviteQueue(ctx.db, fake.gateway);
    return { fake, meetings, queue };
  }

  async function memberEmail(userId: typeof MEMBER) {
    const row = await ctx.db
      .selectFrom("members")
      .select("email")
      .where("user_id", "=", userId)
      .executeTakeFirstOrThrow();
    return row.email.toLowerCase();
  }

  async function create(meetings: ReturnType<typeof setup>["meetings"]) {
    const created = await meetings.create(ORGANIZER, input());
    if (!created.ok) throw new Error(JSON.stringify(created.error));
    return created.value.meetingId;
  }

  it("sends a REQUEST with the event to the organizer and every guest", async () => {
    const { fake, meetings, queue } = setup();
    const meetingId = await create(meetings);
    await queue.drain();

    const recipients = fake.meetingInvites.map((sent) => sent.to).toSorted();
    expect(recipients).toEqual(
      [
        await memberEmail(ORGANIZER),
        await memberEmail(MEMBER),
        "cliente@example.com",
      ].toSorted(),
    );
    const [first] = fake.meetingInvites;
    expect(first?.ics.method).toBe("REQUEST");
    const ics = first?.ics.content ?? "";
    expect(ics).toContain(`UID:${meetingId}@work360\r\n`);
    expect(ics).toContain("SEQUENCE:0\r\n");
    expect(ics).toContain("DTSTART:20261201T150000Z\r\n");
    expect(ics).toContain("DESCRIPTION:Avance\\; pendientes\\, riesgos\r\n");
    expect(ics).toContain("mailto:cliente@example.com");
    expect(first?.params.videoLink).toBe(
      "https://meet.google.com/abc-defg-hij",
    );
  });

  it("updates the remaining guests and cancels the removed one", async () => {
    const { fake, meetings, queue } = setup();
    const meetingId = await create(meetings);
    await queue.drain();
    fake.meetingInvites.length = 0;

    const updated = await meetings.update(
      ORGANIZER,
      meetingId,
      input({
        guests: [{ email: "x@example.com", name: null, memberUserId: MEMBER }],
      }),
    );
    expect(updated.ok).toBe(true);
    await queue.drain();

    const byRecipient = new Map(
      fake.meetingInvites.map((sent) => [sent.to, sent]),
    );
    const removed = byRecipient.get("cliente@example.com");
    expect(removed?.ics.method).toBe("CANCEL");
    expect(removed?.ics.content).toContain("SEQUENCE:1\r\n");
    expect(removed?.ics.content).toContain("STATUS:CANCELLED\r\n");
    const kept = byRecipient.get(await memberEmail(MEMBER));
    expect(kept?.ics.method).toBe("REQUEST");
    expect(kept?.ics.content).toContain("SEQUENCE:1\r\n");
    expect(kept?.ics.content).not.toContain("cliente@example.com");
    expect(fake.meetingInvites).toHaveLength(3);
  });

  it("sends only the latest invite when a change lands before the send", async () => {
    const { fake, meetings, queue } = setup();
    const meetingId = await create(meetings);
    await meetings.update(
      ORGANIZER,
      meetingId,
      input({ title: "Revisión movida" }),
    );
    await queue.drain();

    expect(fake.meetingInvites).toHaveLength(3);
    for (const sent of fake.meetingInvites) {
      expect(sent.ics.content).toContain("SEQUENCE:1\r\n");
      expect(sent.ics.content).toContain("SUMMARY:Revisión movida\r\n");
    }
  });

  it("cancels the meeting for everyone and refuses further changes", async () => {
    const { fake, meetings, queue } = setup();
    const meetingId = await create(meetings);
    await queue.drain();
    fake.meetingInvites.length = 0;

    expect((await meetings.cancel(ORGANIZER, meetingId)).ok).toBe(true);
    await queue.drain();

    expect(fake.meetingInvites).toHaveLength(3);
    for (const sent of fake.meetingInvites) {
      expect(sent.ics.method).toBe("CANCEL");
      expect(sent.ics.content).toContain("mailto:cliente@example.com");
    }
    const again = await meetings.update(ORGANIZER, meetingId, input());
    expect(again.ok ? null : again.error.code).toBe("meeting_canceled");
  });

  it("lets only the organizer change the meeting and hides it from others", async () => {
    const { meetings } = setup();
    const meetingId: MeetingId = await create(meetings);
    const guestEdit = await meetings.update(MEMBER, meetingId, input());
    expect(guestEdit.ok ? null : guestEdit.error.code).toBe(
      "meeting_not_organizer",
    );

    const outsider = TEST_FIXTURES.users.execTwo.id;
    const seen = await meetings.detail(meetingId, {
      userId: outsider,
      viewAll: false,
    });
    expect(seen.ok).toBe(false);
    const listed = await meetings.list({
      viewerUserId: MEMBER,
      viewAll: false,
    });
    expect(listed.map((meeting) => meeting.id)).toEqual([meetingId]);
  });

  it("rejects an end before the start and a non-https link", async () => {
    const { meetings } = setup();
    const backwards = await meetings.create(
      ORGANIZER,
      input({ endsAt: new Date(START.getTime() - 60_000) }),
    );
    expect(backwards.ok ? null : backwards.error.code).toBe(
      "meeting_time_invalid",
    );
    const link = await meetings.create(
      ORGANIZER,
      input({ videoLink: "javascript:alert(1)" }),
    );
    expect(link.ok ? null : link.error.code).toBe("meeting_link_invalid");
  });
});
