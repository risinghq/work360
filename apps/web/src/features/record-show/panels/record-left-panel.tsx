import type { LeadDetailView } from "~/contracts/workflow/views";
import { DetailFieldsSection } from "~/features/record-show/sections/fields";
import { RecordSummaryCard } from "~/features/record-show/summary-card/record-summary-card";

import styles from "./record-left-panel.module.css";

export function RecordLeftPanel(props: { data: LeadDetailView }) {
  return (
    <div class={styles.panel}>
      <RecordSummaryCard lead={props.data.lead} />
      <div class={styles.scrollBody}>
        <DetailFieldsSection data={props.data} />
      </div>
    </div>
  );
}
