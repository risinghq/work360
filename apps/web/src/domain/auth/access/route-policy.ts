import type { SessionClass } from "../core/session-contract";
import { hasPermission, type Permission, type Role } from "./rbac";
import {
  DYNAMIC_ROUTES,
  ROUTE_MANIFEST,
  type AppPath,
  type DynamicRouteConfig,
  type RouteConfig,
} from "./route-manifest";
import { hasModule, type Member } from "./workspace-modules";

export type { Permission, Role } from "./rbac";
export type { Member } from "./workspace-modules";

const ROLE_DEFAULT_PATHS: Partial<Record<Role, AppPath>> = {
  logistics: "/fulfillment",
  back_office: "/records",
  supervisor: "/records",
  admin: "/records",
  superuser: "/records",
};

function isAppPath(path: string): path is AppPath {
  return path in ROUTE_MANIFEST;
}

function resolveRouteConfig(
  pathname: string,
): RouteConfig | DynamicRouteConfig | null {
  const dynamicRoute = DYNAMIC_ROUTES.find((route) =>
    route.pattern.test(pathname),
  );

  if (dynamicRoute) {
    return dynamicRoute;
  }

  if (isAppPath(pathname)) {
    return ROUTE_MANIFEST[pathname];
  }

  // Nested paths inherit the nearest configured parent route.
  const prefix = Object.keys(ROUTE_MANIFEST)
    .filter(isAppPath)
    .filter((path) => pathname.startsWith(`${path}/`))
    .toSorted((a, b) => b.length - a.length)[0];

  return prefix ? ROUTE_MANIFEST[prefix] : null;
}

export function getRoutePermission(pathname: string): Permission | null {
  return resolveRouteConfig(pathname)?.permission ?? null;
}

export function canAccessPath(member: Member, pathname: string): boolean {
  const config = resolveRouteConfig(pathname);

  if (!config) {
    return true;
  }

  if (config.roles && !config.roles.includes(member.role)) {
    return false;
  }

  if (config.module && !hasModule(member, config.module)) {
    return false;
  }

  return !config.permission || hasPermission(member, config.permission);
}

// Every member can open it, so a landing that resolves to nothing cannot
// redirect in a loop.
const FALLBACK_PATH: AppPath = "/settings/profile";

export function getDefaultAppPath(member: Member): string {
  const roleDefault = ROLE_DEFAULT_PATHS[member.role];

  if (roleDefault && canAccessPath(member, roleDefault)) {
    return roleDefault;
  }

  const candidate = Object.keys(ROUTE_MANIFEST)
    .filter(isAppPath)
    .filter((path) => ROUTE_MANIFEST[path].landingPriority !== undefined)
    .toSorted(
      (a, b) =>
        (ROUTE_MANIFEST[a].landingPriority ?? 0) -
        (ROUTE_MANIFEST[b].landingPriority ?? 0),
    )
    .find((path) => canAccessPath(member, path));

  return candidate ?? FALLBACK_PATH;
}

// An app session lands on "/", where the request guard picks the member's
// home page, so a login flow needs no workspace lookup of its own.
export function getSessionPath(sessionClass: SessionClass): string {
  switch (sessionClass) {
    case "pre_auth":
      return "/onboarding";
    case "recovery_setup":
      return "/recovery-codes";
    case "app":
      return "/";
    default:
      return sessionClass satisfies never;
  }
}
