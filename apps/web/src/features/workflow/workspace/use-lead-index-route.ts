import { useSearchParams } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createSignal,
  type Accessor,
} from "solid-js";

import type { SavedView } from "~/contracts/views/views";

import { leadFilterValue, leadSortValue } from "./saved-view-query";
import { resolveWorkspaceView, type WorkspaceView } from "./views";

const SEARCH_DEBOUNCE_MS = 250;

type RouteControl<T> = {
  value: Accessor<T>;
  set: (value: T) => void;
};

type LeadIndexRoute = {
  activeView: Accessor<WorkspaceView>;
  view: RouteControl<string>;
  filter: RouteControl<string | undefined>;
  sort: RouteControl<string | undefined>;
  search: RouteControl<string> & { query: Accessor<string | undefined> };
};

export function useLeadIndexRoute(options: {
  availableViews: ReadonlyArray<WorkspaceView>;
  defaultViewId: string;
  savedView: Accessor<SavedView>;
}): LeadIndexRoute {
  const [searchParams, setSearchParams] = useSearchParams<{
    filter?: string;
    query?: string;
    sort?: string;
    view?: string;
  }>();
  const activeView = createMemo(() =>
    resolveWorkspaceView(
      options.availableViews,
      options.defaultViewId,
      searchParams.view,
    ),
  );
  const activeViewId = () => activeView().id;
  const filterDefault = () => leadFilterValue(options.savedView().filter);
  const sortDefault = () => leadSortValue(options.savedView().sort);
  const filter = () => searchParams.filter ?? filterDefault();
  const sort = () => searchParams.sort ?? sortDefault();
  const search = () => searchParams.query ?? "";
  const [debouncedSearch, setDebouncedSearch] = createSignal(search().trim());

  createEffect(search, (value) => {
    const normalized = value.trim();
    if (!normalized) {
      setDebouncedSearch("");
      return;
    }

    const timeout = setTimeout(
      () => setDebouncedSearch(normalized),
      SEARCH_DEBOUNCE_MS,
    );
    // Returning the teardown cancels the pending timer before the next
    // keystroke schedules its own, which is what makes this a debounce.
    return () => clearTimeout(timeout);
  });

  return {
    activeView,
    view: {
      value: activeViewId,
      set(viewId) {
        setSearchParams({
          view: viewId === options.defaultViewId ? null : viewId,
          query: null,
        });
      },
    },
    filter: {
      value: filter,
      set(value) {
        setSearchParams({
          filter: value && value !== filterDefault() ? value : null,
        });
      },
    },
    sort: {
      value: sort,
      set(value) {
        setSearchParams({
          sort: value && value !== sortDefault() ? value : null,
        });
      },
    },
    search: {
      value: search,
      query: () => debouncedSearch() || undefined,
      set(value) {
        setSearchParams({ query: value || null });
      },
    },
  };
}
