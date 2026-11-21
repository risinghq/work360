# Database development

work360 keeps its state in SQLite stores. Development stores are disposable: a
schema change deletes them and the seed builds them again.

## Run with local stores

From the repository root:

```sh
bun run dev
```

The `dev` script of `apps/web` runs the seed, then starts the server. The seed
creates the stores under `apps/web/.local-storage/data` and fills them. It
verifies an installation that already exists and leaves it as it is.

`WEB_DATA_DIR` moves the stores to another directory. Production requires it.
See [Web configuration](web-configuration.md).

## Reset the stores

From the repository root:

```sh
bun run db:reset
```

The command deletes `apps/web/.local-storage/data` and runs the seed.

## Stores

Each store is one SQLite database with its own schema and migrations.

| Store             | File under the data directory | Holds                                                                       |
| ----------------- | ----------------------------- | --------------------------------------------------------------------------- |
| platform          | `platform.sqlite`             | workspaces, accounts, memberships, invites and sign-in state                |
| registry          | `registry.sqlite`             | the public company registry, shared by every workspace                      |
| one per workspace | `workspaces/<id>.sqlite`      | everything a workspace's members do: members, sessions, roles, records, ... |

A workspace's data is invisible to every other workspace because it lives in
another store. No table in a workspace store has a `workspace_id` column, so no
query there filters by workspace. A unique key such as a RUC or a DNI is unique
within one workspace.

The platform store knows which workspaces an account belongs to. Each
workspace's `members` row copies the account's name and avatar, so lists read
them without a trip to the platform store. Kapso posts every inbound WhatsApp
message to one webhook. `whatsapp_numbers` in the platform store maps the
receiving number to the workspace that takes the message.

No transaction spans two stores. A write that touches two stores, such as
accepting an invite, writes each store in its own transaction.

[`store.ts`](../apps/web/src/server/platform/database/store.ts) defines the
interface every store implements.
[`bun-store.ts`](../apps/web/src/server/platform/database/bun-store.ts) opens a
file or an in-memory database.
[`durable-object-store.ts`](../apps/web/src/server/platform/database/durable-object-store.ts)
adapts a SQLite Durable Object's storage.
[`open-store.ts`](../apps/web/src/server/platform/database/open-store.ts)
migrates a store and returns its Kysely instance.

## Change the schema

The migrations are lists of SQL statements:

- [`schema/platform.ts`](../apps/web/src/server/platform/database/schema/platform.ts)
- [`schema/registry.ts`](../apps/web/src/server/platform/database/schema/registry.ts)
- [`schema/workspace.ts`](../apps/web/src/server/platform/database/schema/workspace.ts),
  which joins the `schema/workspace-*.ts` files

Edit the statement, then the table's type in
[`schema/types`](../apps/web/src/server/platform/database/schema/types). Then
run `bun run db:reset`.

Each store counts the migrations it has run in its `schema_version` table.
Opening a store runs the pending migrations in one transaction
([`migrate.ts`](../apps/web/src/server/platform/database/migrate.ts)).

### Column types

The declared type of a column decides how a value reads back
([`codec.ts`](../apps/web/src/server/platform/database/codec.ts)):

| Declared type | Stored as     | Reads as     |
| ------------- | ------------- | ------------ |
| `timestamptz` | ISO-8601 text | `Date`       |
| `boolean`     | `0` or `1`    | `boolean`    |
| `json`        | JSON text     | parsed value |
| anything else | the value     | the value    |

Rows come back keyed by column name, so a column name has one kind in every
table of a store. Opening a store fails with `sqlite_column_kind_conflict` when
two tables disagree. A column computed by an expression is not decoded.

### Statement limits

A Durable Object refuses a statement with more than 100 bound parameters, or
longer than 100 KB. The local stores check the same limits, so a test fails
where production would, with `sqlite_too_many_bindings` or
`sqlite_statement_too_long`. Split a multi-row insert with `insertBatches` and
an `in (...)` list with `listBatches`, both in
[`batches.ts`](../apps/web/src/server/platform/database/batches.ts).

## Modules

`workspace_settings.modules` lists the product modules a workspace bought.

| Module     | Covers                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------- |
| `culqi`    | Culqi's lead workflow: records, sales, quotations, fulfillment, inventory and commissions |
| `contacts` | contact search, data-source imports and search capacity                                   |

`contacts` is separate because contact data is personal data under Ley 29733: a
workspace receives it only when its contract covers it. Campaigns, team and
administration need no module.

`cases` is not stored. A workspace has it while `case_types` holds a row,
because cases and their reports have nothing to show without a case process. A
workspace with no case process sees neither page in its menu and never lands on
one.

[`workspace-modules.ts`](../apps/web/src/domain/auth/access/workspace-modules.ts)
maps every permission to its module or to none. A member holds a permission when
the role grants it and the workspace has its module. The session carries the
modules, so the server's permission check, the route guard and the navigation
all apply the same rule. A server function that any role may call but only a
module may reach declares `access: { kind: "module", module }`. A route does the
same with `module` in the
[route manifest](../apps/web/src/domain/auth/access/route-manifest.ts). A member
lands on the first page the workspace and role allow.

## Roles

Each workspace owns its roles in `workspace_roles`. A role has a key, a name, a
kind and a permission list. The kind is one of the eight structural roles in
[`rbac.ts`](../apps/web/src/domain/auth/access/rbac.ts) and decides what code
reads from structure, such as which members carry an executive category. The
permissions decide what the role's members may do. A member's `role_id` names a
role, and `role` copies its kind. A foreign key on both columns keeps the copy
equal to the role's kind.

A new workspace starts with one baseline role per kind, with the kind's baseline
permissions. A workspace may add roles of its own: Entel adds `validador`, a
supervisor kind. `workspace_role_assignables` lists the roles each role's
members may invite or move users into. The admin and superuser kinds assign
every role but a superuser one, so they have no list.

A member with `role:manage` edits the roles at `/settings/members?tab=roles`.
The server applies these rules:

- An editor grants only permissions they hold. A permission outside the
  workspace's modules is not shown, and an edit keeps it as it was.
- A new role takes any kind but superuser. It starts with its kind's baseline
  permissions, narrowed to those the creator holds.
- The key is a slug of the name at creation and never changes, because case
  stages name their owner role by key.
- The admin and superuser baseline roles are locked: nobody edits or deletes
  them, so a workspace always keeps a role that can manage roles.
- A role with members, or that owns a case stage, cannot be deleted.
- An assignable role id must name a role of the workspace, or the change fails
  with `role_not_assignable`.

The session reads the role on every request, so an edit applies to its members'
next request.

## Test stores

The unit, contract and integration suites never touch the development stores.
[`tests/support/runtime/db.ts`](../apps/web/tests/support/runtime/db.ts) builds
migrated stores holding the test fixtures once per process and gives each test
an in-memory copy. A reset replaces the copy. The Playwright suite keeps its own
stores; see [End-to-end testing](e2e-testing.md).
