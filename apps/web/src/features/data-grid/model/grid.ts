import type { JSX } from "@solidjs/web";

import type { DataGridReorderConfig } from "../dnd/types";
import type { DataGridSelectionController } from "./selection";
import type { DataGridSource } from "./source";
import type {
  DataGridActionRowConfig,
  DataGridColumn,
  DataGridLoadMore,
  DataGridRowOpenIndicator,
} from "./types";

export type DataGridPagination = {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  onNextPage: () => void;
  onPreviousPage: () => void;
};

export type DataGridProps<T> = {
  actionRow?: DataGridActionRowConfig;
  ariaLabel: string;
  columns: readonly DataGridColumn<T>[];
  emptyState: JSX.Element;
  loadMore?: DataGridLoadMore;
  onAddColumn?: () => void;
  // A resize ends: the owner keeps the width, or the grid holds it for the page.
  onColumnResize?: (key: string, width: number) => void;
  onRowOpen?: (row: T) => void;
  // The pointer rests on a row: warm what onRowOpen will read.
  onRowIntent?: (rowId: string) => void;
  pagination?: DataGridPagination;
  reorder?: DataGridReorderConfig<T>;
  rowId: (row: T) => string;
  rowOpenIndicator?: DataGridRowOpenIndicator;
  selection?: DataGridSelectionController;
  source: DataGridSource<T>;
};
