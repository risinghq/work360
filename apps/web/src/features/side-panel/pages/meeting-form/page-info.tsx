import CalendarDays from "~/components/icons/calendar-days";

import { useSidePanelPageState } from "../../router/page-state";
import { PageInfoLayout } from "../../top-bar/page-info-layout";

export function MeetingFormPageInfo() {
  const pageState = useSidePanelPageState("meeting-form");

  return (
    <PageInfoLayout
      icon={<CalendarDays size={14} />}
      title={pageState().meetingId ? "Editar reunión" : "Nueva reunión"}
      label="Reunión"
    />
  );
}
