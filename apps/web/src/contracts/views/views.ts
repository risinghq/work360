import type { ObjectName } from "~/contracts/objects/registry";

// Each case type is its own object with its own stage fields, so its view is
// keyed by the case type id.
export type ViewObject = "lead" | "company" | `case:${string}`;

const VIEW_OBJECT_PATTERN = /^(?:lead|company|case:[0-9a-f-]{36})$/;
const CASE_PREFIX = "case:";

export function isViewObject(value: string): value is ViewObject {
  return VIEW_OBJECT_PATTERN.test(value);
}

export function caseViewObject(caseTypeId: string): ViewObject {
  return `${CASE_PREFIX}${caseTypeId}`;
}

// The case type a case view belongs to, or null for any other object.
export function viewCaseTypeId(object: ViewObject): string | null {
  return object.startsWith(CASE_PREFIX)
    ? object.slice(CASE_PREFIX.length)
    : null;
}

export type ViewObjectName = Extract<ObjectName, "lead" | "company" | "case">;

export function viewObjectName(object: ViewObject): ViewObjectName {
  return object === "lead" || object === "company" ? object : "case";
}

export interface ViewFieldView {
  fieldKey: string;
  position: number;
  width: number;
  visible: boolean;
}

export const VIEW_SORT_DIRECTIONS = ["asc", "desc"] as const;
export type ViewSortDirection = (typeof VIEW_SORT_DIRECTIONS)[number];

export interface ViewSortView {
  fieldKey: string;
  direction: ViewSortDirection;
}

// Twenty's filter operands, limited to the ones these views offer: a select
// field equal to one option, and a date within the current day.
export const VIEW_FILTER_OPERANDS = ["is", "isToday"] as const;
export type ViewFilterOperand = (typeof VIEW_FILTER_OPERANDS)[number];

export interface ViewFilterView {
  fieldKey: string;
  operand: ViewFilterOperand;
  value: string;
}

// The workspace's view of one object, as Twenty's index view: its columns,
// and the sort and filter a member sees before choosing their own.
export interface SavedView {
  fields: ViewFieldView[];
  sort: ViewSortView | null;
  filter: ViewFilterView | null;
}

export const VIEW_FIELD_WIDTH = { min: 80, max: 800 } as const;
