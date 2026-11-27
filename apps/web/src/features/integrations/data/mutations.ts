import { action } from "@solidjs/router";
import { respond } from "@solidjs/web";

import {
  connectZoom,
  disconnectGoogle,
  disconnectZoom,
} from "~/rpc/integrations/actions";
import {
  integrationsQuery,
  myConnectionsQuery,
} from "~/rpc/integrations/queries";
import { meetingVideoOptionsQuery } from "~/rpc/meetings/queries";

export type ZoomCredentialsInput = {
  accountId: string;
  clientId: string;
  clientSecret: string;
};

// The meeting form offers only connected providers, so it reloads too.
const revalidate = [integrationsQuery.key, meetingVideoOptionsQuery.key];

export const connectZoomMutation = action(
  async (input: ZoomCredentialsInput) =>
    respond(await connectZoom(input), { revalidate }),
  "connectZoom",
);

export const disconnectZoomMutation = action(
  async () => respond(await disconnectZoom(), { revalidate }),
  "disconnectZoom",
);

export const disconnectGoogleMutation = action(
  async () =>
    respond(await disconnectGoogle(), {
      revalidate: [myConnectionsQuery.key, meetingVideoOptionsQuery.key],
    }),
  "disconnectGoogle",
);
