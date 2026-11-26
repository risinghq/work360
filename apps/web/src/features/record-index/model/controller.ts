import { useAction } from "@solidjs/router";
import { createMemo, createSignal, type Accessor, type Setter } from "solid-js";

import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import type { SavedView } from "~/contracts/views/views";
import { createDataGridSelection } from "~/features/data-grid/hooks/create-selection";
import type { DataGridSelectionController } from "~/features/data-grid/model/selection";
import type { DataGridSource } from "~/features/data-grid/model/source";
import type { DataGridColumn } from "~/features/data-grid/model/types";
import { viewQuery } from "~/rpc/views/queries";

import { saveViewMutation } from "../data/mutations";
import type {
  RecordIndexControl,
  RecordIndexDefinition,
  RecordIndexPresentationDefinition,
  RecordIndexSearchControl,
  ViewValueCodec,
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

// Twenty's view bar details: whether the list's sort or filter differs from
// the saved view, and the actions that reset the list or update the view.
type RecordIndexViewDetails = {
  sortChanged: Accessor<boolean>;
  filterChanged: Accessor<boolean>;
  canSave: boolean;
  reset: () => void;
  update: () => void;
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
  details?: RecordIndexViewDetails;
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

type SavedViewHandle = {
  saved: Accessor<SavedView | null>;
  persist: (edit: (stored: SavedView) => SavedView) => void;
};

function createSavedView<T extends { id: string }>(
  definition: RecordIndexDefinition<T>,
): SavedViewHandle {
  const view = definition.savedView;
  const saved = createMemo<SavedView | null>(() =>
    view ? viewQuery(view.object) : null,
  );
  const save = useAction(saveViewMutation);
  const { enqueueErrorSnackBar } = useSnackBar();

  // A member who may not manage views keeps the change on this page only.
  function persist(edit: (stored: SavedView) => SavedView) {
    const stored = saved();
    if (!view?.canSave || !stored) return;
    save({ object: view.object, view: edit(stored) }).catch(
      (caught: unknown) => {
        console.error("Failed to save view", caught);
        enqueueErrorSnackBar("No se pudo guardar la vista");
      },
    );
  }

  return { saved, persist };
}

function createViewLayout<T extends { id: string }>(
  definition: RecordIndexDefinition<T>,
  view: SavedViewHandle,
) {
  const [draft, setDraft] = createSignal<ViewLayoutField[]>();
  const layout = createMemo(
    () =>
      draft() ??
      mergeViewLayout(definition.columns, view.saved()?.fields ?? []),
  );

  function commit(next: ViewLayoutField[]) {
    const normalized = mergeViewLayout(definition.columns, toSavedFields(next));
    setDraft(normalized);
    view.persist((stored) => ({
      ...stored,
      fields: toSavedFields(normalized, stored.fields),
    }));
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

// One control compared with the saved view, as Twenty compares the current
// sorts and filters with the view's.
function createViewValue<TView>(
  control: RecordIndexControl<string | undefined> | undefined,
  defaultValue: string | undefined,
  codec: ViewValueCodec<TView> | undefined,
  stored: Accessor<TView | null | undefined>,
) {
  const current = () => control?.value() ?? defaultValue;
  const target = createMemo(() => {
    const view = stored();
    return codec && view !== undefined ? codec.read(view) : undefined;
  });
  const changed = createMemo(() => {
    const value = target();
    return value !== undefined && current() !== value;
  });
  return {
    changed,
    reset: () => {
      const value = target();
      if (changed() && value !== undefined) control?.set(value);
    },
    write: (fallback: TView | null) => {
      const value = current();
      return codec && value !== undefined ? codec.write(value) : fallback;
    },
  };
}

function createViewDetails<T extends { id: string }>(
  definition: RecordIndexDefinition<T>,
  view: SavedViewHandle,
): RecordIndexViewDetails | undefined {
  const saved = definition.savedView;
  if (!saved || (!saved.sort && !saved.filter)) return undefined;
  const sort = createViewValue(
    definition.sort?.control,
    definition.sort?.catalog.defaultValue,
    saved.sort,
    () => view.saved()?.sort,
  );
  const filter = createViewValue(
    definition.filter?.control,
    definition.filter?.catalog.defaultValue,
    saved.filter,
    () => view.saved()?.filter,
  );
  return {
    sortChanged: sort.changed,
    filterChanged: filter.changed,
    canSave: saved.canSave,
    reset: () => {
      sort.reset();
      filter.reset();
    },
    update: () =>
      view.persist((stored) => ({
        ...stored,
        sort: sort.write(stored.sort),
        filter: filter.write(stored.filter),
      })),
  };
}

export function createRecordIndexController<T extends { id: string }>(
  definition: RecordIndexDefinition<T>,
): RecordIndexController<T> {
  const source = createMemo(definition.source);
  const [openMenu, setOpenMenu] = createSignal<RecordIndexMenu>(null);
  const savedView = createSavedView(definition);
  const viewLayout = createViewLayout(definition, savedView);
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
    details: createViewDetails(definition, savedView),
    search: definition.search,
  } satisfies RecordIndexController<T>;

  return controller;
}
