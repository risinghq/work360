export const ROLES = [
  "executive",
  "supervisor",
  "back_office",
  "sales_manager",
  "logistics",
  "hr",
  "admin",
  "superuser",
] as const;

export type Role = (typeof ROLES)[number];

export type Permission =
  | "lead:rate:simulate"
  | "lead:work"
  | "lead:workflow"
  | "sales:create"
  | "sales:submit"
  | "sales:review"
  | "sales:approve"
  | "search:use"
  | "capacity:read:self"
  | "capacity:request:self"
  | "capacity:read:team"
  | "capacity:manage"
  | "capacity:approve"
  | "capacity:policy:manage"
  | "capacity:audit:read"
  | "team:read"
  | "team:manage"
  | "hr:read"
  | "team:invite"
  | "admin:read"
  | "admin:manage"
  | "role:manage"
  | "audit:read"
  | "lead:register"
  | "lead:note:add"
  | "lead:commercial-input:complete"
  | "lead:sale:create"
  | "lead:sale:upload-proof"
  | "lead:view:all"
  | "lead:delete"
  | "lead:review"
  | "lead:reassign"
  | "quotation:create"
  | "quotation:revise"
  | "quotation:view:all"
  | "quotation:policy:manage"
  | "integration:manage"
  | "fulfillment:manage"
  | "fulfillment:client-step"
  | "dashboards:read"
  | "dashboards:read:own"
  | "dashboards:manage"
  | "commission:read"
  | "commission:manage"
  | "data-source:import"
  | "campaign:work"
  | "campaign:manage"
  | "outcome:manage"
  | "case:work"
  | "case:view:all"
  | "case:reassign"
  | "company:read"
  | "company:view:all"
  | "report:read"
  | "report:view:branch"
  | "report:view:all"
  | "view:manage"
  | "meeting:schedule"
  | "meeting:view:all";

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  executive: [
    "lead:note:add",
    "lead:rate:simulate",
    "lead:work",
    "campaign:work",
    "case:work",
    "company:read",
    "report:read",
    "lead:workflow",
    "sales:create",
    "sales:submit",
    "search:use",
    "capacity:read:self",
    "capacity:request:self",
    "lead:register",
    "lead:commercial-input:complete",
    "lead:sale:create",
    "lead:sale:upload-proof",
    "fulfillment:client-step",
    "dashboards:read:own",
    "meeting:schedule",
  ],

  supervisor: [
    "lead:note:add",
    "lead:delete",
    "lead:rate:simulate",
    "lead:work",
    "campaign:work",
    "case:work",
    "case:view:all",
    "case:reassign",
    "company:read",
    "company:view:all",
    "report:read",
    "report:view:branch",
    "lead:view:all",
    "sales:create",
    "sales:submit",
    "sales:review",
    "sales:approve",
    "lead:sale:upload-proof",
    "search:use",
    "capacity:read:self",
    "capacity:request:self",
    "capacity:read:team",
    "capacity:manage",
    "capacity:approve",
    "team:read",
    "team:manage",
    "audit:read",
    "dashboards:read",
    "dashboards:read:own",
    "dashboards:manage",
    "view:manage",
    "meeting:schedule",
  ],

  back_office: [
    "lead:note:add",
    "lead:rate:simulate",
    "sales:review",
    "sales:approve",
    "audit:read",
    "case:work",
    "case:view:all",
    "company:read",
    "company:view:all",
    "lead:view:all",
    "lead:review",
    "quotation:create",
    "quotation:revise",
    "quotation:view:all",
    "integration:manage",
    "lead:sale:upload-proof",
    "fulfillment:manage",
    "dashboards:read",
    "dashboards:read:own",
    "dashboards:manage",
  ],

  sales_manager: [
    "lead:note:add",
    "lead:delete",
    "lead:rate:simulate",
    "lead:work",
    "campaign:work",
    "lead:view:all",
    "sales:review",
    "sales:approve",
    "lead:sale:upload-proof",
    "search:use",
    "capacity:read:self",
    "capacity:request:self",
    "capacity:read:team",
    "capacity:manage",
    "capacity:approve",
    "capacity:policy:manage",
    "capacity:audit:read",
    "team:read",
    "team:manage",
    "team:invite",
    "audit:read",
    "admin:read",
    "admin:manage",
    "quotation:policy:manage",
    "dashboards:read",
    "dashboards:read:own",
    "dashboards:manage",
    "commission:read",
    "commission:manage",
    "data-source:import",
    "campaign:manage",
    "case:work",
    "case:view:all",
    "case:reassign",
    "company:read",
    "company:view:all",
    "report:read",
    "report:view:all",
    "view:manage",
    "meeting:schedule",
  ],

  logistics: [
    "fulfillment:manage",
    "case:work",
    "case:view:all",
    "company:read",
    "company:view:all",
  ],

  hr: ["hr:read", "team:invite", "team:read", "meeting:schedule"],

  admin: [
    "lead:note:add",
    "lead:delete",
    "lead:rate:simulate",
    "lead:work",
    "campaign:work",
    "sales:review",
    "search:use",
    "lead:commercial-input:complete",
    "lead:sale:create",
    "lead:sale:upload-proof",
    "lead:view:all",
    "lead:review",
    "lead:reassign",
    "quotation:create",
    "quotation:revise",
    "quotation:view:all",
    "quotation:policy:manage",
    "integration:manage",
    "capacity:read:self",
    "capacity:request:self",
    "capacity:read:team",
    "capacity:manage",
    "capacity:approve",
    "capacity:policy:manage",
    "capacity:audit:read",
    "team:read",
    "team:manage",
    "hr:read",
    "team:invite",
    "admin:read",
    "admin:manage",
    "role:manage",
    "audit:read",
    "dashboards:read",
    "dashboards:read:own",
    "dashboards:manage",
    "commission:read",
    "commission:manage",
    "data-source:import",
    "campaign:manage",
    "outcome:manage",
    "case:work",
    "case:view:all",
    "case:reassign",
    "company:read",
    "company:view:all",
    "report:read",
    "report:view:all",
    "view:manage",
    "meeting:schedule",
    "meeting:view:all",
  ],

  superuser: [
    "lead:note:add",
    "lead:delete",
    "lead:rate:simulate",
    "lead:work",
    "campaign:work",
    "sales:create",
    "sales:submit",
    "sales:review",
    "sales:approve",
    "lead:commercial-input:complete",
    "lead:sale:create",
    "lead:sale:upload-proof",
    "lead:view:all",
    "lead:review",
    "lead:reassign",
    "quotation:create",
    "quotation:revise",
    "quotation:view:all",
    "quotation:policy:manage",
    "integration:manage",
    "search:use",
    "capacity:read:self",
    "capacity:request:self",
    "capacity:read:team",
    "capacity:manage",
    "capacity:approve",
    "capacity:policy:manage",
    "capacity:audit:read",
    "team:read",
    "team:manage",
    "hr:read",
    "team:invite",
    "admin:read",
    "admin:manage",
    "role:manage",
    "audit:read",
    "dashboards:read",
    "dashboards:read:own",
    "dashboards:manage",
    "commission:read",
    "commission:manage",
    "data-source:import",
    "campaign:manage",
    "outcome:manage",
    "case:work",
    "case:view:all",
    "case:reassign",
    "company:read",
    "company:view:all",
    "report:read",
    "report:view:all",
    "view:manage",
    "meeting:schedule",
    "meeting:view:all",
  ],
};

const PERMISSION_SET: Record<Permission, true> = {
  "lead:rate:simulate": true,
  "lead:work": true,
  "lead:workflow": true,
  "sales:create": true,
  "sales:submit": true,
  "sales:review": true,
  "sales:approve": true,
  "search:use": true,
  "capacity:read:self": true,
  "capacity:request:self": true,
  "capacity:read:team": true,
  "capacity:manage": true,
  "capacity:approve": true,
  "capacity:policy:manage": true,
  "capacity:audit:read": true,
  "team:read": true,
  "team:manage": true,
  "hr:read": true,
  "team:invite": true,
  "admin:read": true,
  "admin:manage": true,
  "role:manage": true,
  "audit:read": true,
  "lead:register": true,
  "lead:note:add": true,
  "lead:commercial-input:complete": true,
  "lead:sale:create": true,
  "lead:sale:upload-proof": true,
  "lead:view:all": true,
  "lead:delete": true,
  "lead:review": true,
  "lead:reassign": true,
  "quotation:create": true,
  "quotation:revise": true,
  "quotation:view:all": true,
  "quotation:policy:manage": true,
  "integration:manage": true,
  "fulfillment:manage": true,
  "fulfillment:client-step": true,
  "dashboards:read": true,
  "dashboards:read:own": true,
  "dashboards:manage": true,
  "commission:read": true,
  "commission:manage": true,
  "data-source:import": true,
  "campaign:work": true,
  "campaign:manage": true,
  "outcome:manage": true,
  "case:work": true,
  "case:view:all": true,
  "case:reassign": true,
  "company:read": true,
  "company:view:all": true,
  "report:read": true,
  "report:view:branch": true,
  "report:view:all": true,
  "view:manage": true,
  "meeting:schedule": true,
  "meeting:view:all": true,
};

export function isPermission(value: string): value is Permission {
  return Object.hasOwn(PERMISSION_SET, value);
}

export const PERMISSIONS: readonly Permission[] =
  Object.keys(PERMISSION_SET).filter(isPermission);

// A new workspace starts with one role per kind, keyed by the kind, holding
// these permissions. Its admin edits them from there.
export const BASELINE_PERMISSIONS: Readonly<
  Record<Role, readonly Permission[]>
> = ROLE_PERMISSIONS;

// The baseline admin and superuser cannot be edited or deleted, so a
// workspace cannot lock itself out of role management.
export const LOCKED_BASELINE_ROLES: readonly Role[] = ["admin", "superuser"];

// The baseline roles each kind may assign. The admin and superuser kinds are
// absent because they assign every role but superuser, including roles
// created later.
export const BASELINE_ASSIGNABLE: Readonly<
  Partial<Record<Role, readonly Role[]>>
> = {
  hr: [
    "executive",
    "supervisor",
    "back_office",
    "sales_manager",
    "logistics",
    "hr",
  ],
  // Sales managers staff their branch sales team.
  sales_manager: ["executive", "supervisor", "back_office"],
};

export function assignsEveryRole(kind: Role): boolean {
  return kind === "admin" || kind === "superuser";
}

export function isRole(value: string): value is Role {
  return ROLES.some((role) => role === value);
}

// A member's permissions come from their workspace role, narrowed to the
// workspace's modules when the session is read.
export interface PermissionHolder {
  readonly permissions: readonly Permission[];
}

export function hasPermission(
  holder: PermissionHolder,
  permission: Permission,
): boolean {
  return holder.permissions.includes(permission);
}
