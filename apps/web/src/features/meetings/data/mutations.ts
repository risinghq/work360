import { action } from "@solidjs/router";
import { respond } from "@solidjs/web";

import type {
  MeetingGuestView,
  MeetingVideoProvider,
} from "~/contracts/meetings/views";
import {
  cancelMeeting,
  createMeeting,
  updateMeeting,
} from "~/rpc/meetings/actions";
import { meetingQuery, meetingsQuery } from "~/rpc/meetings/queries";

// Times are epoch milliseconds.
export type MeetingFormInput = {
  title: string;
  description: string;
  startsAt: number;
  endsAt: number;
  location: string | null;
  videoProvider: MeetingVideoProvider;
  videoLink: string | null;
  organizationId: string | null;
  caseId: string | null;
  guests: MeetingGuestView[];
};

export const createMeetingMutation = action(
  async (input: MeetingFormInput) =>
    respond(await createMeeting(input), { revalidate: [meetingsQuery.key] }),
  "createMeeting",
);

export const updateMeetingMutation = action(
  async (input: MeetingFormInput & { meetingId: string }) =>
    respond(await updateMeeting(input), {
      revalidate: [meetingsQuery.key, meetingQuery.key],
    }),
  "updateMeeting",
);

export const cancelMeetingMutation = action(
  async (meetingId: string) =>
    respond(await cancelMeeting({ meetingId }), {
      revalidate: [meetingsQuery.key, meetingQuery.key],
    }),
  "cancelMeeting",
);
