import { useNavigate, useSearchParams } from "@solidjs/router";
import { Errored, Loading, createEffect, createSignal } from "solid-js";

import { Spinner } from "~/components/feedback/spinner/spinner";
import Building2 from "~/components/icons/building-2";
import CalendarDays from "~/components/icons/calendar-days";
import List from "~/components/icons/list";
import Mail from "~/components/icons/mail";
import MapPin from "~/components/icons/map";
import Phone from "~/components/icons/phone";
import Target from "~/components/icons/target";
import { useAuthenticatedSession } from "~/components/providers/authenticated-session-provider";
import { RecordLinkChip } from "~/components/ui/record-chip/record-chip";
import type { CompanySummaryView } from "~/contracts/companies/views";
import { hasPermission } from "~/domain/auth/access/rbac";
import { formatAppDate } from "~/domain/time/app-time";
import { createGridSource } from "~/features/data-grid/model/create-grid-source";
import type { DataGridColumn } from "~/features/data-grid/model/types";
import { RecordIndexScreen } from "~/features/record-index/components/screen";
import type { RecordIndexDefinition } from "~/features/record-index/model/definition";
import { companiesQuery } from "~/rpc/companies/queries";

import styles from "./companies.module.css";

const SEARCH_DEBOUNCE_MS = 250;

const COMPANY_COLUMNS = [
  {
    key: "legalName",
    label: "Empresa",
    icon: Building2,
    width: 240,
    sticky: true,
    renderCell: (company) => (
      <RecordLinkChip
        href={`/companies/${company.id}`}
        name={company.legalName ?? company.ruc}
        shape="square"
      />
    ),
  },
  {
    key: "ruc",
    label: "RUC",
    icon: List,
    width: 120,
    renderCell: (company) => (
      <span class={styles.mutedCellText}>{company.ruc}</span>
    ),
  },
  {
    key: "lineOfBusiness",
    label: "Rubro",
    icon: Target,
    width: 200,
    renderCell: (company) => company.lineOfBusiness,
  },
  {
    key: "phone",
    label: "Teléfono",
    icon: Phone,
    width: 140,
    renderCell: (company) => company.phone,
  },
  {
    key: "email",
    label: "Correo",
    icon: Mail,
    width: 200,
    renderCell: (company) => company.email,
  },
  {
    key: "district",
    label: "Distrito",
    icon: MapPin,
    renderCell: (company) => company.district,
  },
  {
    key: "province",
    label: "Provincia",
    icon: MapPin,
    renderCell: (company) => company.province,
  },
  {
    key: "department",
    label: "Departamento",
    icon: MapPin,
    renderCell: (company) => company.department,
  },
  {
    key: "createdAt",
    label: "Creado",
    icon: CalendarDays,
    renderCell: (company) => (
      <span class={styles.mutedCellText}>
        {formatAppDate(company.createdAt)}
      </span>
    ),
  },
] satisfies ReadonlyArray<DataGridColumn<CompanySummaryView>>;

export function CompanySearch() {
  const navigate = useNavigate();
  const { currentUser } = useAuthenticatedSession();
  const [search, setSearch] = useSearchParams<{ q?: string }>();
  const text = () => search.q ?? "";
  const [debounced, setDebounced] = createSignal(text().trim());

  createEffect(text, (value) => {
    const normalized = value.trim();
    if (!normalized) {
      setDebounced("");
      return;
    }
    const timeout = setTimeout(
      () => setDebounced(normalized),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timeout);
  });

  const companies = createGridSource(
    () => companiesQuery(debounced()),
    (rows) => ({ rows }),
  );

  const recordIndex = {
    id: "companies",
    title: () => "Empresas",
    ariaLabel: "Empresas",
    class: styles.index,
    object: { label: "Empresas", icon: Building2, color: "blue" },
    columns: COMPANY_COLUMNS,
    savedView: {
      object: "company",
      canSave: hasPermission(currentUser(), "view:manage"),
    },
    source: companies.source,
    search: {
      value: text,
      placeholder: "Buscar por RUC o razón social",
      set: (value) => setSearch({ q: value || null }, { replace: true }),
    },
    onRowOpen: (company) => navigate(`/companies/${company.id}`),
    rowOpenIndicator: "route",
    emptyState: {
      icon: Building2,
      title: "No hay empresas",
      description:
        "Las empresas de tus casos, llamadas y campañas aparecen aquí. Busca por RUC o razón social.",
    },
  } satisfies RecordIndexDefinition<CompanySummaryView>;

  return (
    <Loading fallback={<Spinner size="lg" />}>
      <Errored fallback={<p>No se pudieron cargar las empresas.</p>}>
        <RecordIndexScreen definition={recordIndex} />
      </Errored>
    </Loading>
  );
}
