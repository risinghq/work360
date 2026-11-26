import { describe, expect, it } from "vitest";

import type { DataGridColumn } from "~/features/data-grid/model/types";
import {
  DEFAULT_FIELD_WIDTH,
  layoutColumns,
  mergeViewLayout,
  moveField,
  toggleField,
  toSavedFields,
} from "~/features/record-index/model/view-layout";

type Row = { id: string };

function column(
  key: string,
  extra: Partial<DataGridColumn<Row>> = {},
): DataGridColumn<Row> {
  return { key, label: key, renderCell: () => null, ...extra };
}

const COLUMNS = [
  column("name", { sticky: true, width: 240 }),
  column("ruc", { width: 120 }),
  column("stage"),
  column("owner"),
];

describe("mergeViewLayout", () => {
  it("uses the column defaults when nothing is saved", () => {
    expect(mergeViewLayout(COLUMNS, [])).toEqual([
      { key: "name", width: 240, visible: true },
      { key: "ruc", width: 120, visible: true },
      { key: "stage", width: DEFAULT_FIELD_WIDTH, visible: true },
      { key: "owner", width: DEFAULT_FIELD_WIDTH, visible: true },
    ]);
  });

  it("keeps saved order, drops unknown keys and appends new columns", () => {
    const layout = mergeViewLayout(COLUMNS, [
      { fieldKey: "stage", position: 1, width: 200, visible: false },
      { fieldKey: "gone", position: 0, width: 90, visible: true },
      { fieldKey: "ruc", position: 2, width: 100, visible: true },
      { fieldKey: "name", position: 3, width: 300, visible: false },
    ]);

    expect(layout).toEqual([
      { key: "name", width: 300, visible: true },
      { key: "stage", width: 200, visible: false },
      { key: "ruc", width: 100, visible: true },
      { key: "owner", width: DEFAULT_FIELD_WIDTH, visible: true },
    ]);
  });
});

describe("layout edits", () => {
  const layout = mergeViewLayout(COLUMNS, []);

  it("moves a field and saves positions in the new order", () => {
    const moved = moveField(layout, "owner", 1);
    expect(toSavedFields(moved).map((field) => field.fieldKey)).toEqual([
      "name",
      "owner",
      "ruc",
      "stage",
    ]);
  });

  it("keeps saved fields this page does not show after its own", () => {
    const saved = toSavedFields(layout, [
      { fieldKey: "executive", position: 2, width: 160, visible: false },
      { fieldKey: "ruc", position: 1, width: 90, visible: true },
    ]);
    expect(saved.map((field) => [field.fieldKey, field.position])).toEqual([
      ["name", 0],
      ["ruc", 1],
      ["stage", 2],
      ["owner", 3],
      ["executive", 4],
    ]);
    expect(saved[4]).toMatchObject({ width: 160, visible: false });
  });

  it("never hides the last visible field", () => {
    const one = [{ key: "name", width: 240, visible: true }];
    expect(toggleField(one, "name")).toEqual(one);
    expect(toggleField(layout, "ruc")[1]?.visible).toBe(false);
  });

  it("renders only visible columns at their layout width", () => {
    const hidden = toggleField(layout, "stage");
    const columns = layoutColumns(COLUMNS, hidden);
    expect(columns.map((c) => [c.key, c.width])).toEqual([
      ["name", 240],
      ["ruc", 120],
      ["owner", DEFAULT_FIELD_WIDTH],
    ]);
  });
});
