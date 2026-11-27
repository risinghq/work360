export const MEETING_STATUSES = ["scheduled", "canceled"] as const;

export type MeetingStatus = (typeof MEETING_STATUSES)[number];

// A hosted provider opens the room itself through a connected account; `link`
// is an address the organizer pastes.
export const HOSTED_VIDEO_PROVIDERS = ["zoom", "google_meet", "teams"] as const;

export type HostedVideoProvider = (typeof HOSTED_VIDEO_PROVIDERS)[number];

export const MEETING_VIDEO_PROVIDERS = [
  "none",
  "link",
  ...HOSTED_VIDEO_PROVIDERS,
] as const;

export type MeetingVideoProvider = (typeof MEETING_VIDEO_PROVIDERS)[number];

export function isHostedVideoProvider(
  provider: MeetingVideoProvider,
): provider is HostedVideoProvider {
  return (HOSTED_VIDEO_PROVIDERS as readonly string[]).includes(provider);
}

// The iCalendar PARTSTAT a guest's calendar sent back, lowercased.
export const MEETING_GUEST_RESPONSES = [
  "needs_action",
  "accepted",
  "declined",
  "tentative",
] as const;

export type MeetingGuestResponse = (typeof MEETING_GUEST_RESPONSES)[number];

export type MeetingSummaryView = {
  id: string;
  title: string;
  // Epoch milliseconds.
  startsAt: number;
  endsAt: number;
  status: MeetingStatus;
  organizerUserId: string;
  organizerName: string;
  organizationId: string | null;
  companyName: string | null;
  caseId: string | null;
  guestCount: number;
  videoProvider: MeetingVideoProvider;
  videoLink: string | null;
};

// A guest is a workspace member or an outside address, such as a company's
// contact. A member guest carries its user id.
export type MeetingGuestView = {
  email: string;
  name: string | null;
  memberUserId: string | null;
};

export type MeetingAttendeeView = MeetingGuestView & {
  response: MeetingGuestResponse;
};

export type MeetingDetailView = MeetingSummaryView & {
  description: string;
  location: string | null;
  guests: MeetingAttendeeView[];
  // Only the organizer changes or cancels a meeting.
  canEdit: boolean;
};

// Which video choices the form can offer the current member: the hosted
// providers whose account is connected for them.
export type MeetingVideoOptionsView = {
  available: HostedVideoProvider[];
};

// The guests the create panel offers: members and the company's contacts.
export type MeetingGuestOption = {
  email: string;
  name: string;
  memberUserId: string | null;
};
