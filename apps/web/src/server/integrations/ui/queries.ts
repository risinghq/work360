import type { WorkspaceIntegrationsView } from "~/contracts/integrations/views";
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
