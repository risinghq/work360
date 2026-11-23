import { useAction, useNavigate, useSearchParams } from "@solidjs/router";
import { For, Loading, Show, createMemo } from "solid-js";

import { EmptyState } from "~/components/feedback/empty-state/empty";
import { Skeleton } from "~/components/ui/feedback/skeleton";
import { Button } from "~/components/ui/input/button";
import { ExportButton } from "~/components/ui/input/export-button";
import { Select } from "~/components/ui/input/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/layout/table";
import { Tag } from "~/components/ui/tag/tag";
import type { CaseSummaryView, CaseTypeView } from "~/contracts/cases/views";
import { formatAppDateTime } from "~/domain/time/app-time";
import { requestCaseReportMutation } from "~/features/cases/data/mutations";
import { TabStrip } from "~/features/side-panel/components/tab-strip";
import {
  caseTypesQuery,
  casesQuery,
  waitingCasesQuery,
} from "~/rpc/cases/queries";

import styles from "./cases.module.css";

type CaseTab = "waiting" | "all";

export function CaseList() {
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const types = createMemo(() => caseTypesQuery());
  const selected = createMemo(() => {
    const list = types();
    return list.find((caseType) => caseType.key === search.type) ?? list[0];
  });

  return (
    <Loading fallback={<Skeleton height={240} />}>
      <Show
        when={selected()}
        fallback={
          <EmptyState
            title="Sin procesos"
            description="Este espacio de trabajo todavía no tiene un proceso de casos."
          />
        }
      >
        {(caseType) => (
          <div class={styles.page}>
            <div class={styles.toolbar}>
              <Show when={types().length > 1}>
                <div class={styles.picker}>
                  <Select
                    label="Proceso"
                    value={caseType().key}
                    onInput={(event) =>
                      setSearch({ type: event.currentTarget.value, tab: null })
                    }
                  >
                    <For each={types()}>
                      {(option) => (
                        <option value={option.key}>{option.name}</option>
                      )}
                    </For>
                  </Select>
                </div>
              </Show>
              <div class={styles.toolbarActions}>
                <CaseReportButton caseTypeId={caseType().id} />
                <Show when={caseType().canOpen}>
                  <Button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/cases/new?${new URLSearchParams({ type: caseType().key }).toString()}`,
                      )
                    }
                  >
                    Nuevo caso
                  </Button>
                </Show>
              </div>
            </div>
            <CaseTabs caseType={caseType()} />
          </div>
        )}
      </Show>
    </Loading>
  );
}

function CaseReportButton(props: { caseTypeId: string }) {
  const requestReport = useAction(requestCaseReportMutation);
  return <ExportButton start={() => requestReport(props.caseTypeId)} />;
}

function CaseTabs(props: { caseType: CaseTypeView }) {
  const [search, setSearch] = useSearchParams();
  const tab = (): CaseTab =>
    props.caseType.hasQueue && search.tab !== "all" ? "waiting" : "all";

  return (
    <>
      <Show when={props.caseType.hasQueue}>
        <TabStrip<CaseTab>
          tabs={[
            { id: "waiting", label: "Por atender" },
            { id: "all", label: "Todos" },
          ]}
          activeTab={tab()}
          onTabSelect={(id) => setSearch({ tab: id })}
        />
      </Show>
      <Loading fallback={<Skeleton height={200} />}>
        <Show
          when={tab() === "waiting"}
          fallback={<AllCases caseType={props.caseType} />}
        >
          <WaitingCases caseType={props.caseType} />
        </Show>
      </Loading>
    </>
  );
}

function WaitingCases(props: { caseType: CaseTypeView }) {
  const cases = createMemo(() => waitingCasesQuery(props.caseType.id));
  return (
    <CaseTable
      caseType={props.caseType}
      cases={cases()}
      empty={
        <EmptyState
          title="Nada por atender"
          description="Cuando un caso llegue a una etapa de tu rol, aparece aquí."
        />
      }
    />
  );
}

function AllCases(props: { caseType: CaseTypeView }) {
  const cases = createMemo(() => casesQuery(props.caseType.id));
  return (
    <CaseTable
      caseType={props.caseType}
      cases={cases()}
      empty={
        <EmptyState
          title="Sin casos"
          description={
            props.caseType.canOpen
              ? "Abre un caso con Nuevo caso o desde una empresa de tu lote de campaña."
              : "Todavía no hay casos de este proceso."
          }
        />
      }
    />
  );
}

function CaseTable(props: {
  caseType: CaseTypeView;
  cases: CaseSummaryView[];
  empty: ReturnType<typeof EmptyState>;
}) {
  const navigate = useNavigate();

  return (
    <Show when={props.cases.length > 0} fallback={props.empty}>
      <Table aria-label="Casos" variant="list">
        <TableHeader>
          <TableRow>
            <TableHead>Empresa</TableHead>
            <For each={props.caseType.stages}>
              {(stage) => <TableHead>{stage.name}</TableHead>}
            </For>
            <TableHead>Responsable</TableHead>
            <TableHead align="right">Actualizado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <For each={props.cases}>
            {(row) => {
              const open = () => navigate(`/cases/${row.id}`);
              return (
                <TableRow
                  clickable
                  tabindex={0}
                  onClick={open}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      open();
                    }
                  }}
                >
                  <TableCell>
                    <div class={styles.company}>
                      <span class={styles.name}>
                        {row.legalName ?? row.ruc}
                      </span>
                      <span class={styles.meta}>RUC {row.ruc}</span>
                    </div>
                  </TableCell>
                  <For each={props.caseType.stages}>
                    {(stage) => (
                      <TableCell>
                        <Tag
                          color="gray"
                          text={row.statuses[stage.key] ?? "Sin estado"}
                        />
                      </TableCell>
                    )}
                  </For>
                  <TableCell>{row.holderName}</TableCell>
                  <TableCell align="right" class={styles.meta}>
                    {formatAppDateTime(row.updatedAt)}
                  </TableCell>
                </TableRow>
              );
            }}
          </For>
        </TableBody>
      </Table>
    </Show>
  );
}
