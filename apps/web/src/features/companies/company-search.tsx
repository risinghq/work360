import { useNavigate, useSearchParams } from "@solidjs/router";
import { Errored, Loading, createEffect, createSignal } from "solid-js";

import { Spinner } from "~/components/feedback/spinner/spinner";
import Building2 from "~/components/icons/building-2";
import { useAuthenticatedSession } from "~/components/providers/authenticated-session-provider";
import { RecordLinkChip } from "~/components/ui/record-chip/record-chip";
import type { CompanySummaryView } from "~/contracts/companies/views";
import { OBJECTS } from "~/contracts/objects/registry";
import { hasPermission } from "~/domain/auth/access/rbac";
import { formatAppDate } from "~/domain/time/app-time";
import { createPagedGridSource } from "~/features/data-grid/model/create-paged-grid-source";
import type { DataGridColumn } from "~/features/data-grid/model/types";
import { fieldColumn } from "~/features/object-registry/field-column";
import { RecordIndexScreen } from "~/features/record-index/components/screen";
import type { RecordIndexDefinition } from "~/features/record-index/model/definition";
import { companiesQuery } from "~/rpc/companies/queries";

import styles from "./companies.module.css";

const SEARCH_DEBOUNCE_MS = 250;
// Twenty's DEFAULT_QUERY_PAGE_SIZE.
const COMPANY_PAGE_SIZE = 30;

const COMPANY_COLUMNS: ReadonlyArray<DataGridColumn<CompanySummaryView>> = [
  fieldColumn("company", "legalName", {
    renderCell: (company) => (
      <RecordLinkChip
        href={`/companies/${company.id}`}
        name={company.legalName ?? company.ruc}
        shape="square"
      />
    ),
  }),
  fieldColumn("company", "ruc", {
    renderCell: (company) => (
      <span class={styles.mutedCellText}>{company.ruc}</span>
    ),
  }),
  fieldColumn("company", "lineOfBusiness", {
    renderCell: (company) => company.lineOfBusiness,
  }),
  fieldColumn("company", "phone", {
    renderCell: (company) => company.phone,
  }),
  fieldColumn("company", "email", {
    renderCell: (company) => company.email,
  }),
  fieldColumn("company", "district", {
    renderCell: (company) => company.district,
  }),
  fieldColumn("company", "province", {
    renderCell: (company) => company.province,
  }),
  fieldColumn("company", "department", {
    renderCell: (company) => company.department,
  }),
  fieldColumn("company", "createdAt", {
    renderCell: (company) => (
      <span class={styles.mutedCellText}>
        {formatAppDate(company.createdAt)}
      </span>
    ),
  }),
];

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

  const companies = createPagedGridSource({
    pageSize: COMPANY_PAGE_SIZE,
    resetKey: debounced,
    load: (limit, offset) => companiesQuery(debounced(), limit, offset),
  });

  const recordIndex = {
    id: "companies",
    title: () => OBJECTS.company.labelPlural,
    ariaLabel: OBJECTS.company.labelPlural,
    class: styles.index,
    object: {
      label: OBJECTS.company.labelPlural,
      icon: Building2,
      color: "blue",
    },
    columns: COMPANY_COLUMNS,
    savedView: {
      object: "company",
      canSave: hasPermission(currentUser(), "view:manage"),
    },
    source: companies.source,
    loadMore: companies.loadMore,
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
