// A meeting a member schedules, its guests and the email invites that carry
// its calendar file. `sequence` is the iCalendar SEQUENCE: each change that a
// guest's calendar must apply raises it, and an invite queued for an older
// sequence is dropped instead of sent.
export const WORKSPACE_MEETINGS: readonly string[] = [
  `create table meetings (
    id uuid primary key not null,
    title text not null,
    description text not null default '',
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    location text,
    video_link text,
    organizer_user_id uuid not null references members(user_id),
    organization_id uuid references organizations(id),
    case_id uuid references cases(id),
    status text not null default 'scheduled' check (status in ('scheduled', 'canceled')),
    sequence integer not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create index idx_meetings_starts on meetings (starts_at)`,
  `create index idx_meetings_organizer on meetings (organizer_user_id, starts_at)`,
  `create index idx_meetings_organization on meetings (organization_id, starts_at) where organization_id is not null`,
  `create index idx_meetings_case on meetings (case_id, starts_at) where case_id is not null`,

  // A guest is a member of the workspace or an outside address, such as a
  // client's contact. The email is the guest's identity in the calendar file.
  `create table meeting_guests (
    meeting_id uuid not null references meetings(id) on delete cascade,
    email text not null,
    name text,
    member_user_id uuid references members(user_id),
    primary key (meeting_id, email)
  )`,
  `create index idx_meeting_guests_member on meeting_guests (member_user_id) where member_user_id is not null`,

  `create table meeting_invites (
    id uuid primary key not null,
    meeting_id uuid not null references meetings(id) on delete cascade,
    recipient_email text not null,
    recipient_name text,
    method text not null check (method in ('request', 'cancel')),
    sequence integer not null,
    queue_state text not null default 'pending',
    attempt_count integer not null default 0,
    max_attempts integer not null default 5,
    claimable_at timestamptz not null,
    provider text,
    provider_message_id text,
    error_code text,
    error_message text,
    created_at timestamptz not null,
    completed_at timestamptz
  )`,
  `create index idx_meeting_invites_claim on meeting_invites (claimable_at) where queue_state in ('pending', 'processing')`,
  `create index idx_meeting_invites_meeting on meeting_invites (meeting_id, recipient_email)`,

  // Roles are stored per workspace, so the new permissions are granted to the
  // roles that already exist, by the kind the baseline grants them to.
  `update workspace_roles
    set permissions = json_insert(permissions, '$[#]', 'meeting:schedule')
    where kind in ('executive', 'supervisor', 'sales_manager', 'hr', 'admin', 'superuser')
      and not exists (select 1 from json_each(workspace_roles.permissions) where value = 'meeting:schedule')`,
  `update workspace_roles
    set permissions = json_insert(permissions, '$[#]', 'meeting:view:all')
    where kind in ('admin', 'superuser')
      and not exists (select 1 from json_each(workspace_roles.permissions) where value = 'meeting:view:all')`,
];
