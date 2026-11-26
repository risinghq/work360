// Migrations replay in order on every workspace, so this first column table
// stays even though WORKSPACE_SAVED_VIEWS drops it.
export const WORKSPACE_VIEWS: readonly string[] = [
  `create table view_fields (
    object text not null,
    field_key text not null,
    position integer not null,
    width integer not null,
    visible boolean not null,
    primary key (object, field_key)
  )`,
];

// One saved view per object, shared by the whole workspace as in Twenty. The
// view is read and saved whole, so its columns, sort and filter are one row.
// An object with no row shows the default the server seeds from the object
// registry, so adding a field needs no write.
export const WORKSPACE_SAVED_VIEWS: readonly string[] = [
  `drop table view_fields`,
  `create table saved_views (
    object text not null primary key,
    view_columns json not null,
    view_sort json,
    view_filter json
  )`,
];
