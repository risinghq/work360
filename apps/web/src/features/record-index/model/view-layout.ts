import type { ViewFieldView } from "~/contracts/views/views";
import type { DataGridColumn } from "~/features/data-grid/model/types";

// Twenty sizes every field column to a fixed width and lets the user resize
// it; a column that declares no width takes this one.
export const DEFAULT_FIELD_WIDTH = 150;

export type ViewLayoutField = {
  key: string;
  width: number;
  visible: boolean;
};

// The sticky column names the record, so it stays first and visible.
function isPinned<T>(column: DataGridColumn<T>) {
  return column.sticky === true;
}

export function defaultViewLayout<T>(
  columns: ReadonlyArray<DataGridColumn<T>>,
): ViewLayoutField[] {
  return columns.map((column) => ({
    key: column.key,
    width: column.width ?? DEFAULT_FIELD_WIDTH,
    visible: true,
  }));
}

// Saved fields keep their order; a column the view has never saved joins at
// the end with its default, and a saved field the page no longer has drops.
export function mergeViewLayout<T>(
  columns: ReadonlyArray<DataGridColumn<T>>,
  saved: ReadonlyArray<ViewFieldView>,
): ViewLayoutField[] {
  const defaults = defaultViewLayout(columns);
  if (saved.length === 0) return defaults;

  const byKey = new Map(defaults.map((field) => [field.key, field]));
  const ordered = saved
    .toSorted((a, b) => a.position - b.position)
    .flatMap((field) =>
      byKey.has(field.fieldKey)
        ? [{ key: field.fieldKey, width: field.width, visible: field.visible }]
        : [],
    );
  const savedKeys = new Set(ordered.map((field) => field.key));
  return pinFirst(columns, [
    ...ordered,
    ...defaults.filter((field) => !savedKeys.has(field.key)),
  ]);
}

function pinFirst<T>(
  columns: ReadonlyArray<DataGridColumn<T>>,
  layout: ViewLayoutField[],
): ViewLayoutField[] {
  const pinned = new Set(columns.filter(isPinned).map((column) => column.key));
  return [
    ...layout
      .filter((field) => pinned.has(field.key))
      .map((field) => ({ key: field.key, width: field.width, visible: true })),
    ...layout.filter((field) => !pinned.has(field.key)),
  ];
}

export function canEditViewField<T>(column: DataGridColumn<T>) {
  return !isPinned(column);
}

export function layoutColumns<T>(
  columns: ReadonlyArray<DataGridColumn<T>>,
  layout: ReadonlyArray<ViewLayoutField>,
): DataGridColumn<T>[] {
  const byKey = new Map(columns.map((column) => [column.key, column]));
  return layout.flatMap((field) => {
    const column = byKey.get(field.key);
    if (!column || !field.visible) return [];
    return [
      {
        ...column,
        width: field.width,
        minWidth: undefined,
        maxWidth: undefined,
        grow: undefined,
      },
    ];
  });
}

export function resizeField(
  layout: ReadonlyArray<ViewLayoutField>,
  key: string,
  width: number,
): ViewLayoutField[] {
  return layout.map((field) =>
    field.key === key ? { ...field, width: Math.round(width) } : field,
  );
}

// The last visible field cannot be hidden: a view always shows a column.
export function toggleField(
  layout: ReadonlyArray<ViewLayoutField>,
  key: string,
): ViewLayoutField[] {
  const visibleCount = layout.filter((field) => field.visible).length;
  return layout.map((field) =>
    field.key !== key || (field.visible && visibleCount === 1)
      ? field
      : { ...field, visible: !field.visible },
  );
}

export function moveField(
  layout: ReadonlyArray<ViewLayoutField>,
  key: string,
  toIndex: number,
): ViewLayoutField[] {
  const fromIndex = layout.findIndex((field) => field.key === key);
  if (fromIndex < 0 || fromIndex === toIndex) return [...layout];
  const next = [...layout];
  const [field] = next.splice(fromIndex, 1);
  if (!field) return next;
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, field);
  return next;
}

export function toSavedFields(
  layout: ReadonlyArray<ViewLayoutField>,
): ViewFieldView[] {
  return layout.map((field, position) => ({
    fieldKey: field.key,
    position,
    width: field.width,
    visible: field.visible,
  }));
}
