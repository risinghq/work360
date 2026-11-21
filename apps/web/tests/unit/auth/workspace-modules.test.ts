import { makeAuthSession } from "@tests/support/unit/factories";
import { describe, expect, it } from "vitest";

import {
  BASELINE_PERMISSIONS,
  type Permission,
} from "~/domain/auth/access/rbac";
import {
  effectivePermissions,
  type WorkspaceModule,
} from "~/domain/auth/access/workspace-modules";
import {
  authorizeModule,
  authorizePermission,
} from "~/server/platform/action/session";
import { isErr } from "~/shared/result";

function grants(
  granted: readonly Permission[],
  modules: readonly WorkspaceModule[],
  permission: Permission,
): boolean {
  return effectivePermissions(granted, modules).includes(permission);
}

describe("workspace modules", () => {
  it("denies a module permission to a workspace without the module", () => {
    const admin = BASELINE_PERMISSIONS.admin;

    expect(grants(admin, [], "lead:work")).toBe(false);
    expect(grants(admin, ["culqi"], "lead:work")).toBe(true);
    expect(grants(admin, ["culqi"], "search:use")).toBe(false);
    expect(grants(admin, [], "case:work")).toBe(false);
    expect(grants(admin, ["cases"], "case:work")).toBe(true);
    expect(grants(admin, [], "campaign:work")).toBe(true);
    expect(grants(admin, [], "team:read")).toBe(true);
  });

  it("still applies the role inside a workspace that has the module", () => {
    expect(grants(BASELINE_PERMISSIONS.hr, ["culqi"], "lead:work")).toBe(false);
  });

  it("drops a stored permission the code no longer defines", () => {
    expect(
      effectivePermissions(["lead:work", "retired:perm"], ["culqi"]),
    ).toEqual(["lead:work"]);
  });

  it("forbids actions gated by a module the workspace lacks", () => {
    const session = makeAuthSession({ role: "admin", modules: [] });

    expect(isErr(authorizeModule(session, "culqi"))).toBe(true);
    expect(isErr(authorizePermission(session, "lead:review"))).toBe(true);
    expect(isErr(authorizePermission(session, "campaign:work"))).toBe(false);

    const culqi = makeAuthSession({ role: "admin" });

    expect(isErr(authorizeModule(culqi, "culqi"))).toBe(false);
    expect(isErr(authorizePermission(culqi, "lead:review"))).toBe(false);
  });
});
