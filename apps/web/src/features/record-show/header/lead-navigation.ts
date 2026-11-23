import { createMemo } from "solid-js";

import { leadListQuery } from "~/rpc/workflow/lead-list";

const LEAD_NAVIGATION_LIMIT = 200;

// The record show page reads this list only for its position label and
// previous and next buttons. Read it inside its own Loading boundary: a read
// under the page's boundary holds the whole record until the list arrives.
export function leadNavigationQuery() {
  return leadListQuery({ limit: LEAD_NAVIGATION_LIMIT, offset: 0 });
}

export function useLeadNavigation(leadId: () => string) {
  const list = createMemo(() => leadNavigationQuery());

  const index = createMemo(() =>
    list().rows.findIndex((row) => row.id === leadId()),
  );

  return {
    position: createMemo(() =>
      index() < 0 ? null : { index: index(), total: list().totalCount },
    ),
    previousId: createMemo(() =>
      index() > 0 ? (list().rows[index() - 1]?.id ?? null) : null,
    ),
    nextId: createMemo(() =>
      index() >= 0 ? (list().rows[index() + 1]?.id ?? null) : null,
    ),
  };
}
