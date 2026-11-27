import { For, Loading, createMemo } from "solid-js";

import Plus from "~/components/icons/plus";
import { useAuthenticatedSession } from "~/components/providers/authenticated-session-provider";
import { Button } from "~/components/ui/input/button";
import { RecordLinkChip } from "~/components/ui/record-chip/record-chip";
import { objectField } from "~/contracts/objects/registry";
import { hasPermission } from "~/domain/auth/access/rbac";
import { formatAppDateTime } from "~/domain/time/app-time";
import {
  RelationCard,
  RelationItem,
} from "~/features/record-show/relations/relation-card";
import { useSidePanel } from "~/features/side-panel/state/use-side-panel";
import { createMeetingFormSidePanelPage } from "~/features/side-panel/types/side-panel-page";
import { meetingsQuery } from "~/rpc/meetings/queries";

import { meetingStatusLabel } from "./meeting-status";

// The meetings of a company or a case. A meeting scheduled from here is linked
// to the record, and the company's contacts are offered as guests.
export function MeetingsRelationCard(props: {
  organizationId: string;
  caseId?: string;
  subject: string;
}) {
  return (
    <Loading
      fallback={
        <RelationCard
          title={objectField("company", "meetings").label}
          count={0}
        />
      }
    >
      <Meetings {...props} />
    </Loading>
  );
}

function Meetings(props: {
  organizationId: string;
  caseId?: string;
  subject: string;
}) {
  const { openPanel } = useSidePanel();
  const { currentUser } = useAuthenticatedSession();
  const meetings = createMemo(() =>
    meetingsQuery(
      props.caseId
        ? { caseId: props.caseId }
        : { organizationId: props.organizationId },
    ),
  );

  return (
    <RelationCard
      title={objectField("company", "meetings").label}
      count={meetings().length}
      action={
        hasPermission(currentUser(), "meeting:schedule") ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Nueva reunión"
            title="Nueva reunión"
            onClick={() =>
              openPanel(
                createMeetingFormSidePanelPage({
                  organizationId: props.organizationId,
                  caseId: props.caseId,
                  subject: `Reunión con ${props.subject}`,
                }),
              )
            }
          >
            <Plus size={14} />
          </Button>
        ) : undefined
      }
    >
      <For each={meetings()}>
        {(meeting) => (
          <RelationItem
            chip={
              <RecordLinkChip
                href={`/meetings/${meeting.id}`}
                name={meeting.title}
                shape="square"
              />
            }
            meta={`${formatAppDateTime(meeting.startsAt)} · ${meetingStatusLabel(meeting.status)}`}
          />
        )}
      </For>
    </RelationCard>
  );
}
