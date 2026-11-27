import { query } from "@solidjs/router";

import {
  getMyConnections,
  getWorkspaceIntegrations,
} from "~/server/integrations/ui/queries";

export const integrationsQuery = query(async () => {
  "use server";
  return getWorkspaceIntegrations();
}, "integrations.status");

export const myConnectionsQuery = query(async () => {
  "use server";
  return getMyConnections();
}, "integrations.my_connections");
