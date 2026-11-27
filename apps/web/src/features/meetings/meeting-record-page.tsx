import { Title } from "@solidjs/meta";
import { For, Loading, Show, createMemo, createSignal } from "solid-js";

import CalendarDays from "~/components/icons/calendar-days";
import Info from "~/components/icons/info";
import Users from "~/components/icons/users";
import { Button } from "~/components/ui/input/button";
import { PageCardHeader } from "~/components/ui/layout/page-card/page-card-header";
import {
  RecordChip,
  RecordLinkChip,
} from "~/components/ui/record-chip/record-chip";
import {
  isHostedVideoProvider,
  type MeetingDetailView,
} from "~/contracts/meetings/views";
import { OBJECTS } from "~/contracts/objects/registry";
import { RecordBreadcrumb } from "~/features/record-show/header/record-breadcrumb";
import type { RecordFieldValue } from "~/features/record-show/model/field-groups";
import { RecordPageLayout } from "~/features/record-show/page/record-page-layout";
import { RecordTabPane } from "~/features/record-show/page/record-tab-pane";
import {
  RecordFieldCell,
  RecordFieldsWidget,
} from "~/features/record-show/sections/fields/record-fields-widget";
import { RecordSummaryCard } from "~/features/record-show/summary-card/record-summary-card";
import { ActivityTabEmptyState } from "~/features/side-panel/components/activity-tabs/empty-state";
import { useSidePanel } from "~/features/side-panel/state/use-side-panel";
import { createMeetingFormSidePanelPage } from "~/features/side-panel/types/side-panel-page";
import { FieldTextValue } from "~/features/widgets/field-table";
import { meetingQuery } from "~/rpc/meetings/queries";

import { GuestResponseTag } from "./guest-response";
import { MeetingStatusTag, meetingStatusLabel } from "./meeting-status";
import { VIDEO_PROVIDER_LABELS } from "./video-provider";

import styles from "./meetings.module.css";

export function MeetingRecordHeader(props: { meetingId: string }) {
  return (
    <Loading fallback={<PageCardHeader />}>
      <MeetingBreadcrumbHeader meetingId={props.meetingId} />
    </Loading>
  );
}

function MeetingBreadcrumbHeader(props: { meetingId: string }) {
  const detail = createMemo(() => meetingQuery(props.meetingId));
  const { openPanel } = useSidePanel();
  const canEdit = () => detail().canEdit && detail().status === "scheduled";

  return (
    <>
      <Title>{`${detail().title} - Reunión`}</Title>
      <PageCardHeader
        breadcrumb={
          <RecordBreadcrumb
            href="/meetings"
            objectLabel={OBJECTS.meeting.labelPlural}
            icon={CalendarDays}
            name={detail().title}
          />
        }
        actionButton={
          <Show when={canEdit()}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                openPanel(
                  createMeetingFormSidePanelPage({
                    meetingId: props.meetingId,
                    title: detail().title,
                  }),
                )
              }
            >
              Editar
            </Button>
          </Show>
        }
      />
    </>
  );
}

export function MeetingRecordPage(props: { meetingId: string }) {
  const detail = createMemo(() => meetingQuery(props.meetingId));

  return (
    <RecordPageLayout
      summary={
        <RecordSummaryCard
          name={detail().title}
          icon={CalendarDays}
          tag={<MeetingStatusTag status={detail().status} />}
        />
      }
      fields={<MeetingFields detail={detail()} />}
    >
      <MeetingTabs detail={detail()} />
    </RecordPageLayout>
  );
}

function MeetingFields(props: { detail: MeetingDetailView }) {
  const record = createMemo(() => ({
    startsAt: props.detail.startsAt,
    endsAt: props.detail.endsAt,
    location: props.detail.location,
    status: meetingStatusLabel(props.detail.status),
    organizer: props.detail.organizerName,
  }));

  return (
    <RecordFieldsWidget
      object="meeting"
      record={record()}
      cells={{
        videoLink: (entry) => (
          <LinkField
            entry={entry}
            href={props.detail.videoLink}
            text={
              isHostedVideoProvider(props.detail.videoProvider)
                ? `Unirse por ${VIDEO_PROVIDER_LABELS[props.detail.videoProvider]}`
                : props.detail.videoLink
            }
          />
        ),
        company: (entry) => (
          <RecordFieldCell entry={entry} empty={!props.detail.organizationId}>
            <RecordLinkChip
              href={`/companies/${props.detail.organizationId}`}
              name={props.detail.companyName ?? "Empresa"}
              shape="square"
            />
          </RecordFieldCell>
        ),
        case: (entry) => (
          <RecordFieldCell entry={entry} empty={!props.detail.caseId}>
            <RecordLinkChip
              href={`/cases/${props.detail.caseId}`}
              name="Ver caso"
              shape="square"
            />
          </RecordFieldCell>
        ),
        organizer: (entry) => (
          <RecordFieldCell entry={entry}>
            <FieldTextValue>{props.detail.organizerName}</FieldTextValue>
          </RecordFieldCell>
        ),
      }}
    />
  );
}

function LinkField(props: {
  entry: RecordFieldValue;
  href: string | null;
  text: string | null;
}) {
  return (
    <RecordFieldCell entry={props.entry} empty={!props.href}>
      <a
        class={styles.link}
        href={props.href ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
      >
        {props.text}
      </a>
    </RecordFieldCell>
  );
}

type MeetingTabId = "guests" | "details";

function MeetingTabs(props: { detail: MeetingDetailView }) {
  const [active, setActive] = createSignal<MeetingTabId>("guests");

  return (
    <RecordTabPane
      tabs={[
        {
          id: "guests",
          label: "Invitados",
          icon: Users,
          pill: String(props.detail.guests.length),
        },
        { id: "details", label: "Descripción", icon: Info },
      ]}
      active={active()}
      onSelect={setActive}
    >
      <Show
        when={active() === "guests"}
        fallback={
          <div class={styles.details}>
            <Show
              when={props.detail.description}
              fallback={
                <ActivityTabEmptyState
                  type="emptyTimeline"
                  title="Sin descripción"
                  subtitle="El organizador no añadió una agenda."
                />
              }
            >
              {(text) => <p class={styles.description}>{text()}</p>}
            </Show>
          </div>
        }
      >
        <div class={styles.details}>
          <ul class={styles.guests}>
            <For each={props.detail.guests}>
              {(guest) => (
                <li class={styles.guest}>
                  <RecordChip name={guest.name ?? guest.email} shape="round" />
                  <span class={styles.meta}>
                    {guest.memberUserId ? "Equipo" : "Contacto"} · {guest.email}
                  </span>
                  <span class={styles.response}>
                    <GuestResponseTag response={guest.response} />
                  </span>
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>
    </RecordTabPane>
  );
}
