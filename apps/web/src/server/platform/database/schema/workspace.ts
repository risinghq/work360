import { WORKSPACE_AUDIT } from "./workspace-audit";
import { WORKSPACE_CAPACITY } from "./workspace-capacity";
import { WORKSPACE_CASES } from "./workspace-cases";
import { WORKSPACE_CORE } from "./workspace-core";
import { WORKSPACE_FILES } from "./workspace-files";
import { WORKSPACE_INGEST } from "./workspace-ingest";
import { WORKSPACE_MEETINGS } from "./workspace-meetings";
import {
  WORKSPACE_MERCHANT_STATS,
  WORKSPACE_MERCHANT_STATS_LATEST_ADJUSTMENT,
} from "./workspace-merchant-stats";
import { WORKSPACE_MESSAGING } from "./workspace-messaging";
import { WORKSPACE_PIPELINE } from "./workspace-pipeline";
import {
  WORKSPACE_ORGANIZATIONS_LIST,
  WORKSPACE_RECORDS,
} from "./workspace-records";
import { WORKSPACE_SAVED_VIEWS, WORKSPACE_VIEWS } from "./workspace-views";

// Until the first deploy, the schema grows inside the first migration. After
// it, a change is a new entry that runs on every existing workspace.
export const WORKSPACE_MIGRATIONS: readonly (readonly string[])[] = [
  [
    ...WORKSPACE_CORE,
    ...WORKSPACE_RECORDS,
    ...WORKSPACE_CAPACITY,
    ...WORKSPACE_MESSAGING,
    ...WORKSPACE_AUDIT,
    ...WORKSPACE_FILES,
    ...WORKSPACE_INGEST,
    ...WORKSPACE_PIPELINE,
    ...WORKSPACE_CASES,
    ...WORKSPACE_MERCHANT_STATS,
  ],
  WORKSPACE_MERCHANT_STATS_LATEST_ADJUSTMENT,
  WORKSPACE_VIEWS,
  WORKSPACE_SAVED_VIEWS,
  WORKSPACE_ORGANIZATIONS_LIST,
  WORKSPACE_MEETINGS,
];
