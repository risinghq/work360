import { useAction, useNavigate, useParams } from "@solidjs/router";
import { createMemo, createSignal, For, Show } from "solid-js";

import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import { SettingsSection } from "~/components/settings/SettingsSection";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Button } from "~/components/ui/input/button";
import { Checkbox } from "~/components/ui/input/checkbox";
import { Input } from "~/components/ui/input/input";
import { Tag } from "~/components/ui/tag/tag";
import { actionErrorMessage } from "~/contracts/errors";
import type { RoleDetail } from "~/contracts/roles";
import type { Permission } from "~/domain/auth/access/rbac";
import { getRoleLabel } from "~/domain/auth/access/role-display";
import { SettingsPageLayout } from "~/features/settings-shell/page/settings-page-layout";
import {
  deleteRoleMutation,
  updateRoleMutation,
} from "~/features/team-management/data/role-mutations";
import { RolePermissions } from "~/features/team-management/role-permissions";
import { roleDetailQuery } from "~/rpc/roles/read";

import styles from "~/features/team-management/team-management.module.css";

export default function SettingsRoleDetailPage() {
  const params = useParams<{ roleId: string }>();
  const detail = createMemo(() => roleDetailQuery(params.roleId));

  return (
    <SettingsPageLayout>
      <Show when={detail()}>
        {(role) => (
          // Remount when the role changes, but not on revalidation.
          <Show when={role().id} keyed>
            <RoleEditor role={role()} />
          </Show>
        )}
      </Show>
    </SettingsPageLayout>
  );
}

function toggle<T>(list: readonly T[], item: T, on: boolean): T[] {
  const rest = list.filter((value) => value !== item);
  return on ? [...rest, item] : rest;
}

function RoleEditor(props: { role: RoleDetail }) {
  const navigate = useNavigate();
  const update = useAction(updateRoleMutation);
  const remove = useAction(deleteRoleMutation);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const initial = props.role;
  const [name, setName] = createSignal(initial.name);
  const [permissions, setPermissions] = createSignal<readonly Permission[]>(
    initial.permissions,
  );
  const [assignable, setAssignable] = createSignal<readonly string[]>(
    initial.assignableRoleIds,
  );
  const [busy, setBusy] = createSignal(false);
  const [confirmingDelete, setConfirmingDelete] = createSignal(false);

  const readOnly = () => !props.role.canEdit;

  async function save() {
    setBusy(true);
    try {
      const { message } = await update({
        roleId: props.role.id,
        name: name(),
        permissions: [...permissions()],
        assignableRoleIds: [...assignable()],
      });
      enqueueSuccessSnackBar(message);
    } catch (caught: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      const { message } = await remove(props.role.id);
      enqueueSuccessSnackBar(message);
      setConfirmingDelete(false);
      navigate("/settings/members?tab=roles");
    } catch (caught: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header class={styles.detailHeader}>
        <div class={styles.detailHeaderText}>
          <span class={styles.detailName}>{props.role.name}</span>
          <span>
            {getRoleLabel(props.role.kind)}
            {" · "}
            {props.role.memberCount} miembro
            {props.role.memberCount === 1 ? "" : "s"}{" "}
            <Show when={props.role.locked}>
              <Tag color="gray" text="Fijo" />
            </Show>
          </span>
        </div>
        <Show when={!readOnly()}>
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={busy()}
            disabled={name().trim() === ""}
            onClick={() => void save()}
          >
            Guardar cambios
          </Button>
        </Show>
      </header>

      <div class={styles.tabPane}>
        <Show when={props.role.locked}>
          <p class={styles.rosterEmpty}>
            Este rol es fijo: sus permisos no se pueden cambiar ni eliminar.
          </p>
        </Show>

        <SettingsSection title="Nombre">
          <Input
            value={name()}
            maxlength={60}
            disabled={readOnly()}
            onInput={(event) => setName(event.currentTarget.value)}
          />
        </SettingsSection>

        <SettingsSection
          title="Permisos"
          description="Lo que los miembros de este rol pueden ver y hacer. Solo puedes otorgar permisos que tú tienes."
        >
          <RolePermissions
            granted={permissions()}
            shown={props.role.availablePermissions}
            onToggle={
              readOnly()
                ? undefined
                : (permission, on) =>
                    setPermissions((current) => toggle(current, permission, on))
            }
          />
        </SettingsSection>

        <Show when={!props.role.assignsEveryRole}>
          <SettingsSection
            title="Roles que puede asignar"
            description="Si este rol administra el equipo, solo invita o cambia a usuarios hacia estos roles."
          >
            <div class={styles.fieldStack}>
              <For each={props.role.otherRoles}>
                {(other) => (
                  <Checkbox
                    label={other.name}
                    checked={assignable().includes(other.id)}
                    disabled={readOnly()}
                    onChange={(event) => {
                      const on = event.currentTarget.checked;
                      setAssignable((current) => toggle(current, other.id, on));
                    }}
                  />
                )}
              </For>
            </div>
          </SettingsSection>
        </Show>

        <Show when={!readOnly()}>
          <SettingsSection
            title="Eliminar rol"
            description="Solo es posible si el rol no tiene miembros ni es dueño de una etapa de caso."
          >
            <div class={styles.adminActions}>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy()}
                onClick={() => setConfirmingDelete(true)}
              >
                Eliminar rol
              </Button>
            </div>
          </SettingsSection>
        </Show>
      </div>

      <ConfirmDialog
        isOpen={confirmingDelete()}
        title="Eliminar rol"
        description={`Se eliminará el rol "${props.role.name}". Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="destructive"
        loading={busy()}
        onConfirm={() => void confirmDelete()}
        onClose={() => setConfirmingDelete(false)}
      />
    </>
  );
}
