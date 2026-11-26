import { type JSX } from "@solidjs/web";
/* oxlint-disable jsx-a11y/no-noninteractive-element-to-interactive-role */
import { Show, children } from "solid-js";

import { useDataGrid } from "../context/instance-context";
import { createRowIntent } from "../hooks/create-row-intent";
import {
  REORDER_COLUMN_WIDTH,
  SELECTION_COLUMN_WIDTH,
} from "../model/column-layout";
import type { DataGridProps } from "../model/grid";
import { DataGridBody } from "./body";
import { DataGridEditorLayer } from "./editor-layer";
import { DataGridHeader } from "./header";
import { DataGridLoadMoreSentinel } from "./load-more-sentinel";

import styles from "../styles/table.module.css";

type DataGridSurfaceProps<T> = Omit<
  DataGridProps<T>,
  "reorder" | "selection"
> & {
  gridTemplateColumns: string;
  stickyColumnIndex: number;
};

function SurfaceMessage(props: { content: JSX.Element }) {
  // `props.content` is a getter that builds the element on every read. Reading
  // it for the type check and again for the output would create the component
  // twice.
  const content = children(() => props.content);

  return (
    <Show when={typeof content() === "string"} fallback={content()}>
      <p class={styles.surfaceMessage}>{content()}</p>
    </Show>
  );
}

export function DataGridSurface<T>(props: DataGridSurfaceProps<T>) {
  const grid = useDataGrid();
  const rows = () => props.source.rows;
  const selectionLeft = () => (grid.reorder ? REORDER_COLUMN_WIDTH : 0);
  const stickyLeft = () =>
    selectionLeft() + (grid.selection ? SELECTION_COLUMN_WIDTH : 0);
  const ariaColumnCount = () =>
    props.columns.length +
    Number(!!grid.reorder) +
    Number(!!grid.selection) +
    Number(props.onAddColumn !== undefined);
  const dataRowCount = () =>
    Math.max(props.source.totalCount ?? rows().length, rows().length);
  const ariaRowCount = () =>
    dataRowCount() + 1 + Number(props.actionRow !== undefined);
  const rowIntent = createRowIntent(() => props.onRowIntent);

  return (
    <div class={styles.indexContainer}>
      <div class={styles.tableContainer}>
        <div ref={grid.setScrollWrapper} class={styles.scrollWrapper}>
          <section
            ref={grid.setContainer}
            class={styles.table}
            aria-label={props.ariaLabel}
            aria-colcount={ariaColumnCount()}
            aria-rowcount={ariaRowCount()}
            role="grid"
            onPointerOver={rowIntent.onPointerOver}
            onPointerLeave={rowIntent.onPointerLeave}
            style={{
              "--data-grid-columns": props.gridTemplateColumns,
              "--data-grid-selection-left": `${selectionLeft()}px`,
              "--data-grid-sticky-left": `${stickyLeft()}px`,
            }}
          >
            <DataGridHeader
              columns={props.columns}
              onAddColumn={props.onAddColumn}
              stickyColumnIndex={props.stickyColumnIndex}
            />

            <Show
              when={rows().length > 0}
              fallback={
                <div class={styles.emptyStateSurface} role="row">
                  <div role="gridcell">
                    <SurfaceMessage content={props.emptyState} />
                  </div>
                </div>
              }
            >
              <DataGridBody
                actionRow={props.actionRow}
                columns={props.columns}
                onRowOpen={props.onRowOpen}
                rowId={props.rowId}
                rowOpenIndicator={props.rowOpenIndicator}
                rows={rows()}
                totalRowCount={dataRowCount()}
                stickyColumnIndex={props.stickyColumnIndex}
              />
              <Show when={props.loadMore}>
                {(loadMore) => <DataGridLoadMoreSentinel config={loadMore()} />}
              </Show>
            </Show>
            <DataGridEditorLayer
              columns={props.columns}
              rowId={props.rowId}
              rows={rows()}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
