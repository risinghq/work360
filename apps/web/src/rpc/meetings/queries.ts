import { query } from "@solidjs/router";

import {
  getMeeting,
  listMeetingGuestOptions,
  listMeetings,
} from "~/server/meetings/ui/queries";

export type MeetingsFilter = { organizationId?: string; caseId?: string };

export const meetingsQuery = query(async (filter: MeetingsFilter = {}) => {
  "use server";
  return listMeetings(filter);
}, "meetings.list");

export const meetingQuery = query(async (meetingId: string) => {
  "use server";
  return getMeeting({ meetingId });
}, "meetings.detail");

export const meetingGuestOptionsQuery = query(
  async (organizationId: string | null) => {
    "use server";
    return listMeetingGuestOptions({ organizationId });
  },
  "meetings.guestOptions",
);
