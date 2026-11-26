export const VIEW_OBJECTS = ["lead", "company", "case"] as const;

export type ViewObject = (typeof VIEW_OBJECTS)[number];

export interface ViewFieldView {
  fieldKey: string;
  position: number;
  width: number;
  visible: boolean;
}

export const VIEW_FIELD_WIDTH = { min: 80, max: 800 } as const;
