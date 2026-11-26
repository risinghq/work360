import { beforeAll, describe, expect, test } from "vitest";

import {
  parseCalendarDate,
  parseCalendarMonth,
} from "~/domain/time/calendar-date";
import { isErr } from "~/shared/result";

import {
  BENCH_MONTH,
  CASES,
  createVolumeHost,
  type VolumeHost,
} from "../_shared/volume";

function calendar<T>(value: T | null, text: string): T {
  if (value === null) {
    throw new Error(`bench_calendar_invalid: ${text}`);
  }
  return value;
}

const MONTH = calendar(parseCalendarMonth(BENCH_MONTH), BENCH_MONTH);
const FROM = calendar(parseCalendarDate("2023-11-01"), "2023-11-01");
const TO = calendar(parseCalendarDate("2023-11-30"), "2023-11-30");
const ALL = { kind: "all" } as const;
const FIRST_PAGE = { limit: 30, offset: 0 };

// The screens a workspace opens all day, over a workspace a few months in.
// Each one holds the workspace's Durable Object while it runs.
describe("workspace reads", () => {
  let volume: VolumeHost;

  function executive() {
    const [first] = volume.executives;
    if (!first) {
      throw new Error("bench_host_has_no_executive");
    }
    return first;
  }

  beforeAll(async () => {
    volume = await createVolumeHost();
  });

  test("list every case of a type", async ({ bench: run }) => {
    const result = await run("list every case of a type", async () => {
      const cases = await volume.app.cases.list({
        caseTypeId: volume.caseTypeId,
        actorUserId: volume.admin.id,
        viewAll: true,
      });
      if (cases.length === 0 || cases.length > CASES) {
        throw new Error(`unexpected case count: ${cases.length}`);
      }
    }).run();
    expect(result.state).toBe("completed");
  });

  test("list an executive's cases", async ({ bench: run }) => {
    const result = await run("list an executive's cases", async () => {
      const cases = await volume.app.cases.list({
        caseTypeId: volume.caseTypeId,
        actorUserId: executive().id,
        viewAll: false,
      });
      if (cases.length === 0) {
        throw new Error("executive has no cases");
      }
    }).run();
    expect(result.state).toBe("completed");
  });

  test("list the back office's waiting cases", async ({ bench: run }) => {
    const result = await run(
      "list the back office's waiting cases",
      async () => {
        await volume.app.cases.waiting({
          caseTypeId: volume.caseTypeId,
          roleKey: "back_office",
          branchId: volume.branchId,
        });
      },
    ).run();
    expect(result.state).toBe("completed");
  });

  test("search companies across the workspace", async ({ bench: run }) => {
    const result = await run(
      "search companies across the workspace",
      async () => {
        const found = await volume.app.companies.search(
          "comercial lima",
          FIRST_PAGE,
          { userId: volume.admin.id, viewAll: true },
        );
        if (found.rows.length === 0) {
          throw new Error("search found no company");
        }
      },
    ).run();
    expect(result.state).toBe("completed");
  });

  test("search an executive's companies", async ({ bench: run }) => {
    const result = await run("search an executive's companies", async () => {
      await volume.app.companies.search("comercial", FIRST_PAGE, {
        userId: executive().id,
        viewAll: false,
      });
    }).run();
    expect(result.state).toBe("completed");
  });

  test("list every company by name with its total", async ({ bench: run }) => {
    const result = await run(
      "list every company by name with its total",
      async () => {
        const found = await volume.app.companies.search("", FIRST_PAGE, {
          userId: volume.admin.id,
          viewAll: true,
        });
        if (found.rows.length === 0) {
          throw new Error("the list found no company");
        }
      },
    ).run();
    expect(result.state).toBe("completed");
  });

  test("count the month's production", async ({ bench: run }) => {
    const result = await run("count the month's production", async () => {
      const report = await volume.app.reports.production({
        caseTypeId: volume.caseTypeId,
        stageKey: "back",
        sumFieldKey: "monto",
        month: MONTH,
        reach: ALL,
      });
      if (isErr(report) || report.value.rows.length === 0) {
        throw new Error(
          `unexpected production report: ${JSON.stringify(report)}`,
        );
      }
    }).run();
    expect(result.state).toBe("completed");
  });

  test("export the month's production", async ({ bench: run }) => {
    const result = await run("export the month's production", async () => {
      const exported = await volume.app.reports.exportProduction({
        caseTypeId: volume.caseTypeId,
        stageKey: "back",
        sumFieldKey: "monto",
        month: MONTH,
        reach: ALL,
      });
      if (isErr(exported)) {
        throw new Error(`production export failed: ${exported.error.code}`);
      }
    }).run();
    expect(result.state).toBe("completed");
  });

  test("list the month's calls", async ({ bench: run }) => {
    const result = await run("list the month's calls", async () => {
      const calls = await volume.app.reports.activities({
        from: FROM,
        to: TO,
        reach: ALL,
        userId: null,
        channel: null,
        outcomeId: null,
      });
      if (isErr(calls) || calls.value.length === 0) {
        throw new Error("activity report is empty");
      }
    }).run();
    expect(result.state).toBe("completed");
  });

  test("export the month's calls", async ({ bench: run }) => {
    const result = await run("export the month's calls", async () => {
      const exported = await volume.app.reports.exportActivities({
        from: FROM,
        to: TO,
        reach: ALL,
        userId: null,
        channel: null,
        outcomeId: null,
      });
      if (isErr(exported)) {
        throw new Error(`activity export failed: ${exported.error.code}`);
      }
    }).run();
    expect(result.state).toBe("completed");
  });
});
