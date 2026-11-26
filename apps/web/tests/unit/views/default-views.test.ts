import { describe, expect, it } from "vitest";

import { caseViewObject } from "~/contracts/views/views";
import { defaultView } from "~/server/views/domain/default-views";

const CASE = caseViewObject("3f1c2b7e-9a4d-4c1e-8b2a-0d5e6f7a8b9c");
const STAGES = [
  { key: "intake", name: "Recepción" },
  { key: "review", name: "Revisión" },
];

describe("default views", () => {
  it("seeds the company view identifier first with Twenty's widths", () => {
    const view = defaultView("company", []);
    expect(view.fields[0]).toEqual({
      fieldKey: "legalName",
      position: 0,
      width: 180,
      visible: true,
    });
    expect(view.fields.map((field) => field.position)).toEqual(
      view.fields.map((_, index) => index),
    );
    expect(view.fields.every((field) => field.visible)).toBe(true);
    expect(view.sort).toBeNull();
    expect(view.filter).toBeNull();
  });

  it("sorts leads newest first", () => {
    const view = defaultView("lead", []);
    expect(view.fields[0]?.fieldKey).toBe("legalName");
    expect(view.sort).toEqual({ fieldKey: "createdAt", direction: "desc" });
  });

  it("places a case type's stages between the RUC and the holder", () => {
    const keys = defaultView(CASE, STAGES).fields.map((f) => f.fieldKey);
    expect(keys).toEqual([
      "legalName",
      "ruc",
      "stage.intake",
      "stage.review",
      "holder",
      "updatedAt",
    ]);
  });
});
