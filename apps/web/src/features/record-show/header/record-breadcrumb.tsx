import type { ParentProps } from "solid-js";

import type { TabIconComponent } from "~/features/side-panel/components/tab-strip";

import styles from "./record-show-header.module.css";

// Twenty's record page header: "<object icon> <Objects> / <record name>",
// the object part linking back to the object's index.
export function RecordBreadcrumb(
  props: ParentProps<{
    href: string;
    objectLabel: string;
    icon: TabIconComponent;
    name: string;
  }>,
) {
  return (
    <span class={styles.breadcrumb}>
      <a
        href={props.href}
        class={styles.breadcrumbLink}
        aria-label={`Volver a ${props.objectLabel}`}
      >
        <span class={styles.breadcrumbPrefix}>
          <span class={styles.objectIcon}>
            <props.icon size={16} />
          </span>
          <span>{props.objectLabel}</span>
        </span>
      </a>
      <span class={styles.breadcrumbSep}>/</span>
      <span class={styles.breadcrumbCurrent} title={props.name}>
        {props.name}
      </span>
      {props.children}
    </span>
  );
}
