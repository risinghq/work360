import type { AppPath } from "~/domain/auth/access/route-manifest";
import type { TileColor } from "~/shared/ui/tile-color";

export type RouteIcon =
  | "search"
  | "settings"
  | "team"
  | "fulfillment"
  | "leads"
  | "contacts"
  | "campaigns"
  | "cases"
  | "meetings"
  | "companies"
  | "reports"
  | "rate-simulator"
  | "home"
  | "audit"
  | "capacity"
  | "profile"
  | "dashboards";

export type SidebarSection = "primary" | "secondary";

export interface SidebarChild {
  href: AppPath;
  label: string;
  order: number;
}

export interface SidebarEntry {
  id: string;
  href: AppPath;
  activePrefixes: string[];
  label: string;
  navLabel?: string;
  icon: RouteIcon;
  tileColor?: TileColor;
  section: SidebarSection;
  order: number;
  group?: string;
  children?: SidebarChild[];
}

export interface HeaderDescriptor {
  label: string;
  icon: RouteIcon;
  tileColor?: TileColor;
}

interface PageHeaderRule {
  match: string | RegExp;
  header: HeaderDescriptor;
}

// Put specific routes before broader matches.
export const PAGE_HEADERS = [
  {
    match: /^\/records\/[^/]+$/,
    header: { label: "Registros", icon: "leads", tileColor: "blue" },
  },
  {
    match: "/home",
    header: { label: "Inicio", icon: "home", tileColor: "blue" },
  },
  {
    match: "/records",
    header: { label: "Registros", icon: "leads", tileColor: "blue" },
  },
  {
    match: "/inquiries",
    header: { label: "Consultas", icon: "search", tileColor: "yellow" },
  },
  {
    match: "/rate-simulator",
    header: {
      label: "Simulador de tasas",
      icon: "rate-simulator",
      tileColor: "green",
    },
  },
  {
    match: "/me/assignments",
    header: {
      label: "Mis contactos",
      icon: "contacts",
      tileColor: "blue",
    },
  },
  {
    match: "/campaigns",
    header: { label: "Campañas", icon: "campaigns", tileColor: "green" },
  },
  {
    match: /^\/cases(?:\/.*)?$/,
    header: { label: "Casos", icon: "cases", tileColor: "turquoise" },
  },
  {
    match: /^\/meetings(?:\/.*)?$/,
    header: { label: "Reuniones", icon: "meetings", tileColor: "purple" },
  },
  {
    match: /^\/companies(?:\/.*)?$/,
    header: { label: "Empresas", icon: "companies", tileColor: "blue" },
  },
  {
    match: "/reports",
    header: { label: "Reportes", icon: "reports", tileColor: "purple" },
  },
  {
    match: "/me/capacity",
    header: {
      label: "Mi capacidad",
      icon: "capacity",
      tileColor: "turquoise",
    },
  },
  {
    match: "/fulfillment",
    header: {
      label: "Entregas",
      icon: "fulfillment",
      tileColor: "orange",
    },
  },
  {
    match: "/team/requests",
    header: {
      label: "Solicitudes",
      icon: "team",
      tileColor: "turquoise",
    },
  },
  {
    match: "/team",
    header: {
      label: "Capacidad del equipo",
      icon: "team",
      tileColor: "turquoise",
    },
  },
  {
    match: /^\/dashboards\/merchant-gpv(?:\/.*)?$/,
    header: {
      label: "GPV de comercios",
      icon: "dashboards",
    },
  },
  {
    match: "/settings/profile",
    header: {
      label: "Perfil",
      icon: "profile",
    },
  },
  {
    match: "/settings/capacity-policies",
    header: {
      label: "Políticas comerciales",
      icon: "settings",
    },
  },
  {
    match: "/settings/event-logs",
    header: {
      label: "Registro de eventos",
      icon: "settings",
    },
  },
] satisfies PageHeaderRule[];

export const SIDEBAR_ENTRIES = [
  {
    id: "home",
    href: "/home",
    activePrefixes: ["/home"],
    label: "Inicio",
    icon: "home",
    tileColor: "blue",
    section: "primary",
    order: 1,
  },
  {
    id: "records",
    href: "/records",
    activePrefixes: ["/records"],
    label: "Registros",
    icon: "leads",
    tileColor: "blue",
    section: "secondary",
    order: 1,
    group: "Comercial",
  },
  {
    id: "inquiries",
    href: "/inquiries",
    activePrefixes: ["/inquiries"],
    label: "Consultas",
    icon: "search",
    tileColor: "yellow",
    section: "secondary",
    order: 2,
    group: "Comercial",
  },
  {
    id: "rate-simulator",
    href: "/rate-simulator",
    activePrefixes: ["/rate-simulator"],
    label: "Simulador de tasas",
    icon: "rate-simulator",
    tileColor: "green",
    section: "secondary",
    order: 3,
    group: "Comercial",
  },
  {
    id: "my-assignments",
    href: "/me/assignments",
    activePrefixes: ["/me/assignments"],
    label: "Mis contactos",
    icon: "contacts",
    tileColor: "blue",
    section: "secondary",
    order: 4,
    group: "Comercial",
  },
  {
    id: "campaigns",
    href: "/campaigns",
    activePrefixes: ["/campaigns"],
    label: "Campañas",
    icon: "campaigns",
    tileColor: "green",
    section: "secondary",
    order: 4,
    group: "Comercial",
  },
  {
    id: "cases",
    href: "/cases",
    activePrefixes: ["/cases"],
    label: "Casos",
    icon: "cases",
    tileColor: "turquoise",
    section: "secondary",
    order: 4,
    group: "Comercial",
  },
  {
    id: "companies",
    href: "/companies",
    activePrefixes: ["/companies"],
    label: "Empresas",
    icon: "companies",
    tileColor: "blue",
    section: "secondary",
    order: 4,
    group: "Comercial",
  },
  {
    id: "reports",
    href: "/reports",
    activePrefixes: ["/reports"],
    label: "Reportes",
    icon: "reports",
    tileColor: "purple",
    section: "secondary",
    order: 4,
    group: "Comercial",
  },
  {
    id: "my-capacity",
    href: "/me/capacity",
    activePrefixes: ["/me/capacity"],
    label: "Mi capacidad",
    icon: "capacity",
    tileColor: "turquoise",
    section: "secondary",
    order: 5,
    group: "Comercial",
  },
  {
    id: "meetings",
    href: "/meetings",
    activePrefixes: ["/meetings"],
    label: "Reuniones",
    icon: "meetings",
    tileColor: "purple",
    section: "secondary",
    order: 6,
    group: "Operaciones",
  },
  {
    id: "team",
    href: "/team",
    activePrefixes: ["/team"],
    label: "Equipo",
    icon: "team",
    tileColor: "turquoise",
    section: "secondary",
    order: 7,
    group: "Operaciones",
    children: [
      { href: "/team", label: "Capacidad", order: 1 },
      { href: "/team/requests", label: "Solicitudes", order: 2 },
    ],
  },
  {
    id: "fulfillment",
    href: "/fulfillment",
    activePrefixes: ["/fulfillment"],
    label: "Entregas",
    icon: "fulfillment",
    tileColor: "orange",
    section: "secondary",
    order: 8,
    group: "Operaciones",
  },
  {
    id: "dashboards",
    href: "/dashboards/merchant-gpv",
    activePrefixes: ["/dashboards"],
    label: "GPV de comercios",
    icon: "dashboards",
    tileColor: "green",
    section: "secondary",
    order: 9,
    group: "Negocio",
  },
] satisfies SidebarEntry[];
