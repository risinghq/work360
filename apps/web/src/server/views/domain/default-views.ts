import { caseStageField, type FieldKey } from "~/contracts/objects/registry";
import {
  viewObjectName,
  type SavedView,
  type ViewObject,
} from "~/contracts/views/views";

// Twenty seeds each object's index view with the field that names the record
// first at 180 and most other fields at 150. A RUC is eleven digits, so it
// takes a narrower column.
const IDENTIFIER_WIDTH = 180;
const FIELD_WIDTH = 150;
const RUC_WIDTH = 120;

export type CaseStage = { key: string; name: string };

type SeedField = { key: string; width?: number };

const COMPANY_FIELDS: ReadonlyArray<{ key: FieldKey<"company">; width?: number }> = [
  { key: "legalName", width: IDENTIFIER_WIDTH },
  { key: "ruc", width: RUC_WIDTH },
  { key: "lineOfBusiness" },
  { key: "phone" },
  { key: "email", width: 200 },
  { key: "district" },
  { key: "province" },
  { key: "department" },
  { key: "createdAt" },
];

const LEAD_FIELDS: ReadonlyArray<{ key: FieldKey<"lead">; width?: number }> = [
  { key: "legalName", width: IDENTIFIER_WIDTH },
  { key: "stage" },
  { key: "executive" },
  { key: "nextStep", width: 180 },
  { key: "status" },
  { key: "priority" },
  { key: "ruc", width: RUC_WIDTH },
  { key: "updatedAt" },
  { key: "createdBy" },
];

// A case type's stages sit between the case's identity and its holder, in the
// order the case type defines them.
function caseFields(stages: ReadonlyArray<CaseStage>): SeedField[] {
  return [
    { key: "legalName", width: IDENTIFIER_WIDTH },
    { key: "ruc", width: RUC_WIDTH },
    ...stages.map((stage) => ({ key: caseStageField(stage).key })),
    { key: "holder" },
    { key: "updatedAt" },
  ];
}

function seedFields(fields: ReadonlyArray<SeedField>): SavedView["fields"] {
  return fields.map((field, position) => ({
    fieldKey: field.key,
    position,
    width: field.width ?? FIELD_WIDTH,
    visible: true,
  }));
}

// The view a workspace has before anyone saves one. The lead list keeps the
// newest-first order it always had; the other objects start unsorted.
export function defaultView(
  object: ViewObject,
  caseStages: ReadonlyArray<CaseStage>,
): SavedView {
  const name = viewObjectName(object);
  switch (name) {
    case "company":
      return { fields: seedFields(COMPANY_FIELDS), sort: null, filter: null };
    case "lead":
      return {
        fields: seedFields(LEAD_FIELDS),
        sort: { fieldKey: "createdAt", direction: "desc" },
        filter: null,
      };
    case "case":
      return { fields: seedFields(caseFields(caseStages)), sort: null, filter: null };
  }
}
