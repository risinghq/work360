import { Show } from "solid-js";

import type { RecordContext } from "~/features/record-show/model/record-context";
import { DetailFieldsSection } from "~/features/record-show/sections/fields";

import styles from "./datos-tab.module.css";

export function DatosTab(props: { context: RecordContext }) {
  return (
    <Show
      when={props.context.kind === "lead" ? props.context.data : null}
      keyed
    >
      {(data) => (
        <div class={styles.fields}>
          <DetailFieldsSection data={data} />
        </div>
      )}
    </Show>
  );
}
