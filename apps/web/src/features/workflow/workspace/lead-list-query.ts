import type { ListLeadsFiltersInput } from "~/contracts/workflow/inputs";

import {
  LEAD_WORKSPACE_FILTER_DEFAULT,
  resolveLeadWorkspaceFilterQuery,
} from "./filter-query";
import {
  LEAD_WORKSPACE_SORT_DEFAULT,
  resolveLeadWorkspaceSortQuery,
} from "./sort-query";
import {
  defaultViewIdForRole,
  resolveWorkspaceView,
  viewsForRole,
  type ViewMember,
} from "./views";

// Twenty's DEFAULT_QUERY_PAGE_SIZE: the grid loads this many more on scroll.
export const LEAD_PAGE_SIZE = 30;

// Keep raw route inputs un-defaulted so every caller resolves the same cache key.
type LeadListQueryParams = {
  view: string | undefined;
  filter: string | undefined;
  sort: string | undefined;
  search: string | undefined;
};

// Explicit URL filters override the selected view's defaults. The input asks
// for the first page; the grid moves `offset` as it loads more.
export function resolveLeadListQueryInput(
  params: LeadListQueryParams,
  user: ViewMember & { id: string },
): ListLeadsFiltersInput {
  const activeView = resolveWorkspaceView(
    viewsForRole(user),
    defaultViewIdForRole(user),
    params.view,
  );

  return {
    ...activeView.filters(user.id),
    ...resolveLeadWorkspaceFilterQuery(
      params.filter ?? LEAD_WORKSPACE_FILTER_DEFAULT,
    ),
    ...resolveLeadWorkspaceSortQuery(
      params.sort ?? LEAD_WORKSPACE_SORT_DEFAULT,
    ),
    anyFieldSearch: params.search?.trim() || undefined,
    limit: LEAD_PAGE_SIZE,
    offset: 0,
  };
}
