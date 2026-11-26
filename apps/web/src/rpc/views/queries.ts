import { query } from "@solidjs/router";

import {
  VIEW_OBJECTS,
  type ViewFieldView,
  type ViewObject,
} from "~/contracts/views/views";
import { getApplication } from "~/server/composition/application";
import { executeSessionServerFunction } from "~/server/platform/action";
import {
  parseObject,
  validationFail,
} from "~/server/platform/action/input-reader";
import { Ok } from "~/shared/result";

// Every member sees the workspace's saved view, so any session may read it.
export const viewFieldsQuery = query(
  async (object: ViewObject): Promise<ViewFieldView[]> => {
    "use server";
    return executeSessionServerFunction({
      name: "views.fields.list",
      access: { kind: "session" },
      parse: () =>
        parseObject({ object }, validationFail, (r) => ({
          object: r.enum("object", VIEW_OBJECTS),
        })),
      execute: async (_ctx, input) =>
        Ok(await getApplication().views.listFields(input.object)),
    });
  },
  "views.fields",
);
