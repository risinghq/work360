import { Title } from "@solidjs/meta";
import {
  For,
  Loading,
  Show,
  createMemo,
  createSignal,
  type ParentProps,
} from "solid-js";

import Building2 from "~/components/icons/building-2";
import List from "~/components/icons/list";
import Mail from "~/components/icons/mail";
import MapIcon from "~/components/icons/map";
import Phone from "~/components/icons/phone";
import Target from "~/components/icons/target";
import TimelineEvent from "~/components/icons/timeline-event";
import { PageCardHeader } from "~/components/ui/layout/page-card/page-card-header";
import {
  RecordChip,
  RecordLinkChip,
} from "~/components/ui/record-chip/record-chip";
import type { CompanyDetailView } from "~/contracts/companies/views";
import { formatAppDateTime } from "~/domain/time/app-time";
import { companyTimeline } from "~/features/companies/model/company-timeline";
import { RecordBreadcrumb } from "~/features/record-show/header/record-breadcrumb";
import { RecordPageLayout } from "~/features/record-show/page/record-page-layout";
import { RecordSummaryCard } from "~/features/record-show/summary-card/record-summary-card";
import { EventList } from "~/features/record-show/tabs/timeline/components/event-list";
import { groupEventsByMonth } from "~/features/record-show/tabs/timeline/model/group";
import { ActivityTabEmptyState } from "~/features/side-panel/components/activity-tabs/empty-state";
import {
  TabStrip,
  type TabIconComponent,
} from "~/features/side-panel/components/tab-strip";
import {
  FieldTable,
  FieldTextValue,
  RecordInlineCell,
} from "~/features/widgets/field-table";
import {
  WidgetCard,
  WidgetCardContent,
  WidgetCardHeader,
  WidgetCardTitle,
} from "~/features/widgets/widget-card";
import { companyQuery } from "~/rpc/companies/queries";

import styles from "./companies.module.css";
import timelineStyles from "~/features/record-show/tabs/timeline/styles.module.css";

export function companyDisplayName(company: {
  legalName: string | null;
  ruc: string;
}): string {
  return company.legalName ?? company.ruc;
}

export function CompanyRecordHeader(props: { companyId: string }) {
  return (
    <Loading fallback={<PageCardHeader />}>
      <CompanyBreadcrumbHeader companyId={props.companyId} />
    </Loading>
  );
}

function CompanyBreadcrumbHeader(props: { companyId: string }) {
  const detail = createMemo(() => companyQuery(props.companyId));
  const name = () => companyDisplayName(detail());

  return (
    <>
      <Title>{`${name()} - Empresa`}</Title>
      <PageCardHeader
        breadcrumb={
          <RecordBreadcrumb
            href="/companies"
            objectLabel="Empresas"
            icon={Building2}
            name={name()}
          />
        }
      />
    </>
  );
}

export function CompanyRecordPage(props: { companyId: string }) {
  const detail = createMemo(() => companyQuery(props.companyId));

  return (
    <RecordPageLayout
      summary={
        <RecordSummaryCard
          name={companyDisplayName(detail())}
          icon={Building2}
        />
      }
      fields={
        <>
          <CompanyFields detail={detail()} />
          <CompanyPeople detail={detail()} />
          <CompanyCases detail={detail()} />
          <CompanyCampaigns detail={detail()} />
        </>
      }
    >
      <CompanyTabs detail={detail()} />
    </RecordPageLayout>
  );
}

function TextField(props: {
  label: string;
  icon: TabIconComponent;
  value: string | null;
}) {
  return (
    <RecordInlineCell
      label={props.label}
      icon={props.icon}
      empty={!props.value}
    >
      <FieldTextValue>{props.value}</FieldTextValue>
    </RecordInlineCell>
  );
}

function CompanyFields(props: { detail: CompanyDetailView }) {
  const place = () =>
    [props.detail.district, props.detail.province, props.detail.department]
      .filter(Boolean)
      .join(", ") || null;

  return (
    <WidgetCard variant="side-column">
      <WidgetCardHeader>
        <WidgetCardTitle text="Campos" />
      </WidgetCardHeader>
      <WidgetCardContent>
        <FieldTable>
          <TextField label="RUC" icon={List} value={props.detail.ruc} />
          <TextField
            label="Rubro"
            icon={Target}
            value={props.detail.lineOfBusiness}
          />
          <TextField
            label="Dirección"
            icon={MapIcon}
            value={props.detail.address}
          />
          <TextField label="Ubicación" icon={MapIcon} value={place()} />
          <TextField label="Teléfono" icon={Phone} value={props.detail.phone} />
          <TextField label="Correo" icon={Mail} value={props.detail.email} />
        </FieldTable>
      </WidgetCardContent>
    </WidgetCard>
  );
}

function RelationCard(
  props: ParentProps<{ title: string; count: number; emptyText: string }>,
) {
  return (
    <WidgetCard variant="side-column">
      <WidgetCardHeader>
        <WidgetCardTitle text={props.title} count={props.count} />
      </WidgetCardHeader>
      <WidgetCardContent>
        <Show
          when={props.count > 0}
          fallback={<p class={styles.relationEmpty}>{props.emptyText}</p>}
        >
          <ul class={styles.relationList}>{props.children}</ul>
        </Show>
      </WidgetCardContent>
    </WidgetCard>
  );
}

function CompanyPeople(props: { detail: CompanyDetailView }) {
  return (
    <RelationCard
      title="Contactos"
      count={props.detail.people.length}
      emptyText="Sin contactos"
    >
      <For each={props.detail.people}>
        {(person) => (
          <li class={styles.relationItem}>
            <RecordChip name={person.name} shape="round" />
            <span class={styles.relationMeta}>
              {[person.role, person.phone, person.email]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </li>
        )}
      </For>
    </RelationCard>
  );
}

function CompanyCases(props: { detail: CompanyDetailView }) {
  return (
    <RelationCard
      title="Casos"
      count={props.detail.cases.length}
      emptyText="Sin casos"
    >
      <For each={props.detail.cases}>
        {(each) => (
          <li class={styles.relationItem}>
            <RecordLinkChip
              href={`/cases/${each.id}`}
              name={each.caseTypeName}
              shape="square"
            />
            <span class={styles.relationMeta}>{each.holderName}</span>
          </li>
        )}
      </For>
    </RelationCard>
  );
}

function CompanyCampaigns(props: { detail: CompanyDetailView }) {
  return (
    <RelationCard
      title="Campañas"
      count={props.detail.campaignRecords.length}
      emptyText="En ninguna campaña"
    >
      <For each={props.detail.campaignRecords}>
        {(each) => (
          <li class={styles.relationItem}>
            <RecordChip name={each.campaignName} shape="square" />
            <span class={styles.relationMeta}>
              {each.segment} · {campaignStatus(each)}
            </span>
          </li>
        )}
      </For>
    </RelationCard>
  );
}

function campaignStatus(
  record: CompanyDetailView["campaignRecords"][number],
): string {
  if (record.workedAt !== null) {
    return `Trabajada ${formatAppDateTime(record.workedAt)}`;
  }
  return record.holderName ? `Lote de ${record.holderName}` : "Sin asignar";
}

type CompanyTabId = "timeline";

function CompanyTabs(props: { detail: CompanyDetailView }) {
  const [active, setActive] = createSignal<CompanyTabId>("timeline");
  const groups = createMemo(() =>
    groupEventsByMonth(companyTimeline(props.detail.activities)),
  );

  return (
    <div class={styles.tabPanel}>
      <TabStrip
        tabs={[
          {
            id: "timeline",
            label: "Línea de tiempo",
            icon: TimelineEvent,
            pill:
              props.detail.activities.length > 0
                ? String(props.detail.activities.length)
                : undefined,
          },
        ]}
        activeTab={active()}
        onTabSelect={setActive}
      />
      <div class={styles.tabScroll}>
        <div class={timelineStyles.mainContainer}>
          <Show
            when={groups().length > 0}
            fallback={
              <ActivityTabEmptyState
                type="emptyTimeline"
                title="Aún no hay actividad"
                subtitle="Nadie llamó ni visitó esta empresa todavía."
              />
            }
          >
            <EventList id={props.detail.id} groups={groups()} />
          </Show>
        </div>
      </div>
    </div>
  );
}
