import type { Kysely } from "kysely";

import {
  BASELINE_ASSIGNABLE,
  BASELINE_PERMISSIONS,
  LOCKED_BASELINE_ROLES,
  ROLES,
  type Permission,
  type Role,
} from "~/domain/auth/access/rbac";
import { getRoleLabel } from "~/domain/auth/access/role-display";
import type { StoredModule } from "~/domain/auth/access/workspace-modules";
import { RoleId, type WorkspaceId } from "~/domain/ids";
import {
  BASELINE_OUTCOMES,
  type CatalogOutcome,
} from "~/server/activities/domain/outcome-seed";
import { createOutcomesRepo } from "~/server/activities/infrastructure/outcomes-repo";
import { insertBatches } from "~/server/platform/database/batches";
import type {
  PlatformDatabase,
  WorkspaceDatabase,
} from "~/server/platform/database/types";

// A role a workspace starts with. `assignedBy` lists the keys of the roles
// whose holders may assign it; the admin kinds assign it without being listed.
export interface RoleSeed {
  key: string;
  name: string;
  kind: Role;
  permissions: readonly Permission[];
  assignedBy?: readonly string[];
}

export interface NewWorkspace {
  id: WorkspaceId;
  name: string;
  modules: readonly StoredModule[];
  createdAt: Date;
  // Roles the workspace needs beyond the baseline, such as Entel's validador.
  extraRoles?: readonly RoleSeed[];
  // The outcome catalog it starts with; the baseline when absent.
  outcomes?: readonly CatalogOutcome[];
}

const BASELINE_ROLES: readonly RoleSeed[] = ROLES.map((kind) => ({
  key: kind,
  name: getRoleLabel(kind),
  kind,
  permissions: BASELINE_PERMISSIONS[kind],
  assignedBy: ROLES.filter((assigner) =>
    BASELINE_ASSIGNABLE[assigner]?.includes(kind),
  ),
}));

// Fills the new workspace's store with its settings, baseline roles and
// outcome catalog, then lists it on the platform. The store is complete before
// any account can be placed in it.
export async function createWorkspace(
  stores: {
    platform: Kysely<PlatformDatabase>;
    workspace: Kysely<WorkspaceDatabase>;
  },
  workspace: NewWorkspace,
): Promise<void> {
  await stores.workspace.transaction().execute(async (trx) => {
    await trx
      .insertInto("workspace_settings")
      .values({ id: 1, modules: [...workspace.modules] })
      .execute();
    await insertRoles(
      trx,
      [...BASELINE_ROLES, ...(workspace.extraRoles ?? [])],
      workspace.createdAt,
    );
    await createOutcomesRepo(trx).insertMany(
      workspace.outcomes ?? BASELINE_OUTCOMES,
      workspace.createdAt,
    );
  });
  await stores.platform
    .insertInto("workspaces")
    .values({
      id: workspace.id,
      name: workspace.name,
      created_at: workspace.createdAt,
    })
    .execute();
}

async function insertRoles(
  trx: Kysely<WorkspaceDatabase>,
  seeds: readonly RoleSeed[],
  at: Date,
): Promise<void> {
  const rows = await trx
    .insertInto("workspace_roles")
    .values(
      seeds.map((seed) => ({
        id: RoleId.mint(),
        key: seed.key,
        name: seed.name,
        kind: seed.kind,
        permissions: [...seed.permissions],
        locked: LOCKED_BASELINE_ROLES.some((kind) => kind === seed.key),
        created_at: at,
      })),
    )
    .returning(["id", "key"])
    .execute();
  const idOf = new Map(rows.map((row) => [row.key, row.id]));
  const assignables = seeds.flatMap((seed) =>
    (seed.assignedBy ?? []).flatMap((assignerKey) => {
      const assigner = idOf.get(assignerKey);
      const assignable = idOf.get(seed.key);
      return assigner === undefined || assignable === undefined
        ? []
        : [{ role_id: assigner, assignable_role_id: assignable }];
    }),
  );
  if (assignables.length > 0) {
    for (const batch of insertBatches(assignables)) {
      // eslint-disable-next-line no-await-in-loop
      await trx
        .insertInto("workspace_role_assignables")
        .values(batch)
        .execute();
    }
  }
}
