import { describe, expect, it } from "vitest";

import {
  OBJECTS,
  caseStageField,
  isLabelIdentifier,
  objectField,
  type ObjectName,
} from "~/contracts/objects/registry";

const OBJECT_NAMES: ObjectName[] = Object.values(OBJECTS).map(
  (object) => object.name,
);

describe("object registry", () => {
  it.each(OBJECT_NAMES)(
    "%s names its records with one of its fields",
    (name) => {
      const object = OBJECTS[name];
      const keys = object.fields.map((field) => field.key);
      expect(object.name).toBe(name);
      expect(keys).toContain(object.labelIdentifier);
      expect(isLabelIdentifier(name, object.labelIdentifier)).toBe(true);
    },
  );

  it.each(OBJECT_NAMES)("%s has unique field keys", (name) => {
    const keys = OBJECTS[name].fields.map((field) => field.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives a target to every relation field and only to them", () => {
    for (const object of Object.values(OBJECTS)) {
      for (const field of object.fields) {
        expect(field.type === "RELATION").toBe("target" in field);
      }
    }
  });

  it("finds a field by key and rejects an unknown one", () => {
    expect(objectField("company", "ruc").label).toBe("RUC");
    // @ts-expect-error -- an unknown key is also a type error
    expect(() => objectField("company", "missing")).toThrow(
      "company has no field missing",
    );
  });

  it("turns a case stage into a select field keyed by the stage", () => {
    expect(caseStageField({ key: "review", name: "Revisión" })).toEqual({
      key: "stage.review",
      label: "Revisión",
      type: "SELECT",
      icon: "target",
    });
    expect(isLabelIdentifier("case", "stage.review")).toBe(false);
  });
});
