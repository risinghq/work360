import type {
  ViewFieldView,
  ViewFilterView,
  ViewObject,
  ViewSortView,
} from "~/contracts/views/views";

export interface SavedViewsTable {
  object: ViewObject;
  view_columns: ViewFieldView[];
  view_sort: ViewSortView | null;
  view_filter: ViewFilterView | null;
}
