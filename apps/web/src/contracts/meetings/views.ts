export const MEETING_STATUSES = ["scheduled", "canceled"] as const;

export type MeetingStatus = (typeof MEETING_STATUSES)[number];

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
  videoLink: string | null;
};

// A guest is a workspace member or an outside address, such as a company's
// contact. A member guest carries its user id.
export type MeetingGuestView = {
  email: string;
  name: string | null;
  memberUserId: string | null;
};

export type MeetingDetailView = MeetingSummaryView & {
  description: string;
  location: string | null;
  guests: MeetingGuestView[];
  // Only the organizer changes or cancels a meeting.
  canEdit: boolean;
};

// The guests the create panel offers: members and the company's contacts.
export type MeetingGuestOption = {
  email: string;
  name: string;
  memberUserId: string | null;
};
