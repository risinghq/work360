import { describe, expect, it } from "vitest";

import {
  createZoomClient,
  ZoomError,
  type FetchFn,
} from "~/server/integrations/zoom/zoom-client";

const CREDENTIALS = { accountId: "acc", clientId: "cid", clientSecret: "sec" };
const SPEC = {
  title: "Revisión semanal",
  description: "Agenda",
  startsAt: new Date("2026-12-01T15:00:00.000Z"),
  endsAt: new Date("2026-12-01T16:30:00.000Z"),
};

type Call = { url: string; method: string; auth: string; body: unknown };

// Answers the token request, then each API call from `replies` in order.
function fakeZoom(replies: Response[]) {
  const calls: Call[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    calls.push({
      url,
      method: init?.method ?? "GET",
      auth: new Headers(init?.headers).get("authorization") ?? "",
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    });
    if (url.startsWith("https://zoom.us/oauth/token")) {
      return Response.json({ access_token: "tok", expires_in: 3600 });
    }
    const reply = replies.shift();
    if (!reply) throw new Error(`unexpected call ${url}`);
    return reply;
  };
  return { calls, fetchFn };
}

describe("createZoomClient", () => {
  it("mints one account token and creates a scheduled meeting", async () => {
    const zoom = fakeZoom([
      Response.json({ id: 8123, join_url: "https://zoom.us/j/8123" }),
      new Response(null, { status: 204 }),
    ]);
    const client = createZoomClient(CREDENTIALS, zoom.fetchFn);

    const room = await client.host.create(SPEC);
    await client.host.update(room.externalId, SPEC);

    expect(room).toEqual({
      joinUrl: "https://zoom.us/j/8123",
      externalId: "8123",
    });
    const [token, create, update] = zoom.calls;
    expect(token?.url).toBe(
      "https://zoom.us/oauth/token?grant_type=account_credentials&account_id=acc",
    );
    expect(token?.auth).toBe(`Basic ${btoa("cid:sec")}`);
    expect(create).toMatchObject({
      url: "https://api.zoom.us/v2/users/me/meetings",
      method: "POST",
      auth: "Bearer tok",
      body: {
        topic: "Revisión semanal",
        type: 2,
        start_time: "2026-12-01T15:00:00Z",
        duration: 90,
        settings: { join_before_host: true, waiting_room: false },
      },
    });
    expect(update).toMatchObject({
      url: "https://api.zoom.us/v2/meetings/8123",
      method: "PATCH",
    });
    expect(zoom.calls).toHaveLength(3);
  });

  it("treats a meeting Zoom no longer has as removed", async () => {
    const zoom = fakeZoom([new Response("gone", { status: 404 })]);
    const client = createZoomClient(CREDENTIALS, zoom.fetchFn);
    await expect(client.host.remove("8123")).resolves.toBeUndefined();
  });

  it("tells a refusal from an outage", async () => {
    const refused = createZoomClient(
      CREDENTIALS,
      fakeZoom([new Response("scope", { status: 403 })]).fetchFn,
    );
    await expect(refused.me()).rejects.toMatchObject({ reason: "rejected" });

    const down = createZoomClient(
      CREDENTIALS,
      fakeZoom([new Response("", { status: 503 })]).fetchFn,
    );
    const error = await down.host.create(SPEC).catch((caught) => caught);
    expect(error).toBeInstanceOf(ZoomError);
    expect(error.reason).toBe("unreachable");
  });
});
