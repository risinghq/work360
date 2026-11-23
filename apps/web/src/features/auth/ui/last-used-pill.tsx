import { Tag } from "~/components/ui/tag/tag";

import styles from "./last-used-pill.module.css";

export function LastUsedPill() {
  return (
    <span class={styles.container} aria-label="Último método usado">
      <Tag color="blue" text="Último" weight="medium" />
    </span>
  );
}
