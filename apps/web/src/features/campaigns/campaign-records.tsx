import { useAction, useSearchParams } from "@solidjs/router";
import { Errored, For, Show, createMemo, createSignal } from "solid-js";

import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import Target from "~/components/icons/target";
import { useAuthenticatedSession } from "~/components/providers/authenticated-session-provider";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Select } from "~/components/ui/input/select";
import {
  RecordChip,
  RecordLinkChip,
} from "~/components/ui/record-chip/record-chip";
import { Tag } from "~/components/ui/tag/tag";
import type {
  CampaignView,
  HeldCampaignRecordView,
} from "~/contracts/campaigns/views";
import { actionErrorMessage } from "~/contracts/errors";
import { hasPermission } from "~/domain/auth/access/rbac";
import { createGridSource } from "~/features/data-grid/model/create-grid-source";
import type { DataGridColumn } from "~/features/data-grid/model/types";
import {
  fieldColumn,
  metadataColumn,
} from "~/features/object-registry/field-column";
import { RecordIndexScreen } from "~/features/record-index/components/screen";
import type { RecordIndexDefinition } from "~/features/record-index/model/definition";
import { useSidePanelRowOpen } from "~/features/side-panel/hooks/use-side-panel-row-open";
import { createCampaignRecordSidePanelPage } from "~/features/side-panel/types/side-panel-page";
import {
  campaignAvailabilityQuery,
  campaignsQuery,
  myCampaignBatchQuery,
} from "~/rpc/campaigns/queries";

import {
  drawCampaignBatchMutation,
  releaseCampaignBatchMutation,
} from "./data/mutations";
import { factField, factNames } from "./model/facts";

import styles from "./campaign-records.module.css";

function campaignColumns(
  facts: ReadonlyArray<string>,
  canReadCompany: boolean,
): ReadonlyArray<DataGridColumn<HeldCampaignRecordView>> {
  return [
    fieldColumn("campaignRecord", "legalName", {
      renderCell: (row) => (
        <Show
          when={canReadCompany}
          fallback={<RecordChip name={row.legalName ?? row.ruc} />}
        >
          <RecordLinkChip
            href={`/companies/${row.organizationId}`}
            name={row.legalName ?? row.ruc}
            shape="square"
          />
        </Show>
      ),
    }),
    fieldColumn("campaignRecord", "ruc", {
      renderCell: (row) => <span class={styles.meta}>{row.ruc}</span>,
    }),
    fieldColumn("campaignRecord", "segment", {
      renderCell: (row) => <Tag color="gray" text={row.segment} />,
    }),
    ...facts.map((fact) =>
      metadataColumn<HeldCampaignRecordView>(
        "campaignRecord",
        factField(fact),
        {
          renderCell: (row) => (
            <span class={styles.meta}>{row.facts[fact] ?? ""}</span>
          ),
        },
      ),
    ),
  ];
}

export function CampaignRecords() {
  const campaigns = createMemo(() => campaignsQuery());

  return (
    <Show when={campaigns()[0]} fallback={<NoCampaigns />}>
      {(first) => (
        <CampaignIndex campaigns={campaigns()} defaultCampaign={first()} />
      )}
    </Show>
  );
}

// The page keeps its header and columns with no campaign, as Twenty does for
// an object with no records; the empty state sits inside the grid.
function NoCampaigns() {
  const { currentUser } = useAuthenticatedSession();

  return (
    <RecordIndexScreen<HeldCampaignRecordView>
      definition={{
        id: "campaigns-empty",
        title: () => "Campañas",
        ariaLabel: "Campañas",
        class: styles.index,
        object: { label: "Campañas", icon: Target, color: "blue" },
        columns: campaignColumns(
          [],
          hasPermission(currentUser(), "company:read"),
        ),
        source: () => ({ rows: [] }),
        emptyState: {
          icon: Target,
          title: "Sin campañas",
          description:
            "Un gerente comercial carga las bases en Configuración, Campañas.",
        },
      }}
    />
  );
}

// Each campaign is a view; its rows are the companies of the viewer's batch.
function CampaignIndex(props: {
  campaigns: CampaignView[];
  defaultCampaign: CampaignView;
}) {
  const { currentUser } = useAuthenticatedSession();
  const { enqueueErrorSnackBar, enqueueSuccessSnackBar } = useSnackBar();
  const release = useAction(releaseCampaignBatchMutation);
  const [search, setSearch] = useSearchParams<{ view?: string }>();
  const [drawing, setDrawing] = createSignal(false);
  const [releasing, setReleasing] = createSignal(false);
  const [confirmRelease, setConfirmRelease] = createSignal(false);

  const campaign = () =>
    props.campaigns.find((candidate) => candidate.id === search.view) ??
    props.defaultCampaign;
  const batch = createGridSource(
    () => myCampaignBatchQuery(campaign().id),
    (rows) => ({ rows }),
  );
  const availability = createMemo(() =>
    campaignAvailabilityQuery(campaign().id),
  );
  const available = () =>
    availability().reduce((sum, segment) => sum + segment.available, 0);
  const held = () => batch.source().rows.length;

  // A string, so a worked row that leaves the fact names alone does not
  // rebuild the grid.
  const factList = createMemo(() => factNames(batch.data()).join("\n"));
  const facts = () => (factList() === "" ? [] : factList().split("\n"));

  const openRecord = useSidePanelRowOpen((row: HeldCampaignRecordView) =>
    createCampaignRecordSidePanelPage({
      campaignId: campaign().id,
      record: row,
    }),
  );

  async function releaseBatch(): Promise<void> {
    setReleasing(true);
    try {
      const result = await release(campaign().id);
      if (!result.ok) {
        enqueueErrorSnackBar(result.error.message);
        return;
      }
      setConfirmRelease(false);
      enqueueSuccessSnackBar(
        `Devolviste ${result.value.released} empresas a la campaña.`,
      );
    } catch (caught: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(caught));
    } finally {
      setReleasing(false);
    }
  }

  const definition = (): RecordIndexDefinition<HeldCampaignRecordView> => ({
    id: `campaign-${campaign().id}`,
    title: () => campaign().name,
    ariaLabel: "Campañas",
    class: styles.index,
    object: { label: "Campañas", icon: Target, color: "blue" },
    columns: campaignColumns(
      facts(),
      hasPermission(currentUser(), "company:read"),
    ),
    source: batch.source,
    onRowOpen: openRecord,
    rowOpenIndicator: "panel",
    emptyState:
      available() > 0
        ? {
            icon: Target,
            title: "Toma un lote",
            description:
              "Recibes hasta 30 empresas de esta campaña que nadie más está trabajando.",
          }
        : {
            icon: Target,
            title: "No quedan empresas por trabajar",
            description:
              "Todas las empresas de esta campaña ya fueron tomadas o trabajadas.",
          },
    createAction:
      available() > 0
        ? { label: "Tomar lote", onClick: () => setDrawing(true) }
        : undefined,
    actions:
      held() > 0
        ? [
            {
              label: "Devolver pendientes",
              onClick: () => {
                setConfirmRelease(true);
              },
            },
          ]
        : [],
    views: {
      catalog: {
        available: props.campaigns.map((each) => ({
          id: each.id,
          label: each.name,
        })),
      },
      control: {
        value: () => campaign().id,
        set: (id) => setSearch({ view: id }),
      },
    },
  });

  return (
    <Errored fallback={<p>No se pudo cargar la campaña.</p>}>
      <Show when={definition()} keyed>
        {(current) => <RecordIndexScreen definition={current} />}
      </Show>
      <DrawBatchDialog
        isOpen={drawing()}
        campaignId={campaign().id}
        onClose={() => setDrawing(false)}
      />
      <ConfirmDialog
        isOpen={confirmRelease()}
        title={`¿Devolver ${held()} empresas?`}
        description="Las empresas que no marcaste como trabajadas vuelven a la campaña y otro ejecutivo puede tomarlas."
        confirmLabel="Devolver"
        loading={releasing()}
        onConfirm={() => void releaseBatch()}
        onClose={() => setConfirmRelease(false)}
      />
    </Errored>
  );
}

function DrawBatchDialog(props: {
  isOpen: boolean;
  campaignId: string;
  onClose: () => void;
}) {
  const draw = useAction(drawCampaignBatchMutation);
  const { enqueueErrorSnackBar } = useSnackBar();
  const availability = createMemo(() =>
    campaignAvailabilityQuery(props.campaignId),
  );
  const total = () =>
    availability().reduce((sum, segment) => sum + segment.available, 0);
  const [segment, setSegment] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  async function takeBatch(): Promise<void> {
    setBusy(true);
    try {
      const result = await draw({
        campaignId: props.campaignId,
        ...(segment() ? { segment: segment() } : {}),
      });
      if (!result.ok) {
        enqueueErrorSnackBar(result.error.message);
        return;
      }
      props.onClose();
    } catch (caught: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      isOpen={props.isOpen}
      title="Tomar lote"
      description="Recibes hasta 30 empresas que nadie más está trabajando."
      confirmLabel="Tomar lote"
      variant="primary"
      loading={busy()}
      onConfirm={() => void takeBatch()}
      onClose={props.onClose}
    >
      <Show when={availability().length > 1}>
        <Select
          label="Segmento"
          value={segment()}
          disabled={busy()}
          onInput={(event) => setSegment(event.currentTarget.value)}
        >
          <option value="">Todos ({total()} disponibles)</option>
          <For each={availability()}>
            {(option) => (
              <option value={option.segment}>
                {option.segment} ({option.available})
              </option>
            )}
          </For>
        </Select>
      </Show>
    </ConfirmDialog>
  );
}
