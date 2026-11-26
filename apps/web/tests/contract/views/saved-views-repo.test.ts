import {
  cleanupTestDb,
  createIsolatedTestDb,
  resetTestDb,
  type TestDbContext,
} from "@tests/support/runtime/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { caseViewObject, type SavedView } from "~/contracts/views/views";
import { createSavedViewsRepo } from "~/server/views/infrastructure/saved-views-repo";

describe("saved views repository", () => {
  let ctx: TestDbContext;

  beforeAll(async () => {
    ctx = await createIsolatedTestDb("saved-views");
  });

  afterAll(async () => {
    await cleanupTestDb(ctx);
  });

  beforeEach(async () => {
    await resetTestDb(ctx);
  });

  it("stores one view per object and replaces it whole", async () => {
    const repo = createSavedViewsRepo(ctx.db);
    const first: SavedView = {
      fields: [
        { fieldKey: "legalName", position: 0, width: 180, visible: true },
        { fieldKey: "stage", position: 1, width: 150, visible: false },
      ],
      sort: { fieldKey: "createdAt", direction: "desc" },
      filter: { fieldKey: "stage", operand: "is", value: "won" },
    };
    const second: SavedView = {
      fields: [
        { fieldKey: "legalName", position: 0, width: 260, visible: true },
      ],
      sort: null,
      filter: null,
    };

    await repo.put("lead", first);
    expect(await repo.find("lead")).toEqual(first);

    await repo.put("lead", second);
    await repo.put("company", first);
    expect(await repo.find("lead")).toEqual(second);
    expect(await repo.find("company")).toEqual(first);
    expect(
      await repo.find(caseViewObject("00000000-0000-4000-8000-000000000000")),
    ).toBeNull();
  });
});
