import type { ViewFilterView, ViewSortView } from "~/contracts/views/views";

import { LEAD_WORKSPACE_FILTER_DEFAULT } from "./filter-query";
import { LEAD_WORKSPACE_SORT_DEFAULT, type LeadSortKey } from "./sort-query";

// The URL carries the lead list's sort and filter; the saved view supplies
// them when the URL has none. The list API calls the creator "registeredBy".
const SORT_PREFIX: Readonly<Record<string, string>> = {
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  createdBy: "registeredBy",
  ruc: "ruc",
};

const LEAD_SORT_KEYS: ReadonlySet<string> = new Set<LeadSortKey>([
  "createdAt_desc",
  "createdAt_asc",
  "updatedAt_desc",
  "updatedAt_asc",
  "registeredBy_asc",
  "registeredBy_desc",
  "ruc_asc",
  "ruc_desc",
]);

function isLeadSortKey(value: string): value is LeadSortKey {
  return LEAD_SORT_KEYS.has(value);
}

export function leadSortValue(sort: ViewSortView | null): LeadSortKey {
  const prefix = sort ? SORT_PREFIX[sort.fieldKey] : undefined;
  const value = prefix && sort ? `${prefix}_${sort.direction}` : "";
  return isLeadSortKey(value) ? value : LEAD_WORKSPACE_SORT_DEFAULT;
}

export function leadFilterValue(filter: ViewFilterView | null): string {
  if (filter?.operand === "isToday" && filter.fieldKey === "updatedAt") {
    return "updated_today";
  }
  if (
    filter?.operand === "is" &&
    (filter.fieldKey === "stage" || filter.fieldKey === "status")
  ) {
    return `${filter.fieldKey}:${filter.value}`;
  }
  return LEAD_WORKSPACE_FILTER_DEFAULT;
}

const SORT_FIELD: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(SORT_PREFIX).map(([fieldKey, prefix]) => [prefix, fieldKey]),
);

// The saved sort for a URL sort, so a member can save what the list shows.
export function leadViewSort(value: string): ViewSortView | null {
  const separator = value.lastIndexOf("_");
  const fieldKey = SORT_FIELD[value.slice(0, separator)];
  const direction = value.slice(separator + 1);
  if (!fieldKey || (direction !== "asc" && direction !== "desc")) return null;
  return { fieldKey, direction };
}

export function leadViewFilter(value: string): ViewFilterView | null {
  if (value === "updated_today") {
    return { fieldKey: "updatedAt", operand: "isToday", value: "" };
  }
  const [fieldKey, option] = value.split(":", 2);
  if ((fieldKey === "stage" || fieldKey === "status") && option) {
    return { fieldKey, operand: "is", value: option };
  }
  return null;
}
