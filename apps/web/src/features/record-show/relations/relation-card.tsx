import type { JSX } from "@solidjs/web";
import { Show, type ParentProps } from "solid-js";

import {
  WidgetCard,
  WidgetCardContent,
  WidgetCardHeader,
  WidgetCardTitle,
} from "~/features/widgets/widget-card";

import styles from "./relation-card.module.css";

// A side-column card listing the records related to this one.
export function RelationCard(
  props: ParentProps<{ title: string; count: number; emptyText: string }>,
) {
  return (
    <WidgetCard variant="side-column">
      <WidgetCardHeader>
        <WidgetCardTitle text={props.title} count={props.count} />
      </WidgetCardHeader>
      <WidgetCardContent>
        <Show
          when={props.count > 0}
          fallback={<p class={styles.empty}>{props.emptyText}</p>}
        >
          <ul class={styles.list}>{props.children}</ul>
        </Show>
      </WidgetCardContent>
    </WidgetCard>
  );
}

export function RelationItem(props: { chip: JSX.Element; meta?: string }) {
  return (
    <li class={styles.item}>
      {props.chip}
      <Show when={props.meta}>
        {(meta) => <span class={styles.meta}>{meta()}</span>}
      </Show>
    </li>
  );
}
