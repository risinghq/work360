import { Title } from "@solidjs/meta";
import { Loading, Show, createMemo, type ParentProps } from "solid-js";

import Building2 from "~/components/icons/building-2";
import { PageCardHeader } from "~/components/ui/layout/page-card/page-card-header";
import { leadDetailQuery } from "~/rpc/workflow/lead-detail";

import { useLeadNavigation } from "./lead-navigation";

import styles from "./record-show-header.module.css";

export function RecordShowHeader(
  props: ParentProps<{
    leadId: string;
  }>,
) {
  const data = createMemo(() => leadDetailQuery(props.leadId));

  const lead = createMemo(() => data()?.lead);

  const displayName = createMemo(
    () => lead()?.legalName ?? lead()?.ruc ?? "Sin nombre",
  );

  const documentTitle = createMemo(() => {
    const name = lead()?.legalName ?? lead()?.ruc;

    return name ? `${name} - Registro` : "Registro";
  });

  return (
    <>
      <Title>{documentTitle()}</Title>

      <PageCardHeader
        breadcrumb={
          <span class={styles.breadcrumb}>
            <a
              href="/records"
              class={styles.breadcrumbLink}
              aria-label="Volver a Registros"
            >
              <span class={styles.breadcrumbPrefix}>
                <span class={styles.objectIconBadge}>
                  <Building2 size={14} />
                </span>
                <span>Registros</span>
              </span>
            </a>

            <span class={styles.breadcrumbSep}>/</span>

            <span class={styles.breadcrumbCurrent} title={displayName()}>
              {displayName()}
            </span>

            <Loading fallback={null}>
              <PaginationInfo leadId={props.leadId} />
            </Loading>
          </span>
        }
        actionButton={props.children}
      />
    </>
  );
}

function PaginationInfo(props: { leadId: string }) {
  const { position } = useLeadNavigation(() => props.leadId);

  return (
    <Show when={position()}>
      {(at) => (
        <span class={styles.paginationInfo}>
          ({at().index + 1}/{at().total})
        </span>
      )}
    </Show>
  );
}
