// The objects a workspace holds and the fields each one shows, as Twenty's
// object metadata: one place names a field, gives its type and its label, and
// says which field names the record. Grids, record pages and saved views read
// this registry instead of declaring their own copies.

export type ObjectName =
  | "company"
  | "person"
  | "lead"
  | "case"
  | "campaignRecord";

// Twenty's field type names, limited to the ones these objects use.
export type FieldType =
  | "TEXT"
  | "FULL_NAME"
  | "PHONES"
  | "EMAILS"
  | "ADDRESS"
  | "SELECT"
  | "RELATION"
  | "ACTOR"
  | "DATE_TIME";

// Icon names resolve to components in the web layer, so the server can read
// the registry without loading UI code.
export type FieldIconName =
  | "building"
  | "calendar"
  | "info"
  | "list"
  | "mail"
  | "map"
  | "package"
  | "phone"
  | "target"
  | "timeline"
  | "user"
  | "users";

// A member of the workspace (an executive, a holder) and a campaign live
// outside the registry, as Twenty's workspaceMember does.
export type RelationTarget = ObjectName | "workspaceMember" | "campaign";

export type FieldMetadata = {
  readonly key: string;
  readonly label: string;
  readonly type: FieldType;
  readonly icon: FieldIconName;
  readonly target?: RelationTarget;
};

export type ObjectMetadata = {
  readonly name: ObjectName;
  readonly labelSingular: string;
  readonly labelPlural: string;
  readonly icon: FieldIconName;
  readonly labelIdentifier: string;
  readonly fields: ReadonlyArray<FieldMetadata>;
  readonly fieldGroups?: ReadonlyArray<FieldGroup>;
};

// The record page's fields widget, as Twenty's view field groups: the order
// and grouping of the fields shown beside a record. A relation to one record
// is a field here; a relation to many renders as its own card instead.
export type FieldGroup<Key extends string = string> = {
  readonly name: string;
  readonly fields: ReadonlyArray<Key>;
};

function defineObject<const Fields extends ReadonlyArray<FieldMetadata>>(
  object: Omit<ObjectMetadata, "fields" | "labelIdentifier" | "fieldGroups"> & {
    fields: Fields;
    labelIdentifier: Fields[number]["key"];
    fieldGroups?: ReadonlyArray<FieldGroup<Fields[number]["key"]>>;
  },
) {
  return object;
}

const COMPANY = defineObject({
  name: "company",
  labelSingular: "Empresa",
  labelPlural: "Empresas",
  icon: "building",
  labelIdentifier: "legalName",
  fields: [
    { key: "legalName", label: "Empresa", type: "TEXT", icon: "building" },
    { key: "ruc", label: "RUC", type: "TEXT", icon: "list" },
    { key: "lineOfBusiness", label: "Rubro", type: "TEXT", icon: "target" },
    { key: "phone", label: "Teléfono", type: "PHONES", icon: "phone" },
    { key: "email", label: "Correo", type: "EMAILS", icon: "mail" },
    { key: "address", label: "Dirección", type: "ADDRESS", icon: "map" },
    { key: "district", label: "Distrito", type: "TEXT", icon: "map" },
    { key: "province", label: "Provincia", type: "TEXT", icon: "map" },
    { key: "department", label: "Departamento", type: "TEXT", icon: "map" },
    {
      key: "people",
      label: "Contactos",
      type: "RELATION",
      icon: "users",
      target: "person",
    },
    {
      key: "cases",
      label: "Casos",
      type: "RELATION",
      icon: "package",
      target: "case",
    },
    {
      key: "campaignRecords",
      label: "Campañas",
      type: "RELATION",
      icon: "target",
      target: "campaignRecord",
    },
    { key: "createdAt", label: "Creado", type: "DATE_TIME", icon: "calendar" },
  ],
  fieldGroups: [
    { name: "General", fields: ["ruc"] },
    { name: "Negocio", fields: ["lineOfBusiness"] },
    {
      name: "Contacto",
      fields: [
        "phone",
        "email",
        "address",
        "district",
        "province",
        "department",
      ],
    },
    { name: "Sistema", fields: ["createdAt"] },
  ],
});

const PERSON = defineObject({
  name: "person",
  labelSingular: "Contacto",
  labelPlural: "Contactos",
  icon: "user",
  labelIdentifier: "name",
  fields: [
    { key: "name", label: "Nombre", type: "FULL_NAME", icon: "user" },
    { key: "role", label: "Cargo", type: "TEXT", icon: "info" },
    { key: "phone", label: "Teléfono", type: "PHONES", icon: "phone" },
    { key: "email", label: "Correo", type: "EMAILS", icon: "mail" },
    {
      key: "company",
      label: "Empresa",
      type: "RELATION",
      icon: "building",
      target: "company",
    },
  ],
});

const LEAD = defineObject({
  name: "lead",
  labelSingular: "Registro",
  labelPlural: "Registros",
  icon: "building",
  labelIdentifier: "legalName",
  fields: [
    { key: "legalName", label: "Razón social", type: "TEXT", icon: "building" },
    { key: "stage", label: "Etapa", type: "SELECT", icon: "target" },
    {
      key: "executive",
      label: "Ejecutivo",
      type: "RELATION",
      icon: "user",
      target: "workspaceMember",
    },
    {
      key: "nextStep",
      label: "Siguiente paso",
      type: "SELECT",
      icon: "timeline",
    },
    { key: "status", label: "Estado", type: "SELECT", icon: "info" },
    { key: "priority", label: "Prioridad", type: "SELECT", icon: "package" },
    { key: "ruc", label: "RUC", type: "TEXT", icon: "list" },
    { key: "address", label: "Dirección", type: "ADDRESS", icon: "map" },
    {
      key: "company",
      label: "Empresa",
      type: "RELATION",
      icon: "building",
      target: "company",
    },
    {
      key: "createdBy",
      label: "Registrado por",
      type: "ACTOR",
      icon: "user",
    },
    { key: "createdAt", label: "Creado", type: "DATE_TIME", icon: "calendar" },
    {
      key: "updatedAt",
      label: "Actualizado",
      type: "DATE_TIME",
      icon: "calendar",
    },
  ],
});

// A case type adds one SELECT field per stage; caseStageField builds it.
const CASE = defineObject({
  name: "case",
  labelSingular: "Caso",
  labelPlural: "Casos",
  icon: "package",
  labelIdentifier: "legalName",
  fields: [
    { key: "legalName", label: "Empresa", type: "TEXT", icon: "building" },
    { key: "ruc", label: "RUC", type: "TEXT", icon: "list" },
    { key: "caseType", label: "Tipo", type: "SELECT", icon: "package" },
    {
      key: "holder",
      label: "Responsable",
      type: "RELATION",
      icon: "user",
      target: "workspaceMember",
    },
    {
      key: "company",
      label: "Empresa",
      type: "RELATION",
      icon: "building",
      target: "company",
    },
    { key: "createdAt", label: "Creado", type: "DATE_TIME", icon: "calendar" },
    {
      key: "updatedAt",
      label: "Actualizado",
      type: "DATE_TIME",
      icon: "calendar",
    },
  ],
  // Twenty's opportunity layout: the deal, its relations, then system fields.
  fieldGroups: [
    { name: "Caso", fields: ["caseType", "ruc"] },
    { name: "Relaciones", fields: ["company", "holder"] },
    { name: "Sistema", fields: ["createdAt", "updatedAt"] },
  ],
});

const CAMPAIGN_RECORD = defineObject({
  name: "campaignRecord",
  labelSingular: "Registro de campaña",
  labelPlural: "Registros de campaña",
  icon: "target",
  labelIdentifier: "legalName",
  fields: [
    { key: "legalName", label: "Razón social", type: "TEXT", icon: "building" },
    { key: "ruc", label: "RUC", type: "TEXT", icon: "list" },
    { key: "segment", label: "Segmento", type: "SELECT", icon: "target" },
    {
      key: "campaign",
      label: "Campaña",
      type: "RELATION",
      icon: "target",
      target: "campaign",
    },
    {
      key: "holder",
      label: "Responsable",
      type: "RELATION",
      icon: "user",
      target: "workspaceMember",
    },
    {
      key: "company",
      label: "Empresa",
      type: "RELATION",
      icon: "building",
      target: "company",
    },
    {
      key: "workedAt",
      label: "Trabajada",
      type: "DATE_TIME",
      icon: "calendar",
    },
  ],
  fieldGroups: [{ name: "General", fields: ["company", "ruc", "segment"] }],
});

export const OBJECTS = {
  company: COMPANY,
  person: PERSON,
  lead: LEAD,
  case: CASE,
  campaignRecord: CAMPAIGN_RECORD,
} as const satisfies Record<ObjectName, ObjectMetadata>;

type Objects = typeof OBJECTS;

export type FieldKey<O extends ObjectName> =
  Objects[O]["fields"][number]["key"];

export function objectField<O extends ObjectName>(
  object: O,
  key: FieldKey<O>,
): FieldMetadata {
  const fields: ReadonlyArray<FieldMetadata> = OBJECTS[object].fields;
  const field = fields.find((each) => each.key === key);
  if (!field) throw new Error(`${object} has no field ${key}`);
  return field;
}

export function isLabelIdentifier(object: ObjectName, key: string): boolean {
  return OBJECTS[object].labelIdentifier === key;
}

export function caseStageField(stage: {
  key: string;
  name: string;
}): FieldMetadata {
  return {
    key: `stage.${stage.key}`,
    label: stage.name,
    type: "SELECT",
    icon: "target",
  };
}
