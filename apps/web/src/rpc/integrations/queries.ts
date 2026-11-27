import { query } from "@solidjs/router";

import { getWorkspaceIntegrations } from "~/server/integrations/ui/queries";

export const integrationsQuery = query(async () => {
  "use server";
  return getWorkspaceIntegrations();
}, "integrations.status");
