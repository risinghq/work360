import { describe, expect, it } from "vitest";

import { caseViewObject, type SavedView } from "~/contracts/views/views";
import { normalizeView } from "~/server/views/domain/validate-view";

function field(fieldKey: string, position: number, visible = true) {
  return { fieldKey, position, width: 150, visible };
}

function view(overrides: Partial<SavedView> = {}): SavedView {
  return {
    fields: [field("legalName", 0), field("stage", 1), field("ruc", 2)],
    sort: null,
    filter: null,
    ...overrides,
  };
}

function errorCode(result: ReturnType<typeof normalizeView>) {
  return result.ok ? null : result.error.code;
}

describe("normalizeView", () => {
  it("moves the identifier first, renumbers and keeps it visible", () => {
    const result = normalizeView(
      "lead",
      view({
        fields: [
          field("stage", 0),
          field("ruc", 4),
          field("legalName", 7, false),
        ],
      }),
      [],
    );
    expect(result.ok && result.value.fields).toEqual([
      field("legalName", 0),
      field("stage", 1),
      field("ruc", 2),
    ]);
  });

  it("rejects an unknown, a repeated or a missing identifier field", () => {
    expect(
      errorCode(
        normalizeView(
          "lead",
          view({ fields: [field("legalName", 0), field("nope", 1)] }),
          [],
        ),
      ),
    ).toBe("unknown_view_field");
    expect(
      errorCode(
        normalizeView(
          "lead",
          view({ fields: [field("legalName", 0), field("legalName", 1)] }),
          [],
        ),
      ),
    ).toBe("duplicate_view_field");
    expect(
      errorCode(
        normalizeView("lead", view({ fields: [field("stage", 0)] }), []),
      ),
    ).toBe("missing_view_field");
  });

  it("accepts a case type's stage fields only for that case type", () => {
    const object = caseViewObject("3f1c2b7e-9a4d-4c1e-8b2a-0d5e6f7a8b9c");
    const fields = [field("legalName", 0), field("stage.intake", 1)];
    const stages = [{ key: "intake", name: "Recepción" }];
    expect(normalizeView(object, view({ fields }), stages).ok).toBe(true);
    expect(errorCode(normalizeView(object, view({ fields }), []))).toBe(
      "unknown_view_field",
    );
  });

  it("checks the sort field and the filter operand against the field type", () => {
    expect(
      errorCode(
        normalizeView(
          "lead",
          view({ sort: { fieldKey: "nope", direction: "asc" } }),
          [],
        ),
      ),
    ).toBe("unknown_view_sort");
    expect(
      normalizeView(
        "lead",
        view({ filter: { fieldKey: "stage", operand: "is", value: "won" } }),
        [],
      ).ok,
    ).toBe(true);
    expect(
      normalizeView(
        "lead",
        view({
          filter: { fieldKey: "updatedAt", operand: "isToday", value: "" },
        }),
        [],
      ).ok,
    ).toBe(true);
    expect(
      errorCode(
        normalizeView(
          "lead",
          view({ filter: { fieldKey: "ruc", operand: "is", value: "1" } }),
          [],
        ),
      ),
    ).toBe("invalid_view_filter");
    expect(
      errorCode(
        normalizeView(
          "lead",
          view({ filter: { fieldKey: "stage", operand: "is", value: "" } }),
          [],
        ),
      ),
    ).toBe("invalid_view_filter");
  });
});
