import { Tag } from "~/components/ui/tag/tag";
import type { MeetingStatus } from "~/contracts/meetings/views";

const STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: "Agendada",
  canceled: "Cancelada",
};

export function meetingStatusLabel(status: MeetingStatus): string {
  return STATUS_LABELS[status];
}

export function MeetingStatusTag(props: { status: MeetingStatus }) {
  return (
    <Tag
      color={props.status === "canceled" ? "gray" : "purple"}
      text={meetingStatusLabel(props.status)}
      preventShrink
    />
  );
}
