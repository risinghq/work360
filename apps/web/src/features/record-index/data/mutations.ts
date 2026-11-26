import { action } from "@solidjs/router";
import { respond } from "@solidjs/web";

import type { ViewFieldView, ViewObject } from "~/contracts/views/views";
import { saveViewFields } from "~/rpc/views/actions";
import { viewFieldsQuery } from "~/rpc/views/queries";

export const saveViewFieldsMutation = action(
  async (input: { object: ViewObject; fields: ViewFieldView[] }) =>
    respond(await saveViewFields(input), {
      revalidate: viewFieldsQuery.keyFor(input.object),
    }),
  "saveViewFields",
);
