import {
  type RouteDefinition,
  useAction,
  useSearchParams,
} from "@solidjs/router";
import { Show, createMemo, onSettled } from "solid-js";

import { createActionPending } from "~/browser/ui/action-in-flight";
import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import Google from "~/components/icons/brands/google";
import {
  SettingsOptionCard,
  SettingsOptionCardRow,
} from "~/components/settings/settings-option-card";
import { SettingsSection } from "~/components/settings/SettingsSection";
import { Button } from "~/components/ui/input/button";
import { actionErrorMessage } from "~/contracts/errors";
import type { MemberConnectionView } from "~/contracts/integrations/views";
import { formatAppDate } from "~/domain/time/app-time";
import { disconnectGoogleMutation } from "~/features/integrations/data/mutations";
import { SettingsPageLayout } from "~/features/settings-shell/page/settings-page-layout";
import { myConnectionsQuery } from "~/rpc/integrations/queries";

export const route = {
  preload: () => {
    void myConnectionsQuery();
  },
} satisfies RouteDefinition;

// The Google callback returns here with `?google=<outcome>`.
const GOOGLE_OUTCOMES: Record<string, { ok: boolean; message: string }> = {
  connected: { ok: true, message: "Google conectado" },
  denied: { ok: false, message: "No se conectó Google." },
  calendar_denied: {
    ok: false,
    message:
      "Google no dio acceso al calendario. Vuelve a conectar y marca el permiso de Google Calendar.",
  },
  failed: {
    ok: false,
    message: "No se pudo conectar Google. Inténtalo de nuevo.",
  },
};

export default function AccountsSettingsPage() {
  const connections = createMemo(() => myConnectionsQuery());
  const [params, setParams] = useSearchParams<{ google?: string }>();
  const { enqueueErrorSnackBar, enqueueSuccessSnackBar } = useSnackBar();

  onSettled(() => {
    const outcome = params.google ? GOOGLE_OUTCOMES[params.google] : undefined;
    if (!outcome) return;
    if (outcome.ok) enqueueSuccessSnackBar(outcome.message);
    else enqueueErrorSnackBar(outcome.message);
    setParams({ google: undefined }, { replace: true });
  });

  return (
    <SettingsPageLayout>
      <SettingsSection
        title="Videollamadas"
        description="Conecta tu cuenta para crear las salas de tus reuniones con ella."
      >
        <Show when={connections()}>
          {(data) => (
            <SettingsOptionCard>
              <GoogleRow connection={data().google} />
            </SettingsOptionCard>
          )}
        </Show>
      </SettingsSection>
    </SettingsPageLayout>
  );
}

function GoogleRow(props: { connection: MemberConnectionView | null }) {
  const disconnect = useAction(disconnectGoogleMutation);
  const disconnecting = createActionPending(disconnectGoogleMutation);
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
    <Show
      when={props.connection}
      fallback={
        <SettingsOptionCardRow
          Icon={Google}
          title="Google Meet"
          description="Crea un enlace de Meet en un calendario «work360» de tu cuenta. work360 no lee tus otros calendarios."
          control={
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => window.location.assign("/api/integrations/google")}
            >
              Conectar
            </Button>
          }
        />
      }
    >
      {(connection) => (
        <SettingsOptionCardRow
          Icon={Google}
          title="Google Meet"
          description={`Conectado como ${connection().label} el ${formatAppDate(connection().connectedAt)}.`}
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
      )}
    </Show>
  );
}
