import { action } from "@solidjs/router";
import { respond } from "@solidjs/web";

import type { SavedView, ViewObject } from "~/contracts/views/views";
import { saveView } from "~/rpc/views/actions";
import { viewQuery } from "~/rpc/views/queries";

export const saveViewMutation = action(
  async (input: { object: ViewObject; view: SavedView }) =>
    respond(await saveView(input), {
      revalidate: viewQuery.keyFor(input.object),
    }),
  "saveView",
);
