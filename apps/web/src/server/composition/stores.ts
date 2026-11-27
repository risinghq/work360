import type { WorkspaceId } from "~/domain/ids";
import { createSunatScraperClient } from "~/server/client-search/enrichment/sunat/client";
import { createCompanyRegistry } from "~/server/client-search/registry";
import { createDefaultEngineClient } from "~/server/integrations/engine/client";
import { createNotificationMessaging } from "~/server/notifications/runtime";
import { createOrganizationEnrichment } from "~/server/organization/enrichment";
import {
  appConfig,
  engineConfig,
  googleOAuthConfig,
  integrationsConfig,
  meetingsConfig,
  notificationsConfig,
} from "~/server/platform/config/env";
import {
  openPlatformStore,
  openRegistryStore,
  openWorkspaceStore,
} from "~/server/platform/database/open-store";
import {
  workspaceStoreName,
  type StoreOpener,
} from "~/server/platform/database/store";
import {
  AVATAR_BLOBS,
  workspaceBlobsName,
  type BlobOpener,
} from "~/server/platform/files/blob-store";
import type { WorkspaceInfrastructure } from "~/server/platform/infrastructure";
import { createLogger } from "~/shared/observability/runtime-logger";

import {
  createPlatformApplication,
  type WorkspacePorts,
} from "./platform-application";
import type { WorkspaceHostServices } from "./workspace-application";

// Each store composes on its own over its peers' ports. One process wires the
// ports as direct calls; a Durable Object wires them as `remote` calls.

export interface HostStorage {
  openStore: StoreOpener;
  openBlobs: BlobOpener;
}

export type WorkspacePeer = (
  workspaceId: WorkspaceId,
) => Promise<WorkspacePorts>;

// The clients every store shares, built from the environment.
export type HostServices = Omit<WorkspaceHostServices, "platform" | "registry">;

export function createHostServices(): HostServices {
  const engine = createDefaultEngineClient(engineConfig());
  const config = {
    app: appConfig(),
    notifications: notificationsConfig(),
    integrations: integrationsConfig(),
    googleOAuth: googleOAuthConfig(),
    meetings: meetingsConfig(),
  };
  return {
    config,
    messaging: createNotificationMessaging(config.notifications),
    engine,
    organizationEnrichment: createOrganizationEnrichment(engine),
  };
}

export async function composePlatform(
  { openStore, openBlobs }: HostStorage,
  services: HostServices,
  workspace: WorkspacePeer,
) {
  const store = await openPlatformStore(openStore("platform"));
  const application = createPlatformApplication(
    { db: store.db, logger: createLogger("platform") },
    {
      workspace,
      messaging: services.messaging,
      avatarStore: openBlobs(AVATAR_BLOBS),
      notifications: services.config.notifications,
    },
  );
  return { store, application };
}

export async function composeRegistry(
  openStore: StoreOpener,
  services: HostServices,
  workspace: WorkspacePeer,
) {
  const store = await openRegistryStore(openStore("registry"));
  const registry = createCompanyRegistry({
    db: store.db,
    scraper: createSunatScraperClient(),
    engineFallback: (ruc) => services.organizationEnrichment.enrichByRuc(ruc),
    sink: {
      async project(workspaceId, projection) {
        await (await workspace(workspaceId)).applyEnrichment(projection);
      },
      async publish(workspaceId, status) {
        await (await workspace(workspaceId)).publishEnrichment(status);
      },
    },
  });
  return { store, registry };
}

export async function openWorkspaceInfrastructure(
  { openStore, openBlobs }: HostStorage,
  workspaceId: WorkspaceId,
): Promise<WorkspaceInfrastructure> {
  const { db, effects } = await openWorkspaceStore(
    openStore(workspaceStoreName(workspaceId)),
  );
  return {
    workspaceId,
    db,
    effects,
    blobs: openBlobs(workspaceBlobsName(workspaceId)),
    logger: createLogger(`workspace:${workspaceId}`),
  };
}
