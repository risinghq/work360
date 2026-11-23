import { revalidate, useAction } from "@solidjs/router";
import { For, Loading, Show, createMemo, createSignal } from "solid-js";

import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import { useAuthenticatedSession } from "~/components/providers/authenticated-session-provider";
import { Skeleton } from "~/components/ui/feedback/skeleton";
import { Button } from "~/components/ui/input/button";
import { Select } from "~/components/ui/input/select";
import { Tag } from "~/components/ui/tag/tag";
import type {
  CaseDetailView,
  CaseEventView,
  CaseFieldView,
  CaseStageView,
} from "~/contracts/cases/views";
import { actionErrorMessage } from "~/contracts/errors";
import { hasPermission } from "~/domain/auth/access/rbac";
import { formatAppDateTime } from "~/domain/time/app-time";
import { CallWithExtension } from "~/features/extension/call-with-extension";
import { caseQuery } from "~/rpc/cases/queries";

import {
  CaseFieldInput,
  CaseFileDownload,
  displayValue,
  fromFormValues,
  requiredFieldKeys,
  toFormValues,
} from "./case-fields";
import { reassignCaseMutation, writeCaseStageMutation } from "./data/mutations";

import styles from "./cases.module.css";

const ACCESS_HINTS: Record<
  Exclude<CaseStageView["access"], "writable">,
  string
> = {
  amending:
    "La etapa siguiente ya atiende el caso. Aún puedes actualizar estos datos.",
  not_owned: "Otro rol completa esta etapa.",
  other_branch: "Otra sede atiende este caso.",
  not_open: "Esta etapa se abre cuando la anterior avanza.",
  locked: "Esta etapa ya está cerrada.",
};

// The name of the file a saved file field holds.
function savedFileName(
  detail: CaseDetailView,
  field: CaseFieldView,
): string | undefined {
  const value = detail.values[field.key];
  return field.kind === "file" && typeof value === "string"
    ? detail.fileNames[value]
    : undefined;
}

export function CaseDetail(props: { caseId: string }) {
  const detail = createMemo(() => caseQuery(props.caseId));
  const { currentUser } = useAuthenticatedSession();
  const canCall = () => hasPermission(currentUser(), "case:work");
  const canReadCompany = () => hasPermission(currentUser(), "company:read");

  return (
    <Loading fallback={<Skeleton height={320} />}>
      <div class={styles.page}>
        <header class={styles.caseHeader}>
          <Show
            when={canReadCompany()}
            fallback={
              <span class={styles.title}>
                {detail().legalName ?? detail().ruc}
              </span>
            }
          >
            <a
              class={styles.title}
              href={`/companies/${detail().organizationId}`}
            >
              {detail().legalName ?? detail().ruc}
            </a>
          </Show>
          <span class={styles.meta}>
            RUC {detail().ruc} · {detail().caseType.name} · Responsable{" "}
            {detail().holderName}
          </span>
          <Show when={canCall()}>
            <CallWithExtension
              request={{ subject: { kind: "case", id: props.caseId } }}
            />
          </Show>
        </header>
        <Show when={detail().holderCandidates.length > 0}>
          <ReassignForm detail={detail()} />
        </Show>
        <For each={detail().stages}>
          {(stage) => <CaseStage detail={detail()} stage={stage} />}
        </For>
        <CaseHistory events={detail().events} />
      </div>
    </Loading>
  );
}

function ReassignForm(props: { detail: CaseDetailView }) {
  const reassign = useAction(reassignCaseMutation);
  const { enqueueSuccessSnackBar } = useSnackBar();
  const [holder, setHolder] = createSignal(props.detail.holderUserId);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const result = await reassign({
        caseId: props.detail.id,
        expectedVersion: props.detail.version,
        holderUserId: holder(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      enqueueSuccessSnackBar("Caso reasignado.");
    } catch (caught: unknown) {
      setError(actionErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form class={styles.reassign} onSubmit={(event) => void submit(event)}>
      <Select
        label="Responsable"
        value={holder()}
        disabled={busy()}
        error={error()}
        onInput={(event) => setHolder(event.currentTarget.value)}
      >
        <For each={props.detail.holderCandidates}>
          {(candidate) => (
            <option value={candidate.id}>{candidate.name}</option>
          )}
        </For>
      </Select>
      <Button
        type="submit"
        variant="outline"
        loading={busy()}
        disabled={busy() || holder() === props.detail.holderUserId}
      >
        Reasignar
      </Button>
    </form>
  );
}

function eventText(event: CaseEventView): string {
  const actor = event.actorName ?? "Un usuario";
  switch (event.kind) {
    case "opened":
      return `${actor} registró el caso`;
    case "stage_written":
      return `${actor} guardó ${event.stageName ?? "una etapa"}: ${event.status ?? ""}`;
    case "reassigned":
      return `${actor} pasó el caso a ${event.holderName ?? "otro responsable"}`;
    case "timed_out":
      return `${event.stageName ?? "Una etapa"} venció y pasó a ${event.status ?? ""}`;
  }
}

function CaseHistory(props: { events: CaseEventView[] }) {
  return (
    <Show when={props.events.length > 0}>
      <section class={styles.stage}>
        <span class={styles.title}>Historial</span>
        <ol class={styles.history}>
          <For each={props.events}>
            {(event) => (
              <li class={styles.meta}>
                {formatAppDateTime(event.at)} · {eventText(event)}
              </li>
            )}
          </For>
        </ol>
      </section>
    </Show>
  );
}

function CaseStage(props: { detail: CaseDetailView; stage: CaseStageView }) {
  return (
    <section class={styles.stage}>
      <div class={styles.stageHeader}>
        <div class={styles.company}>
          <span class={styles.title}>{props.stage.name}</span>
          <span class={styles.meta}>{props.stage.ownerRoleLabel}</span>
        </div>
        <Tag color="gray" text={props.stage.status} />
      </div>
      <Show when={props.stage.access !== "writable"}>
        <StageValues detail={props.detail} stage={props.stage} />
      </Show>
      <Show
        when={
          props.stage.access === "writable" || props.stage.access === "amending"
        }
      >
        <StageForm detail={props.detail} stage={props.stage} />
      </Show>
      <Show when={props.stage.dueAt}>
        {(dueAt) => (
          <span class={styles.meta}>Vence el {formatAppDateTime(dueAt())}</span>
        )}
      </Show>
      <Show when={props.stage.lastAuthor}>
        {(author) => (
          <span class={styles.meta}>
            <Show
              when={author().name}
              fallback={<>Actualizado el {formatAppDateTime(author().at)}</>}
            >
              {(name) => (
                <>
                  Guardado por {name()} el {formatAppDateTime(author().at)}
                </>
              )}
            </Show>
          </span>
        )}
      </Show>
    </section>
  );
}

// An amended stage shows the values its form does not edit.
function StageValues(props: { detail: CaseDetailView; stage: CaseStageView }) {
  const hint = () => {
    const access = props.stage.access;
    return access === "writable" ? undefined : ACCESS_HINTS[access];
  };
  const fields = createMemo(() => {
    if (props.stage.access !== "amending") {
      return props.stage.fields;
    }
    const editable = new Set(
      props.stage.editableFields.map((field) => field.key),
    );
    return props.stage.fields.filter((field) => !editable.has(field.key));
  });
  return (
    <>
      <Show when={fields().length > 0}>
        <dl class={styles.values}>
          <For each={fields()}>
            {(field) => (
              <div class={styles.value}>
                <dt>{field.label}</dt>
                <dd>
                  <Show
                    when={savedFileName(props.detail, field)}
                    fallback={displayValue(
                      field,
                      props.detail.values[field.key],
                    )}
                  >
                    {(name) => (
                      <CaseFileDownload
                        caseId={props.detail.id}
                        fieldKey={field.key}
                        fileName={name()}
                      />
                    )}
                  </Show>
                </dd>
              </div>
            )}
          </For>
        </dl>
      </Show>
      <Show when={hint()}>
        {(text) => <span class={styles.hint}>{text()}</span>}
      </Show>
    </>
  );
}

function StageForm(props: { detail: CaseDetailView; stage: CaseStageView }) {
  const write = useAction(writeCaseStageMutation);
  const { enqueueSuccessSnackBar } = useSnackBar();
  const [form, setForm] = createSignal(
    toFormValues(props.stage.editableFields, props.detail.values),
  );
  const [status, setStatus] = createSignal(props.stage.status);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [conflict, setConflict] = createSignal(false);
  // The server checks required fields when the stage leaves its initial status,
  // or always for a stage that keeps them.
  const required = createMemo(() =>
    status() === props.stage.initialStatus && !props.stage.keepsRequired
      ? new Set<string>()
      : requiredFieldKeys(props.stage.editableFields, {
          values: {
            ...props.detail.values,
            ...fromFormValues(props.stage.editableFields, form()),
          },
          statuses: {
            ...Object.fromEntries(
              props.detail.stages.map((each) => [each.key, each.status]),
            ),
            [props.stage.key]: status(),
          },
        }),
  );

  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    setConflict(false);
    try {
      const result = await write({
        caseId: props.detail.id,
        expectedVersion: props.detail.version,
        stageKey: props.stage.key,
        status: status(),
        values: fromFormValues(props.stage.editableFields, form()),
      });
      if (!result.ok) {
        setError(result.error.message);
        setConflict(result.error.code === "case_conflict");
        return;
      }
      enqueueSuccessSnackBar(`${props.stage.name} guardada.`);
    } catch (caught: unknown) {
      setError(actionErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form class={styles.form} onSubmit={(event) => void save(event)}>
      <For each={props.stage.editableFields}>
        {(field) => (
          <>
            <CaseFieldInput
              field={field}
              value={form()[field.key] ?? ""}
              fileName={savedFileName(props.detail, field)}
              required={required().has(field.key)}
              disabled={busy()}
              onInput={(value) =>
                setForm((current) => ({ ...current, [field.key]: value }))
              }
            />
            <Show
              when={
                form()[field.key] === String(props.detail.values[field.key]) &&
                savedFileName(props.detail, field)
              }
            >
              {(name) => (
                <CaseFileDownload
                  caseId={props.detail.id}
                  fieldKey={field.key}
                  fileName={name()}
                />
              )}
            </Show>
          </>
        )}
      </For>
      <Show when={props.stage.access === "writable"}>
        <Select
          label="Estado"
          value={status()}
          disabled={busy()}
          onInput={(event) => setStatus(event.currentTarget.value)}
        >
          <For each={props.stage.statuses}>
            {(option) => <option value={option}>{option}</option>}
          </For>
        </Select>
      </Show>
      <Show when={error()}>
        {(message) => (
          <p class={styles.error} role="alert">
            {message()}
          </p>
        )}
      </Show>
      <div class={styles.actions}>
        <Button type="submit" loading={busy()} disabled={busy()}>
          Guardar
        </Button>
        <Show when={conflict()}>
          <Button
            type="button"
            variant="outline"
            onClick={() => revalidate(caseQuery.key)}
          >
            Recargar
          </Button>
        </Show>
      </div>
    </form>
  );
}
