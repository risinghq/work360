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

import {
  createZoomClient,
  parseZoomCredentials,
  ZoomError,
  type FetchFn,
  type ZoomCredentials,
} from "../zoom/zoom-client";
import { createIntegrationsRepo } from "./integrations-repo";

export type IntegrationStatus = {
  label: string;
  connectedAt: Date;
  connectedByName: string;
};

export function createIntegrationsRuntime(deps: {
  executor: Kysely<WorkspaceDatabase>;
  // INTEGRATIONS_ENCRYPTION_KEY; every sealed config opens only with it.
  keyMaterial: string;
  fetch?: FetchFn;
  now?: () => Date;
}) {
  const repo = createIntegrationsRepo(deps.executor);
  const now = deps.now ?? (() => new Date());
  // The client keeps its access token, so one per sealed config is reused
  // across requests until the connection changes.
  let zoomHost: { sealed: string; host: VideoRoomHost } | null = null;

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

  const videoRooms: VideoRooms = {
    async available(): Promise<HostedVideoProvider[]> {
      return (await repo.find("zoom")) ? ["zoom"] : [];
    },
    async host(provider: HostedVideoProvider, _userId: UserId) {
      return provider === "zoom" ? openZoomHost() : null;
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
  };
}

export type IntegrationsRuntime = ReturnType<typeof createIntegrationsRuntime>;
