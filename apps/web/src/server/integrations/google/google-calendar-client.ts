import type {
  VideoRoom,
  VideoRoomHost,
  VideoRoomSpec,
} from "~/server/meetings/video/video-rooms";
import { isPlainRecord } from "~/shared/type-guards";

import type { FetchFn } from "../zoom/zoom-client";

// The OAuth client of the "teams-rising-sh" Google project. A member's refresh
// token opens their calendar only together with it.
export type GoogleApp = { clientId: string; clientSecret: string };

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const CALENDARS_URL = "https://www.googleapis.com/calendar/v3/calendars";
const CALENDAR_NAME = "work360";
const TIME_ZONE = "America/Lima";
// Renew a token this long before Google says it expires.
const TOKEN_MARGIN_MS = 60_000;

// `rejected` means Google answered and refused (a revoked grant, a deleted
// event); `unreachable` means no usable answer came back.
export class GoogleError extends Error {
  constructor(
    readonly reason: "rejected" | "unreachable",
    message: string,
  ) {
    super(message);
    this.name = "GoogleError";
  }
}

async function send(
  fetchFn: FetchFn,
  url: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetchFn(url, init);
  } catch (error) {
    throw new GoogleError(
      "unreachable",
      `Google request failed: ${String(error)}`,
    );
  }
}

async function readJson(
  response: Response,
  what: string,
): Promise<Record<string, unknown>> {
  const body: unknown = await response.json().catch(() => null);
  if (!isPlainRecord(body)) {
    throw new GoogleError("unreachable", `Google ${what}: no JSON object`);
  }
  return body;
}

function stringField(
  body: Record<string, unknown>,
  key: string,
  what: string,
): string {
  const value = body[key];
  if (typeof value !== "string") {
    throw new GoogleError("unreachable", `Google ${what}: no ${key}`);
  }
  return value;
}

async function expectOk(response: Response, what: string): Promise<void> {
  if (response.ok) return;
  const reason =
    response.status >= 400 && response.status < 500
      ? "rejected"
      : "unreachable";
  const detail = await response.text().catch(() => "");
  throw new GoogleError(
    reason,
    `Google ${what}: HTTP ${response.status} ${detail.slice(0, 200)}`,
  );
}

// The Meet link of an event Google created with a conference.
function meetLink(event: Record<string, unknown>): string | null {
  if (typeof event.hangoutLink === "string") return event.hangoutLink;
  const conference = event.conferenceData;
  if (!isPlainRecord(conference) || !Array.isArray(conference.entryPoints)) {
    return null;
  }
  for (const entry of conference.entryPoints) {
    if (
      isPlainRecord(entry) &&
      entry.entryPointType === "video" &&
      typeof entry.uri === "string"
    ) {
      return entry.uri;
    }
  }
  return null;
}

function eventTimes(spec: VideoRoomSpec) {
  return {
    summary: spec.title,
    description: spec.description,
    start: { dateTime: spec.startsAt.toISOString(), timeZone: TIME_ZONE },
    end: { dateTime: spec.endsAt.toISOString(), timeZone: TIME_ZONE },
  };
}

// A room's external id names the calendar and the event, because the calendar
// can be replaced after the room was made. Event ids never hold a "/".
function roomId(calendarId: string, eventId: string): string {
  return `${calendarId}/${eventId}`;
}

function eventUrl(externalId: string): string {
  const slash = externalId.lastIndexOf("/");
  const calendarId = externalId.slice(0, slash);
  const eventId = externalId.slice(slash + 1);
  return `${CALENDARS_URL}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
}

// Revokes a refresh token, and with it every token it minted.
export async function revokeGoogleToken(
  token: string,
  fetchFn: FetchFn = fetch,
): Promise<void> {
  const response = await send(fetchFn, REVOKE_URL, {
    method: "POST",
    body: new URLSearchParams({ token }),
  });
  // Google answers 400 for a token that is already revoked.
  if (response.status === 400) return;
  await expectOk(response, "revoke token");
}

// Hosts a member's Meet links as events in a "work360" calendar of their own
// Google account. The events have no guests: work360 sends the invitations.
export function createGoogleCalendarClient(deps: {
  app: GoogleApp;
  refreshToken: string;
  calendarId: string | null;
  // Stores the calendar the client created, so later rooms reuse it.
  saveCalendarId: (calendarId: string) => Promise<void>;
  fetch?: FetchFn;
}) {
  const fetchFn = deps.fetch ?? fetch;
  let calendarId = deps.calendarId;
  let token: { value: string; expiresAt: number } | null = null;

  async function accessToken(): Promise<string> {
    if (token && token.expiresAt > Date.now()) return token.value;
    const response = await send(fetchFn, TOKEN_URL, {
      method: "POST",
      body: new URLSearchParams({
        client_id: deps.app.clientId,
        client_secret: deps.app.clientSecret,
        refresh_token: deps.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    await expectOk(response, "token");
    const body = await readJson(response, "token");
    const expiresIn = body.expires_in;
    if (typeof expiresIn !== "number") {
      throw new GoogleError("unreachable", "Google token: no expires_in");
    }
    token = {
      value: stringField(body, "access_token", "token"),
      expiresAt: Date.now() + expiresIn * 1000 - TOKEN_MARGIN_MS,
    };
    return token.value;
  }

  async function api(
    method: string,
    url: string,
    body?: unknown,
  ): Promise<Response> {
    return send(fetchFn, url, {
      method,
      headers: {
        authorization: `Bearer ${await accessToken()}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async function createCalendar(): Promise<string> {
    const response = await api("POST", CALENDARS_URL, {
      summary: CALENDAR_NAME,
      timeZone: TIME_ZONE,
    });
    await expectOk(response, "create calendar");
    const id = stringField(
      await readJson(response, "create calendar"),
      "id",
      "create calendar",
    );
    await deps.saveCalendarId(id);
    calendarId = id;
    return id;
  }

  async function insertEvent(
    calendar: string,
    spec: VideoRoomSpec,
  ): Promise<Response> {
    const url = new URL(
      `${CALENDARS_URL}/${encodeURIComponent(calendar)}/events`,
    );
    url.searchParams.set("conferenceDataVersion", "1");
    url.searchParams.set("sendUpdates", "none");
    return api("POST", url.toString(), {
      ...eventTimes(spec),
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    });
  }

  const host: VideoRoomHost = {
    // A 404 means the member deleted the work360 calendar, and a 403 that the
    // current grant cannot reach it, so a new one is made once.
    async create(spec: VideoRoomSpec): Promise<VideoRoom> {
      const stored = calendarId;
      let calendar = stored ?? (await createCalendar());
      let response = await insertEvent(calendar, spec);
      if (stored && (response.status === 404 || response.status === 403)) {
        calendar = await createCalendar();
        response = await insertEvent(calendar, spec);
      }
      await expectOk(response, "create event");
      const event = await readJson(response, "create event");
      const externalId = roomId(
        calendar,
        stringField(event, "id", "create event"),
      );
      const joinUrl = meetLink(event);
      if (!joinUrl) {
        await host.remove(externalId).catch(() => undefined);
        throw new GoogleError("unreachable", "Google create event: no Meet");
      }
      return { joinUrl, externalId };
    },

    async update(externalId: string, spec: VideoRoomSpec): Promise<void> {
      const url = new URL(eventUrl(externalId));
      url.searchParams.set("sendUpdates", "none");
      await expectOk(
        await api("PATCH", url.toString(), eventTimes(spec)),
        "update event",
      );
    },

    async remove(externalId: string): Promise<void> {
      const response = await api("DELETE", eventUrl(externalId));
      // 410 is an event that was already deleted.
      if (response.status === 404 || response.status === 410) return;
      await expectOk(response, "delete event");
    },
  };

  return { host };
}
