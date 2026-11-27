import { describe, expect, it } from "vitest";

import {
  createGoogleCalendarClient,
  revokeGoogleToken,
} from "~/server/integrations/google/google-calendar-client";
import type { FetchFn } from "~/server/integrations/zoom/zoom-client";

const APP = { clientId: "cid", clientSecret: "sec" };
const SPEC = {
  title: "Revisión semanal",
  description: "Agenda",
  startsAt: new Date("2026-12-01T15:00:00.000Z"),
  endsAt: new Date("2026-12-01T16:30:00.000Z"),
};
const CALENDARS = "https://www.googleapis.com/calendar/v3/calendars";

type Call = { url: string; method: string; auth: string; body: unknown };

const answer400: FetchFn = async () => new Response("", { status: 400 });

// Answers each token request, then each API call from `replies` in order.
function fakeGoogle(replies: Response[]) {
  const calls: Call[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    const body = init?.body;
    calls.push({
      url,
      method: init?.method ?? "GET",
      auth: new Headers(init?.headers).get("authorization") ?? "",
      body:
        typeof body === "string"
          ? JSON.parse(body)
          : body instanceof URLSearchParams
            ? Object.fromEntries(body)
            : undefined,
    });
    if (url === "https://oauth2.googleapis.com/token") {
      return Response.json({ access_token: "tok", expires_in: 3600 });
    }
    const reply = replies.shift();
    if (!reply) throw new Error(`unexpected call ${url}`);
    return reply;
  };
  return { calls, fetchFn };
}

function client(
  google: ReturnType<typeof fakeGoogle>,
  calendarId: string | null,
) {
  const saved: string[] = [];
  const { host } = createGoogleCalendarClient({
    app: APP,
    refreshToken: "refresh",
    calendarId,
    saveCalendarId: async (id) => {
      saved.push(id);
    },
    fetch: google.fetchFn,
  });
  return { host, saved };
}

describe("createGoogleCalendarClient", () => {
  it("creates the work360 calendar once and a Meet event in it", async () => {
    const google = fakeGoogle([
      Response.json({ id: "cal@group" }),
      Response.json({ id: "ev1", hangoutLink: "https://meet.google.com/a" }),
      Response.json({ id: "ev2", hangoutLink: "https://meet.google.com/b" }),
    ]);
    const { host, saved } = client(google, null);

    const first = await host.create(SPEC);
    const second = await host.create(SPEC);

    expect(first).toEqual({
      joinUrl: "https://meet.google.com/a",
      externalId: "cal@group/ev1",
    });
    expect(second.externalId).toBe("cal@group/ev2");
    expect(saved).toEqual(["cal@group"]);
    const [token, calendar, event] = google.calls;
    expect(token?.body).toEqual({
      client_id: "cid",
      client_secret: "sec",
      refresh_token: "refresh",
      grant_type: "refresh_token",
    });
    expect(calendar).toMatchObject({
      url: CALENDARS,
      method: "POST",
      auth: "Bearer tok",
      body: { summary: "work360", timeZone: "America/Lima" },
    });
    expect(event).toMatchObject({
      url: `${CALENDARS}/cal%40group/events?conferenceDataVersion=1&sendUpdates=none`,
      method: "POST",
      body: {
        summary: "Revisión semanal",
        start: { dateTime: "2026-12-01T15:00:00.000Z" },
        conferenceData: {
          createRequest: { conferenceSolutionKey: { type: "hangoutsMeet" } },
        },
      },
    });
    // One token, one calendar, two events.
    expect(google.calls).toHaveLength(4);
  });

  it("replaces a stored calendar the member deleted", async () => {
    const google = fakeGoogle([
      new Response("not found", { status: 404 }),
      Response.json({ id: "new@group" }),
      Response.json({ id: "ev1", hangoutLink: "https://meet.google.com/a" }),
    ]);
    const { host, saved } = client(google, "old@group");

    const room = await host.create(SPEC);

    expect(room.externalId).toBe("new@group/ev1");
    expect(saved).toEqual(["new@group"]);
  });

  it("removes an event that came back without a Meet link", async () => {
    const google = fakeGoogle([
      Response.json({ id: "ev1" }),
      new Response(null, { status: 204 }),
    ]);
    const { host } = client(google, "cal@group");

    await expect(host.create(SPEC)).rejects.toThrow("no Meet");
    expect(google.calls.at(-1)).toMatchObject({
      url: `${CALENDARS}/cal%40group/events/ev1`,
      method: "DELETE",
    });
  });

  it("updates and removes the event the external id names", async () => {
    const google = fakeGoogle([
      Response.json({ id: "ev1" }),
      new Response("gone", { status: 410 }),
    ]);
    const { host } = client(google, "cal@group");

    await host.update("cal@group/ev1", SPEC);
    await host.remove("cal@group/ev1");

    expect(google.calls[1]).toMatchObject({
      url: `${CALENDARS}/cal%40group/events/ev1?sendUpdates=none`,
      method: "PATCH",
      body: { summary: "Revisión semanal" },
    });
    expect(google.calls[2]?.method).toBe("DELETE");
  });

  it("refuses a revoked grant", async () => {
    const { host } = createGoogleCalendarClient({
      app: APP,
      refreshToken: "refresh",
      calendarId: "cal@group",
      saveCalendarId: async () => undefined,
      fetch: answer400,
    });

    await expect(host.create(SPEC)).rejects.toMatchObject({
      reason: "rejected",
    });
  });
});

describe("revokeGoogleToken", () => {
  it("treats a token Google already revoked as revoked", async () => {
    await expect(
      revokeGoogleToken("refresh", answer400),
    ).resolves.toBeUndefined();
  });
});
