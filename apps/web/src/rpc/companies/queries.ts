import { query } from "@solidjs/router";

import { getCompany, searchCompanies } from "~/server/companies/ui/queries";

export const companiesQuery = query(
  async (text: string, limit: number, offset: number) => {
    "use server";
    return searchCompanies({ text, limit, offset });
  },
  "companies.search",
);

export const companyQuery = query(async (companyId: string) => {
  "use server";
  return getCompany({ companyId });
}, "companies.detail");
