import { Title } from "@solidjs/meta";
import { For, Loading, Show, createMemo, createSignal } from "solid-js";

import Building2 from "~/components/icons/building-2";
import TimelineEvent from "~/components/icons/timeline-event";
import { PageCardHeader } from "~/components/ui/layout/page-card/page-card-header";
import {
  RecordChip,
  RecordLinkChip,
} from "~/components/ui/record-chip/record-chip";
import type { CompanyDetailView } from "~/contracts/companies/views";
import { OBJECTS, objectField } from "~/contracts/objects/registry";
import { formatAppDateTime } from "~/domain/time/app-time";
import { companyTimeline } from "~/features/companies/model/company-timeline";
import { MeetingsRelationCard } from "~/features/meetings/meetings-card";
import { RecordBreadcrumb } from "~/features/record-show/header/record-breadcrumb";
import { RecordPageLayout } from "~/features/record-show/page/record-page-layout";
import { RecordTabPane } from "~/features/record-show/page/record-tab-pane";
import {
  RelationCard,
  RelationItem,
} from "~/features/record-show/relations/relation-card";
import { RecordFieldsWidget } from "~/features/record-show/sections/fields/record-fields-widget";
import { RecordSummaryCard } from "~/features/record-show/summary-card/record-summary-card";
import { EventList } from "~/features/record-show/tabs/timeline/components/event-list";
import { groupEventsByMonth } from "~/features/record-show/tabs/timeline/model/group";
import { ActivityTabEmptyState } from "~/features/side-panel/components/activity-tabs/empty-state";
import { companyQuery } from "~/rpc/companies/queries";

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
            objectLabel={OBJECTS.company.labelPlural}
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
          <RecordFieldsWidget object="company" record={detail()} />
          <CompanyPeople detail={detail()} />
          <CompanyCases detail={detail()} />
          <MeetingsRelationCard
            organizationId={detail().id}
            subject={companyDisplayName(detail())}
          />
          <CompanyCampaigns detail={detail()} />
        </>
      }
    >
      <CompanyTabs detail={detail()} />
    </RecordPageLayout>
  );
}

const relationTitle = (key: "people" | "cases" | "campaignRecords") =>
  objectField("company", key).label;

function CompanyPeople(props: { detail: CompanyDetailView }) {
  return (
    <RelationCard
      title={relationTitle("people")}
      count={props.detail.people.length}
    >
      <For each={props.detail.people}>
        {(person) => (
          <RelationItem
            chip={<RecordChip name={person.name} shape="round" />}
            meta={[person.role, person.phone, person.email]
              .filter(Boolean)
              .join(" · ")}
          />
        )}
      </For>
    </RelationCard>
  );
}

function CompanyCases(props: { detail: CompanyDetailView }) {
  return (
    <RelationCard
      title={relationTitle("cases")}
      count={props.detail.cases.length}
    >
      <For each={props.detail.cases}>
        {(each) => (
          <RelationItem
            chip={
              <RecordLinkChip
                href={`/cases/${each.id}`}
                name={each.caseTypeName}
                shape="square"
              />
            }
            meta={each.holderName}
          />
        )}
      </For>
    </RelationCard>
  );
}

function CompanyCampaigns(props: { detail: CompanyDetailView }) {
  return (
    <RelationCard
      title={relationTitle("campaignRecords")}
      count={props.detail.campaignRecords.length}
    >
      <For each={props.detail.campaignRecords}>
        {(each) => (
          <RelationItem
            chip={<RecordChip name={each.campaignName} shape="square" />}
            meta={`${each.segment} · ${campaignStatus(each)}`}
          />
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
    <RecordTabPane
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
      active={active()}
      onSelect={setActive}
    >
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
    </RecordTabPane>
  );
}
