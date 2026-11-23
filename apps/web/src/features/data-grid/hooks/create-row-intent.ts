import { onCleanup } from "solid-js";

// Long enough that a pointer sweeping across rows fires nothing, short enough
// that a pointer moving to click a row has fired before the click lands.
const ROW_INTENT_DELAY_MS = 80;

// Reports the row the pointer rests on, so a row open finds its data already
// loading. Delegated from the grid: rows and cells carry data-grid-row-id.
export function createRowIntent(
  onRowIntent: () => ((rowId: string) => void) | undefined,
) {
  let hoveredRowId: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };

  onCleanup(cancel);

  return {
    onPointerOver: (event: PointerEvent) => {
      const rowId =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>("[data-grid-row-id]")?.dataset
              .gridRowId
          : undefined;

      if (rowId === hoveredRowId) {
        return;
      }

      hoveredRowId = rowId;
      cancel();

      const handler = onRowIntent();

      if (rowId && handler) {
        timer = setTimeout(() => handler(rowId), ROW_INTENT_DELAY_MS);
      }
    },
    onPointerLeave: () => {
      hoveredRowId = undefined;
      cancel();
    },
  };
}
