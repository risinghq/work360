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
import { fieldColumn } from "~/features/object-registry/field-column";
import { ExecutivePicker } from "~/features/workflow/detail/actions/executive-picker";
import {
  leadNextStepLabel,
  leadStageColor,
  leadStageLabel,
} from "~/features/workflow/presentation/lead-display";
import { capitalize } from "~/shared/text";

import styles from "./styles.module.css";

// The saved view orders and sizes these columns; see
// server/views/domain/default-views.ts for the seed.
const NAME_COLUMN = fieldColumn<"lead", LeadListRowView>("lead", "legalName", {
  renderCell: (lead) => (
    <RecordLinkChip
      href={`/records/${lead.id}`}
      name={lead.legalName ?? lead.ruc}
      shape="square"
    />
  ),
});

const STAGE_COLUMN = fieldColumn<"lead", LeadListRowView>("lead", "stage", {
  renderCell: (lead) => (
    <Tag color={leadStageColor(lead.stage)} text={leadStageLabel(lead.stage)} />
  ),
});

const REFERENCE_COLUMNS: ReadonlyArray<DataGridColumn<LeadListRowView>> = [
  fieldColumn("lead", "nextStep", {
    renderCell: (lead) => (
      <span class={styles.mutedCellText}>
        {leadNextStepLabel(lead.nextStep)}
      </span>
    ),
  }),
  fieldColumn("lead", "status", {
    renderCell: (lead) =>
      lead.status ? <Tag color="gray" text={capitalize(lead.status)} /> : null,
  }),
  fieldColumn("lead", "priority", {
    renderCell: (lead) =>
      lead.priority ? (
        <Tag color="gray" text={capitalize(lead.priority)} />
      ) : null,
  }),
  fieldColumn("lead", "ruc", {
    renderCell: (lead) => <span class={styles.mutedCellText}>{lead.ruc}</span>,
  }),
  fieldColumn("lead", "updatedAt", {
    renderCell: (lead) => (
      <span class={styles.mutedCellText}>{formatAppDate(lead.updatedAt)}</span>
    ),
  }),
];

const CREATED_BY_COLUMN = fieldColumn<"lead", LeadListRowView>(
  "lead",
  "createdBy",
  {
    renderCell: (lead) => (
      <RecordChip name={lead.createdByName} shape="round" />
    ),
  },
);

function executiveColumn(
  canReassign: boolean,
): DataGridColumn<LeadListRowView> {
  return fieldColumn("lead", "executive", {
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
  });
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
