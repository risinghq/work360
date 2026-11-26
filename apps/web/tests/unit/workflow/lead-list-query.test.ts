import { describe, expect, it } from "vitest";

import { BASELINE_PERMISSIONS, type Role } from "~/domain/auth/access/rbac";
import { resolveLeadListQueryInput } from "~/features/workflow/workspace/lead-list-query";

function viewMember(role: Role) {
  return { id: "user-1", role, permissions: BASELINE_PERMISSIONS[role] };
}

describe("resolveLeadListQueryInput", () => {
  it("applies role defaults and asks for the first page", () => {
    expect(
      resolveLeadListQueryInput(
        {
          view: undefined,
          filter: undefined,
          sort: undefined,
          search: undefined,
        },
        viewMember("executive"),
      ),
    ).toEqual({
      executiveId: "user-1",
      sortBy: "createdAt",
      sortDirection: "desc",
      anyFieldSearch: undefined,
      limit: 30,
      offset: 0,
    });
  });

  it("normalizes route values before building the query key", () => {
    expect(
      resolveLeadListQueryInput(
        {
          view: "review",
          filter: "stage:LIVE",
          sort: "ruc_asc",
          search: "  Acme  ",
        },
        viewMember("back_office"),
      ),
    ).toEqual({
      stage: "LIVE",
      sortBy: "ruc",
      sortDirection: "asc",
      anyFieldSearch: "Acme",
      limit: 30,
      offset: 0,
    });
  });
});
