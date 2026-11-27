import { createScriptedMessagingGateway } from "@tests/support/fakes/messaging-gateway";
import {
  cleanupTestDb,
  createIsolatedTestDb,
  resetTestDb,
  TEST_FIXTURES,
  type TestDbContext,
} from "@tests/support/runtime/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { HostedVideoProvider } from "~/contracts/meetings/views";
import type { MeetingId, WorkspaceId } from "~/domain/ids";
import { meetingUid } from "~/server/meetings/domain/ics";
import { createMeetingInviteQueue } from "~/server/meetings/invites/queue";
import {
  createMeetingsRuntime,
  type MeetingInput,
} from "~/server/meetings/runtime";
import type {
  VideoRoomHost,
  VideoRooms,
} from "~/server/meetings/video/video-rooms";

const ORGANIZER = TEST_FIXTURES.users.execOne.id;
const MEMBER = TEST_FIXTURES.users.backOne.id;
const WORKSPACE = TEST_FIXTURES.workspace.id as WorkspaceId;
const REPLY_TO = "reuniones@rising.sh";
const START = new Date("2026-12-01T15:00:00.000Z");
const END = new Date("2026-12-01T16:00:00.000Z");

// A Zoom account that records each call and can be told to refuse.
function fakeZoom() {
  const calls: string[] = [];
  let rooms = 0;
  let refuse = false;
  const host: VideoRoomHost = {
    async create() {
      if (refuse) throw new Error("zoom refused");
      rooms += 1;
      calls.push(`create:z${rooms}`);
      return { joinUrl: `https://zoom.us/j/${rooms}`, externalId: `z${rooms}` };
    },
    async update(externalId) {
      if (refuse) throw new Error("zoom refused");
      calls.push(`update:${externalId}`);
    },
    async remove(externalId) {
      calls.push(`remove:${externalId}`);
    },
  };
  const video: VideoRooms = {
    available: async () => ["zoom"],
    host: async (provider: HostedVideoProvider) =>
      provider === "zoom" ? host : null,
  };
  return {
    calls,
    video,
    refuse: () => {
      refuse = true;
    },
  };
}

function input(overrides: Partial<MeetingInput> = {}): MeetingInput {
  return {
    title: "Revisión semanal",
    description: "Avance; pendientes, riesgos",
    startsAt: START,
    endsAt: END,
    location: null,
    videoProvider: "link",
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

  function setup(video?: VideoRooms) {
    const fake = createScriptedMessagingGateway();
    const meetings = createMeetingsRuntime({ executor: ctx.db, video });
    const queue = createMeetingInviteQueue(ctx.db, fake.gateway, {
      workspaceId: WORKSPACE,
      replyTo: REPLY_TO,
    });
    return { fake, meetings, queue };
  }

  async function detail(
    meetings: ReturnType<typeof setup>["meetings"],
    meetingId: MeetingId,
  ) {
    const found = await meetings.detail(meetingId, {
      userId: ORGANIZER,
      viewAll: false,
    });
    if (!found.ok) throw new Error(JSON.stringify(found.error));
    return found.value;
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
    expect(ics.replace(/\r\n /g, "")).toContain(
      `UID:${meetingUid(WORKSPACE, meetingId)}\r\n`,
    );
    expect(ics.replace(/\r\n /g, "")).toContain(`:mailto:${REPLY_TO}\r\n`);
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

  it("opens a Zoom room before the save and mails its link", async () => {
    const zoom = fakeZoom();
    const { fake, meetings, queue } = setup(zoom.video);
    const created = await meetings.create(
      ORGANIZER,
      input({ videoProvider: "zoom", videoLink: "https://ignored.example" }),
    );
    if (!created.ok) throw new Error(JSON.stringify(created.error));
    await queue.drain();

    const saved = await detail(meetings, created.value.meetingId);
    expect(saved.videoProvider).toBe("zoom");
    expect(saved.videoLink).toBe("https://zoom.us/j/1");
    expect(zoom.calls).toEqual(["create:z1"]);
    expect(fake.meetingInvites[0]?.params.videoLink).toBe(
      "https://zoom.us/j/1",
    );
  });

  it("refuses a provider that is not connected and saves nothing", async () => {
    const { meetings } = setup();
    const created = await meetings.create(
      ORGANIZER,
      input({ videoProvider: "zoom" }),
    );
    expect(created.ok ? null : created.error.code).toBe(
      "meeting_video_unavailable",
    );
    const zoom = fakeZoom();
    zoom.refuse();
    const refused = await setup(zoom.video).meetings.create(
      ORGANIZER,
      input({ videoProvider: "zoom" }),
    );
    expect(refused.ok ? null : refused.error.code).toBe("meeting_video_failed");
    const listed = await setup().meetings.list({
      viewerUserId: ORGANIZER,
      viewAll: true,
    });
    expect(listed).toHaveLength(0);
  });

  it("moves the room on edit and removes it on a switch and on cancel", async () => {
    const zoom = fakeZoom();
    const { meetings } = setup(zoom.video);
    const created = await meetings.create(
      ORGANIZER,
      input({ videoProvider: "zoom" }),
    );
    if (!created.ok) throw new Error(JSON.stringify(created.error));
    const meetingId = created.value.meetingId;

    const moved = await meetings.update(
      ORGANIZER,
      meetingId,
      input({ videoProvider: "zoom", title: "Revisión movida" }),
    );
    expect(moved.ok).toBe(true);
    expect((await detail(meetings, meetingId)).videoLink).toBe(
      "https://zoom.us/j/1",
    );

    const switched = await meetings.update(ORGANIZER, meetingId, input());
    expect(switched.ok).toBe(true);
    const own = await detail(meetings, meetingId);
    expect(own.videoProvider).toBe("link");
    expect(own.videoLink).toBe("https://meet.google.com/abc-defg-hij");

    await meetings.update(
      ORGANIZER,
      meetingId,
      input({ videoProvider: "zoom" }),
    );
    expect((await meetings.cancel(ORGANIZER, meetingId)).ok).toBe(true);
    expect(zoom.calls).toEqual([
      "create:z1",
      "update:z1",
      "remove:z1",
      "create:z2",
      "remove:z2",
    ]);
  });

  it("records a guest's answer and ignores one to an older invite", async () => {
    const { meetings } = setup();
    const meetingId = await create(meetings);
    const answered = await meetings.receiveReply({
      meetingId,
      email: "Cliente@example.com",
      response: "accepted",
      sequence: 0,
    });
    expect(answered).toBe(true);
    const guest = (await detail(meetings, meetingId)).guests.find(
      (each) => each.email === "cliente@example.com",
    );
    expect(guest?.response).toBe("accepted");

    await meetings.update(ORGANIZER, meetingId, input({ title: "Otra" }));
    const stale = await meetings.receiveReply({
      meetingId,
      email: "cliente@example.com",
      response: "declined",
      sequence: 0,
    });
    expect(stale).toBe(false);

    await meetings.cancel(ORGANIZER, meetingId);
    const late = await meetings.receiveReply({
      meetingId,
      email: "cliente@example.com",
      response: "declined",
      sequence: 2,
    });
    expect(late).toBe(false);
  });
});
