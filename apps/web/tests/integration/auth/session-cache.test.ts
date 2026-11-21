import { getSeededIdentity } from "@tests/support/identities/api";
import { operationAt } from "@tests/support/operation";
import {
  cleanupTestDb,
  createIsolatedTestDb,
  resetTestDb,
  type TestDbContext,
} from "@tests/support/runtime/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  generateSessionToken,
  hashSessionToken,
} from "~/server/auth/session/tokens";
import { createWorkspaceSessions } from "~/server/sessions/workspace-sessions";

const IDENTITY = getSeededIdentity("execOne");
const NOW = new Date("2026-07-15T12:00:00.000Z");

describe("session authentication", () => {
  let ctx: TestDbContext;

  beforeAll(async () => {
    ctx = await createIsolatedTestDb("session-cache");
  });

  afterAll(async () => {
    await cleanupTestDb(ctx);
  });

  beforeEach(async () => {
    await resetTestDb(ctx);
  });

  function resolve(token: string) {
    return createWorkspaceSessions(ctx.db, ctx.fixtures.workspace.id).resolve(
      token,
      operationAt(NOW),
    );
  }

  async function seedSession(
    overrides: { session_class?: "app" | "pre_auth" } = {},
  ): Promise<string> {
    const token = generateSessionToken(ctx.fixtures.workspace.id);
    await ctx.db
      .insertInto("user_sessions")
      .values({
        id: hashSessionToken(token),
        user_id: IDENTITY.userId,
        session_class: overrides.session_class ?? "app",
        primary_auth_method: "password",
        strong_auth_method: null,
        strong_auth_at: null,
        impersonator_user_id: null,
        ip_address: "127.0.0.1",
        user_agent: null,
        created_at: NOW,
        last_activity: NOW,
        expires_at: new Date(NOW.getTime() + 60 * 60_000),
      })
      .execute();
    return token;
  }

  it("resolves a session from the database and reflects its persisted session class", async () => {
    const token = await seedSession({ session_class: "pre_auth" });

    const result = await resolve(token);

    expect(result?.sessionClass).toBe("pre_auth");
    expect(result?.role).toBe(IDENTITY.role);
  });

  it("carries the workspace modules into the session", async () => {
    const token = await seedSession();

    expect((await resolve(token))?.modules).toEqual(["culqi", "contacts"]);

    await ctx.db
      .updateTable("workspace_settings")
      .set({ modules: [] })
      .execute();

    expect((await resolve(token))?.modules).toEqual([]);

    await ctx.db
      .insertInto("case_types")
      .values({
        id: crypto.randomUUID(),
        key: "fija",
        name: "Fija",
        created_at: NOW,
      })
      .execute();

    expect((await resolve(token))?.modules).toEqual(["cases"]);
  });

  it("reads the member's current role on each request", async () => {
    const token = await seedSession();

    const role = await ctx.db
      .selectFrom("workspace_roles")
      .select(["id", "kind"])
      .where("key", "=", "back_office")
      .executeTakeFirstOrThrow();
    await ctx.db
      .updateTable("members")
      .set({ role_id: role.id, role: role.kind })
      .where("user_id", "=", IDENTITY.userId)
      .execute();

    expect(await resolve(token)).toMatchObject({
      roleKey: "back_office",
      role: "back_office",
    });
  });

  it("ends the session of a deactivated member", async () => {
    const token = await seedSession();
    await ctx.db
      .updateTable("members")
      .set({ is_active: false })
      .where("user_id", "=", IDENTITY.userId)
      .execute();

    expect(await resolve(token)).toBeNull();
    expect(
      await ctx.repos.sessions.findById(hashSessionToken(token)),
    ).toBeNull();
  });
});
