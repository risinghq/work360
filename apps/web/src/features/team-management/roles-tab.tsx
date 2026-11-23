import { useAction, useNavigate } from "@solidjs/router";
import { createMemo, createSignal, For, Show } from "solid-js";

import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import ChevronRight from "~/components/icons/chevron-right";
import { SettingsSection } from "~/components/settings/SettingsSection";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Button } from "~/components/ui/input/button";
import { Input } from "~/components/ui/input/input";
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
import { actionErrorMessage } from "~/contracts/errors";
import type { Role } from "~/domain/auth/access/rbac";
import { getRoleLabel } from "~/domain/auth/access/role-display";
import { createRoleMutation } from "~/features/team-management/data/role-mutations";
import { rolesListQuery } from "~/rpc/roles/read";

import styles from "./team-management.module.css";

export function RolesTab() {
  const navigate = useNavigate();
  const list = createMemo(() => rolesListQuery());
  const canCreate = () => (list()?.creatableKinds.length ?? 0) > 0;
  const [creating, setCreating] = createSignal(false);

  const openRole = (roleId: string) =>
    navigate(`/settings/members/roles/${roleId}`);

  return (
    <SettingsSection
      title="Roles"
      description="Cada rol define lo que pueden ver y hacer sus miembros. El tipo fija su lugar en el flujo de trabajo."
      actions={
        <Show when={canCreate()}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setCreating(true)}
          >
            Nuevo rol
          </Button>
        </Show>
      }
    >
      <Table aria-label="Roles" variant="list">
        <colgroup>
          <col style={{ width: "260px" }} />
          <col />
          <col />
          <col style={{ width: "40px" }} />
        </colgroup>

        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead align="right">Miembros</TableHead>
            <TableHead align="right"> </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <For each={list()?.roles ?? []}>
            {(role) => (
              <TableRow
                clickable
                tabindex={0}
                onClick={() => openRole(role.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openRole(role.id);
                  }
                }}
              >
                <TableCell>
                  {role.name}{" "}
                  <Show when={role.locked}>
                    <Tag color="gray" text="Fijo" />
                  </Show>
                </TableCell>
                <TableCell>{getRoleLabel(role.kind)}</TableCell>
                <TableCell align="right" class={styles.roleCount}>
                  {role.memberCount} miembro
                  {role.memberCount === 1 ? "" : "s"}
                </TableCell>
                <TableCell align="right" class={styles.rosterChevron}>
                  <ChevronRight size={16} />
                </TableCell>
              </TableRow>
            )}
          </For>
        </TableBody>
      </Table>

      <Show when={creating()}>
        <CreateRoleDialog
          kinds={list()?.creatableKinds ?? []}
          onClose={() => setCreating(false)}
          onCreated={openRole}
        />
      </Show>
    </SettingsSection>
  );
}

function CreateRoleDialog(props: {
  kinds: readonly Role[];
  onClose: () => void;
  onCreated: (roleId: string) => void;
}) {
  const create = useAction(createRoleMutation);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const [name, setName] = createSignal("");
  const [kind, setKind] = createSignal<string>(props.kinds[0] ?? "");
  const [busy, setBusy] = createSignal(false);

  async function submit() {
    setBusy(true);
    try {
      const { message, roleId } = await create({ name: name(), kind: kind() });
      enqueueSuccessSnackBar(message);
      props.onClose();
      props.onCreated(roleId);
    } catch (caught: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      isOpen
      title="Nuevo rol"
      description="El rol empieza con los permisos base de su tipo. Luego puedes ajustarlos."
      confirmLabel="Crear rol"
      loading={busy()}
      confirmDisabled={name().trim() === "" || kind() === ""}
      onConfirm={() => void submit()}
      onClose={props.onClose}
    >
      <div class={styles.fieldStack}>
        <Input
          label="Nombre"
          value={name()}
          maxlength={60}
          onInput={(event) => setName(event.currentTarget.value)}
          required
        />
        <Select
          label="Tipo"
          value={kind()}
          onInput={(event) => setKind(event.currentTarget.value)}
        >
          <For each={props.kinds}>
            {(option) => <option value={option}>{getRoleLabel(option)}</option>}
          </For>
        </Select>
      </div>
    </ConfirmDialog>
  );
}
