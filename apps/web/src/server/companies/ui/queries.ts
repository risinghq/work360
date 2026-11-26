import type {
  CompanyDetailView,
  CompanyPageView,
  CompanySummaryView,
} from "~/contracts/companies/views";
import {
  hasPermission,
  type PermissionHolder,
} from "~/domain/auth/access/rbac";
import { OrganizationId, type UserId } from "~/domain/ids";
import { getApplication } from "~/server/composition/application";
import { executeSessionServerFunction } from "~/server/platform/action";
import {
  parseObject,
  validationFail,
} from "~/server/platform/action/input-reader";
import { Ok } from "~/shared/result";

import type { CompanyDetail } from "../application/read-companies";
import type {
  CompanySummary,
  CompanyViewer,
} from "../infrastructure/companies-repo";

const MAX_PAGE = 100;

function viewerOf(actor: PermissionHolder & { userId: UserId }): CompanyViewer {
  return {
    userId: actor.userId,
    viewAll: hasPermission(actor, "company:view:all"),
  };
}

function toSummaryView(company: CompanySummary): CompanySummaryView {
  return { ...company, createdAt: company.createdAt.getTime() };
}

function toDetailView({
  identity,
  people,
  cases,
  activities,
  campaignRecords,
}: CompanyDetail): CompanyDetailView {
  return {
    ...identity,
    createdAt: identity.createdAt.getTime(),
    people,
    cases: cases.map((each) => ({
      ...each,
      updatedAt: each.updatedAt.getTime(),
    })),
    activities: activities.map((each) => ({
      ...each,
      startedAt: each.startedAt.getTime(),
    })),
    campaignRecords: campaignRecords.map((each) => ({
      ...each,
      workedAt: each.workedAt ? each.workedAt.getTime() : null,
    })),
  };
}

export async function searchCompanies(
  input: unknown,
): Promise<CompanyPageView> {
  return executeSessionServerFunction({
    name: "companies.search",
    access: { kind: "permission", permission: "company:read" },
    parse: () =>
      parseObject(input, validationFail, (r) => ({
        text: r.optStr("text") ?? "",
        page: {
          limit: r.optIntRange("limit", { min: 1, max: MAX_PAGE }) ?? MAX_PAGE,
          offset: r.optIntRange("offset", { min: 0, max: 1_000_000 }) ?? 0,
        },
      })),
    execute: async (ctx, { text, page }) => {
      const found = await getApplication().companies.search(
        text,
        page,
        viewerOf(ctx.actor),
      );
      return Ok({
        rows: found.rows.map(toSummaryView),
        totalCount: found.totalCount,
      });
    },
  });
}

export async function getCompany(input: unknown): Promise<CompanyDetailView> {
  return executeSessionServerFunction({
    name: "companies.detail",
    access: { kind: "permission", permission: "company:read" },
    parse: () =>
      parseObject(input, validationFail, (r) => ({
        companyId: r.id("companyId", OrganizationId),
      })),
    execute: async (ctx, { companyId }) => {
      const found = await getApplication().companies.read(
        companyId,
        viewerOf(ctx.actor),
      );
      return found.ok ? Ok(toDetailView(found.value)) : found;
    },
  });
}
