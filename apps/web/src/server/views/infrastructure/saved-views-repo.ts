import type { Kysely } from "kysely";

import type { SavedView, ViewObject } from "~/contracts/views/views";
import type { WorkspaceDatabase } from "~/server/platform/database/types";

export function createSavedViewsRepo(db: Kysely<WorkspaceDatabase>) {
  return {
    async find(object: ViewObject): Promise<SavedView | null> {
      const row = await db
        .selectFrom("saved_views")
        .select(["view_columns", "view_sort", "view_filter"])
        .where("object", "=", object)
        .executeTakeFirst();
      return row
        ? {
            fields: row.view_columns,
            sort: row.view_sort,
            filter: row.view_filter,
          }
        : null;
    },

    async put(object: ViewObject, view: SavedView): Promise<void> {
      const values = {
        view_columns: view.fields,
        view_sort: view.sort,
        view_filter: view.filter,
      };
      await db
        .insertInto("saved_views")
        .values({ object, ...values })
        .onConflict((conflict) => conflict.column("object").doUpdateSet(values))
        .execute();
    },
  };
}
