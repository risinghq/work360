import { useNavigate } from "@solidjs/router";
import { Loading, Show, createMemo, createSignal } from "solid-js";

import { useModKeyLabel } from "~/browser/hotkey/use-mod-key-label";
import ChevronDown from "~/components/icons/chevron-down";
import ChevronUp from "~/components/icons/chevron-up";
import Heart from "~/components/icons/heart";
import Mail from "~/components/icons/mail";
import Trash from "~/components/icons/trash";
import { TopBarActionButton } from "~/components/layout/top-bar-action-button";
import { TopBarCommandButton } from "~/components/layout/top-bar-command-button";
import { TopBarTooltip } from "~/components/layout/top-bar-tooltip";
import { useAuthenticatedSession } from "~/components/providers/authenticated-session-provider";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { actionErrorMessage } from "~/contracts/errors";
import { hasPermission } from "~/domain/auth/access/rbac";
import { useLeadActions } from "~/features/record-show/use-record-actions";
import { PAGE_HEADER_SIDE_PANEL_BUTTON_CLICK_OUTSIDE_ID } from "~/features/side-panel/constants/side-panel-click-outside-id";
import { usePageCommands } from "~/features/side-panel/hooks/use-page-commands";
import { useSidePanelMenu } from "~/features/side-panel/hooks/use-side-panel-menu";
import { leadDetailQuery } from "~/rpc/workflow/lead-detail";

import { useLeadNavigation } from "./lead-navigation";

import styles from "./record-show-header.module.css";

function LoadedNavigationButtons(props: { leadId: string }) {
  const { nextId, previousId } = useLeadNavigation(() => props.leadId);

  return <NavigationButtons nextId={nextId()} previousId={previousId()} />;
}

function NavigationButtons(props: {
  nextId: string | null;
  previousId: string | null;
}) {
  const navigate = useNavigate();

  return (
    <>
      <TopBarTooltip content="Registro anterior">
        <TopBarActionButton
          ariaLabel="Navegar al registro anterior"
          iconOnly
          disabled={!props.previousId}
          onClick={() =>
            props.previousId && navigate(`/records/${props.previousId}`)
          }
        >
          <ChevronUp size={16} />
        </TopBarActionButton>
      </TopBarTooltip>

      <TopBarTooltip content="Registro siguiente">
        <TopBarActionButton
          ariaLabel="Navegar al siguiente registro"
          iconOnly
          disabled={!props.nextId}
          onClick={() => props.nextId && navigate(`/records/${props.nextId}`)}
        >
          <ChevronDown size={16} />
        </TopBarActionButton>
      </TopBarTooltip>
    </>
  );
}

export function RecordShowHeaderActions(props: { leadId: string }) {
  const navigate = useNavigate();
  const detail = createMemo(() => leadDetailQuery(props.leadId));

  const { favoriteBusy, setFavorite, deleteBusy, deleteLead } =
    useLeadActions();
  const { currentUser } = useAuthenticatedSession();
  const { isSidePanelOpen, toggleSidePanelMenu } = useSidePanelMenu();
  const modKey = useModKeyLabel();

  const [confirmDeleteOpen, setConfirmDeleteOpen] = createSignal(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = createSignal<
    string | null
  >(null);

  const canDelete = createMemo(
    () => detail()?.lead != null && hasPermission(currentUser(), "lead:delete"),
  );

  usePageCommands(() =>
    canDelete()
      ? {
          label: "Empresa",
          items: [
            {
              id: "delete",
              label: "Eliminar empresa",
              icon: Trash,
              danger: true,
              disabled: deleteBusy(),
              onAction: () => {
                setDeleteErrorMessage(null);
                setConfirmDeleteOpen(true);
              },
            },
          ],
        }
      : null,
  );

  const isFavorite = () => detail()?.lead.isFavorite ?? false;

  const toggleFavorite = () => {
    void setFavorite(props.leadId, isFavorite());
  };

  async function handleConfirmDelete() {
    setDeleteErrorMessage(null);

    try {
      await deleteLead(props.leadId);
      setConfirmDeleteOpen(false);
      navigate("/records");
    } catch (caught) {
      setDeleteErrorMessage(actionErrorMessage(caught));
    }
  }

  return (
    <>
      <TopBarTooltip content="Enviar email estará disponible pronto">
        <TopBarActionButton
          ariaLabel="Enviar email"
          label="Enviar email"
          disabled
          class={styles.desktopAction}
        >
          <Mail size={14} />
        </TopBarActionButton>
      </TopBarTooltip>

      <TopBarTooltip
        content={isFavorite() ? "Quitar de favoritos" : "Agregar a favoritos"}
      >
        <TopBarActionButton
          ariaLabel={
            isFavorite() ? "Quitar de favoritos" : "Agregar a favoritos"
          }
          iconOnly
          disabled={favoriteBusy()}
          pressed={isFavorite()}
          onClick={toggleFavorite}
          class={styles.desktopAction}
        >
          <Heart size={16} color={isFavorite() ? "var(--accent)" : undefined} />
        </TopBarActionButton>
      </TopBarTooltip>

      <Loading fallback={<NavigationButtons nextId={null} previousId={null} />}>
        <LoadedNavigationButtons leadId={props.leadId} />
      </Loading>

      <TopBarCommandButton
        isOpen={isSidePanelOpen()}
        modKey={modKey()}
        onClick={toggleSidePanelMenu}
        dataClickOutsideId={PAGE_HEADER_SIDE_PANEL_BUTTON_CLICK_OUTSIDE_ID}
      />

      <ConfirmDialog
        isOpen={confirmDeleteOpen()}
        title="Eliminar empresa"
        description="Se quitará de tus listas de clientes. Esta acción no se puede deshacer desde la aplicación."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleteBusy()}
        onConfirm={() => void handleConfirmDelete()}
        onClose={() => setConfirmDeleteOpen(false)}
      >
        <Show when={deleteErrorMessage()}>
          {(message) => <p class={styles.deleteError}>{message()}</p>}
        </Show>
      </ConfirmDialog>
    </>
  );
}
