import { useAction, useNavigate } from "@solidjs/router";
import { For, Loading, Show, createMemo, createSignal } from "solid-js";

import { EmptyState } from "~/components/feedback/empty-state/empty";
import { Skeleton } from "~/components/ui/feedback/skeleton";
import { Input } from "~/components/ui/input/input";
import type { CaseTypeView } from "~/contracts/cases/views";
import { actionErrorMessage } from "~/contracts/errors";
import {
  CaseFieldInput,
  fromFormValues,
  requiredFieldKeys,
  toFormValues,
} from "~/features/cases/case-fields";
import { openCaseMutation } from "~/features/cases/data/mutations";
import { caseTypesQuery } from "~/rpc/cases/queries";

import { SidePanelPage } from "../../components/page";
import { SidePanelFooter } from "../../components/panel-footer";
import { useSidePanelPageState } from "../../router/page-state";
import { useSidePanel } from "../../state/use-side-panel";

import styles from "./page.module.css";

export function CreateCasePage() {
  const pageState = useSidePanelPageState("create-case");
  const types = createMemo(() => caseTypesQuery());
  const caseType = createMemo(() => {
    const openable = types().filter((option) => option.canOpen);
    return (
      openable.find((option) => option.key === pageState().caseTypeKey) ??
      openable[0]
    );
  });

  return (
    <Loading fallback={<Skeleton height={240} />}>
      <Show
        when={caseType()}
        fallback={
          <SidePanelPage>
            <EmptyState
              title="No puedes abrir casos"
              description="Tu rol no registra casos en este espacio de trabajo."
            />
          </SidePanelPage>
        }
      >
        {(selected) => (
          <OpeningForm caseType={selected()} ruc={pageState().ruc} />
        )}
      </Show>
    </Loading>
  );
}

// A campaign record passes the company's RUC, so the form shows it instead of
// asking for it.
function OpeningForm(props: { caseType: CaseTypeView; ruc: string }) {
  const open = useAction(openCaseMutation);
  const navigate = useNavigate();
  const { closePanel } = useSidePanel();
  const fields = () => props.caseType.opening.fields;
  const [form, setForm] = createSignal(toFormValues(fields(), {}));
  const [ruc, setRuc] = createSignal(props.ruc);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const required = createMemo(() =>
    requiredFieldKeys(fields(), {
      values: fromFormValues(fields(), form()),
      statuses: {
        [props.caseType.opening.key]: props.caseType.opening.initialStatus,
      },
    }),
  );

  async function submit(): Promise<void> {
    setBusy(true);
    setError(undefined);
    try {
      const result = await open({
        caseTypeKey: props.caseType.key,
        ruc: ruc().trim(),
        values: fromFormValues(fields(), form()),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      closePanel();
      navigate(`/cases/${result.value.caseId}`);
    } catch (caught: unknown) {
      setError(actionErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SidePanelPage
      footer={
        <SidePanelFooter
          primary={{
            label: "Abrir caso",
            shortcut: "⏎",
            onClick: () => void submit(),
            disabled: busy(),
          }}
        />
      }
    >
      <form
        class={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <header class={styles.header}>
          <span class={styles.title}>{props.caseType.opening.name}</span>
          <span class={styles.meta}>{props.caseType.name}</span>
        </header>
        <Show when={!props.ruc}>
          <Input
            label="RUC"
            required
            inputmode="numeric"
            maxlength={11}
            value={ruc()}
            disabled={busy()}
            onInput={(event) => setRuc(event.currentTarget.value)}
          />
        </Show>
        <For each={fields()}>
          {(field) => (
            <CaseFieldInput
              field={field}
              value={form()[field.key] ?? ""}
              required={required().has(field.key)}
              disabled={busy()}
              onInput={(value) =>
                setForm((current) => ({ ...current, [field.key]: value }))
              }
            />
          )}
        </For>
        <Show when={error()}>
          {(message) => (
            <p class={styles.error} role="alert">
              {message()}
            </p>
          )}
        </Show>
      </form>
    </SidePanelPage>
  );
}
