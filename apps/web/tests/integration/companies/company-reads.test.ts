import { expectErr, expectOk } from "@tests/support/_core/assertions";
import { operationAt } from "@tests/support/operation";
import { createTestCasesRuntime } from "@tests/support/runtime/cases";
import {
  cleanupTestDb,
  createIsolatedTestDb,
  resetTestDb,
  TEST_FIXTURES,
  type TestDbContext,
} from "@tests/support/runtime/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { hydrateRuc } from "~/domain/identity/document";
import { ActivityId, OrganizationId, type UserId } from "~/domain/ids";
import { createCampaignsRuntime } from "~/server/campaigns/runtime";
import { createCompaniesRuntime } from "~/server/companies/runtime";

import { FIJA } from "../cases/fija";

const EXEC_ONE = TEST_FIXTURES.users.execOne.id;
const EXEC_TWO = TEST_FIXTURES.users.execTwo.id;
const MANAGER = TEST_FIXTURES.users.superUser.id;
const BRANCH = TEST_FIXTURES.branches.lima.id;
const LIMA = TEST_FIXTURES.organizations.lima.id;
const NORTE = TEST_FIXTURES.organizations.norte.id;
const OPERATION = operationAt(new Date("2026-11-16T15:00:00.000Z"));
const LATER = operationAt(new Date("2026-11-16T18:00:00.000Z"));

const own = (userId: UserId) => ({ userId, viewAll: false });
const everyCompany = { userId: MANAGER, viewAll: true };
const ALL_ROWS = { limit: 100, offset: 0 };

describe("company reads", () => {
  let ctx: TestDbContext;

  beforeAll(async () => {
    ctx = await createIsolatedTestDb("company-reads");
  });

  afterAll(async () => {
    await cleanupTestDb(ctx);
  });

  beforeEach(async () => {
    await resetTestDb(ctx);
    expectOk(await cases().defineCaseType(FIJA, OPERATION));
  });

  function companies() {
    return createCompaniesRuntime({ executor: ctx.db });
  }

  function cases() {
    return createTestCasesRuntime(ctx);
  }

  async function fileCase(ruc: string) {
    return expectOk(
      await cases().open(
        {
          actorUserId: EXEC_ONE,
          actorRoleKey: "executive",
          actorBranchId: BRANCH,
          caseTypeKey: FIJA.key,
          ruc: hydrateRuc(ruc),
          values: { plan: "FIBRA 300" },
        },
        OPERATION,
      ),
    );
  }

  async function names(
    text: string,
    viewer: { userId: UserId; viewAll: boolean },
  ) {
    return (await companies().search(text, ALL_ROWS, viewer)).rows.map(
      (each) => each.legalName,
    );
  }

  it("lists nameless companies last and pages with the full count", async () => {
    await ctx.db
      .insertInto("organizations")
      .values({
        id: OrganizationId.mint(),
        ruc: "20100000000",
        legal_name: null,
        created_at: new Date(),
      })
      .execute();

    expect(await names("", everyCompany)).toEqual([
      "Org Lima",
      "Org Norte",
      null,
    ]);
    const second = await companies().search(
      "",
      { limit: 1, offset: 1 },
      everyCompany,
    );
    expect(second.rows.map((each) => each.legalName)).toEqual(["Org Norte"]);
    expect(second.totalCount).toBe(3);
  });

  it("searches only the companies the viewer worked unless the role sees all", async () => {
    await fileCase(TEST_FIXTURES.organizations.lima.ruc);

    expect(await names("", own(EXEC_ONE))).toEqual(["Org Lima"]);
    expect(await names("", own(EXEC_TWO))).toEqual([]);
    expect(await names("", everyCompany)).toEqual(["Org Lima", "Org Norte"]);
  });

  it("matches a RUC prefix or any part of the legal name", async () => {
    expect(await names("2010000000", everyCompany)).toEqual([
      "Org Lima",
      "Org Norte",
    ]);
    expect(await names("20100000002", everyCompany)).toEqual(["Org Norte"]);
    expect(await names("nort", everyCompany)).toEqual(["Org Norte"]);
    expect(await names("  lima ", everyCompany)).toEqual(["Org Lima"]);
    expect(await names("%", everyCompany)).toEqual([]);
  });

  it("follows the case to its new holder", async () => {
    const filed = await fileCase(TEST_FIXTURES.organizations.lima.ruc);
    expectOk(
      await cases().reassign(
        {
          actorUserId: MANAGER,
          caseId: filed.caseId,
          expectedVersion: filed.version,
          holderUserId: EXEC_TWO,
        },
        OPERATION,
      ),
    );

    expect(expectErr(await companies().read(LIMA, own(EXEC_ONE))).code).toBe(
      "company_not_found",
    );
    const detail = expectOk(await companies().read(LIMA, own(EXEC_TWO)));
    expect(detail.cases).toEqual([
      expect.objectContaining({ id: filed.caseId, caseTypeName: FIJA.name }),
    ]);
  });

  it("opens a company from a campaign hold and shows the worked record and its call", async () => {
    const campaigns = createCampaignsRuntime({ executor: ctx.db });
    const imported = expectOk(
      await campaigns.import(
        {
          campaignName: "Entel noviembre",
          rows: [
            {
              line: 2,
              ruc: "20500000001",
              legalName: "Empresa trabajada",
              segment: "PYME",
              facts: {},
            },
            {
              line: 3,
              ruc: "20500000002",
              legalName: "Empresa en lote",
              segment: "PYME",
              facts: {},
            },
          ],
        },
        OPERATION,
      ),
    );
    const batch = expectOk(
      await campaigns.draw(
        {
          actorUserId: EXEC_ONE,
          campaignId: imported.campaignId,
          segment: "PYME",
        },
        OPERATION,
      ),
    );
    const worked = batch.find((each) => each.ruc === "20500000001");
    const held = batch.find((each) => each.ruc === "20500000002");
    if (!worked || !held) {
      throw new Error("the batch must hold both records");
    }
    const sold = (await ctx.repos.outcomes.listLive()).find(
      (each) => each.label === "Venta cerrada",
    );
    if (!sold) {
      throw new Error("baseline outcome missing");
    }
    expectOk(
      await campaigns.markWorked(
        {
          actorUserId: EXEC_ONE,
          branchId: TEST_FIXTURES.users.execOne.branchId,
          recordId: worked.id,
          outcomeId: sold.id,
          notes: "Firmó el contrato",
        },
        LATER,
      ),
    );

    const workedDetail = expectOk(
      await companies().read(worked.organizationId, own(EXEC_ONE)),
    );
    expect(workedDetail.campaignRecords).toEqual([
      expect.objectContaining({
        campaignName: "Entel noviembre",
        segment: "PYME",
        workedAt: LATER.operationAt,
      }),
    ]);
    expect(workedDetail.activities).toEqual([
      expect.objectContaining({
        outcomeLabel: "Venta cerrada",
        notes: "Firmó el contrato",
      }),
    ]);

    const heldDetail = expectOk(
      await companies().read(held.organizationId, own(EXEC_ONE)),
    );
    expect(heldDetail.campaignRecords).toEqual([
      expect.objectContaining({
        workedAt: null,
        holderName: expect.any(String),
      }),
    ]);
    expect(
      expectErr(await companies().read(held.organizationId, own(EXEC_TWO)))
        .code,
    ).toBe("company_not_found");
  });

  it("opens a company from a logged visit alone", async () => {
    await ctx.db
      .insertInto("activities")
      .values({
        id: ActivityId.mint(),
        channel: "visit",
        user_id: EXEC_TWO,
        branch_id: TEST_FIXTURES.users.execTwo.branchId,
        organization_id: NORTE,
        source: "manual",
        started_at: OPERATION.operationAt,
      })
      .execute();

    expect(await names("", own(EXEC_TWO))).toEqual(["Org Norte"]);
    const detail = expectOk(await companies().read(NORTE, own(EXEC_TWO)));
    expect(detail.activities).toEqual([
      expect.objectContaining({ channel: "visit", outcomeLabel: null }),
    ]);
  });
});
