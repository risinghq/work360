import type { JSX } from "@solidjs/web";
import type { ParentProps } from "solid-js";

import styles from "./record-show-page.module.css";

// Twenty's record page: a fixed side column with the record's identity and
// fields, and the tab pane (children) filling the rest.
export function RecordPageLayout(
  props: ParentProps<{ summary: JSX.Element; fields: JSX.Element }>,
) {
  return (
    <div class={styles.layout}>
      <div class={styles.leftPanel}>
        {props.summary}
        <div class={styles.leftScroll}>{props.fields}</div>
      </div>
      {props.children}
    </div>
  );
}
