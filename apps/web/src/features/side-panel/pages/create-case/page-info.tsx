import Inbox from "~/components/icons/inbox";

import { useSidePanelPageState } from "../../router/page-state";
import { PageInfoLayout } from "../../top-bar/page-info-layout";

export function CreateCasePageInfo() {
  const pageState = useSidePanelPageState("create-case");

  return (
    <PageInfoLayout
      icon={<Inbox size={14} />}
      title="Nuevo caso"
      label={pageState().ruc ? `RUC ${pageState().ruc}` : "Borrador"}
    />
  );
}
