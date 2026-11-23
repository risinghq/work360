// Copies a deployed Worker's Durable Objects into an empty local data
// directory: `LOAD_TOKEN=... bun run stores:pull https://host`. A local
// command such as a cutover then writes to the copy, and
// `stores:push` sends it back. The push refuses a store that gained rows since
// the pull, so a copy never overwrites newer writes. A pull reads each store
// in many requests, so it runs while nobody writes.
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { databaseConfig } from "~/server/platform/config/env";

import { createBunSqliteStore } from "./bun-store";
import { applyMigrations } from "./migrate";
import { copyStore, localEnd } from "./store-pages";
import {
  migrationsOf,
  remoteEnd,
  runTransfer,
  transferArgs,
} from "./store-transfer";

async function pullStore(
  base: string,
  token: string,
  dataDir: string,
  name: string,
): Promise<void> {
  const migrations = migrationsOf(name);
  const store = createBunSqliteStore(join(dataDir, `${name}.sqlite`));
  try {
    await applyMigrations(store, migrations);
    const { rows } = await copyStore(
      remoteEnd(base, token, name),
      localEnd(store, migrations),
    );
    console.log(`${name}: ${rows} rows`);
  } finally {
    store.close();
  }
}

// The platform store lists every workspace, so it names the stores to pull.
function workspaceStores(dataDir: string): string[] {
  const store = createBunSqliteStore(join(dataDir, "platform.sqlite"));
  try {
    return store
      .exec("select id from workspaces order by id", [])
      .rows.map((row) => `workspaces/${String(row.id)}`);
  } finally {
    store.close();
  }
}

async function main(): Promise<void> {
  const { base, token, stores } = transferArgs("stores:pull");
  const { dataDir } = databaseConfig();
  // `stores:push` sends every local store, so a stray local workspace would
  // reach production.
  if (existsSync(join(dataDir, "platform.sqlite"))) {
    throw new Error(`${dataDir} already holds stores; pull into an empty one`);
  }
  mkdirSync(join(dataDir, "workspaces"), { recursive: true });
  // Named stores pull alone, so a fix to one small store skips the large
  // workspaces; the push then sends back only those stores.
  if (stores.length > 0) {
    for (const name of stores) {
      // eslint-disable-next-line no-await-in-loop
      await pullStore(base, token, dataDir, name);
    }
    return;
  }
  await pullStore(base, token, dataDir, "platform");
  for (const name of ["registry", ...workspaceStores(dataDir)]) {
    // One store at a time keeps a failure's report to one store.
    // eslint-disable-next-line no-await-in-loop
    await pullStore(base, token, dataDir, name);
  }
}

if (import.meta.main) {
  runTransfer(main);
}
