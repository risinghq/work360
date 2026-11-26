import {
  OBJECTS,
  caseStageField,
  type FieldMetadata,
} from "~/contracts/objects/registry";
import {
  viewObjectName,
  type SavedView,
  type ViewObject,
} from "~/contracts/views/views";
import { invalid, type DomainError } from "~/domain/errors";
import { Err, Ok, type Result } from "~/shared/result";

import type { CaseStage } from "./default-views";

function viewFields(
  object: ViewObject,
  caseStages: ReadonlyArray<CaseStage>,
): Map<string, FieldMetadata> {
  const name = viewObjectName(object);
  const fields: ReadonlyArray<FieldMetadata> = [
    ...OBJECTS[name].fields,
    ...(name === "case" ? caseStages.map(caseStageField) : []),
  ];
  return new Map(fields.map((field) => [field.key, field]));
}

function rejected(code: string, fieldKey: string): Result<never, DomainError> {
  return Err(invalid({ code, details: { fieldKey } }));
}

// A saved view names only the object's fields, each once. The field that
// names the record stays first and visible, as the grid pins it.
export function normalizeView(
  object: ViewObject,
  view: SavedView,
  caseStages: ReadonlyArray<CaseStage>,
): Result<SavedView, DomainError> {
  const known = viewFields(object, caseStages);
  const seen = new Set<string>();
  for (const field of view.fields) {
    if (!known.has(field.fieldKey))
      return rejected("unknown_view_field", field.fieldKey);
    if (seen.has(field.fieldKey))
      return rejected("duplicate_view_field", field.fieldKey);
    seen.add(field.fieldKey);
  }

  const identifier = OBJECTS[viewObjectName(object)].labelIdentifier;
  if (!seen.has(identifier)) return rejected("missing_view_field", identifier);

  if (view.sort && !known.has(view.sort.fieldKey))
    return rejected("unknown_view_sort", view.sort.fieldKey);

  if (view.filter) {
    const field = known.get(view.filter.fieldKey);
    const fits =
      view.filter.operand === "is"
        ? field?.type === "SELECT" && view.filter.value !== ""
        : field?.type === "DATE_TIME";
    if (!fits) return rejected("invalid_view_filter", view.filter.fieldKey);
  }

  const ordered = view.fields.toSorted((a, b) =>
    a.fieldKey === identifier
      ? -1
      : b.fieldKey === identifier
        ? 1
        : a.position - b.position,
  );
  return Ok({
    fields: ordered.map((field, position) => ({
      fieldKey: field.fieldKey,
      position,
      width: field.width,
      visible: field.fieldKey === identifier || field.visible,
    })),
    sort: view.sort,
    filter: view.filter,
  });
}
