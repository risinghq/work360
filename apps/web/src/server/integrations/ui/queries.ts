import type {
  MemberConnectionsView,
  WorkspaceIntegrationsView,
} from "~/contracts/integrations/views";
import { getApplication } from "~/server/composition/application";
import { executeSessionServerFunction } from "~/server/platform/action";
import { Ok } from "~/shared/result";

export async function getWorkspaceIntegrations(): Promise<WorkspaceIntegrationsView> {
  return executeSessionServerFunction({
    name: "integrations.status",
    access: { kind: "permission", permission: "admin:manage" },
    execute: async () => {
      const { zoom } = await getApplication().integrations.status();
      return Ok({
        zoom: zoom
          ? {
              label: zoom.label,
              connectedAt: zoom.connectedAt.getTime(),
              connectedByName: zoom.connectedByName,
            }
          : null,
      });
    },
  });
}

export async function getMyConnections(): Promise<MemberConnectionsView> {
  return executeSessionServerFunction({
    name: "integrations.my_connections",
    access: { kind: "permission", permission: "meeting:video:host" },
    execute: async (ctx) => {
      const { google } = await getApplication().integrations.memberStatus(
        ctx.actor.userId,
      );
      return Ok({
        google: google
          ? { label: google.label, connectedAt: google.connectedAt.getTime() }
          : null,
      });
    },
  });
}
