import { Database } from "bun:sqlite";
import { appendFileSync } from "node:fs";

import type {
  SqliteStore,
  SqliteValue,
} from "~/server/platform/database/store";

// Fails a statement whose query plan reads a whole table. Test stores hold a
// few rows, so a full scan costs nothing here and everything at volume. The
// plan shows it at any size, because with no ANALYZE statistics the planner
// picks from the schema alone.
//
// SQLITE_PLAN_REPORT=<file> appends each scan to the file instead of failing.
const REPORT_FILE = process.env.SQLITE_PLAN_REPORT;

// Tables that configuration or headcount bound in every store, so a scan of
// one stays small at any volume.
const SMALL_TABLES = new Set([
  "activity_outcomes",
  "audit_action_policies",
  "branches",
  "case_stages",
  "case_types",
  "members",
  "workspace_roles",
  "workspace_settings",
  "workspaces",
]);

const PLAN_FREE =
  /^\s*(create|drop|alter|pragma|begin|commit|rollback|savepoint|release)\b/i;

// One schema copy per template, shared by every store opened from it.
const planners = new WeakMap<Uint8Array, Database>();

// Statement texts already planned. A statement names its tables, so its plan
// is the same in every store that can run it.
const planned = new Map<string, readonly string[]>();

// `schema` is a serialized store of the same kind. Plans run on a copy of it,
// never on the store under test: Bun leaves an EXPLAIN of a write statement
// in progress on a cached query, and the store's next COMMIT then fails.
export function withPlanCheck(
  store: SqliteStore,
  schema: Uint8Array,
): SqliteStore {
  let planner = planners.get(schema);
  if (!planner) {
    planner = Database.deserialize(schema, { readonly: true });
    planners.set(schema, planner);
  }
  const db = planner;
  return {
    exec(sql, parameters) {
      checkPlan(db, sql, parameters);
      return store.exec(sql, parameters);
    },
    transaction: (work) => store.transaction(work),
  };
}

function checkPlan(
  planner: Database,
  sql: string,
  parameters: readonly SqliteValue[],
): void {
  if (PLAN_FREE.test(sql)) {
    return;
  }
  let scans = planned.get(sql);
  if (!scans) {
    scans = fullScans(planner, sql, parameters);
    planned.set(sql, scans);
  }
  if (scans.length === 0) {
    return;
  }
  const caller = appCaller(new Error().stack ?? "");
  if (!caller) {
    return;
  }
  if (!REPORT_FILE) {
    throw new Error(
      `sqlite_full_scan: ${scans.join(", ")} from ${caller} in ${sql.slice(0, 200)}`,
    );
  }
  const key = `${caller}\n${sql}`;
  if (!reported.has(key)) {
    reported.add(key);
    appendFileSync(
      REPORT_FILE,
      `${JSON.stringify({ caller, scans, sql: sql.replace(/\s+/g, " ") })}\n`,
    );
  }
}

const reported = new Set<string>();

// The innermost app frame that issued the statement. A test that reads a
// whole table to assert on it has none, and the check leaves it alone. Bun
// keeps the frames across awaits, so the app frame survives Kysely's.
function appCaller(stack: string): string | undefined {
  for (const line of stack.split("\n")) {
    const frame = /\/apps\/web\/(src\/\S+?):\d+:\d+\)?$/.exec(line)?.[1];
    if (frame && !frame.startsWith("src/server/platform/database/")) {
      return `${/at (\S+) \(/.exec(line)?.[1] ?? "<anonymous>"} ${frame}`;
    }
  }
  return undefined;
}

type PlanRow = { id: number; parent: number; detail: string };

// The tables the plan reads end to end: "SCAN t" and "SCAN t USING INDEX i"
// both visit every row. These do not:
// - a subquery, a constant row or a virtual table's own index search;
// - a view's result, whose own table reads are rows of the plan;
// - json_each over a bound parameter, which holds only the caller's rows;
// - a scan of a partial index, which holds only the rows its condition keeps;
// - the outermost loop walking an index in ORDER BY order under a LIMIT,
//   which stops at the limit, or at offset plus limit. A WHERE that rejects
//   most rows would make it walk on, and the plan cannot show that.
function fullScans(
  planner: Database,
  sql: string,
  parameters: readonly SqliteValue[],
): string[] {
  const statement = planner.prepare<PlanRow, SqliteValue[]>(
    `explain query plan ${sql}`,
  );
  let rows: PlanRow[];
  try {
    rows = statement.all(...parameters);
  } finally {
    statement.finalize();
  }
  const aliases = tableAliases(sql);
  const limited = /\blimit \?(?: offset \?)?\s*$/i.test(sql);
  return rows
    .filter((row, position) => {
      const scan = /^SCAN (\S+)(?: USING (?:COVERING )?INDEX (\S+))?(.*)$/.exec(
        row.detail,
      );
      if (!scan) {
        return false;
      }
      const [, name = "", index, rest = ""] = scan;
      if (
        name.startsWith("(") ||
        name === "CONSTANT" ||
        /^\d/.test(name) ||
        /VIRTUAL TABLE INDEX \d+:\S/.test(rest) ||
        aliases.get(name) === JSON_EACH ||
        SMALL_TABLES.has(aliases.get(name) ?? name) ||
        isView(planner, aliases.get(name) ?? name)
      ) {
        return false;
      }
      if (index !== undefined && isPartial(planner, index)) {
        return false;
      }
      return !(
        index !== undefined &&
        limited &&
        position === 0 &&
        row.parent === 0
      );
    })
    .map((row) => row.detail);
}

const JSON_EACH = "json_each(?)";

// Kysely writes `"table" as "alias"`, and the plan names the alias.
function tableAliases(sql: string): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const [, table = "", alias = ""] of sql.matchAll(
    /"(\w+)" as "(\w+)"/g,
  )) {
    aliases.set(alias, table);
  }
  for (const [, alias = ""] of sql.matchAll(/json_each\(\?\) as "(\w+)"/g)) {
    aliases.set(alias, JSON_EACH);
  }
  return aliases;
}

function isView(planner: Database, name: string): boolean {
  const row = planner
    .query<{ type: string }, [string]>(
      "select type from sqlite_master where name = ?",
    )
    .get(name);
  return row?.type === "view";
}

function isPartial(planner: Database, index: string): boolean {
  const row = planner
    .query<{ sql: string | null }, [string]>(
      "select sql from sqlite_master where type = 'index' and name = ?",
    )
    .get(index);
  return /\bwhere\b/i.test(row?.sql ?? "");
}
