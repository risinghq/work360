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

// An account one member connects for themselves, such as the Google account
// whose calendar gives their meetings a Meet link. `sealed_config` holds the
// refresh token, sealed with INTEGRATIONS_ENCRYPTION_KEY; `label` is the
// account's email. `calendar_id` is the calendar work360 created there, null
// until the first meeting needs one.
export const WORKSPACE_MEMBER_CONNECTIONS: readonly string[] = [
  `create table member_connections (
    user_id uuid not null references members(user_id),
    provider text not null check (provider in ('google')),
    sealed_config text not null,
    label text not null,
    calendar_id text,
    connected_at timestamptz not null,
    primary key (user_id, provider)
  )`,
];
