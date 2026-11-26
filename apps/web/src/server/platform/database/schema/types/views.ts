import type { ViewObject } from "~/contracts/views/views";

export interface ViewFieldsTable {
  object: ViewObject;
  field_key: string;
  position: number;
  width: number;
  visible: boolean;
}
