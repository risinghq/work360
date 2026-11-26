// The companies and people a workspace sells to, and the campaign lists that
// draw from them.
export const WORKSPACE_RECORDS: readonly string[] = [
  `create table people (
    id uuid primary key not null,
    dni text not null unique,
    names text not null,
    first_surname text,
    second_surname text,
    email text,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,

  // seq is the row's integer key, which the search index points at. An
  // implicit rowid may change on VACUUM; a declared one never does.
  `create table organizations (
    seq integer primary key,
    id uuid not null unique,
    ruc text not null unique,
    legal_name text,
    line_of_business text,
    address text,
    district text,
    province text,
    department text,
    phone text,
    email text,
    created_at timestamptz not null
  )`,
  `create index idx_organizations_name on organizations (legal_name, ruc)`,

  // A trigram index answers legal_name LIKE '%text%' for three or more
  // characters, so a name search reads the matches instead of every company.
  `create virtual table organizations_search using fts5(
    legal_name,
    content = 'organizations',
    content_rowid = 'seq',
    tokenize = 'trigram'
  )`,
  `create trigger organizations_search_insert after insert on organizations begin
    insert into organizations_search (rowid, legal_name) values (new.seq, new.legal_name);
  end`,
  `create trigger organizations_search_delete after delete on organizations begin
    insert into organizations_search (organizations_search, rowid, legal_name)
      values ('delete', old.seq, old.legal_name);
  end`,
  `create trigger organizations_search_update after update of legal_name on organizations begin
    insert into organizations_search (organizations_search, rowid, legal_name)
      values ('delete', old.seq, old.legal_name);
    insert into organizations_search (rowid, legal_name) values (new.seq, new.legal_name);
  end`,

  `create table organization_ownerships (
    id uuid primary key not null,
    organization_id uuid not null references organizations(id) on delete cascade,
    executive_id uuid not null references members(user_id),
    valid_from timestamptz not null,
    valid_until timestamptz,
    assigned_by uuid not null references members(user_id),
    reason text,
    created_at timestamptz not null,
    check (valid_until is null or valid_until > valid_from)
  )`,
  `create unique index idx_organization_ownerships_current on organization_ownerships (organization_id) where valid_until is null`,
  `create index idx_organization_ownerships_executive on organization_ownerships (executive_id, valid_until)`,
  `create index idx_organization_ownerships_history on organization_ownerships (organization_id, valid_from)`,
  `create view organization_current_owners as
    select organization_id, executive_id, valid_from as assigned_at
      from organization_ownerships
     where valid_until is null`,

  `create table contacts (
    id uuid primary key not null,
    person_id uuid not null references people(id) on delete cascade,
    organization_id uuid not null references organizations(id) on delete cascade,
    phone text,
    email text,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    unique (organization_id, person_id)
  )`,

  `create table contact_roles (
    id uuid primary key not null,
    contact_id uuid not null references contacts(id) on delete cascade,
    role text not null,
    is_primary boolean not null default 1,
    effective_from timestamptz not null,
    effective_to timestamptz
  )`,
  // A contact holds a role once at a time; ended roles stay as history.
  `create unique index idx_contact_roles_current on contact_roles (contact_id, role) where effective_to is null`,

  `create table contact_holds (
    id uuid primary key not null,
    user_id uuid not null references members(user_id),
    contact_id uuid not null references contacts(id),
    held_at timestamptz not null,
    expires_at timestamptz not null,
    status text not null
  )`,
  `create index idx_contact_holds_user on contact_holds (user_id, status)`,

  `create table contact_cadence (
    contact_id uuid primary key not null references contacts(id) on delete cascade,
    last_contacted_at timestamptz,
    last_contacted_by_user_id uuid references members(user_id),
    cooldown_until timestamptz
  )`,

  `create table campaigns (
    id uuid primary key not null,
    name text not null unique,
    created_at timestamptz not null
  )`,

  `create table campaign_records (
    id uuid primary key not null,
    campaign_id uuid not null references campaigns(id) on delete cascade,
    organization_id uuid not null references organizations(id),
    segment text not null,
    facts json not null,
    imported_at timestamptz not null,
    worked_at timestamptz,
    unique (campaign_id, organization_id, segment)
  )`,
  `create index idx_campaign_records_pool on campaign_records (campaign_id, segment, id) where worked_at is null`,
  `create index idx_campaign_records_organization on campaign_records (organization_id, imported_at)`,

  `create table campaign_holds (
    id uuid primary key not null,
    record_id uuid not null references campaign_records(id) on delete cascade,
    user_id uuid not null references members(user_id),
    held_at timestamptz not null,
    released_at timestamptz
  )`,
  `create unique index idx_campaign_holds_one_holder on campaign_holds (record_id) where released_at is null`,
  `create index idx_campaign_holds_holder on campaign_holds (user_id, released_at)`,
];

// The company list sorts the nameless companies after the named ones. Its
// order by repeats this expression so SQLite walks the index.
// organizations_count holds the row count, so the unfiltered list's total is
// one row read instead of a pass over every company. A store load inserts it
// after organizations, whose name sorts first, so the triggers find no row to
// change and the loaded count stands.
export const WORKSPACE_ORGANIZATIONS_LIST: readonly string[] = [
  `drop index idx_organizations_name`,
  `create index idx_organizations_name on organizations (legal_name is null, legal_name, ruc)`,
  `create table organizations_count (
    id integer primary key check (id = 1),
    n integer not null
  )`,
  `insert into organizations_count (id, n) select 1, count(*) from organizations`,
  `create trigger organizations_count_insert after insert on organizations begin
    update organizations_count set n = n + 1;
  end`,
  `create trigger organizations_count_delete after delete on organizations begin
    update organizations_count set n = n - 1;
  end`,
];
