import type {
  VideoRoom,
  VideoRoomHost,
  VideoRoomSpec,
} from "~/server/meetings/video/video-rooms";
import { isPlainRecord } from "~/shared/type-guards";

// A Zoom Server-to-Server OAuth app: the account id and the app's client
// credentials mint an hour-long account token.
export type ZoomCredentials = {
  accountId: string;
  clientId: string;
  clientSecret: string;
};

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

const TOKEN_URL = "https://zoom.us/oauth/token";
const API_URL = "https://api.zoom.us/v2";
const TOPIC_MAX = 200;
const AGENDA_MAX = 2000;
// Renew a token this long before Zoom says it expires.
const TOKEN_MARGIN_MS = 60_000;

// `rejected` means Zoom answered and refused (bad credentials, a missing
// scope); `unreachable` means no usable answer came back.
export class ZoomError extends Error {
  constructor(
    readonly reason: "rejected" | "unreachable",
    message: string,
  ) {
    super(message);
    this.name = "ZoomError";
  }
}

function meetingBody(spec: VideoRoomSpec) {
  const minutes = Math.max(
    1,
    Math.round((spec.endsAt.getTime() - spec.startsAt.getTime()) / 60_000),
  );
  return {
    topic: spec.title.slice(0, TOPIC_MAX),
    agenda: spec.description.slice(0, AGENDA_MAX),
    type: 2,
    start_time: spec.startsAt.toISOString().replace(/\.\d{3}Z$/, "Z"),
    duration: minutes,
    timezone: "America/Lima",
    // The room belongs to the workspace's Zoom account, not to the member who
    // organizes the meeting, so nobody present can start it as host. Guests
    // must be able to enter without one.
    settings: { join_before_host: true, jbh_time: 0, waiting_room: false },
  };
}

// The credentials a sealed connection holds, or null when the JSON is not
// three non-empty strings.
export function parseZoomCredentials(json: string): ZoomCredentials | null {
  const value: unknown = JSON.parse(json);
  if (!isPlainRecord(value)) return null;
  const { accountId, clientId, clientSecret } = value;
  return typeof accountId === "string" &&
    typeof clientId === "string" &&
    typeof clientSecret === "string"
    ? { accountId, clientId, clientSecret }
    : null;
}

async function readJson(
  response: Response,
  what: string,
): Promise<Record<string, unknown>> {
  const body: unknown = await response.json().catch(() => null);
  if (!isPlainRecord(body)) {
    throw new ZoomError("unreachable", `Zoom ${what}: no JSON object`);
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
    throw new ZoomError("unreachable", `Zoom ${what}: no ${key}`);
  }
  return value;
}

function numberField(
  body: Record<string, unknown>,
  key: string,
  what: string,
): number {
  const value = body[key];
  if (typeof value !== "number") {
    throw new ZoomError("unreachable", `Zoom ${what}: no ${key}`);
  }
  return value;
}

async function expectOk(
  response: Response,
  what: string,
  allow404 = false,
): Promise<void> {
  if (response.ok || (allow404 && response.status === 404)) return;
  const reason =
    response.status >= 400 && response.status < 500
      ? "rejected"
      : "unreachable";
  const detail = await response.text().catch(() => "");
  throw new ZoomError(
    reason,
    `Zoom ${what}: HTTP ${response.status} ${detail.slice(0, 200)}`,
  );
}

export function createZoomClient(
  credentials: ZoomCredentials,
  fetchFn: FetchFn = fetch,
) {
  let token: { value: string; expiresAt: number } | null = null;

  async function send(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetchFn(url, init);
    } catch (error) {
      throw new ZoomError(
        "unreachable",
        `Zoom request failed: ${String(error)}`,
      );
    }
  }

  async function accessToken(): Promise<string> {
    if (token && token.expiresAt > Date.now()) return token.value;
    const basic = btoa(`${credentials.clientId}:${credentials.clientSecret}`);
    const query = new URLSearchParams({
      grant_type: "account_credentials",
      account_id: credentials.accountId,
    });
    const response = await send(`${TOKEN_URL}?${query}`, {
      method: "POST",
      headers: { authorization: `Basic ${basic}` },
    });
    if (response.status >= 400 && response.status < 500) {
      throw new ZoomError("rejected", `Zoom token: HTTP ${response.status}`);
    }
    if (!response.ok) {
      throw new ZoomError("unreachable", `Zoom token: HTTP ${response.status}`);
    }
    const body = await readJson(response, "token");
    token = {
      value: stringField(body, "access_token", "token"),
      expiresAt:
        Date.now() +
        numberField(body, "expires_in", "token") * 1000 -
        TOKEN_MARGIN_MS,
    };
    return token.value;
  }

  async function api(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response> {
    const response = await send(`${API_URL}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await accessToken()}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return response;
  }

  const host: VideoRoomHost = {
    async create(spec: VideoRoomSpec): Promise<VideoRoom> {
      const response = await api(
        "POST",
        "/users/me/meetings",
        meetingBody(spec),
      );
      await expectOk(response, "create meeting");
      const created = await readJson(response, "create meeting");
      return {
        joinUrl: stringField(created, "join_url", "create meeting"),
        externalId: String(numberField(created, "id", "create meeting")),
      };
    },

    async update(externalId: string, spec: VideoRoomSpec): Promise<void> {
      const response = await api(
        "PATCH",
        `/meetings/${encodeURIComponent(externalId)}`,
        meetingBody(spec),
      );
      await expectOk(response, "update meeting");
    },

    async remove(externalId: string): Promise<void> {
      const response = await api(
        "DELETE",
        `/meetings/${encodeURIComponent(externalId)}`,
      );
      await expectOk(response, "delete meeting", true);
    },
  };

  return {
    host,
    // The account's user, which proves the credentials and names the account.
    async me(): Promise<{ email: string }> {
      const response = await api("GET", "/users/me");
      await expectOk(response, "read user");
      const user = await readJson(response, "read user");
      return { email: stringField(user, "email", "read user") };
    },
  };
}
