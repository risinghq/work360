import { useAction } from "@solidjs/router";
import { createMemo, createSignal, type Accessor, type Setter } from "solid-js";

import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import type { ViewFieldView } from "~/contracts/views/views";
import { createDataGridSelection } from "~/features/data-grid/hooks/create-selection";
import type { DataGridSelectionController } from "~/features/data-grid/model/selection";
import type { DataGridSource } from "~/features/data-grid/model/source";
import type { DataGridColumn } from "~/features/data-grid/model/types";
import { viewFieldsQuery } from "~/rpc/views/queries";

import { saveViewFieldsMutation } from "../data/mutations";
import type {
  RecordIndexDefinition,
  RecordIndexPresentationDefinition,
  RecordIndexSearchControl,
} from "./definition";
import {
  layoutColumns,
  mergeViewLayout,
  moveField,
  resizeField,
  toggleField,
  toSavedFields,
  type ViewLayoutField,
} from "./view-layout";

export type RecordIndexMenu = "filter" | "sort" | "options" | "views" | null;

type RecordIndexFilterPanel =
  | { kind: "field-list" }
  | { kind: "field-value"; fieldId: string }
  | { kind: "any-field-search" };

type RecordIndexFilteringController = {
  value: Accessor<string | undefined>;
  set: (value: string | undefined) => void;
  isActive: Accessor<boolean>;
  panel: Accessor<RecordIndexFilterPanel>;
  setPanel: Setter<RecordIndexFilterPanel>;
};

type RecordIndexSortingController = {
  value: Accessor<string | undefined>;
  set: (value: string | undefined) => void;
  isActive: Accessor<boolean>;
};

export type RecordIndexUiController = {
  definition: RecordIndexPresentationDefinition;
  counts: {
    pickerMeta: Accessor<string>;
    total: Accessor<number | undefined>;
  };
  columns: {
    openMenu: Accessor<RecordIndexMenu>;
    setOpenMenu: Setter<RecordIndexMenu>;
    layout: Accessor<ReadonlyArray<ViewLayoutField>>;
    visibleKeys: Accessor<ReadonlySet<string>>;
    hasHidden: Accessor<boolean>;
    toggle: (key: string) => void;
    move: (key: string, toIndex: number) => void;
    resize: (key: string, width: number) => void;
  };
  filtering?: RecordIndexFilteringController;
  sorting?: RecordIndexSortingController;
  view?: {
    value: Accessor<string>;
    set: (id: string) => void;
  };
  search?: RecordIndexSearchControl;
};

export type RecordIndexController<T extends { id: string }> = Omit<
  RecordIndexUiController,
  "definition"
> & {
  definition: RecordIndexDefinition<T>;
  source: Accessor<DataGridSource<T>>;
  visibleColumns: Accessor<ReadonlyArray<DataGridColumn<T>>>;
  selection: DataGridSelectionController;
};

function isActive(value: string | undefined, defaultValue: string | undefined) {
  return value !== undefined && value !== defaultValue;
}

function createViewLayout<T extends { id: string }>(
  definition: RecordIndexDefinition<T>,
) {
  const view = definition.savedView;
  const saved = createMemo<ViewFieldView[]>(() =>
    view ? viewFieldsQuery(view.object) : [],
  );
  const [draft, setDraft] = createSignal<ViewLayoutField[]>();
  const layout = createMemo(
    () => draft() ?? mergeViewLayout(definition.columns, saved()),
  );
  const save = useAction(saveViewFieldsMutation);
  const { enqueueErrorSnackBar } = useSnackBar();

  // A member who may not manage views keeps the change on this page only.
  function commit(next: ViewLayoutField[]) {
    const normalized = mergeViewLayout(definition.columns, toSavedFields(next));
    setDraft(normalized);
    if (!view?.canSave) return;
    save({ object: view.object, fields: toSavedFields(normalized) }).catch(
      (caught: unknown) => {
        console.error("Failed to save view", caught);
        enqueueErrorSnackBar("No se pudo guardar la vista");
      },
    );
  }

  return {
    layout,
    toggle: (key: string) => commit(toggleField(layout(), key)),
    move: (key: string, toIndex: number) =>
      commit(moveField(layout(), key, toIndex)),
    resize: (key: string, width: number) =>
      commit(resizeField(layout(), key, width)),
  };
}

export function createRecordIndexController<T extends { id: string }>(
  definition: RecordIndexDefinition<T>,
): RecordIndexController<T> {
  const source = createMemo(definition.source);
  const [openMenu, setOpenMenu] = createSignal<RecordIndexMenu>(null);
  const viewLayout = createViewLayout(definition);
  const visibleKeys = createMemo<ReadonlySet<string>>(
    () =>
      new Set(
        viewLayout
          .layout()
          .filter((field) => field.visible)
          .map((field) => field.key),
      ),
  );
  const [filterPanel, setFilterPanel] = createSignal<RecordIndexFilterPanel>({
    kind: "field-list",
  });

  const visibleColumns = createMemo(() =>
    layoutColumns(definition.columns, viewLayout.layout()),
  );
  const visible = createMemo(() => source().rows.length);
  const total = createMemo(() => source().totalCount);
  const pickerMeta = createMemo(() => {
    const visibleCount = visible();
    const totalCount = total();

    return typeof totalCount === "number" && totalCount !== visibleCount
      ? `${visibleCount} de ${totalCount}`
      : String(visibleCount);
  });

  const controller = {
    definition,
    source,
    visibleColumns,
    selection: createDataGridSelection(
      () => source().rows,
      (row) => row.id,
    ),
    counts: { pickerMeta, total },
    columns: {
      openMenu,
      setOpenMenu,
      layout: viewLayout.layout,
      visibleKeys,
      hasHidden: createMemo(
        () => visibleKeys().size !== viewLayout.layout().length,
      ),
      toggle: viewLayout.toggle,
      move: viewLayout.move,
      resize: viewLayout.resize,
    },
    filtering: definition.filter
      ? {
          value: definition.filter.control.value,
          set: definition.filter.control.set,
          isActive: createMemo(() =>
            isActive(
              definition.filter?.control.value(),
              definition.filter?.catalog.defaultValue,
            ),
          ),
          panel: filterPanel,
          setPanel: setFilterPanel,
        }
      : undefined,
    sorting: definition.sort
      ? {
          value: definition.sort.control.value,
          set: definition.sort.control.set,
          isActive: createMemo(() =>
            isActive(
              definition.sort?.control.value(),
              definition.sort?.catalog.defaultValue,
            ),
          ),
        }
      : undefined,
    view: definition.views
      ? {
          value: definition.views.control.value,
          set: definition.views.control.set,
        }
      : undefined,
    search: definition.search,
  } satisfies RecordIndexController<T>;

  return controller;
}
