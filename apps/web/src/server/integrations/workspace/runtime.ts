import type { Kysely } from "kysely";

import type { HostedVideoProvider } from "~/contracts/meetings/views";
import { fail, type DomainError } from "~/domain/errors";
import type { UserId } from "~/domain/ids";
import type {
  VideoRoomHost,
  VideoRooms,
} from "~/server/meetings/video/video-rooms";
import { openSecret, sealSecret } from "~/server/platform/crypto/sealed-secret";
import type { WorkspaceDatabase } from "~/server/platform/database/types";
import { Err, Ok, type Result } from "~/shared/result";
import { isPlainRecord } from "~/shared/type-guards";

import {
  createGoogleCalendarClient,
  revokeGoogleToken,
  type GoogleApp,
} from "../google/google-calendar-client";
import {
  createZoomClient,
  parseZoomCredentials,
  ZoomError,
  type FetchFn,
  type ZoomCredentials,
} from "../zoom/zoom-client";
import { createIntegrationsRepo } from "./integrations-repo";
import { createMemberConnectionsRepo } from "./member-connections-repo";

export type IntegrationStatus = {
  label: string;
  connectedAt: Date;
  connectedByName: string;
};

export type MemberConnectionStatus = { label: string; connectedAt: Date };

// The refresh token a sealed Google connection holds, or null when the JSON
// does not carry one.
function parseGoogleConfig(json: string): string | null {
  const value: unknown = JSON.parse(json);
  return isPlainRecord(value) && typeof value.refreshToken === "string"
    ? value.refreshToken
    : null;
}

export function createIntegrationsRuntime(deps: {
  executor: Kysely<WorkspaceDatabase>;
  // INTEGRATIONS_ENCRYPTION_KEY; every sealed config opens only with it.
  keyMaterial: string;
  google: GoogleApp;
  fetch?: FetchFn;
  now?: () => Date;
}) {
  const repo = createIntegrationsRepo(deps.executor);
  const memberConnections = createMemberConnectionsRepo(deps.executor);
  const now = deps.now ?? (() => new Date());
  // A client keeps its access token, so one per sealed config is reused
  // across requests until the connection changes.
  let zoomHost: { sealed: string; host: VideoRoomHost } | null = null;
  const googleHosts = new Map<
    UserId,
    { sealed: string; host: VideoRoomHost }
  >();

  async function openZoomHost(): Promise<VideoRoomHost | null> {
    const row = await repo.find("zoom");
    if (!row) return null;
    if (zoomHost?.sealed !== row.sealedConfig) {
      const credentials = parseZoomCredentials(
        await openSecret(deps.keyMaterial, row.sealedConfig),
      );
      if (!credentials) return null;
      zoomHost = {
        sealed: row.sealedConfig,
        host: createZoomClient(credentials, deps.fetch).host,
      };
    }
    return zoomHost.host;
  }

  async function openGoogleHost(userId: UserId): Promise<VideoRoomHost | null> {
    const row = await memberConnections.find(userId, "google");
    if (!row) return null;
    const cached = googleHosts.get(userId);
    if (cached?.sealed === row.sealedConfig) return cached.host;
    const refreshToken = parseGoogleConfig(
      await openSecret(deps.keyMaterial, row.sealedConfig),
    );
    if (!refreshToken) return null;
    const { host } = createGoogleCalendarClient({
      app: deps.google,
      refreshToken,
      calendarId: row.calendarId,
      saveCalendarId: (calendarId) =>
        memberConnections.setCalendar(userId, "google", calendarId),
      fetch: deps.fetch,
    });
    googleHosts.set(userId, { sealed: row.sealedConfig, host });
    return host;
  }

  // Revokes the token a sealed Google connection holds. A failure leaves the
  // grant for the member to remove from their Google account.
  async function revokeGoogle(sealedConfig: string): Promise<void> {
    try {
      const refreshToken = parseGoogleConfig(
        await openSecret(deps.keyMaterial, sealedConfig),
      );
      if (refreshToken) await revokeGoogleToken(refreshToken, deps.fetch);
    } catch {
      // The connection is gone from work360 either way.
    }
  }

  // Zoom serves every member; Google Meet only a member who connected Google.
  const videoRooms: VideoRooms = {
    async available(userId: UserId): Promise<HostedVideoProvider[]> {
      const [zoom, google] = await Promise.all([
        repo.find("zoom"),
        memberConnections.find(userId, "google"),
      ]);
      const providers: HostedVideoProvider[] = [];
      if (zoom) providers.push("zoom");
      if (google) providers.push("google_meet");
      return providers;
    },
    async host(provider: HostedVideoProvider, userId: UserId) {
      if (provider === "zoom") return openZoomHost();
      if (provider === "google_meet") return openGoogleHost(userId);
      return null;
    },
  };

  return {
    videoRooms,

    async status(): Promise<{ zoom: IntegrationStatus | null }> {
      const row = await repo.find("zoom");
      return {
        zoom: row
          ? {
              label: row.label,
              connectedAt: row.connectedAt,
              connectedByName: row.connectedByName,
            }
          : null,
      };
    },

    // Proves the credentials against Zoom before it stores them.
    async connectZoom(
      actorUserId: UserId,
      credentials: ZoomCredentials,
    ): Promise<Result<{ label: string }, DomainError>> {
      let label: string;
      try {
        label = (await createZoomClient(credentials, deps.fetch).me()).email;
      } catch (error) {
        if (error instanceof ZoomError && error.reason === "rejected") {
          return Err(fail("integration_credentials_invalid", { cause: error }));
        }
        return Err(fail("integration_unreachable", { cause: error }));
      }
      await repo.save({
        provider: "zoom",
        sealedConfig: await sealSecret(
          deps.keyMaterial,
          JSON.stringify(credentials),
        ),
        label,
        connectedByUserId: actorUserId,
        connectedAt: now(),
      });
      return Ok({ label });
    },

    async disconnect(provider: "zoom"): Promise<void> {
      await repo.remove(provider);
    },

    async memberStatus(
      userId: UserId,
    ): Promise<{ google: MemberConnectionStatus | null }> {
      const row = await memberConnections.find(userId, "google");
      return {
        google: row ? { label: row.label, connectedAt: row.connectedAt } : null,
      };
    },

    // Stores the grant the member just gave. The token it replaces is not
    // revoked: Google revokes the whole grant, which may hold the new token.
    async connectGoogle(
      userId: UserId,
      grant: { email: string; refreshToken: string },
    ): Promise<void> {
      await memberConnections.save(userId, "google", {
        sealedConfig: await sealSecret(
          deps.keyMaterial,
          JSON.stringify({ refreshToken: grant.refreshToken }),
        ),
        label: grant.email,
        connectedAt: now(),
      });
    },

    async disconnectGoogle(userId: UserId): Promise<void> {
      const row = await memberConnections.find(userId, "google");
      if (!row) return;
      await memberConnections.remove(userId, "google");
      googleHosts.delete(userId);
      await revokeGoogle(row.sealedConfig);
    },
  };
}

export type IntegrationsRuntime = ReturnType<typeof createIntegrationsRuntime>;
