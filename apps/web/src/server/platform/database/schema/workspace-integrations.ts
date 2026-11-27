// A service the whole workspace connects once, such as a Zoom account that
// hosts every member's meetings. `sealed_config` holds the credentials,
// sealed with INTEGRATIONS_ENCRYPTION_KEY; `label` names the connected
// account for the settings page without opening the seal.
export const WORKSPACE_INTEGRATIONS: readonly string[] = [
  `create table workspace_integrations (
    provider text primary key not null check (provider in ('zoom')),
    sealed_config text not null,
    label text not null,
    connected_by_user_id uuid not null references members(user_id),
    connected_at timestamptz not null
  )`,
];
