// A connected account. `label` names it as the provider does (the Zoom
// account's email); `connectedAt` is epoch milliseconds.
export type IntegrationConnectionView = {
  label: string;
  connectedAt: number;
  connectedByName: string;
};

export type WorkspaceIntegrationsView = {
  zoom: IntegrationConnectionView | null;
};
