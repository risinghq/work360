import { type RouteDefinition, useParams } from "@solidjs/router";

import { RecordShowShell } from "~/components/layout/app-shell/record-show-shell";
import {
  MeetingRecordHeader,
  MeetingRecordPage,
} from "~/features/meetings/meeting-record-page";
import { meetingQuery } from "~/rpc/meetings/queries";

export const route = {
  preload: ({ params }) => {
    if (params.id) {
      void meetingQuery(params.id);
    }
  },
} satisfies RouteDefinition;

export default function MeetingPage() {
  const params = useParams<{ id: string }>();
  return (
    <RecordShowShell header={<MeetingRecordHeader meetingId={params.id} />}>
      <MeetingRecordPage meetingId={params.id} />
    </RecordShowShell>
  );
}
