import { useNavigate } from "@solidjs/router";
import { Errored } from "solid-js";

import CalendarDays from "~/components/icons/calendar-days";
import { useAuthenticatedSession } from "~/components/providers/authenticated-session-provider";
import {
  RecordChip,
  RecordLinkChip,
} from "~/components/ui/record-chip/record-chip";
import type { MeetingSummaryView } from "~/contracts/meetings/views";
import { hasPermission } from "~/domain/auth/access/rbac";
import { formatAppDateTime } from "~/domain/time/app-time";
import { createGridSource } from "~/features/data-grid/model/create-grid-source";
import type { DataGridColumn } from "~/features/data-grid/model/types";
import { fieldColumn } from "~/features/object-registry/field-column";
import { RecordIndexScreen } from "~/features/record-index/components/screen";
import type { RecordIndexDefinition } from "~/features/record-index/model/definition";
import { useSidePanel } from "~/features/side-panel/state/use-side-panel";
import { createMeetingFormSidePanelPage } from "~/features/side-panel/types/side-panel-page";
import { meetingsQuery } from "~/rpc/meetings/queries";

import { MeetingStatusTag } from "./meeting-status";

import styles from "./meetings.module.css";

const COLUMNS: ReadonlyArray<DataGridColumn<MeetingSummaryView>> = [
  fieldColumn("meeting", "title", {
    renderCell: (row) => (
      <RecordLinkChip
        href={`/meetings/${row.id}`}
        name={row.title}
        shape="square"
      />
    ),
  }),
  fieldColumn("meeting", "startsAt", {
    renderCell: (row) => (
      <span class={styles.meta}>{formatAppDateTime(row.startsAt)}</span>
    ),
  }),
  fieldColumn("meeting", "organizer", {
    renderCell: (row) => <RecordChip name={row.organizerName} shape="round" />,
  }),
  fieldColumn("meeting", "company", {
    renderCell: (row) =>
      row.organizationId && row.companyName ? (
        <RecordLinkChip
          href={`/companies/${row.organizationId}`}
          name={row.companyName}
          shape="square"
        />
      ) : null,
  }),
  fieldColumn("meeting", "guests", {
    renderCell: (row) => <span class={styles.meta}>{row.guestCount}</span>,
  }),
  fieldColumn("meeting", "status", {
    renderCell: (row) => <MeetingStatusTag status={row.status} />,
  }),
];

// Every member sees the meetings they organize or are invited to; a role
// with meeting:view:all sees all of them.
export function MeetingList() {
  const navigate = useNavigate();
  const { openPanel } = useSidePanel();
  const { currentUser } = useAuthenticatedSession();
  const meetings = createGridSource(
    () => meetingsQuery({}),
    (rows) => ({ rows }),
  );
  const canSchedule = () => hasPermission(currentUser(), "meeting:schedule");

  const definition: RecordIndexDefinition<MeetingSummaryView> = {
    id: "meetings",
    title: () => "Reuniones",
    ariaLabel: "Reuniones",
    class: styles.index,
    object: { label: "Reuniones", icon: CalendarDays, color: "purple" },
    columns: COLUMNS,
    source: meetings.source,
    onRowOpen: (row) => navigate(`/meetings/${row.id}`),
    rowOpenIndicator: "route",
    emptyState: {
      icon: CalendarDays,
      title: "Sin reuniones",
      description: canSchedule()
        ? "Agenda una reunión con Nueva reunión. Cada invitado recibe un correo con la invitación de calendario."
        : "Las reuniones a las que te inviten aparecen aquí.",
    },
    createAction: canSchedule()
      ? {
          label: "Nueva reunión",
          onClick: () => openPanel(createMeetingFormSidePanelPage({})),
        }
      : undefined,
  };

  return (
    <Errored fallback={<p>No se pudieron cargar las reuniones.</p>}>
      <RecordIndexScreen definition={definition} />
    </Errored>
  );
}
