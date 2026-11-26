import { sql, type Kysely, type SqlBool } from "kysely";

import { personDisplayName, shortName } from "~/domain/identity/display-name";
import type {
  CampaignRecordId,
  CaseId,
  OrganizationId,
  UserId,
} from "~/domain/ids";
import type {
  ActivityChannel,
  WorkspaceDatabase,
} from "~/server/platform/database/types";

const SECTION_LIMIT = 100;

// A user reaches a company through the work they did on it. view:all skips
// the check; queue-stage readers of a case rely on it too.
export type CompanyViewer = { userId: UserId; viewAll: boolean };

export type CompanyPage = { limit: number; offset: number };

export type CompanySearchResult = {
  rows: CompanySummary[];
  totalCount: number;
};

export type CompanySummary = {
  id: OrganizationId;
  ruc: string;
  legalName: string | null;
  lineOfBusiness: string | null;
  district: string | null;
  province: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  createdAt: Date;
};

export type CompanyIdentity = CompanySummary & {
  address: string | null;
};

export type CompanyPerson = {
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
};

export type CompanyCase = {
  id: CaseId;
  caseTypeName: string;
  holderName: string;
  updatedAt: Date;
};

export type CompanyActivity = {
  channel: ActivityChannel;
  startedAt: Date;
  userName: string;
  outcomeLabel: string | null;
  notes: string | null;
};

export type CompanyCampaignRecord = {
  id: CampaignRecordId;
  campaignName: string;
  segment: string;
  workedAt: Date | null;
  holderName: string | null;
};

// The companies a user worked, read from that user's own cases, holds and
// activities, so the cost follows the user's work, not the company count.
function workedBy(db: Kysely<WorkspaceDatabase>, userId: UserId) {
  return db
    .selectFrom("cases")
    .select("cases.organization_id")
    .where("cases.holder_user_id", "=", userId)
    .union(
      db
        .selectFrom("campaign_holds as h")
        .innerJoin("campaign_records as r", "r.id", "h.record_id")
        .select("r.organization_id")
        .where("h.user_id", "=", userId),
    )
    .union(
      db
        .selectFrom("activities")
        .select("activities.organization_id")
        .where("activities.user_id", "=", userId),
    );
}

// An FTS5 phrase: the trigram index matches it anywhere in the legal name,
// folding case. Text under three characters matches nothing.
function namePhrase(text: string): string {
  return `"${text.replaceAll('"', '""')}"`;
}

// The RUC is digits, and ":" sorts right after "9", so every RUC that starts
// with the prefix lies in [prefix, prefix + ":").
function rucRange(prefix: string): readonly [string, string] {
  return [prefix, `${prefix}:`];
}

export function createCompaniesRepo(db: Kysely<WorkspaceDatabase>) {
  const visible = (viewer: CompanyViewer) => {
    const query = db.selectFrom("organizations as o");
    return viewer.viewAll
      ? query
      : query.where("o.id", "in", workedBy(db, viewer.userId));
  };

  return {
    // Digits match the RUC from its start, in RUC order; other text matches
    // any part of the legal name. An empty query lists the visible companies
    // by name, the nameless ones last. The total counts every match.
    async search(
      text: string,
      page: CompanyPage,
      viewer: CompanyViewer,
    ): Promise<CompanySearchResult> {
      const byRuc = /^\d+$/.test(text);
      let matches = visible(viewer);
      if (byRuc) {
        const [from, to] = rucRange(text);
        matches = matches.where("o.ruc", ">=", from).where("o.ruc", "<", to);
      } else if (text.length > 0) {
        matches = matches.where("o.seq", "in", (eb) =>
          eb
            .selectFrom("organizations_search")
            .select("organizations_search.rowid")
            .where(
              sql<SqlBool>`organizations_search match ${namePhrase(text)}`,
            ),
        );
      }
      const ordered = byRuc
        ? matches.orderBy("o.ruc")
        : matches
            .orderBy(sql`o.legal_name is null`)
            .orderBy("o.legal_name")
            .orderBy("o.ruc");
      const [rows, counted] = await Promise.all([
        ordered
          .select([
            "o.id",
            "o.ruc",
            "o.legal_name",
            "o.line_of_business",
            "o.district",
            "o.province",
            "o.department",
            "o.phone",
            "o.email",
            "o.created_at",
          ])
          .limit(page.limit)
          .offset(page.offset)
          .execute(),
        viewer.viewAll && text === ""
          ? db
              .selectFrom("organizations_count")
              .select("n as total")
              .where("id", "=", 1)
              .executeTakeFirstOrThrow()
          : matches
              .select((eb) => eb.fn.countAll<number>().as("total"))
              .executeTakeFirstOrThrow(),
      ]);
      return {
        rows: rows.map((row) => ({
          id: row.id,
          ruc: row.ruc,
          legalName: row.legal_name,
          lineOfBusiness: row.line_of_business,
          district: row.district,
          province: row.province,
          department: row.department,
          phone: row.phone,
          email: row.email,
          createdAt: row.created_at,
        })),
        totalCount: counted.total,
      };
    },

    async findIdentity(
      id: OrganizationId,
      viewer: CompanyViewer,
    ): Promise<CompanyIdentity | null> {
      const row = await visible(viewer)
        .selectAll("o")
        .where("o.id", "=", id)
        .executeTakeFirst();
      return row
        ? {
            id: row.id,
            ruc: row.ruc,
            legalName: row.legal_name,
            lineOfBusiness: row.line_of_business,
            address: row.address,
            district: row.district,
            province: row.province,
            department: row.department,
            phone: row.phone,
            email: row.email,
            createdAt: row.created_at,
          }
        : null;
    },

    // One row per contact; the role is the primary current one.
    async listPeople(id: OrganizationId): Promise<CompanyPerson[]> {
      const rows = await db
        .selectFrom("contacts as c")
        .innerJoin("people as p", "p.id", "c.person_id")
        .select((eb) => [
          "p.names",
          "p.first_surname",
          "p.second_surname",
          "p.email as person_email",
          "c.phone",
          "c.email",
          eb
            .selectFrom("contact_roles as cr")
            .select("cr.role")
            .whereRef("cr.contact_id", "=", "c.id")
            .where("cr.effective_to", "is", null)
            .orderBy("cr.is_primary", "desc")
            .orderBy("cr.effective_from", "desc")
            .limit(1)
            .as("role"),
        ])
        .where("c.organization_id", "=", id)
        .orderBy("p.names")
        .limit(SECTION_LIMIT)
        .execute();
      return rows.map((row) => ({
        name: personDisplayName(row),
        role: row.role,
        phone: row.phone,
        email: row.email ?? row.person_email,
      }));
    },

    async listCases(id: OrganizationId): Promise<CompanyCase[]> {
      const rows = await db
        .selectFrom("cases as c")
        .innerJoin("case_types as t", "t.id", "c.case_type_id")
        .innerJoin("members as holder", "holder.user_id", "c.holder_user_id")
        .select([
          "c.id",
          "c.updated_at",
          "t.name as case_type_name",
          "holder.names",
          "holder.first_surname",
          "holder.second_surname",
        ])
        .where("c.organization_id", "=", id)
        .orderBy("c.updated_at", "desc")
        .limit(SECTION_LIMIT)
        .execute();
      return rows.map((row) => ({
        id: row.id,
        caseTypeName: row.case_type_name,
        holderName: shortName(row),
        updatedAt: row.updated_at,
      }));
    },

    async listActivities(id: OrganizationId): Promise<CompanyActivity[]> {
      const rows = await db
        .selectFrom("activities as a")
        .innerJoin("members as u", "u.user_id", "a.user_id")
        .leftJoin("activity_outcomes as oc", "oc.id", "a.outcome_id")
        .select([
          "a.channel",
          "a.started_at",
          "a.notes",
          "u.names",
          "u.first_surname",
          "u.second_surname",
          "oc.label as outcome_label",
        ])
        .where("a.organization_id", "=", id)
        .orderBy("a.started_at", "desc")
        .limit(SECTION_LIMIT)
        .execute();
      return rows.map((row) => ({
        channel: row.channel,
        startedAt: row.started_at,
        userName: shortName(row),
        outcomeLabel: row.outcome_label,
        notes: row.notes,
      }));
    },

    async listCampaignRecords(
      id: OrganizationId,
    ): Promise<CompanyCampaignRecord[]> {
      const rows = await db
        .selectFrom("campaign_records as r")
        .innerJoin("campaigns as k", "k.id", "r.campaign_id")
        .leftJoin("campaign_holds as h", (join) =>
          join
            .onRef("h.record_id", "=", "r.id")
            .on("h.released_at", "is", null),
        )
        .leftJoin("members as u", "u.user_id", "h.user_id")
        .select([
          "r.id",
          "r.segment",
          "r.worked_at",
          "k.name as campaign_name",
          "u.names",
          "u.first_surname",
          "u.second_surname",
        ])
        .where("r.organization_id", "=", id)
        .orderBy("r.imported_at", "desc")
        .limit(SECTION_LIMIT)
        .execute();
      return rows.map((row) => ({
        id: row.id,
        campaignName: row.campaign_name,
        segment: row.segment,
        workedAt: row.worked_at,
        holderName:
          row.names !== null &&
          row.first_surname !== null &&
          row.second_surname !== null
            ? shortName({
                names: row.names,
                first_surname: row.first_surname,
                second_surname: row.second_surname,
              })
            : null,
      }));
    },
  };
}

export type CompaniesRepo = ReturnType<typeof createCompaniesRepo>;
