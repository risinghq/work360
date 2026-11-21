import { describe, expect, it } from "vitest";

import { relaySentryEnvelope } from "~/server/platform/http/sentry-tunnel";

const DSN = "https://key@o123.ingest.us.sentry.io/456";

function envelope(dsn: string): Request {
  const body = [
    JSON.stringify({ dsn, sent_at: "2026-11-21T00:00:00.000Z" }),
    JSON.stringify({ type: "event" }),
    JSON.stringify({ message: "boom" }),
  ].join("\n");
  return new Request("https://work360.test/api/monitoring", {
    method: "POST",
    body,
  });
}

function recorder() {
  const sent: { url: string; body: string }[] = [];
  const send = async (url: string, init: RequestInit) => {
    sent.push({ url, body: await new Response(init.body).text() });
    return new Response('{"id":"1"}', { status: 200 });
  };
  return { sent, send };
}

describe("relaySentryEnvelope", () => {
  it("relays an envelope for our DSN to its project's ingest endpoint", async () => {
    const { sent, send } = recorder();
    const request = envelope(DSN);
    const body = await request.clone().text();

    const response = await relaySentryEnvelope(request, DSN, send);

    expect(response.status).toBe(200);
    expect(sent).toEqual([
      { url: "https://o123.ingest.us.sentry.io/api/456/envelope/", body },
    ]);
  });

  it("refuses an envelope that names another project", async () => {
    const { sent, send } = recorder();

    const otherProject = await relaySentryEnvelope(
      envelope("https://key@o123.ingest.us.sentry.io/999"),
      DSN,
      send,
    );
    const otherHost = await relaySentryEnvelope(
      envelope("https://key@evil.example/456"),
      DSN,
      send,
    );

    expect(otherProject.status).toBe(400);
    expect(otherHost.status).toBe(400);
    expect(sent).toEqual([]);
  });

  it("is absent when the build has no DSN", async () => {
    const { sent, send } = recorder();

    const response = await relaySentryEnvelope(envelope(DSN), "", send);

    expect(response.status).toBe(404);
    expect(sent).toEqual([]);
  });
});
