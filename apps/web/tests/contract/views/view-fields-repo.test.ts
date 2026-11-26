import {
  cleanupTestDb,
  createIsolatedTestDb,
  resetTestDb,
  type TestDbContext,
} from "@tests/support/runtime/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createViewFieldsRepo } from "~/server/views/infrastructure/view-fields-repo";

describe("view fields repository", () => {
  let ctx: TestDbContext;

  beforeAll(async () => {
    ctx = await createIsolatedTestDb("view-fields");
  });

  afterAll(async () => {
    await cleanupTestDb(ctx);
  });

  beforeEach(async () => {
    await resetTestDb(ctx);
  });

  it("replaces one object's fields and lists them by position", async () => {
    const repo = createViewFieldsRepo(ctx.db);
    await repo.replace("company", [
      { fieldKey: "name", position: 0, width: 200, visible: true },
    ]);
    await repo.replace("lead", [
      { fieldKey: "stage", position: 1, width: 150, visible: false },
      { fieldKey: "legalName", position: 0, width: 240, visible: true },
    ]);
    await repo.replace("lead", [
      { fieldKey: "ruc", position: 1, width: 120, visible: true },
      { fieldKey: "legalName", position: 0, width: 260, visible: true },
    ]);

    expect(await repo.list("lead")).toEqual([
      { fieldKey: "legalName", position: 0, width: 260, visible: true },
      { fieldKey: "ruc", position: 1, width: 120, visible: true },
    ]);
    expect(await repo.list("company")).toHaveLength(1);
    expect(await repo.list("case")).toEqual([]);
  });
});
