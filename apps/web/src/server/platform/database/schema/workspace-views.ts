// A saved view's columns for one object, shared by the whole workspace as in
// Twenty. A field with no row here takes its default from the object's field
// registry in the browser, so adding a field to the registry needs no write.
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
