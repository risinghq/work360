import Building2 from "~/components/icons/building-2";
import CalendarDays from "~/components/icons/calendar-days";
import Info from "~/components/icons/info";
import List from "~/components/icons/list";
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
// put, then the fields a user works the record by (stage, owner, next step),
// then the reference fields. A field takes the default width unless its
// content needs another one.
const NAME_COLUMN: DataGridColumn<LeadListRowView> = {
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
};

const STAGE_COLUMN: DataGridColumn<LeadListRowView> = {
  key: "stage",
  label: "Etapa",
  icon: Target,
  renderCell: (lead) => (
    <Tag color={leadStageColor(lead.stage)} text={leadStageLabel(lead.stage)} />
  ),
};

const REFERENCE_COLUMNS: ReadonlyArray<DataGridColumn<LeadListRowView>> = [
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
    width: 120,
    renderCell: (lead) =>
      lead.priority ? (
        <Tag color="gray" text={capitalize(lead.priority)} />
      ) : null,
  },
  {
    key: "ruc",
    label: "RUC",
    icon: List,
    width: 120,
    renderCell: (lead) => <span class={styles.mutedCellText}>{lead.ruc}</span>,
  },
  {
    key: "updatedAt",
    label: "Actualizado",
    icon: CalendarDays,
    width: 120,
    renderCell: (lead) => (
      <span class={styles.mutedCellText}>{formatAppDate(lead.updatedAt)}</span>
    ),
  },
];

const CREATED_BY_COLUMN: DataGridColumn<LeadListRowView> = {
  key: "createdBy",
  label: "Registrado por",
  icon: User,
  width: 160,
  renderCell: (lead) => <RecordChip name={lead.createdByName} shape="round" />,
};

function executiveColumn(
  canReassign: boolean,
): DataGridColumn<LeadListRowView> {
  return {
    key: "executive",
    label: "Ejecutivo",
    icon: User,
    width: 160,
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
  return [
    NAME_COLUMN,
    STAGE_COLUMN,
    executiveColumn(hasPermission(member, "lead:reassign")),
    ...REFERENCE_COLUMNS,
    ...(member.role === "back_office" ? [CREATED_BY_COLUMN] : []),
  ];
}
