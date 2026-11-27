import PostalMime from "postal-mime";

import type { MeetingGuestResponse } from "~/contracts/meetings/views";
import { MeetingId, WorkspaceId } from "~/domain/ids";

import { parseIcsReply, parseMeetingUid } from "../domain/ics";

export type MeetingReplyMail = {
  workspaceId: WorkspaceId;
  meetingId: MeetingId;
  email: string;
  response: MeetingGuestResponse;
  sequence: number;
};

// A calendar's answer to an invite, mailed to the ORGANIZER address. Returns
// null for any mail that is not a REPLY to a work360 meeting.
//
// The envelope sender must be the attendee who answers. Without that check
// anyone who saw an invite could answer for another guest.
export async function readMeetingReply(
  raw: ReadableStream<Uint8Array> | string,
  envelopeFrom: string,
): Promise<MeetingReplyMail | null> {
  const mail = await PostalMime.parse(raw, { attachmentEncoding: "utf8" });
  const calendar = mail.attachments.find(
    (part) => part.mimeType.toLowerCase() === "text/calendar",
  );
  if (!calendar || typeof calendar.content !== "string") return null;
  const reply = parseIcsReply(calendar.content);
  if (!reply || reply.attendee !== envelopeFrom.trim().toLowerCase()) {
    return null;
  }
  const uid = parseMeetingUid(reply.uid);
  if (!uid) return null;
  const workspaceId = WorkspaceId.parse(uid.workspaceId);
  const meetingId = MeetingId.parse(uid.meetingId);
  if (!workspaceId.ok || !meetingId.ok) return null;
  return {
    workspaceId: workspaceId.value,
    meetingId: meetingId.value,
    email: reply.attendee,
    response: reply.response,
    sequence: reply.sequence,
  };
}
