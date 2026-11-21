import Activity from "~/components/icons/activity";
import Bell from "~/components/icons/bell";
import CircleAlert from "~/components/icons/circle-alert";
import CircleCheckBig from "~/components/icons/circle-check-big";
import ColorSwatch from "~/components/icons/color-swatch";
import DoorEnter from "~/components/icons/door-enter";
import HelpCircle from "~/components/icons/help-circle";
import Lock from "~/components/icons/lock";
import MoneyBag from "~/components/icons/moneybag";
import ShieldCheck from "~/components/icons/shield-check";
import Target from "~/components/icons/target";
import TimelineEvent from "~/components/icons/timeline-event";
import TrendingDown from "~/components/icons/trending-down";
import UploadCloud from "~/components/icons/upload-cloud";
import UserCircle from "~/components/icons/user-circle";
import Users from "~/components/icons/users";
import { canAccessPath, type Member } from "~/domain/auth/access/route-policy";

import type { SettingsNavSection } from "./settings-navigation.types";

interface CreateSettingsNavigationSectionsOptions {
  member: Member;
  onLogout: () => void | Promise<void>;
}

// Advanced items come last in their section, so turning them off leaves no gap
// between the items that stay.
export function createSettingsNavigationSections(
  options: CreateSettingsNavigationSectionsOptions,
): SettingsNavSection[] {
  return [
    {
      id: "account",
      label: "Cuenta",
      items: [
        {
          id: "profile",
          label: "Perfil",
          href: "/settings/profile",
          icon: UserCircle,
          section: "account",
        },
        {
          id: "appearance",
          label: "Apariencia",
          href: "/settings/appearance",
          icon: ColorSwatch,
          section: "account",
        },
        {
          id: "notifications",
          label: "Notificaciones",
          href: "/settings/notifications",
          icon: Bell,
          section: "account",
        },
        {
          id: "security",
          label: "Seguridad",
          href: "/settings/security",
          icon: ShieldCheck,
          section: "account",
          isHidden: !canAccessPath(options.member, "/settings/security"),
        },
      ],
    },
    {
      id: "operations",
      label: "Operación",
      items: [
        {
          id: "sales-policies",
          label: "Políticas comerciales",
          href: "/settings/capacity-policies",
          icon: Activity,
          section: "operations",
          isHidden: !canAccessPath(
            options.member,
            "/settings/capacity-policies",
          ),
        },
        {
          id: "quotation-policies",
          label: "Políticas de cotización",
          href: "/settings/quotation-policies",
          icon: TrendingDown,
          section: "operations",
          isHidden: !canAccessPath(
            options.member,
            "/settings/quotation-policies",
          ),
        },
        {
          id: "commission-scheme",
          label: "Esquema de comisiones",
          href: "/settings/commission-scheme",
          icon: MoneyBag,
          section: "operations",
          isHidden: !canAccessPath(
            options.member,
            "/settings/commission-scheme",
          ),
        },
      ],
    },
    {
      id: "administration",
      label: "Administración",
      items: [
        {
          id: "members",
          label: "Miembros",
          href: "/settings/members",
          icon: Users,
          section: "administration",
          matchSubPages: true,
          isHidden: !canAccessPath(options.member, "/settings/members"),
        },
        {
          id: "campaigns",
          label: "Campañas",
          href: "/settings/campaigns",
          icon: Target,
          section: "administration",
          isHidden: !canAccessPath(options.member, "/settings/campaigns"),
        },
        {
          id: "outcomes",
          label: "Resultados",
          href: "/settings/outcomes",
          icon: CircleCheckBig,
          section: "administration",
          isHidden: !canAccessPath(options.member, "/settings/outcomes"),
        },
        {
          id: "data-sources",
          label: "Fuentes de datos",
          href: "/settings/data-sources",
          icon: UploadCloud,
          section: "administration",
          isHidden: !canAccessPath(options.member, "/settings/data-sources"),
          isAdvanced: true,
        },
        {
          id: "login-protection",
          label: "Protección de inicio de sesión",
          href: "/settings/login-protection",
          icon: Lock,
          section: "administration",
          isHidden: !canAccessPath(
            options.member,
            "/settings/login-protection",
          ),
          isAdvanced: true,
        },
        {
          id: "security-policies",
          label: "Políticas de riesgo",
          href: "/settings/security-policies",
          icon: CircleAlert,
          section: "administration",
          isHidden: !canAccessPath(
            options.member,
            "/settings/security-policies",
          ),
          isAdvanced: true,
        },
        {
          id: "event-logs",
          label: "Registro de eventos",
          href: "/settings/event-logs",
          icon: TimelineEvent,
          section: "administration",
          isHidden: !canAccessPath(options.member, "/settings/event-logs"),
          isAdvanced: true,
        },
      ],
    },
    {
      id: "other",
      label: "Otros",
      items: [
        {
          id: "documentation",
          label: "Centro de ayuda",
          href: "/docs",
          icon: HelpCircle,
          section: "other",
        },
        {
          id: "logout",
          label: "Cerrar sesión",
          icon: DoorEnter,
          section: "other",
          onClick: options.onLogout,
        },
      ],
    },
  ];
}
