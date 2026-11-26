import Building2 from "~/components/icons/building-2";
import CalendarDays from "~/components/icons/calendar-days";
import CircleQuestionMark from "~/components/icons/circle-question-mark";
import Info from "~/components/icons/info";
import Package from "~/components/icons/package";
import Target from "~/components/icons/target";
import TimelineEvent from "~/components/icons/timeline-event";
import User from "~/components/icons/user";
import {
  RecordChip,
  RecordLinkChip,
} from "~/components/ui/record-chip/record-chip";
import { Tag } from "~/components/ui/tag/tag";
import type { LeadListRowView } from "~/contracts/workflow/views";
import {
  hasPermission,
  type PermissionHolder,
  type Role,
} from "~/domain/auth/access/rbac";
import { formatAppDate } from "~/domain/time/app-time";
import type { DataGridColumn } from "~/features/data-grid/model/types";
import { ExecutivePicker } from "~/features/workflow/detail/actions/executive-picker";
import {
  leadNextStepLabel,
  leadStageColor,
  leadStageLabel,
} from "~/features/workflow/presentation/lead-display";
import { capitalize } from "~/shared/text";

import styles from "./styles.module.css";

// Twenty's layout: the field that names the record comes first and stays
// put, the other fields take the default width unless their content needs
// another one.
const COMMON_COLUMNS: ReadonlyArray<DataGridColumn<LeadListRowView>> = [
  {
    key: "legalName",
    label: "Razón social",
    icon: Building2,
    width: 240,
    sticky: true,
    renderCell: (lead) => (
      <RecordLinkChip
        href={`/records/${lead.id}`}
        name={lead.legalName ?? lead.ruc}
        shape="square"
      />
    ),
  },
  {
    key: "ruc",
    label: "RUC",
    icon: CircleQuestionMark,
    width: 120,
    renderCell: (lead) => <span class={styles.mutedCellText}>{lead.ruc}</span>,
  },
  {
    key: "stage",
    label: "Etapa",
    icon: Target,
    renderCell: (lead) => (
      <Tag
        color={leadStageColor(lead.stage)}
        text={leadStageLabel(lead.stage)}
      />
    ),
  },
  {
    key: "status",
    label: "Estado",
    icon: Info,
    renderCell: (lead) =>
      lead.status ? <Tag color="gray" text={capitalize(lead.status)} /> : null,
  },
  {
    key: "priority",
    label: "Prioridad",
    icon: Package,
    renderCell: (lead) =>
      lead.priority ? (
        <Tag color="gray" text={capitalize(lead.priority)} />
      ) : null,
  },
  {
    key: "nextStep",
    label: "Siguiente paso",
    icon: TimelineEvent,
    width: 180,
    renderCell: (lead) => (
      <span class={styles.mutedCellText}>
        {leadNextStepLabel(lead.nextStep)}
      </span>
    ),
  },
  {
    key: "updatedAt",
    label: "Actualizado",
    icon: CalendarDays,
    renderCell: (lead) => (
      <span class={styles.mutedCellText}>{formatAppDate(lead.updatedAt)}</span>
    ),
  },
];

const CREATED_BY_COLUMN: DataGridColumn<LeadListRowView> = {
  key: "createdBy",
  label: "Registrado por",
  icon: User,
  renderCell: (lead) => <RecordChip name={lead.createdByName} shape="round" />,
};

function executiveColumn(
  canReassign: boolean,
): DataGridColumn<LeadListRowView> {
  return {
    key: "executive",
    label: "Ejecutivo",
    icon: User,
    renderCell: (lead) => (
      <RecordChip name={lead.executiveName} shape="round" />
    ),
    // Reassignment uses the same editor and mutation as record detail.
    edit: canReassign
      ? {
          ariaLabel: "Reasignar ejecutivo",
          renderEditor: (row, close) => (
            <ExecutivePicker
              leadId={row.id}
              currentUserId={row.executiveId}
              onSelect={close}
              onClose={close}
            />
          ),
        }
      : undefined,
  };
}

export function workspaceColumnsForRole(
  member: PermissionHolder & { role: Role },
): ReadonlyArray<DataGridColumn<LeadListRowView>> {
  const columns: DataGridColumn<LeadListRowView>[] = [
    ...COMMON_COLUMNS,
    executiveColumn(hasPermission(member, "lead:reassign")),
  ];

  if (member.role === "back_office") {
    columns.push(CREATED_BY_COLUMN);
  }

  return columns;
}
