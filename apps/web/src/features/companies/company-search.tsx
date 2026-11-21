import { useNavigate, useSearchParams } from "@solidjs/router";
import { Loading, createEffect, createMemo, createSignal } from "solid-js";

import Building2 from "~/components/icons/building-2";
import List from "~/components/icons/list";
import MapPin from "~/components/icons/map";
import { SearchInput } from "~/components/ui/input/search-input";
import type { CompanySummaryView } from "~/contracts/companies/views";
import { DataGrid } from "~/features/data-grid/components/grid";
import type { DataGridColumn } from "~/features/data-grid/model/types";
import { companiesQuery } from "~/rpc/companies/queries";

import styles from "./companies.module.css";

const SEARCH_DEBOUNCE_MS = 250;

const COMPANY_COLUMNS = [
  {
    key: "legalName",
    label: "Empresa",
    icon: Building2,
    minWidth: 260,
    grow: true,
    sticky: true,
    renderCell: (company) => company.legalName ?? company.ruc,
  },
  {
    key: "ruc",
    label: "RUC",
    icon: List,
    width: 130,
    renderCell: (company) => company.ruc,
  },
  {
    key: "lineOfBusiness",
    label: "Rubro",
    icon: List,
    minWidth: 200,
    grow: true,
    renderCell: (company) => company.lineOfBusiness,
  },
  {
    key: "district",
    label: "Distrito",
    icon: MapPin,
    width: 160,
    renderCell: (company) => company.district,
  },
] satisfies ReadonlyArray<DataGridColumn<CompanySummaryView>>;

export function CompanySearch() {
  const navigate = useNavigate();
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

  const companies = createMemo(() => companiesQuery(debounced()));
  const emptyState = () =>
    debounced()
      ? "Sin resultados. Revisa el RUC o prueba con otra parte de la razón social."
      : "Las empresas de tus casos, llamadas y campañas aparecen aquí.";

  const renderGrid = (
    rows: ReadonlyArray<CompanySummaryView>,
    empty: string,
  ) => (
    <DataGrid
      ariaLabel="Empresas"
      columns={COMPANY_COLUMNS}
      emptyState={empty}
      onRowOpen={(company) => navigate(`/companies/${company.id}`)}
      rowId={(company) => company.id}
      rowOpenIndicator="route"
      source={{ rows }}
    />
  );

  return (
    <div class={styles.index}>
      <div class={styles.searchRow}>
        <SearchInput
          value={text()}
          onValueChange={(value) =>
            setSearch({ q: value || null }, { replace: true })
          }
          placeholder="Buscar por RUC o razón social"
          aria-label="Buscar empresas"
        />
      </div>
      <Loading fallback={renderGrid([], "Cargando empresas...")}>
        {renderGrid(companies(), emptyState())}
      </Loading>
    </div>
  );
}
