import type { JSX } from "@solidjs/web";

import { OverflowingText } from "~/components/ui/overflow-tooltip/overflow-tooltip";
import type { TabIconComponent } from "~/features/side-panel/components/tab-strip";

import styles from "./record-summary-card.module.css";

// Twenty's record identifier bar: icon tile, then the name and a status label,
// in one row at the top of the record page's side column.
export function RecordSummaryCard(props: {
  name: string;
  icon: TabIconComponent;
  tag?: JSX.Element;
}) {
  return (
    <div class={styles.bar}>
      <div class={styles.tile}>
        <props.icon size={16} />
      </div>
      <div class={styles.text}>
        <h3 class={styles.name}>
          <OverflowingText text={props.name} />
        </h3>
        {props.tag}
      </div>
    </div>
  );
}
