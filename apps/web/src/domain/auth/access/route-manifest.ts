import type { Permission, Role } from "./rbac";
import type { WorkspaceModule } from "./workspace-modules";

export type AppPath =
  | "/settings/security"
  | "/settings/login-protection"
  | "/settings/security-policies"
  | "/settings/capacity-policies"
  | "/settings/quotation-policies"
  | "/settings/commission-scheme"
  | "/settings/event-logs"
  | "/settings/data-sources"
  | "/settings/members"
  | "/team"
  | "/team/requests"
  | "/records"
  | "/inquiries"
  | "/fulfillment"
  | "/rate-simulator"
  | "/home"
  | "/dashboards"
  | "/dashboards/merchant-gpv"
  | "/settings/profile"
  | "/settings/appearance"
  | "/settings/notifications"
  | "/me/capacity"
  | "/me/assignments"
  | "/campaigns"
  | "/settings/campaigns"
  | "/settings/outcomes"
  | "/cases"
  | "/cases/new"
  | "/companies"
  | "/reports";

// A route's permission already names its module. `module` gates a route that
// every role may open but only some workspaces have.
export interface RouteConfig {
  permission?: Permission;
  module?: WorkspaceModule;
  roles?: readonly Role[];
  landingPriority?: number;
}

export interface DynamicRouteConfig {
  pattern: RegExp;
  permission?: Permission;
  module?: WorkspaceModule;
  roles?: readonly Role[];
}

export const ROUTE_MANIFEST: Record<AppPath, RouteConfig> = {
  "/settings/security": {},
  "/settings/login-protection": { permission: "admin:manage" },
  "/settings/security-policies": { permission: "admin:manage" },
  "/settings/capacity-policies": { permission: "capacity:policy:manage" },
  "/settings/quotation-policies": { permission: "quotation:policy:manage" },
  "/settings/commission-scheme": { permission: "commission:manage" },
  "/settings/event-logs": { permission: "audit:read" },
  "/settings/data-sources": { permission: "data-source:import" },
  "/settings/members": { permission: "team:read", landingPriority: 10 },
  "/team": { permission: "capacity:read:team", landingPriority: 6 },
  "/team/requests": { permission: "capacity:approve", landingPriority: 7 },
  "/records": { module: "culqi" },
  "/inquiries": { permission: "lead:register" },
  "/fulfillment": { permission: "fulfillment:manage" },
  "/rate-simulator": { permission: "lead:rate:simulate", landingPriority: 4 },
  "/home": {
    permission: "lead:work",
    roles: ["executive", "sales_manager"],
    landingPriority: 1,
  },
  "/dashboards": { permission: "dashboards:read" },
  "/dashboards/merchant-gpv": { permission: "dashboards:read" },
  "/settings/profile": {},
  "/settings/appearance": {},
  "/settings/notifications": {},
  "/me/capacity": { permission: "capacity:read:self" },
  "/me/assignments": { permission: "lead:work" },
  "/campaigns": { permission: "campaign:work", landingPriority: 8 },
  "/settings/campaigns": { permission: "campaign:manage" },
  "/settings/outcomes": { permission: "outcome:manage" },
  "/cases": { permission: "case:work", landingPriority: 9 },
  "/cases/new": { permission: "case:work" },
  "/companies": { permission: "company:read" },
  "/reports": { permission: "report:read" },
};

export const DYNAMIC_ROUTES: DynamicRouteConfig[] = [
  { pattern: /^\/records\/[^/]+$/, module: "culqi" },
  { pattern: /^\/cases\/[^/]+$/, permission: "case:work" },
  { pattern: /^\/companies\/[^/]+$/, permission: "company:read" },
  // Resolving quality rows requires dashboards:manage; the summary requires dashboards:read.
  {
    pattern: /^\/dashboards\/merchant-gpv\/(?:imports|quality)\/[^/]+$/,
    permission: "dashboards:manage",
  },
  { pattern: /^\/dashboards\/[^/]+$/, permission: "dashboards:read" },
  {
    pattern: /^\/settings\/members\/[^/]+$/,
    permission: "team:read",
  },
];
