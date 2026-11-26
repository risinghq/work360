import type { Kysely } from "kysely";

import {
  viewCaseTypeId,
  type SavedView,
  type ViewObject,
} from "~/contracts/views/views";
import type { DomainError } from "~/domain/errors";
import type { WorkspaceDatabase } from "~/server/platform/database/types";
import { Ok, type Result } from "~/shared/result";

import { defaultView, type CaseStage } from "./domain/default-views";
import { normalizeView } from "./domain/validate-view";
import { createSavedViewsRepo } from "./infrastructure/saved-views-repo";

export function createViewsRuntime(deps: {
  executor: Kysely<WorkspaceDatabase>;
  // A case type's stages, in process order; none for an unknown case type.
  caseStages: (caseTypeId: string) => Promise<ReadonlyArray<CaseStage>>;
}) {
  const repo = createSavedViewsRepo(deps.executor);

  async function stagesOf(object: ViewObject) {
    const caseTypeId = viewCaseTypeId(object);
    return caseTypeId === null ? [] : deps.caseStages(caseTypeId);
  }

  return {
    async read(object: ViewObject): Promise<SavedView> {
      return (await repo.find(object)) ?? defaultView(object, await stagesOf(object));
    },
    async save(
      object: ViewObject,
      view: SavedView,
    ): Promise<Result<null, DomainError>> {
      const normalized = normalizeView(object, view, await stagesOf(object));
      if (!normalized.ok) return normalized;
      await repo.put(object, normalized.value);
      return Ok(null);
    },
  };
}

export type ViewsRuntime = ReturnType<typeof createViewsRuntime>;
