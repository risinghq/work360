import type {
  CompanyDetailView,
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
): Promise<CompanySummaryView[]> {
  return executeSessionServerFunction({
    name: "companies.search",
    access: { kind: "permission", permission: "company:read" },
    parse: () =>
      parseObject(input, validationFail, (r) => ({
        text: r.optStr("text") ?? "",
      })),
    execute: async (ctx, { text }) =>
      Ok(
        (
          await getApplication().companies.search(text, viewerOf(ctx.actor))
        ).map(toSummaryView),
      ),
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
