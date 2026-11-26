import { useAction } from "@solidjs/router";
import { For, Show, createSignal } from "solid-js";

import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import Inbox from "~/components/icons/inbox";
import List from "~/components/icons/list";
import { useAuthenticatedSession } from "~/components/providers/authenticated-session-provider";
import { RecordLinkChip } from "~/components/ui/record-chip/record-chip";
import { actionErrorMessage } from "~/contracts/errors";
import { hasPermission } from "~/domain/auth/access/rbac";
import { markCampaignRecordWorkedMutation } from "~/features/campaigns/data/mutations";
import { factLabel } from "~/features/campaigns/model/facts";
import { CallWithExtension } from "~/features/extension/call-with-extension";
import { OutcomePicker } from "~/features/outcomes/outcome-picker";
import {
  RecordFieldCell,
  RecordFieldsWidget,
} from "~/features/record-show/sections/fields/record-fields-widget";
import {
  FieldTable,
  FieldTextValue,
  RecordInlineCell,
} from "~/features/widgets/field-table";
import {
  WidgetCard,
  WidgetCardContent,
  WidgetCardHeader,
  WidgetCardTitle,
} from "~/features/widgets/widget-card";

import { SidePanelPage } from "../../components/page";
import {
  SidePanelFooter,
  type FooterOption,
} from "../../components/panel-footer";
import { useSidePanelPageState } from "../../router/page-state";
import { useSidePanel } from "../../state/use-side-panel";
import { createCaseCreateSidePanelPage } from "../../types/side-panel-page";

import styles from "./page.module.css";

// One company of the viewer's campaign batch: its fields, the columns the
// campaign file brought, and the call and result that take it off the batch.
export function CampaignRecordPage() {
  const pageState = useSidePanelPageState("campaign-record");
  const record = () => pageState().record;
  const { closePanel, navigateTo } = useSidePanel();
  const { currentUser } = useAuthenticatedSession();
  const { enqueueErrorSnackBar } = useSnackBar();
  const markWorked = useAction(markCampaignRecordWorkedMutation);
  const [outcomeId, setOutcomeId] = createSignal("");
  const [notes, setNotes] = createSignal("");
  const [saving, setSaving] = createSignal(false);

  const canReadCompany = () => hasPermission(currentUser(), "company:read");
  const facts = () => Object.entries(record().facts);

  async function saveResult(): Promise<void> {
    setSaving(true);
    try {
      const result = await markWorked({
        recordId: record().id,
        outcomeId: outcomeId(),
        notes: notes(),
      });
      if (!result.ok) {
        enqueueErrorSnackBar(result.error.message);
        return;
      }
      closePanel();
    } catch (caught: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  const options = (): FooterOption[] =>
    hasPermission(currentUser(), "case:work")
      ? [
          {
            id: "open-case",
            label: "Abrir caso",
            icon: Inbox,
            onSelect: () =>
              navigateTo(createCaseCreateSidePanelPage({ ruc: record().ruc })),
          },
        ]
      : [];

  return (
    <SidePanelPage
      footer={
        <SidePanelFooter
          primary={{
            label: "Registrar resultado",
            shortcut: "⏎",
            onClick: () => void saveResult(),
            disabled: saving() || outcomeId() === "",
          }}
          options={options()}
        />
      }
    >
      <RecordFieldsWidget
        object="campaignRecord"
        record={{ ruc: record().ruc, segment: record().segment }}
        cells={{
          company: (entry) => (
            <RecordFieldCell entry={entry}>
              <Show
                when={canReadCompany()}
                fallback={
                  <FieldTextValue>
                    {record().legalName ?? record().ruc}
                  </FieldTextValue>
                }
              >
                <RecordLinkChip
                  href={`/companies/${record().organizationId}`}
                  name={record().legalName ?? record().ruc}
                  shape="square"
                />
              </Show>
            </RecordFieldCell>
          ),
        }}
      />
      <Show when={facts().length > 0}>
        <WidgetCard variant="side-column">
          <WidgetCardHeader>
            <WidgetCardTitle text="Datos de la base" />
          </WidgetCardHeader>
          <WidgetCardContent>
            <FieldTable>
              <For each={facts()}>
                {([key, value]) => (
                  <RecordInlineCell
                    label={factLabel(key)}
                    icon={List}
                    empty={value === ""}
                  >
                    <FieldTextValue>{value}</FieldTextValue>
                  </RecordInlineCell>
                )}
              </For>
            </FieldTable>
          </WidgetCardContent>
        </WidgetCard>
      </Show>
      <WidgetCard variant="side-column">
        <WidgetCardHeader>
          <WidgetCardTitle text="Resultado" />
        </WidgetCardHeader>
        <WidgetCardContent>
          <div class={styles.result}>
            <CallWithExtension
              request={{
                subject: { kind: "campaign_record", id: record().id },
              }}
            />
            <OutcomePicker
              outcomeId={outcomeId()}
              notes={notes()}
              disabled={saving()}
              onOutcome={setOutcomeId}
              onNotes={setNotes}
            />
          </div>
        </WidgetCardContent>
      </WidgetCard>
    </SidePanelPage>
  );
}
