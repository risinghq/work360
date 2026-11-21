const PII_HEADER_SNIPPETS = ["forwarded", "-ip", "remote-", "via", "-user"];

// Content blockers drop requests to Sentry's ingest host, so the browser posts
// its envelopes to this same-origin path and the server relays them.
export const SENTRY_TUNNEL_PATH = "/api/monitoring";

export function sentryDefaultDataCollection() {
  return {
    userInfo: false,
    cookies: { deny: PII_HEADER_SNIPPETS },
    httpHeaders: {
      request: { deny: PII_HEADER_SNIPPETS },
      response: { deny: PII_HEADER_SNIPPETS },
    },
    httpBodies: [],
    queryParams: { deny: PII_HEADER_SNIPPETS },
    genAI: { inputs: false, outputs: false },
    stackFrameVariables: true,
    frameContextLines: 7,
  };
}
