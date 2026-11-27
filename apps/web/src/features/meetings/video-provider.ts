import type { MeetingVideoProvider } from "~/contracts/meetings/views";

export const VIDEO_PROVIDER_LABELS: Record<MeetingVideoProvider, string> = {
  none: "Ninguna",
  link: "Enlace propio",
  zoom: "Zoom",
  google_meet: "Google Meet",
  teams: "Microsoft Teams",
};
