import type { Generated } from "kysely";

import type {
  ContactId,
  IdColumn,
  OrganizationId,
  OrganizationOwnershipId,
  PersonId,
  UserId,
} from "~/domain/ids";

export interface PeopleTable {
  id: IdColumn<PersonId>;
  dni: string;
  names: string;
  first_surname: string | null;
  second_surname: string | null;
  email: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface OrganizationsTable {
  // The rowid, which the organizations_search index keys on.
  seq: Generated<number>;
  id: IdColumn<OrganizationId>;
  ruc: string;
  legal_name: string | null;
  line_of_business: string | null;
  address: string | null;
  district: string | null;
  province: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  created_at: Date;
}

// Triggers on organizations keep this index; code only reads it with MATCH.
export interface OrganizationsSearchTable {
  rowid: number;
  legal_name: string | null;
}

// One row, which triggers on organizations keep at the table's row count.
export interface OrganizationsCountTable {
  id: number;
  n: number;
}

export interface OrganizationOwnershipsTable {
  id: IdColumn<OrganizationOwnershipId>;
  organization_id: IdColumn<OrganizationId>;
  executive_id: IdColumn<UserId>;
  valid_from: Date;
  valid_until: Date | null;
  assigned_by: IdColumn<UserId>;
  reason: string | null;
  created_at: Date;
}

export interface OrganizationCurrentOwnersView {
  organization_id: IdColumn<OrganizationId>;
  executive_id: IdColumn<UserId>;
  assigned_at: Date;
}

export interface ContactsTable {
  id: IdColumn<ContactId>;
  person_id: IdColumn<PersonId>;
  organization_id: IdColumn<OrganizationId>;
  phone: string | null;
  email: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ContactRolesTable {
  id: string;
  contact_id: IdColumn<ContactId>;
  role: string;
  is_primary: boolean;
  effective_from: Date;
  effective_to: Date | null;
}
