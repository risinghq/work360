import { describe, expect, it } from "vitest";

import {
  leadFilterValue,
  leadSortValue,
  leadViewFilter,
  leadViewSort,
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

  it("maps the URL sort and filter back to the saved view", () => {
    expect(leadViewSort("registeredBy_asc")).toEqual({
      fieldKey: "createdBy",
      direction: "asc",
    });
    expect(leadViewSort("bogus")).toBeNull();
    expect(leadViewFilter("updated_today")).toEqual({
      fieldKey: "updatedAt",
      operand: "isToday",
      value: "",
    });
    expect(leadViewFilter("status:SIN RESULTADO")).toEqual({
      fieldKey: "status",
      operand: "is",
      value: "SIN RESULTADO",
    });
    expect(leadViewFilter("all")).toBeNull();
  });

  it("round-trips every URL sort", () => {
    for (const value of [
      "createdAt_desc",
      "updatedAt_asc",
      "registeredBy_desc",
      "ruc_asc",
    ]) {
      expect(leadSortValue(leadViewSort(value))).toBe(value);
    }
  });
});
