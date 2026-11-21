import {
  isStoredModule,
  type WorkspaceModule,
} from "~/domain/auth/access/workspace-modules";
import type { WorkspaceExecutor } from "~/server/platform/database/executor";

// The modules this workspace runs. createWorkspace writes the one settings row;
// `cases` comes from the case processes the workspace defines.
export async function readWorkspaceModules(
  db: WorkspaceExecutor,
): Promise<WorkspaceModule[]> {
  const row = await db
    .selectFrom("workspace_settings")
    .select((eb) => [
      "modules",
      eb
        .exists(eb.selectFrom("case_types").select(eb.lit(1).as("one")))
        .as("has_case_process"),
    ])
    .where("id", "=", 1)
    .executeTakeFirstOrThrow();
  const stored: WorkspaceModule[] = row.modules.filter(isStoredModule);
  return row.has_case_process ? [...stored, "cases"] : stored;
}
