import Target from "~/components/icons/target";

import { useSidePanelPageState } from "../../router/page-state";
import { PageInfoLayout } from "../../top-bar/page-info-layout";

export function CampaignRecordPageInfo() {
  const pageState = useSidePanelPageState("campaign-record");

  return (
    <PageInfoLayout
      icon={<Target size={14} />}
      title={pageState().record.legalName ?? pageState().record.ruc}
      label={`RUC ${pageState().record.ruc}`}
    />
  );
}
