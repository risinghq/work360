import { type RouteDefinition } from "@solidjs/router";

import {
  parseLeadPageIndex,
  resolveLeadListQueryInput,
} from "~/features/workflow/workspace/lead-list-query";
import { LeadsWorkspace } from "~/features/workflow/workspace/leads-workspace";
import {
  leadFilterValue,
  leadSortValue,
} from "~/features/workflow/workspace/saved-view-query";
import { meQuery } from "~/rpc/auth/me";
import { viewQuery } from "~/rpc/views/queries";
import { leadListQuery } from "~/rpc/workflow/lead-list";

// Shared input normalization makes the preload warm the workspace query key.
export const route = {
  preload: async ({ location }) => {
    const user = await meQuery();
    if (!user) {
      return;
    }
    const savedView = await viewQuery("lead");

    void leadListQuery(
      resolveLeadListQueryInput(
        {
          view: firstQueryValue(location.query.view),
          filter:
            firstQueryValue(location.query.filter) ??
            leadFilterValue(savedView.filter),
          sort:
            firstQueryValue(location.query.sort) ??
            leadSortValue(savedView.sort),
          search: firstQueryValue(location.query.query),
          pageIndex: parseLeadPageIndex(firstQueryValue(location.query.page)),
        },
        user,
      ),
    );
  },
} satisfies RouteDefinition;

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return undefined;
}

export default function RecordsPage() {
  return <LeadsWorkspace />;
}
