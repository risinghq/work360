import { createMemo, Errored, Loading } from "solid-js";

import { saveCsv } from "~/browser/files/sheet";
import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import { Spinner } from "~/components/feedback/spinner/spinner";
import Building2 from "~/components/icons/building-2";
import List from "~/components/icons/list";
import { useAuthenticatedSession } from "~/components/providers/authenticated-session-provider";
import type { LeadListRowView } from "~/contracts/workflow/views";
import { hasPermission } from "~/domain/auth/access/rbac";
import { createPagedGridSource } from "~/features/data-grid/model/create-paged-grid-source";
import { RecordIndexScreen } from "~/features/record-index/components/screen";
import type { RecordIndexDefinition } from "~/features/record-index/model/definition";
import { viewQuery } from "~/rpc/views/queries";
import { exportWorkflowLeads } from "~/rpc/workflow/files";
import { leadDetailQuery } from "~/rpc/workflow/lead-detail";
import { leadListQuery } from "~/rpc/workflow/lead-list";
import { pendingQuotationCountQuery } from "~/rpc/workflow/pending-quotation-count";

import { workspaceColumnsForRole } from "./columns";
import { useCreateLeadRecordAction } from "./create-action";
import { LEAD_WORKSPACE_FILTER } from "./filter";
import { ImportDropzone } from "./import-dropzone";
import { LEAD_PAGE_SIZE, resolveLeadListQueryInput } from "./lead-list-query";
import { useOpenLeadRecord } from "./open-row";
import {
  leadFilterValue,
  leadSortValue,
  leadViewFilter,
  leadViewSort,
} from "./saved-view-query";
import { LEAD_WORKSPACE_SORT } from "./sort";
import { useLeadIndexRoute } from "./use-lead-index-route";
import { useRecordsImport } from "./use-records-import";
import { defaultViewIdForRole, viewsForRole } from "./views";

import styles from "./styles.module.css";

async function handleLeadsExport() {
  saveCsv(await exportWorkflowLeads());
}

export function LeadsWorkspace() {
  const { currentUser } = useAuthenticatedSession();
  const user = currentUser();

  const canRegister = hasPermission(user, "lead:register");
  const canManageIntegrations = hasPermission(user, "integration:manage");

  const availableViews = viewsForRole(user);
  const savedView = createMemo(() => viewQuery("lead"));
  const route = useLeadIndexRoute({
    availableViews,
    defaultViewId: defaultViewIdForRole(user),
    savedView,
  });

  const input = createMemo(() =>
    resolveLeadListQueryInput(
      {
        view: route.view.value(),
        filter: route.filter.value(),
        sort: route.sort.value(),
        search: route.search.query(),
      },
      {
        id: user.id,
        role: user.role,
        permissions: user.permissions,
      },
    ),
  );
  const leads = createPagedGridSource({
    pageSize: LEAD_PAGE_SIZE,
    resetKey: input,
    load: (limit, offset) => leadListQuery({ ...input(), limit, offset }),
  });

  const openLeadRecord = useOpenLeadRecord();
  const { enqueueWarningSnackBar } = useSnackBar();

  const createAction = useCreateLeadRecordAction({
    blockedReason: async () => {
      const { count, limit } = await pendingQuotationCountQuery();

      if (limit === null || count < limit) {
        return null;
      }

      return `Tienes ${count} cotizaciones pendientes de decisión. Acéptalas, solicita revisión o ciérralas para registrar nuevos clientes.`;
    },
    onBlocked: enqueueWarningSnackBar,
  });

  const recordImport = useRecordsImport();

  const recordIndex = {
    id: "leads-workspace",
    title: () => route.activeView().label,
    ariaLabel: "Clientes",
    class: styles.page,
    pickerIcon: List,

    object: {
      label: "Registros",
      icon: Building2,
      color: "blue",
    },

    columns: workspaceColumnsForRole(user),
    savedView: {
      object: "lead",
      canSave: hasPermission(user, "view:manage"),
      sort: { read: leadSortValue, write: leadViewSort },
      filter: { read: leadFilterValue, write: leadViewFilter },
    },
    source: leads.source,
    loadMore: leads.loadMore,

    search: {
      value: route.search.value,
      placeholder: "RUC, cliente, dirección o ejecutivo",
      set: route.search.set,
    },

    onRowOpen: openLeadRecord,
    // allSettled keeps a failed warm-up out of Sentry; the open reads again.
    onRowIntent: (id) => void Promise.allSettled([leadDetailQuery(id)]),
    rowOpenIndicator: "panel",

    emptyState: {
      icon: Building2,
      title: "No hay clientes",
      description: "No hay clientes que coincidan con los filtros actuales.",
    },

    createAction: canRegister ? createAction : undefined,

    views: {
      catalog: {
        available: availableViews,
      },
      control: route.view,
    },

    actions: canManageIntegrations
      ? [
          {
            label: "Importar",
            onClick: () => recordImport.openFilePicker(),
          },
          {
            label: "Exportar",
            onClick: handleLeadsExport,
          },
        ]
      : undefined,

    filter: {
      catalog: LEAD_WORKSPACE_FILTER,
      control: route.filter,
    },

    sort: {
      catalog: LEAD_WORKSPACE_SORT,
      control: route.sort,
    },
  } satisfies RecordIndexDefinition<LeadListRowView>;

  return (
    <ImportDropzone
      enabled={canManageIntegrations}
      onFileDropped={recordImport.importFile}
    >
      <input
        ref={recordImport.bindFileInput}
        type="file"
        accept=".csv,.xlsx"
        style={{ display: "none" }}
        onChange={recordImport.onFileInputChange}
      />

      <Loading fallback={<Spinner size="lg" />}>
        <Errored fallback={<p>No se pudieron cargar los registros.</p>}>
          <RecordIndexScreen definition={recordIndex} />
        </Errored>
      </Loading>
    </ImportDropzone>
  );
}
