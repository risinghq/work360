import Building2 from "~/components/icons/building-2";
import { OverflowingText } from "~/components/ui/overflow-tooltip/overflow-tooltip";
import { Tag } from "~/components/ui/tag/tag";
import type { LeadDetailLeadView } from "~/contracts/workflow/views";
import {
  leadStageColor,
  leadStageLabel,
} from "~/features/workflow/presentation/lead-display";

import styles from "./record-summary-card.module.css";

// Twenty's record identifier bar: icon tile, name and a status label in one
// left-aligned row at the top of the record page's side column.
export function RecordSummaryCard(props: { lead: LeadDetailLeadView }) {
  return (
    <div class={styles.bar}>
      <div class={styles.tile}>
        <Building2 size={16} />
      </div>
      <h3 class={styles.name}>
        <OverflowingText text={props.lead.legalName ?? props.lead.ruc} />
      </h3>
      <Tag
        color={leadStageColor(props.lead.stage)}
        text={leadStageLabel(props.lead.stage)}
        preventShrink
      />
    </div>
  );
}
