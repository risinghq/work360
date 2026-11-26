import {
  createMemo,
  createSignal,
  isPending,
  latest,
  type Accessor,
} from "solid-js";

import type { DataGridSource } from "./source";
import type { DataGridLoadMore } from "./types";

export type GridPage<TRow> = {
  rows: readonly TRow[];
  totalCount: number;
};

export type PagedGridSource<TRow> = {
  source: Accessor<DataGridSource<TRow>>;
  loadMore: Accessor<DataGridLoadMore>;
};

/**
 * Loads a grid one page at a time as the user scrolls, and reports the
 * server's count of every match.
 *
 * Each page is its own request, so the loader's cache answers the pages
 * already shown when the next one is added. A new `resetKey` starts again
 * from the first page.
 */
export function createPagedGridSource<TRow>(config: {
  pageSize: number;
  resetKey: Accessor<unknown>;
  load: (limit: number, offset: number) => Promise<GridPage<TRow>>;
}): PagedGridSource<TRow> {
  // Writable memo: load-more raises the count; a new key recomputes it to one.
  const [pageCount, setPageCount] = createSignal<number>(() => {
    config.resetKey();

    return 1;
  });

  const pages = createMemo(async () =>
    Promise.all(
      Array.from({ length: pageCount() }, (_, index) =>
        config.load(config.pageSize, index * config.pageSize),
      ),
    ),
  );

  // Blocks on the first page so the page's Loading boundary shows, then holds
  // the shown pages while the next one is in flight.
  const loaded = createMemo(() => latest(pages));

  const rows = createMemo(() => loaded().flatMap((page) => page.rows));
  const totalCount = () => loaded().at(-1)?.totalCount ?? 0;
  const source = createMemo<DataGridSource<TRow>>(() => ({
    rows: rows(),
    totalCount: totalCount(),
  }));

  const hasMore = () => rows().length < totalCount();

  return {
    source,
    loadMore: () => ({
      hasMore: hasMore(),
      loading: isPending(loaded),
      onLoadMore: () => {
        if (hasMore() && !isPending(loaded)) {
          setPageCount((count) => count + 1);
        }
      },
    }),
  };
}
