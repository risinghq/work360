import { describe, expect, it } from "vitest";

import { caseViewObject, isViewObject } from "~/contracts/views/views";

describe("view object", () => {
  it("accepts the fixed objects and one view per case type", () => {
    expect(isViewObject("lead")).toBe(true);
    expect(isViewObject("company")).toBe(true);
    expect(
      isViewObject(caseViewObject("3f1c2b7e-9a4d-4c1e-8b2a-0d5e6f7a8b9c")),
    ).toBe(true);
  });

  it("rejects unknown objects and a case without its type id", () => {
    expect(isViewObject("case")).toBe(false);
    expect(isViewObject("case:not-a-uuid")).toBe(false);
    expect(isViewObject("campaign")).toBe(false);
    expect(isViewObject("lead ")).toBe(false);
  });
});
