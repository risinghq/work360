import { VIEW_FIELD_WIDTH, VIEW_OBJECTS } from "~/contracts/views/views";
import { getApplication } from "~/server/composition/application";
import { executeSessionServerFunction } from "~/server/platform/action";
import {
  parseObject,
  validationFail,
} from "~/server/platform/action/input-reader";
import { Ok } from "~/shared/result";

export async function saveViewFields(input: unknown): Promise<null> {
  "use server";

  return executeSessionServerFunction({
    name: "views.fields.save",
    access: { kind: "permission", permission: "view:manage" },
    parse: () =>
      parseObject(input, validationFail, (r) => ({
        object: r.enum("object", VIEW_OBJECTS),
        fields: r.list(
          "fields",
          (field) => ({
            fieldKey: field.str("fieldKey"),
            position: field.numAtLeast("position", 0),
            width: Math.min(
              VIEW_FIELD_WIDTH.max,
              Math.round(field.numAtLeast("width", VIEW_FIELD_WIDTH.min)),
            ),
            visible: field.bool("visible"),
          }),
          { max: 100 },
        ),
      })),
    execute: async (_ctx, { object, fields }) => {
      await getApplication().views.saveFields(object, fields);
      return Ok(null);
    },
  });
}
