import { createSignal, type Accessor } from "solid-js";

const MIN_COLUMN_WIDTH = 80;

export type DataGridResizeController = {
  columnWidths: Accessor<Readonly<Record<string, number>>>;
  active: Accessor<boolean>;
  begin: (input: {
    key: string;
    pointerId: number;
    clientX: number;
    currentWidth: number;
  }) => void;
  update: (pointerId: number, clientX: number) => void;
  complete: (pointerId: number) => void;
};

// The drag width lives here. With onResize the owner takes the final width
// and the column's own width applies again.
export function createDataGridResizeController(
  onResize?: (key: string, width: number) => void,
): DataGridResizeController {
  const [columnWidths, setColumnWidths] = createSignal<
    Readonly<Record<string, number>>
  >({});
  const [state, setState] = createSignal<{
    key: string;
    pointerId: number;
    startX: number;
    startWidth: number;
  }>();

  return {
    columnWidths,
    active: () => state() !== undefined,
    begin(input) {
      setState({
        key: input.key,
        pointerId: input.pointerId,
        startX: input.clientX,
        startWidth: input.currentWidth,
      });
    },
    update(pointerId, clientX) {
      const currentState = state();
      if (!currentState || currentState.pointerId !== pointerId) {
        return;
      }

      const width = Math.max(
        MIN_COLUMN_WIDTH,
        currentState.startWidth + (clientX - currentState.startX),
      );
      setColumnWidths((current) =>
        current[currentState.key] === width
          ? current
          : { ...current, [currentState.key]: width },
      );
    },
    complete(pointerId) {
      const currentState = state();
      if (currentState?.pointerId !== pointerId) {
        return;
      }
      setState(undefined);
      const width = columnWidths()[currentState.key];
      if (!onResize || width === undefined) {
        return;
      }
      onResize(currentState.key, width);
      setColumnWidths((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([key]) => key !== currentState.key),
        ),
      );
    },
  };
}
