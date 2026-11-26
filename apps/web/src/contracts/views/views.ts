// Each case type is its own object with its own stage fields, so its view is
// keyed by the case type id.
export type ViewObject = "lead" | "company" | `case:${string}`;

const VIEW_OBJECT_PATTERN = /^(?:lead|company|case:[0-9a-f-]{36})$/;

export function isViewObject(value: string): value is ViewObject {
  return VIEW_OBJECT_PATTERN.test(value);
}

export function caseViewObject(caseTypeId: string): ViewObject {
  return `case:${caseTypeId}`;
}

export interface ViewFieldView {
  fieldKey: string;
  position: number;
  width: number;
  visible: boolean;
}

export const VIEW_FIELD_WIDTH = { min: 80, max: 800 } as const;
