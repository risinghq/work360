import { describe, expect, it } from "vitest";

import {
  leadFilterValue,
  leadSortValue,
} from "~/features/workflow/workspace/saved-view-query";

describe("lead list defaults from the saved view", () => {
  it("maps the saved sort to the URL sort", () => {
    expect(leadSortValue(null)).toBe("createdAt_desc");
    expect(leadSortValue({ fieldKey: "updatedAt", direction: "asc" })).toBe(
      "updatedAt_asc",
    );
    expect(leadSortValue({ fieldKey: "createdBy", direction: "desc" })).toBe(
      "registeredBy_desc",
    );
    expect(leadSortValue({ fieldKey: "stage", direction: "asc" })).toBe(
      "createdAt_desc",
    );
  });

  it("maps the saved filter to the URL filter", () => {
    expect(leadFilterValue(null)).toBe("all");
    expect(
      leadFilterValue({ fieldKey: "updatedAt", operand: "isToday", value: "" }),
    ).toBe("updated_today");
    expect(
      leadFilterValue({ fieldKey: "stage", operand: "is", value: "won" }),
    ).toBe("stage:won");
    expect(
      leadFilterValue({ fieldKey: "status", operand: "is", value: "hot" }),
    ).toBe("status:hot");
    expect(
      leadFilterValue({ fieldKey: "priority", operand: "is", value: "high" }),
    ).toBe("all");
  });
});
