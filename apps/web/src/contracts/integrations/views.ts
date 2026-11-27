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

// An account the signed-in member connected for themselves.
export type MemberConnectionView = { label: string; connectedAt: number };

export type MemberConnectionsView = {
  google: MemberConnectionView | null;
};
