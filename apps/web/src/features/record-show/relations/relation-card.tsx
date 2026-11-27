import type { JSX } from "@solidjs/web";
import { Show, children, type ParentProps } from "solid-js";

import {
  WidgetCard,
  WidgetCardContent,
  WidgetCardHeader,
  WidgetCardHeaderActions,
  WidgetCardTitle,
} from "~/features/widgets/widget-card";

import styles from "./relation-card.module.css";

// A side-column card listing the records related to this one. As in Twenty,
// an empty relation shows only its title and a zero count.
export function RelationCard(
  props: ParentProps<{ title: string; count: number; action?: JSX.Element }>,
) {
  const action = children(() => props.action);

  return (
    <WidgetCard variant="side-column">
      <WidgetCardHeader>
        <WidgetCardTitle text={props.title} count={props.count} />
        <Show when={action()}>
          <WidgetCardHeaderActions>{action()}</WidgetCardHeaderActions>
        </Show>
      </WidgetCardHeader>
      <WidgetCardContent>
        <Show when={props.count > 0}>
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
