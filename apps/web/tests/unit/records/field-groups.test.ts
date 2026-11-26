import { describe, expect, it } from "vitest";

import {
  OBJECTS,
  type ObjectMetadata,
  type ObjectName,
} from "~/contracts/objects/registry";
import { formatAppDateTime } from "~/domain/time/app-time";
import { recordFieldGroups } from "~/features/record-show/model/field-groups";

const OBJECT_NAMES: ObjectName[] = Object.values(OBJECTS).map(
  (object) => object.name,
);

describe("record field groups", () => {
  it.each(OBJECT_NAMES)("%s groups its own fields, once each", (name) => {
    const object: ObjectMetadata = OBJECTS[name];
    const keys = (object.fieldGroups ?? []).flatMap((group) => group.fields);
    for (const key of keys) {
      expect(object.fields.map((field) => field.key)).toContain(key);
    }
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("resolves a company's groups in registry order", () => {
    const createdAt = Date.UTC(2026, 10, 20, 15);
    const groups = recordFieldGroups("company", {
      ruc: "20100047218",
      lineOfBusiness: "",
      phone: null,
      email: "ventas@example.com",
      createdAt,
    });
    expect(groups.map((group) => group.name)).toEqual([
      "General",
      "Negocio",
      "Contacto",
      "Sistema",
    ]);
    const values = new Map(
      groups
        .flatMap((group) => group.fields)
        .map((entry) => [entry.field.key, entry.value]),
    );
    expect(values.get("ruc")).toBe("20100047218");
    expect(values.get("lineOfBusiness")).toBeNull();
    expect(values.get("phone")).toBeNull();
    expect(values.get("email")).toBe("ventas@example.com");
    expect(values.get("createdAt")).toBe(formatAppDateTime(createdAt));
  });

  it("lays a case out as Twenty lays out an opportunity", () => {
    const groups = recordFieldGroups("case", { caseType: "Portabilidad" });
    expect(
      groups.map((group) => [
        group.name,
        group.fields.map((entry) => entry.field.key),
      ]),
    ).toEqual([
      ["Caso", ["caseType", "ruc"]],
      ["Relaciones", ["company", "holder"]],
      ["Sistema", ["createdAt", "updatedAt"]],
    ]);
    expect(groups[0]?.fields[0]?.value).toBe("Portabilidad");
  });

  it("shows a campaign record's company, RUC and segment", () => {
    const groups = recordFieldGroups("campaignRecord", {
      ruc: "20100047218",
      segment: "Pyme",
    });
    expect(
      groups.flatMap((group) =>
        group.fields.map((entry) => [entry.field.key, entry.value]),
      ),
    ).toEqual([
      ["company", null],
      ["ruc", "20100047218"],
      ["segment", "Pyme"],
    ]);
  });

  it("returns no groups for an object without a layout", () => {
    expect(recordFieldGroups("person", { name: "Ana" })).toEqual([]);
  });
});
