import { Tag, type TagColor } from "~/components/ui/tag/tag";
import type { MeetingGuestResponse } from "~/contracts/meetings/views";

const RESPONSES: Record<
  MeetingGuestResponse,
  { text: string; color: TagColor }
> = {
  accepted: { text: "Aceptó", color: "green" },
  declined: { text: "Rechazó", color: "red" },
  tentative: { text: "Tal vez", color: "yellow" },
  needs_action: { text: "Sin respuesta", color: "gray" },
};

export function GuestResponseTag(props: { response: MeetingGuestResponse }) {
  return (
    <Tag
      color={RESPONSES[props.response].color}
      text={RESPONSES[props.response].text}
      preventShrink
    />
  );
}
