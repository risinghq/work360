import { useAction, useNavigate, useSearchParams } from "@solidjs/router";
import { Errored, Loading, Show, createMemo } from "solid-js";

import { saveSheet } from "~/browser/files/sheet";
import { EmptyState } from "~/components/feedback/empty-state/empty";
import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import { Spinner } from "~/components/feedback/spinner/spinner";
import Inbox from "~/components/icons/inbox";
import { useAuthenticatedSession } from "~/components/providers/authenticated-session-provider";
import {
  RecordChip,
  RecordLinkChip,
} from "~/components/ui/record-chip/record-chip";
import { Tag } from "~/components/ui/tag/tag";
import type { CaseSummaryView, CaseTypeView } from "~/contracts/cases/views";
import { actionErrorMessage } from "~/contracts/errors";
import { caseStageField } from "~/contracts/objects/registry";
import { caseViewObject } from "~/contracts/views/views";
import { hasPermission } from "~/domain/auth/access/rbac";
import { formatAppDateTime } from "~/domain/time/app-time";
import { requestCaseReportMutation } from "~/features/cases/data/mutations";
import { createGridSource } from "~/features/data-grid/model/create-grid-source";
import type { DataGridColumn } from "~/features/data-grid/model/types";
import {
  fieldColumn,
  metadataColumn,
} from "~/features/object-registry/field-column";
import { RecordIndexScreen } from "~/features/record-index/components/screen";
import type { RecordIndexDefinition } from "~/features/record-index/model/definition";
import { useSidePanel } from "~/features/side-panel/state/use-side-panel";
import { createCaseCreateSidePanelPage } from "~/features/side-panel/types/side-panel-page";
import {
  caseTypesQuery,
  casesQuery,
  waitingCasesQuery,
} from "~/rpc/cases/queries";

import styles from "./cases.module.css";

// A view is one case type, whole or narrowed to the cases waiting on the
// viewer's role: "<type key>" or "<type key>.waiting".
type CaseView = {
  id: string;
  label: string;
  type: CaseTypeView;
  waiting: boolean;
};

function caseViews(types: ReadonlyArray<CaseTypeView>): CaseView[] {
  const multiple = types.length > 1;
  return types.flatMap((type) => {
    const all = {
      id: type.key,
      label: multiple ? type.name : "Todos",
      type,
      waiting: false,
    };
    if (!type.hasQueue) return [all];
    const waiting = {
      id: `${type.key}.waiting`,
      label: multiple ? `${type.name} · Por atender` : "Por atender",
      type,
      waiting: true,
    };
    return [waiting, all];
  });
}

function caseColumns(
  type: CaseTypeView,
): ReadonlyArray<DataGridColumn<CaseSummaryView>> {
  return [
    fieldColumn("case", "legalName", {
      renderCell: (row) => (
        <RecordLinkChip
          href={`/cases/${row.id}`}
          name={row.legalName ?? row.ruc}
          shape="square"
        />
      ),
    }),
    fieldColumn("case", "ruc", {
      renderCell: (row) => <span class={styles.meta}>{row.ruc}</span>,
    }),
    ...type.stages.map((stage) =>
      metadataColumn<CaseSummaryView>("case", caseStageField(stage), {
        renderCell: (row) => (
          <Tag color="gray" text={row.statuses[stage.key] ?? "Sin estado"} />
        ),
      }),
    ),
    fieldColumn("case", "holder", {
      renderCell: (row) => <RecordChip name={row.holderName} shape="round" />,
    }),
    fieldColumn("case", "updatedAt", {
      renderCell: (row) => (
        <span class={styles.meta}>{formatAppDateTime(row.updatedAt)}</span>
      ),
    }),
  ];
}

export function CaseList() {
  const types = createMemo(() => caseTypesQuery());
  const views = createMemo(() => caseViews(types()));

  return (
    <Loading fallback={<Spinner size="lg" />}>
      <Show
        when={views()[0]}
        fallback={
          <EmptyState
            title="Sin procesos"
            description="Este espacio de trabajo todavía no tiene un proceso de casos."
          />
        }
      >
        {(first) => <CaseIndex views={views()} defaultView={first()} />}
      </Show>
    </Loading>
  );
}

function CaseIndex(props: { views: CaseView[]; defaultView: CaseView }) {
  const navigate = useNavigate();
  const { openPanel } = useSidePanel();
  const { currentUser } = useAuthenticatedSession();
  const { enqueueErrorSnackBar } = useSnackBar();
  const requestReport = useAction(requestCaseReportMutation);
  const [search, setSearch] = useSearchParams<{ view?: string }>();

  const view = () =>
    props.views.find((candidate) => candidate.id === search.view) ??
    props.defaultView;
  const type = () => view().type;

  const cases = createGridSource(
    () =>
      view().waiting ? waitingCasesQuery(type().id) : casesQuery(type().id),
    (rows) => ({ rows }),
  );

  async function exportCases() {
    try {
      await saveSheet(await requestReport(type().id));
    } catch (error) {
      enqueueErrorSnackBar(actionErrorMessage(error));
    }
  }

  const definition = (): RecordIndexDefinition<CaseSummaryView> => ({
    id: `cases-${type().key}`,
    title: () => view().label,
    ariaLabel: "Casos",
    class: styles.index,
    object: { label: type().name, icon: Inbox, color: "orange" },
    columns: caseColumns(type()),
    savedView: {
      object: caseViewObject(type().id),
      canSave: hasPermission(currentUser(), "view:manage"),
    },
    source: cases.source,
    onRowOpen: (row) => navigate(`/cases/${row.id}`),
    rowOpenIndicator: "route",
    emptyState: view().waiting
      ? {
          icon: Inbox,
          title: "Nada por atender",
          description:
            "Cuando un caso llegue a una etapa de tu rol, aparece aquí.",
        }
      : {
          icon: Inbox,
          title: "Sin casos",
          description: type().canOpen
            ? "Abre un caso con Nuevo caso o desde una empresa de tu lote de campaña."
            : "Todavía no hay casos de este proceso.",
        },
    createAction: type().canOpen
      ? {
          label: "Nuevo caso",
          onClick: () =>
            openPanel(
              createCaseCreateSidePanelPage({ caseTypeKey: type().key }),
            ),
        }
      : undefined,
    actions: [{ label: "Exportar", onClick: exportCases }],
    views: {
      catalog: { available: props.views },
      control: {
        value: () => view().id,
        set: (id) => setSearch({ view: id }),
      },
    },
  });

  return (
    <Errored fallback={<p>No se pudieron cargar los casos.</p>}>
      <Show when={definition()} keyed>
        {(current) => <RecordIndexScreen definition={current} />}
      </Show>
    </Errored>
  );
}
