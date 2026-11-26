import {
  OBJECTS,
  type FieldMetadata,
  type ObjectMetadata,
  type ObjectName,
} from "~/contracts/objects/registry";
import { formatAppDate } from "~/domain/time/app-time";

export type RecordFieldValue = {
  field: FieldMetadata;
  value: string | null;
};

export type RecordFieldGroup = {
  name: string;
  fields: ReadonlyArray<RecordFieldValue>;
};

export function fieldDisplayValue(
  field: FieldMetadata,
  value: unknown,
): string | null {
  if (field.type === "DATE_TIME" && typeof value === "number") {
    return formatAppDate(value);
  }
  return typeof value === "string" && value !== "" ? value : null;
}

export function recordFieldGroups(
  object: ObjectName,
  record: Readonly<Record<string, unknown>>,
): RecordFieldGroup[] {
  const metadata: ObjectMetadata = OBJECTS[object];
  const fields = new Map(metadata.fields.map((field) => [field.key, field]));
  return (metadata.fieldGroups ?? []).map((group) => ({
    name: group.name,
    fields: group.fields.flatMap((key) => {
      const field = fields.get(key);
      return field
        ? [{ field, value: fieldDisplayValue(field, record[key]) }]
        : [];
    }),
  }));
}
