import {
  revalidate,
  type RouteDefinition,
  useAction,
  useNavigate,
} from "@solidjs/router";
import { Show, Loading, createMemo, createSignal } from "solid-js";

import { createActionPending } from "~/browser/ui/action-in-flight";
import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import List from "~/components/icons/list";
import Lock from "~/components/icons/lock";
import ShieldCheck from "~/components/icons/shield-check";
import {
  SettingsOptionCard,
  SettingsOptionCardRow,
} from "~/components/settings/settings-option-card";
import { SettingsSection } from "~/components/settings/SettingsSection";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Button } from "~/components/ui/input/button";
import { Input } from "~/components/ui/input/input";
import { Tag } from "~/components/ui/tag/tag";
import { actionErrorMessage } from "~/contracts/errors";
import {
  acknowledgeRecoveryCodesMutation,
  changePasswordMutation,
  disableTotpMutation,
  regenerateRecoveryCodesMutation,
  removeAllPasskeysMutation,
} from "~/features/auth/data/security-mutations";
import { RecoveryCodesPanel } from "~/features/auth/security/recovery-codes-panel";
import { usePasskeyEnrollment } from "~/features/auth/security/use-passkey-enrollment";
import { useTotpEnrollment } from "~/features/auth/security/use-totp-enrollment";
import { OtpSlotInput } from "~/features/auth/ui/otp-slot-input";
import { SettingsPageLayout } from "~/features/settings-shell/page/settings-page-layout";
import { useConfirmDialog } from "~/hooks/use-confirm-dialog";
import { meQuery } from "~/rpc/auth/me";
import { securityStatusQuery } from "~/rpc/auth/security-status";

import styles from "./security.module.css";
import base from "./settings-page.module.css";

export const route = {
  preload: () => securityStatusQuery(),
} satisfies RouteDefinition;

function getSetupKey(otpauthUri: string): string {
  try {
    return new URL(otpauthUri).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

function StatusTag(props: { active: boolean }) {
  return (
    <Tag
      color={props.active ? "turquoise" : "gray"}
      text={props.active ? "Activa" : "Desactivada"}
    />
  );
}

function TotpEnrollmentPanel(props: {
  totp: ReturnType<typeof useTotpEnrollment>;
  onCopySetupKey: (setupKey: string) => void;
}) {
  return (
    <Show when={props.totp.enrollment()}>
      {(enrollment) => (
        <>
          <div class={styles.qrBlock}>
            <div class={styles.qrFrame}>
              <img
                src={enrollment().qrCodeDataUrl}
                alt="Código QR para la aplicación de autenticación"
                class={styles.qrImage}
              />
            </div>

            <Show when={getSetupKey(enrollment().otpauthUri)}>
              {(setupKey) => (
                <p class={styles.qrCopy}>
                  ¿No puedes escanearlo? Copia la{" "}
                  <button
                    type="button"
                    class={styles.inlineLink}
                    onClick={() => props.onCopySetupKey(setupKey())}
                  >
                    clave manual
                  </button>
                </p>
              )}
            </Show>
          </div>

          <div class={styles.divider} />

          <div class={styles.block}>
            <p class={styles.title}>Ingresa el código de verificación</p>
          </div>

          <div class={styles.verifyBlock}>
            <OtpSlotInput
              value={props.totp.code()}
              disabled={props.totp.loading()}
              onValueChange={props.totp.setCode}
            />

            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void props.totp.verifyEnrollment()}
              disabled={props.totp.loading()}
            >
              Guardar
            </Button>
          </div>
        </>
      )}
    </Show>
  );
}

function refreshSecurityStatus() {
  return revalidate([meQuery.key, securityStatusQuery.key]);
}

export default function SecurityPage() {
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = createSignal("");
  const [newPassword, setNewPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [freshRecoveryCodes, setFreshRecoveryCodes] = createSignal<string[]>(
    [],
  );

  const removePasskeysDialog = useConfirmDialog();
  const disableTotpDialog = useConfirmDialog();
  const regenerateRecoveryDialog = useConfirmDialog();

  const status = createMemo(() => securityStatusQuery());
  const recoveryStatus = () => status()?.recoveryCodes;

  const removePasskeys = useAction(removeAllPasskeysMutation);
  const removingPasskeys = createActionPending(removeAllPasskeysMutation);

  const disableTotp = useAction(disableTotpMutation);
  const disablingTotp = createActionPending(disableTotpMutation);

  const regenerateRecovery = useAction(regenerateRecoveryCodesMutation);
  const regeneratingRecovery = createActionPending(
    regenerateRecoveryCodesMutation,
  );

  const acknowledgeRecovery = useAction(acknowledgeRecoveryCodesMutation);
  const acknowledgingRecovery = createActionPending(
    acknowledgeRecoveryCodesMutation,
  );

  const changePassword = useAction(changePasswordMutation);
  const changingPassword = createActionPending(changePasswordMutation);

  function showFreshRecoveryCodes(codes: string[]) {
    setFreshRecoveryCodes(codes);
    revalidate(securityStatusQuery.key);
  }

  const passkeyEnrollment = usePasskeyEnrollment({
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
    refreshStatus: refreshSecurityStatus,
    onRecoveryCodes: showFreshRecoveryCodes,
  });

  const totpEnrollment = useTotpEnrollment({
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
    refreshStatus: refreshSecurityStatus,
    onRecoveryCodes: showFreshRecoveryCodes,
  });

  async function handleRemovePasskeys() {
    try {
      const { message } = await removePasskeys();

      enqueueSuccessSnackBar(message);
    } catch (error) {
      enqueueErrorSnackBar(actionErrorMessage(error));
    } finally {
      removePasskeysDialog.close();
    }
  }

  async function handleDisableTotp() {
    try {
      const { message } = await disableTotp();

      totpEnrollment.reset();
      enqueueSuccessSnackBar(message);
    } catch (error) {
      enqueueErrorSnackBar(actionErrorMessage(error));
    } finally {
      disableTotpDialog.close();
    }
  }

  async function handleCopySetupKey(setupKey: string) {
    await navigator.clipboard.writeText(setupKey);

    enqueueSuccessSnackBar("Clave de configuración copiada");
  }

  async function handleRegenerateRecovery() {
    try {
      const { recoveryCodes } = await regenerateRecovery();

      showFreshRecoveryCodes(recoveryCodes);
    } catch (error) {
      enqueueErrorSnackBar(actionErrorMessage(error));
    } finally {
      regenerateRecoveryDialog.close();
    }
  }

  async function handleAcknowledgeRecovery() {
    try {
      await acknowledgeRecovery();
      setFreshRecoveryCodes([]);
    } catch (error) {
      enqueueErrorSnackBar(actionErrorMessage(error));
    }
  }

  async function handleChangePassword(event: SubmitEvent) {
    event.preventDefault();

    if (newPassword() !== confirmPassword()) {
      enqueueErrorSnackBar("Las contraseñas no coinciden");
      return;
    }

    try {
      await changePassword(currentPassword(), newPassword());

      enqueueSuccessSnackBar(
        "Contraseña actualizada. Inicia sesión nuevamente.",
      );

      navigate("/login", { replace: true });
    } catch (error) {
      enqueueErrorSnackBar(actionErrorMessage(error));
    }
  }

  return (
    <SettingsPageLayout>
      <ConfirmDialog
        isOpen={removePasskeysDialog.isOpen()}
        title="Eliminar claves de acceso"
        description="Se eliminarán todas las claves registradas en esta cuenta."
        confirmLabel="Eliminar"
        loading={removingPasskeys()}
        onConfirm={() => void handleRemovePasskeys()}
        onClose={removePasskeysDialog.close}
      />

      <ConfirmDialog
        isOpen={disableTotpDialog.isOpen()}
        title="Desactivar autenticación en dos pasos"
        description="Se desactivará el segundo paso con código para esta cuenta."
        confirmLabel="Desactivar"
        loading={disablingTotp()}
        onConfirm={() => void handleDisableTotp()}
        onClose={disableTotpDialog.close}
      />

      <ConfirmDialog
        isOpen={regenerateRecoveryDialog.isOpen()}
        title="Regenerar códigos de recuperación"
        description="Los códigos actuales dejarán de funcionar. Recibirás nuevos códigos."
        confirmLabel="Regenerar"
        loading={regeneratingRecovery()}
        onConfirm={() => void handleRegenerateRecovery()}
        onClose={regenerateRecoveryDialog.close}
      />

      <SettingsSection title="Cambiar contraseña">
        <form onSubmit={(event) => void handleChangePassword(event)}>
          <div class={base.formGrid}>
            <Input
              type="password"
              label="Contraseña actual"
              value={currentPassword()}
              onInput={(event) => setCurrentPassword(event.currentTarget.value)}
              required
            />

            <Input
              type="password"
              label="Nueva contraseña"
              value={newPassword()}
              onInput={(event) => setNewPassword(event.currentTarget.value)}
              required
            />

            <Input
              type="password"
              label="Confirmar nueva contraseña"
              value={confirmPassword()}
              onInput={(event) => setConfirmPassword(event.currentTarget.value)}
              required
            />
          </div>

          <div class={base.formActions}>
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              loading={changingPassword()}
            >
              Guardar
            </Button>
          </div>
        </form>
      </SettingsSection>

      <SettingsSection
        title="Claves de acceso"
        description="Usa tu dispositivo para iniciar sesión sin contraseña."
      >
        <SettingsOptionCard>
          <SettingsOptionCardRow
            Icon={Lock}
            title="Clave de acceso"
            description={
              passkeyEnrollment.supported()
                ? undefined
                : "Este dispositivo no es compatible con claves de acceso."
            }
            control={
              <div class={styles.rowControls}>
                <StatusTag active={status()?.hasPasskey ?? false} />
                <Show when={passkeyEnrollment.supported()}>
                  <Show when={status()?.hasPasskey}>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={removePasskeysDialog.open}
                      disabled={passkeyEnrollment.loading()}
                    >
                      Eliminar todas
                    </Button>
                  </Show>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void passkeyEnrollment.enrollPasskey()}
                    disabled={passkeyEnrollment.loading()}
                  >
                    {status()?.hasPasskey ? "Agregar" : "Configurar"}
                  </Button>
                </Show>
              </div>
            }
          />
        </SettingsOptionCard>
      </SettingsSection>

      <SettingsSection
        title="Autenticación en dos pasos"
        description="Pide un código temporal además de tu contraseña."
      >
        <div class={styles.securityStack}>
          <SettingsOptionCard>
            <SettingsOptionCardRow
              Icon={ShieldCheck}
              title="Aplicación de autenticación"
              control={
                <div class={styles.rowControls}>
                  <StatusTag active={status()?.totpEnabled ?? false} />
                  <Show
                    when={status()?.totpEnabled}
                    fallback={
                      <Show when={!totpEnrollment.enrollment()}>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => void totpEnrollment.beginEnrollment()}
                          disabled={totpEnrollment.loading()}
                        >
                          Configurar
                        </Button>
                      </Show>
                    }
                  >
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={disableTotpDialog.open}
                    >
                      Desactivar
                    </Button>
                  </Show>
                </div>
              }
            />
          </SettingsOptionCard>

          <Show when={!status()?.totpEnabled}>
            <TotpEnrollmentPanel
              totp={totpEnrollment}
              onCopySetupKey={(setupKey) => void handleCopySetupKey(setupKey)}
            />
          </Show>
        </div>
      </SettingsSection>

      <Loading>
        <Show
          when={
            freshRecoveryCodes().length > 0 || recoveryStatus()?.hasActiveSet
          }
        >
          <SettingsSection
            title="Códigos de recuperación"
            description="Úsalos para entrar si pierdes tu método de autenticación."
          >
            <div class={styles.securityStack}>
              <Show
                when={freshRecoveryCodes().length > 0}
                fallback={
                  <SettingsOptionCard>
                    <SettingsOptionCardRow
                      Icon={List}
                      title="Códigos disponibles"
                      description={`Te quedan ${recoveryStatus()?.unused ?? 0} de ${recoveryStatus()?.total ?? 0}.`}
                      control={
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={regenerateRecoveryDialog.open}
                        >
                          Regenerar
                        </Button>
                      }
                    />
                  </SettingsOptionCard>
                }
              >
                <p class={styles.sectionDescription}>
                  Guarda estos códigos en un lugar seguro. No volverás a verlos.
                </p>

                <RecoveryCodesPanel codes={freshRecoveryCodes()} />

                <div class={styles.inlineActions}>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    loading={acknowledgingRecovery()}
                    onClick={() => void handleAcknowledgeRecovery()}
                  >
                    Ya los guardé
                  </Button>
                </div>
              </Show>
            </div>
          </SettingsSection>
        </Show>
      </Loading>
    </SettingsPageLayout>
  );
}
