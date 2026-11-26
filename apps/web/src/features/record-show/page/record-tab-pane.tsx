import type { ParentProps } from "solid-js";

import {
  TabStrip,
  type TabItem,
} from "~/features/side-panel/components/tab-strip";

import styles from "./record-show-page.module.css";

// The right side of a record page: a tab strip over one scrolling pane.
export function RecordTabPane<TId extends string>(
  props: ParentProps<{
    tabs: ReadonlyArray<TabItem<TId>>;
    active: TId;
    onSelect: (id: TId) => void;
  }>,
) {
  return (
    <div class={styles.tabPane}>
      <TabStrip
        tabs={props.tabs}
        activeTab={props.active}
        onTabSelect={props.onSelect}
      />
      <div class={styles.tabScroll}>{props.children}</div>
    </div>
  );
}
