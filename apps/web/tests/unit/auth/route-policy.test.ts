import { describe, expect, it } from "vitest";

import { BASELINE_PERMISSIONS } from "~/domain/auth/access/rbac";
import {
  canAccessPath,
  getDefaultAppPath,
  getRoutePermission,
  type Member,
  type Role,
} from "~/domain/auth/access/route-policy";
import { effectivePermissions } from "~/domain/auth/access/workspace-modules";
import { getHeaderRoute } from "~/domain/navigation/policy";

function member(role: Role, modules: Member["modules"]): Member {
  return {
    role,
    modules,
    permissions: effectivePermissions(BASELINE_PERMISSIONS[role], modules),
  };
}

function culqiMember(role: Role): Member {
  return member(role, ["culqi", "contacts"]);
}

// A workspace that runs only campaigns and cases, like the Entel deploy.
function caseMember(role: Role): Member {
  return member(role, []);
}

function can(role: Role, path: string): boolean {
  return canAccessPath(culqiMember(role), path);
}

function home(role: Role): string {
  return getDefaultAppPath(culqiMember(role));
}

describe("route permissions", () => {
  it("resolves static and dynamic route permissions", () => {
    expect(getRoutePermission("/team")).toBe("team:read");
    expect(getRoutePermission("/records")).toBeNull();
    expect(getRoutePermission("/rate-simulator")).toBe("lead:rate:simulate");
    expect(getRoutePermission("/records/new")).toBeNull();
    expect(getRoutePermission("/records/123")).toBeNull();
    expect(getRoutePermission("/home")).toBe("lead:work");
    expect(getRoutePermission("/settings/profile")).toBeNull();
  });

  it("enforces role access checks for restricted paths", () => {
    expect(can("executive", "/settings/event-logs")).toBe(false);
    expect(can("supervisor", "/settings/event-logs")).toBe(true);
    expect(can("executive", "/settings/capacity-policies")).toBe(false);
    expect(can("executive", "/records")).toBe(true);
    expect(can("executive", "/rate-simulator")).toBe(true);
    expect(can("admin", "/records")).toBe(true);
    expect(can("admin", "/rate-simulator")).toBe(true);
    expect(can("logistics", "/records")).toBe(true);
    expect(can("logistics", "/rate-simulator")).toBe(false);
    expect(can("executive", "/team")).toBe(false);
    expect(can("hr", "/team")).toBe(true);
    expect(can("admin", "/settings/catalog")).toBe(true);
  });

  it("returns a role-safe default path", () => {
    expect(home("executive")).toBe("/home");
    expect(home("logistics")).toBe("/fulfillment");
    expect(home("hr")).toBe("/team");
    expect(home("back_office")).toBe("/records");
    expect(home("supervisor")).toBe("/records");
    expect(home("admin")).toBe("/records");
    expect(home("superuser")).toBe("/records");
  });
});

describe("workspace modules", () => {
  it("closes Culqi and contact-data pages to a workspace without them", () => {
    const executive = caseMember("executive");
    const admin = caseMember("admin");

    expect(canAccessPath(executive, "/records")).toBe(false);
    expect(canAccessPath(executive, "/records/123")).toBe(false);
    expect(canAccessPath(executive, "/home")).toBe(false);
    expect(canAccessPath(admin, "/settings/data-sources")).toBe(false);
    expect(canAccessPath(executive, "/campaigns")).toBe(true);
    expect(canAccessPath(executive, "/cases")).toBe(true);
    expect(canAccessPath(admin, "/settings/members")).toBe(true);
  });

  it("lands a member on a page their workspace has", () => {
    expect(getDefaultAppPath(caseMember("executive"))).toBe("/campaigns");
    expect(getDefaultAppPath(caseMember("back_office"))).toBe("/cases");
    expect(getDefaultAppPath(caseMember("supervisor"))).toBe("/team");
    expect(getDefaultAppPath(caseMember("hr"))).toBe("/team");
  });
});

describe("page headers", () => {
  it("resolves header metadata for current dynamic routes", () => {
    expect(getHeaderRoute("/rate-simulator").label).toBe("Simulador de tasas");
    expect(getHeaderRoute("/companies").label).toBe("Empresas");
    expect(getHeaderRoute("/companies/42").label).toBe("Empresas");
  });

  it("uses fallback when no header rule exists", () => {
    expect(getHeaderRoute("/unknown-route").label).toBe("Espacio de trabajo");
    expect(getHeaderRoute("/home").label).toBe("Inicio");
  });
});
