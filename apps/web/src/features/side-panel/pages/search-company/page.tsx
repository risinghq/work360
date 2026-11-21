import { For, Show } from "solid-js";

import Users from "~/components/icons/users";
import { RecordChipList } from "~/components/ui/record-chip/record-chip";
import type { PersonRef } from "~/features/search/model/grouping";

import { SidePanelPage } from "../../components/page";
import { useSidePanelPageState } from "../../router/page-state";

import styles from "./page.module.css";

export function SearchCompanyPage() {
  const pageState = useSidePanelPageState("search-company-detail");

  return (
    <SidePanelPage>
      <div class={styles.content}>
        <section class={styles.hero}>
          <div class={styles.heroIcon}>
            <Users size={16} />
          </div>
          <div class={styles.heroText}>
            <div class={styles.title}>
              {pageState().company.name ?? "Empresa desconocida"}
            </div>
            <div class={styles.subtitle}>RUC {pageState().company.ruc}</div>
          </div>
        </section>

        <section class={styles.section}>
          <div class={styles.sectionTitle}>Teléfonos</div>
          <RecordChipList items={pageState().company.phones} shape="square" />
        </section>

        <Show when={pageState().company.people.length > 0}>
          <section class={styles.section}>
            <div class={styles.sectionTitle}>Personas</div>
            <div class={styles.list}>
              <For each={pageState().company.people}>
                {(person) => (
                  <div class={styles.row}>
                    <div class={styles.rowTitle}>
                      {person.name ?? "Persona sin nombre"}
                    </div>
                    <div class={styles.rowMeta}>{personMeta(person)}</div>
                  </div>
                )}
              </For>
            </div>
          </section>
        </Show>
      </div>
    </SidePanelPage>
  );
}

function personMeta(person: PersonRef): string {
  const document = [person.doc_type, person.doc_number]
    .filter((part) => part !== null)
    .join(" ");
  return [person.role_name, document].filter(Boolean).join(" · ");
}
