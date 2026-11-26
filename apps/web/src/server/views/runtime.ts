import type { Kysely } from "kysely";

import type { ViewFieldView, ViewObject } from "~/contracts/views/views";
import type { WorkspaceDatabase } from "~/server/platform/database/types";

import { createViewFieldsRepo } from "./infrastructure/view-fields-repo";

export function createViewsRuntime(deps: {
  executor: Kysely<WorkspaceDatabase>;
}) {
  const repo = createViewFieldsRepo(deps.executor);
  return {
    listFields: (object: ViewObject) => repo.list(object),
    saveFields: (object: ViewObject, fields: readonly ViewFieldView[]) =>
      repo.replace(object, fields),
  };
}

export type ViewsRuntime = ReturnType<typeof createViewsRuntime>;
