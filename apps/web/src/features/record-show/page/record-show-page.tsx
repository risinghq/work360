import { Show, createMemo } from "solid-js";

import Building2 from "~/components/icons/building-2";
import { Tag } from "~/components/ui/tag/tag";
import { useEnrichmentWatch } from "~/features/record-show/use-enrichment-watch";
import {
  leadStageColor,
  leadStageLabel,
} from "~/features/workflow/presentation/lead-display";
import { leadDetailQuery } from "~/rpc/workflow/lead-detail";

import { RecordRightPanel } from "../panels/record-right-panel";
import { DetailFieldsSection } from "../sections/fields";
import { RecordSummaryCard } from "../summary-card/record-summary-card";
import { RecordPageLayout } from "./record-page-layout";

type RecordShowPageProps = {
  recordId: string;
};

export function RecordShowPage(props: RecordShowPageProps) {
  const data = createMemo(() => leadDetailQuery(props.recordId));

  useEnrichmentWatch(() => data()?.lead.ruc);

  return (
    <Show when={data()}>
      {(detail) => (
        <RecordPageLayout
          summary={
            <RecordSummaryCard
              name={detail().lead.legalName ?? detail().lead.ruc}
              icon={Building2}
              tag={
                <Tag
                  color={leadStageColor(detail().lead.stage)}
                  text={leadStageLabel(detail().lead.stage)}
                  preventShrink
                />
              }
            />
          }
          fields={<DetailFieldsSection data={detail()} />}
        >
          <RecordRightPanel data={detail()} />
        </RecordPageLayout>
      )}
    </Show>
  );
}
