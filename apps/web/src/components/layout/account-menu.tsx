import { useNavigate } from "@solidjs/router";
import { clsx } from "clsx";
import { Show, createSignal } from "solid-js";

import ChevronDown from "~/components/icons/chevron-down";
import LogOut from "~/components/icons/log-out";
import Moon from "~/components/icons/moon";
import Sun from "~/components/icons/sun";
import UserRound from "~/components/icons/user-round";
import { getUserInitials } from "~/components/layout/account-menu-utils";
import { Avatar } from "~/components/ui/display/avatar";
import { MenuItem } from "~/components/ui/navigation/menu-item";
import { AnchoredPopover } from "~/components/ui/overlay/anchored-popover";
import { useTheme } from "~/components/ui/theme/theme-context";

import styles from "./account-menu.module.css";

interface AccountMenuProps {
  label: string;
  avatarUrl?: string | null;
  collapsed?: boolean;
  onOpenSettings?: () => void;
  onLogout: () => Promise<void>;
}

export function AccountMenu(props: AccountMenuProps) {
  const [open, setOpen] = createSignal(false);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  let trigger: HTMLButtonElement | undefined;

  function openProfile() {
    setOpen(false);
    props.onOpenSettings?.();
    navigate("/settings/profile");
  }

  function switchTheme() {
    setOpen(false);
    toggleTheme();
  }

  function logOut() {
    setOpen(false);
    void props
      .onLogout()
      .then(() => navigate("/login", { replace: true }))
      .catch(() => undefined);
  }

  return (
    <div class={styles.container}>
      <button
        ref={(element) => (trigger = element)}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open() ? "true" : "false"}
        onClick={() => setOpen((prev) => !prev)}
        class={clsx(styles.trigger, props.collapsed && styles.triggerCollapsed)}
      >
        <Avatar
          imageUrl={props.avatarUrl ?? null}
          fallback={getUserInitials(props.label)}
          class={styles.avatar}
          fallbackClass={styles.avatarFallback}
        />
        <Show when={!props.collapsed}>
          <span class={styles.label}>{props.label}</span>
        </Show>
        <Show when={!props.collapsed}>
          <ChevronDown
            class={clsx(styles.chevron, open() && styles.chevronOpen)}
            size={16}
          />
        </Show>
      </button>

      {/* Twenty opens the labeled account menu over its trigger, in a portal
          so the page card beside the sidebar cannot cover it. */}
      <Show when={open() ? trigger : undefined} keyed>
        {(anchor) => (
          <AnchoredPopover
            anchor={anchor}
            class={styles.menu}
            onClose={() => setOpen(false)}
            placement={props.collapsed ? "bottom-start" : "overlap"}
            variant="positioner"
          >
            <div role="menu" aria-label={props.label} class={styles.section}>
              <MenuItem
                text="Mi perfil"
                leftComponent={<UserRound size={16} />}
                onClick={openProfile}
              />
              <MenuItem
                text={theme() === "light" ? "Tema oscuro" : "Tema claro"}
                leftComponent={
                  theme() === "light" ? <Moon size={16} /> : <Sun size={16} />
                }
                onClick={switchTheme}
              />
            </div>
            <hr class={styles.separator} />
            <div role="menu" aria-label={props.label} class={styles.section}>
              <MenuItem
                text="Cerrar sesión"
                accent="danger"
                leftComponent={<LogOut size={16} />}
                onClick={logOut}
              />
            </div>
          </AnchoredPopover>
        )}
      </Show>
    </div>
  );
}
