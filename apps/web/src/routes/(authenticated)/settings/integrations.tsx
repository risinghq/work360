import { type RouteDefinition, useAction } from "@solidjs/router";
import { Show, createMemo, createSignal } from "solid-js";

import { createActionPending } from "~/browser/ui/action-in-flight";
import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import Video from "~/components/icons/video";
import {
  SettingsOptionCard,
  SettingsOptionCardRow,
  SettingsOptionCardWideRow,
} from "~/components/settings/settings-option-card";
import { SettingsSection } from "~/components/settings/SettingsSection";
import { Button } from "~/components/ui/input/button";
import { Input } from "~/components/ui/input/input";
import { actionErrorMessage } from "~/contracts/errors";
import type { IntegrationConnectionView } from "~/contracts/integrations/views";
import { formatAppDate } from "~/domain/time/app-time";
import {
  connectZoomMutation,
  disconnectZoomMutation,
} from "~/features/integrations/data/mutations";
import { SettingsPageLayout } from "~/features/settings-shell/page/settings-page-layout";
import { integrationsQuery } from "~/rpc/integrations/queries";

import styles from "./settings-page.module.css";

export const route = {
  preload: () => {
    void integrationsQuery();
  },
} satisfies RouteDefinition;

export default function IntegrationsSettingsPage() {
  const integrations = createMemo(() => integrationsQuery());

  return (
    <SettingsPageLayout>
      <SettingsSection
        title="Videollamadas"
        description="Las reuniones crean su sala en la cuenta conectada y envían el enlace en la invitación."
      >
        <Show when={integrations()}>
          {(data) => (
            <SettingsOptionCard>
              <Show when={data().zoom} fallback={<ZoomConnectRow />}>
                {(zoom) => <ZoomConnectedRow connection={zoom()} />}
              </Show>
            </SettingsOptionCard>
          )}
        </Show>
      </SettingsSection>
    </SettingsPageLayout>
  );
}

function ZoomConnectedRow(props: { connection: IntegrationConnectionView }) {
  const disconnect = useAction(disconnectZoomMutation);
  const disconnecting = createActionPending(disconnectZoomMutation);
  const { enqueueErrorSnackBar } = useSnackBar();

  async function handleDisconnect(): Promise<void> {
    try {
      const result = await disconnect();
      if (!result.ok) enqueueErrorSnackBar(result.error.message);
    } catch (error: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(error));
    }
  }

  return (
    <SettingsOptionCardRow
      Icon={Video}
      title="Zoom"
      description={`Conectado como ${props.connection.label}. Lo conectó ${props.connection.connectedByName} el ${formatAppDate(props.connection.connectedAt)}.`}
      control={
        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={disconnecting()}
          onClick={() => void handleDisconnect()}
        >
          Desconectar
        </Button>
      }
    />
  );
}

function ZoomConnectRow() {
  const connect = useAction(connectZoomMutation);
  const connecting = createActionPending(connectZoomMutation);
  const { enqueueErrorSnackBar, enqueueSuccessSnackBar } = useSnackBar();
  const [accountId, setAccountId] = createSignal("");
  const [clientId, setClientId] = createSignal("");
  const [clientSecret, setClientSecret] = createSignal("");

  async function handleConnect(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    try {
      const result = await connect({
        accountId: accountId().trim(),
        clientId: clientId().trim(),
        clientSecret: clientSecret().trim(),
      });
      if (!result.ok) {
        enqueueErrorSnackBar(result.error.message);
        return;
      }
      enqueueSuccessSnackBar(`Zoom conectado como ${result.value.label}`);
    } catch (error: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(error));
    }
  }

  return (
    <SettingsOptionCardWideRow
      Icon={Video}
      title="Zoom"
      description="Usa una app Server-to-Server OAuth de Zoom con los permisos meeting:write:admin y user:read:admin."
    >
      <form
        class={styles.formGrid}
        onSubmit={(event) => void handleConnect(event)}
      >
        <Input
          label="Account ID"
          required
          autocomplete="off"
          value={accountId()}
          disabled={connecting()}
          onInput={(event) => setAccountId(event.currentTarget.value)}
        />
        <Input
          label="Client ID"
          required
          autocomplete="off"
          value={clientId()}
          disabled={connecting()}
          onInput={(event) => setClientId(event.currentTarget.value)}
        />
        <Input
          label="Client secret"
          type="password"
          required
          autocomplete="new-password"
          value={clientSecret()}
          disabled={connecting()}
          onInput={(event) => setClientSecret(event.currentTarget.value)}
        />
        <div class={styles.formActions}>
          <Button type="submit" size="sm" loading={connecting()}>
            Conectar
          </Button>
        </div>
      </form>
    </SettingsOptionCardWideRow>
  );
}
