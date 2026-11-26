import { describe, expect, it } from "vitest";

import { factField, factNames } from "~/features/campaigns/model/facts";

describe("campaign facts", () => {
  it("lists each fact once, in the order the file first used it", () => {
    expect(
      factNames([
        { facts: { lineas_moviles: "4", operador: "Claro" } },
        { facts: { operador: "Bitel", plan_actual: "Max" } },
        { facts: {} },
      ]),
    ).toEqual(["lineas_moviles", "operador", "plan_actual"]);
  });

  it("names a fact column apart from the registry's own fields", () => {
    expect(factField("lineas_moviles")).toEqual({
      key: "fact.lineas_moviles",
      label: "lineas moviles",
      type: "TEXT",
      icon: "list",
    });
  });
});
