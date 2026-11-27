import { Title } from "@solidjs/meta";
import { revalidate, useAction } from "@solidjs/router";
import { For, Loading, Show, createMemo, createSignal } from "solid-js";

import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import CircleCheckBig from "~/components/icons/circle-check-big";
import Inbox from "~/components/icons/inbox";
import TimelineEvent from "~/components/icons/timeline-event";
import { useAuthenticatedSession } from "~/components/providers/authenticated-session-provider";
import { Button } from "~/components/ui/input/button";
import { InlineOptionsEditor } from "~/components/ui/input/inline-field-editor";
import { Select } from "~/components/ui/input/select";
import { PageCardHeader } from "~/components/ui/layout/page-card/page-card-header";
import { RecordLinkChip } from "~/components/ui/record-chip/record-chip";
import { Tag } from "~/components/ui/tag/tag";
import type {
  CaseDetailView,
  CaseFieldView,
  CaseStageView,
} from "~/contracts/cases/views";
import { actionErrorMessage } from "~/contracts/errors";
import { OBJECTS } from "~/contracts/objects/registry";
import { hasPermission } from "~/domain/auth/access/rbac";
import { formatAppDateTime } from "~/domain/time/app-time";
import { caseTimeline } from "~/features/cases/model/case-timeline";
import { CallWithExtension } from "~/features/extension/call-with-extension";
import { MeetingsRelationCard } from "~/features/meetings/meetings-card";
import { RecordBreadcrumb } from "~/features/record-show/header/record-breadcrumb";
import type { RecordFieldValue } from "~/features/record-show/model/field-groups";
import { RecordPageLayout } from "~/features/record-show/page/record-page-layout";
import { RecordTabPane } from "~/features/record-show/page/record-tab-pane";
import {
  RecordFieldCell,
  RecordFieldsWidget,
} from "~/features/record-show/sections/fields/record-fields-widget";
import { RecordSummaryCard } from "~/features/record-show/summary-card/record-summary-card";
import { EventList } from "~/features/record-show/tabs/timeline/components/event-list";
import { groupEventsByMonth } from "~/features/record-show/tabs/timeline/model/group";
import { ActivityTabEmptyState } from "~/features/side-panel/components/activity-tabs/empty-state";
import { FieldTextValue } from "~/features/widgets/field-table";
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
import timelineStyles from "~/features/record-show/tabs/timeline/styles.module.css";

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

function caseDisplayName(detail: CaseDetailView): string {
  return detail.legalName ?? detail.ruc;
}

export function CaseRecordHeader(props: { caseId: string }) {
  return (
    <Loading fallback={<PageCardHeader />}>
      <CaseBreadcrumbHeader caseId={props.caseId} />
    </Loading>
  );
}

function CaseBreadcrumbHeader(props: { caseId: string }) {
  const detail = createMemo(() => caseQuery(props.caseId));
  const { currentUser } = useAuthenticatedSession();
  const canCall = () => hasPermission(currentUser(), "case:work");

  return (
    <>
      <Title>{`${caseDisplayName(detail())} - ${detail().caseType.name}`}</Title>
      <PageCardHeader
        breadcrumb={
          <RecordBreadcrumb
            href="/cases"
            objectLabel={OBJECTS.case.labelPlural}
            icon={Inbox}
            name={caseDisplayName(detail())}
          />
        }
        actionButton={
          <Show when={canCall()}>
            <CallWithExtension
              request={{ subject: { kind: "case", id: props.caseId } }}
            />
          </Show>
        }
      />
    </>
  );
}

export function CaseRecordPage(props: { caseId: string }) {
  const detail = createMemo(() => caseQuery(props.caseId));

  return (
    <RecordPageLayout
      summary={
        <RecordSummaryCard
          name={caseDisplayName(detail())}
          icon={Inbox}
          tag={<Tag color="gray" text={detail().caseType.name} preventShrink />}
        />
      }
      fields={
        <>
          <CaseFields detail={detail()} />
          <MeetingsRelationCard
            organizationId={detail().organizationId}
            caseId={detail().id}
            subject={caseDisplayName(detail())}
          />
        </>
      }
    >
      <CaseTabs detail={detail()} />
    </RecordPageLayout>
  );
}

function CaseFields(props: { detail: CaseDetailView }) {
  const record = createMemo(() => ({
    caseType: props.detail.caseType.name,
    ruc: props.detail.ruc,
    createdAt: props.detail.createdAt,
    updatedAt: props.detail.updatedAt,
  }));

  return (
    <RecordFieldsWidget
      object="case"
      record={record()}
      cells={{
        company: (entry) => (
          <CompanyField entry={entry} detail={props.detail} />
        ),
        holder: (entry) => <HolderField entry={entry} detail={props.detail} />,
      }}
    />
  );
}

function CompanyField(props: {
  entry: RecordFieldValue;
  detail: CaseDetailView;
}) {
  const { currentUser } = useAuthenticatedSession();
  const canReadCompany = () => hasPermission(currentUser(), "company:read");

  return (
    <RecordFieldCell entry={props.entry}>
      <Show
        when={canReadCompany()}
        fallback={
          <FieldTextValue>{caseDisplayName(props.detail)}</FieldTextValue>
        }
      >
        <RecordLinkChip
          href={`/companies/${props.detail.organizationId}`}
          name={caseDisplayName(props.detail)}
          shape="square"
        />
      </Show>
    </RecordFieldCell>
  );
}

// The holder is edited in place, as Twenty edits a relation cell; the viewer
// sees no editor when the view offers no candidates.
function HolderField(props: {
  entry: RecordFieldValue;
  detail: CaseDetailView;
}) {
  const reassign = useAction(reassignCaseMutation);
  const { enqueueSuccessSnackBar } = useSnackBar();
  const candidateName = (id: string) =>
    props.detail.holderCandidates.find((each) => each.id === id)?.name ?? id;

  async function submit(holderUserId: string): Promise<void> {
    const result = await reassign({
      caseId: props.detail.id,
      expectedVersion: props.detail.version,
      holderUserId,
    });
    if (!result.ok) {
      throw new Error(result.error.message);
    }
    enqueueSuccessSnackBar("Caso reasignado.");
  }

  const edit = () =>
    props.detail.holderCandidates.length === 0
      ? undefined
      : {
          ariaLabel: "Editar Responsable",
          renderEditor: (onClose: () => void) => (
            <InlineOptionsEditor
              options={props.detail.holderCandidates.map((each) => each.id)}
              selected={props.detail.holderUserId}
              optionLabel={candidateName}
              ariaLabel="Responsable"
              onSubmit={submit}
              onClose={onClose}
            />
          ),
        };

  return (
    <RecordFieldCell
      entry={props.entry}
      empty={!props.detail.holderName}
      edit={edit()}
    >
      <FieldTextValue>{props.detail.holderName}</FieldTextValue>
    </RecordFieldCell>
  );
}

type CaseTabId = "stages" | "timeline";

function CaseTabs(props: { detail: CaseDetailView }) {
  const [active, setActive] = createSignal<CaseTabId>("stages");
  const groups = createMemo(() =>
    groupEventsByMonth(
      caseTimeline(props.detail.events, props.detail.caseType.name),
    ),
  );

  return (
    <RecordTabPane
      tabs={[
        {
          id: "stages",
          label: "Etapas",
          icon: CircleCheckBig,
          pill: String(props.detail.stages.length),
        },
        {
          id: "timeline",
          label: "Línea de tiempo",
          icon: TimelineEvent,
          pill:
            props.detail.events.length > 0
              ? String(props.detail.events.length)
              : undefined,
        },
      ]}
      active={active()}
      onSelect={setActive}
    >
      <Show
        when={active() === "stages"}
        fallback={
          <div class={timelineStyles.mainContainer}>
            <Show
              when={groups().length > 0}
              fallback={
                <ActivityTabEmptyState
                  type="emptyTimeline"
                  title="Aún no hay actividad"
                  subtitle="Nadie trabajó este caso todavía."
                />
              }
            >
              <EventList id={props.detail.id} groups={groups()} />
            </Show>
          </div>
        }
      >
        <div class={styles.stages}>
          <For each={props.detail.stages}>
            {(stage) => <CaseStage detail={props.detail} stage={stage} />}
          </For>
        </div>
      </Show>
    </RecordTabPane>
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
