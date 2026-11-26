import type { Kysely } from "kysely";

import type { ViewFieldView, ViewObject } from "~/contracts/views/views";
import type { WorkspaceDatabase } from "~/server/platform/database/types";

export function createViewFieldsRepo(db: Kysely<WorkspaceDatabase>) {
  return {
    async list(object: ViewObject): Promise<ViewFieldView[]> {
      const rows = await db
        .selectFrom("view_fields")
        .select(["field_key", "position", "width", "visible"])
        .where("object", "=", object)
        .orderBy("position")
        .execute();
      return rows.map((row) => ({
        fieldKey: row.field_key,
        position: row.position,
        width: row.width,
        visible: row.visible,
      }));
    },

    // The saved view is the whole column set, so a save replaces every row.
    async replace(
      object: ViewObject,
      fields: readonly ViewFieldView[],
    ): Promise<void> {
      await db.transaction().execute(async (trx) => {
        await trx
          .deleteFrom("view_fields")
          .where("object", "=", object)
          .execute();
        if (fields.length === 0) return;
        await trx
          .insertInto("view_fields")
          .values(
            fields.map((field) => ({
              object,
              field_key: field.fieldKey,
              position: field.position,
              width: field.width,
              visible: field.visible,
            })),
          )
          .execute();
      });
    },
  };
}
