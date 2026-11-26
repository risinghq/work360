import {
  VIEW_FIELD_WIDTH,
  VIEW_FILTER_OPERANDS,
  VIEW_SORT_DIRECTIONS,
} from "~/contracts/views/views";
import { requireViewObject } from "~/rpc/views/input";
import { getApplication } from "~/server/composition/application";
import { executeSessionServerFunction } from "~/server/platform/action";
import {
  parseObject,
  validationFail,
} from "~/server/platform/action/input-reader";

export async function saveView(input: unknown): Promise<null> {
  "use server";

  return executeSessionServerFunction({
    name: "views.save",
    access: { kind: "permission", permission: "view:manage" },
    parse: () =>
      requireViewObject(
        parseObject(input, validationFail, (r) => ({
          object: r.str("object", { max: 60 }),
          view: r.obj("view", (view) => ({
            fields: view.list(
              "fields",
              (field) => ({
                fieldKey: field.str("fieldKey", { max: 100 }),
                position: field.numAtLeast("position", 0),
                width: Math.min(
                  VIEW_FIELD_WIDTH.max,
                  Math.round(field.numAtLeast("width", VIEW_FIELD_WIDTH.min)),
                ),
                visible: field.bool("visible"),
              }),
              { max: 100 },
            ),
            sort:
              view.optObj("sort", (sort) => ({
                fieldKey: sort.str("fieldKey", { max: 100 }),
                direction: sort.enum("direction", VIEW_SORT_DIRECTIONS),
              })) ?? null,
            filter:
              view.optObj("filter", (filter) => ({
                fieldKey: filter.str("fieldKey", { max: 100 }),
                operand: filter.enum("operand", VIEW_FILTER_OPERANDS),
                value: filter.optStr("value") ?? "",
              })) ?? null,
          })),
        })),
      ),
    execute: (_ctx, { object, view }) =>
      getApplication().views.save(object, view),
  });
}
