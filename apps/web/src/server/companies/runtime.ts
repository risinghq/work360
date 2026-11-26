import type { Kysely } from "kysely";

import type { OrganizationId } from "~/domain/ids";
import type { WorkspaceDatabase } from "~/server/platform/database/types";

import { readCompany } from "./application/read-companies";
import {
  createCompaniesRepo,
  type CompanyPage,
  type CompanyViewer,
} from "./infrastructure/companies-repo";

export function createCompaniesRuntime(deps: {
  executor: Kysely<WorkspaceDatabase>;
}) {
  const repo = createCompaniesRepo(deps.executor);

  return {
    search: (text: string, page: CompanyPage, viewer: CompanyViewer) =>
      repo.search(text.trim(), page, viewer),
    read: (id: OrganizationId, viewer: CompanyViewer) =>
      readCompany(id, viewer, repo),
  };
}

export type CompaniesRuntime = ReturnType<typeof createCompaniesRuntime>;
