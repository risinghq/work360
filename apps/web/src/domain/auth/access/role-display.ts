import type { Role } from "./rbac";

const ROLE_LABELS: Record<Role, string> = {
  executive: "Ejecutivo",
  supervisor: "Supervisor",
  back_office: "Validación de ventas",
  sales_manager: "Gerente de ventas",
  logistics: "Logística",
  hr: "RRHH",
  admin: "Administrador",
  superuser: "Superusuario",
};

export function getRoleLabel(role: Role): string {
  return ROLE_LABELS[role];
}

export function getRoleTagColor(role: Role): "gray" | "orange" | "blue" {
  if (role === "supervisor") {
    return "orange";
  }
  if (role === "admin" || role === "superuser") {
    return "blue";
  }
  return "gray";
}
