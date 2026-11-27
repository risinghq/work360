import { describe, expect, it } from "vitest";

import { MeetingId, WorkspaceId } from "~/domain/ids";
import { meetingUid } from "~/server/meetings/domain/ics";
import { readMeetingReply } from "~/server/meetings/invites/reply-mail";

const MEETING = MeetingId.mint();
const WORKSPACE = WorkspaceId.mint();

function replyIcs(attendee: string, uid = meetingUid(WORKSPACE, MEETING)) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "METHOD:REPLY",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    "SEQUENCE:1",
    `ATTENDEE;PARTSTAT=DECLINED;CN=Luis:mailto:${attendee}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

// A calendar's reply as Gmail mails it: a text body and the REPLY as a
// base64 text/calendar part.
function mail(ics: string, from = "luis@example.com") {
  return [
    `From: Luis <${from}>`,
    "To: reuniones@rising.sh",
    "Subject: Rechazada: Revisión semanal",
    "MIME-Version: 1.0",
    'Content-Type: multipart/mixed; boundary="b1"',
    "",
    "--b1",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    "Luis rechazó esta invitación.",
    "--b1",
    'Content-Type: text/calendar; charset=UTF-8; method=REPLY; name="invite.ics"',
    "Content-Transfer-Encoding: base64",
    "",
    btoa(ics),
    "--b1--",
    "",
  ].join("\r\n");
}

describe("readMeetingReply", () => {
  it("reads the answer, meeting and workspace from a reply mail", async () => {
    const reply = await readMeetingReply(
      mail(replyIcs("Luis@Example.com")),
      "LUIS@example.com",
    );
    expect(reply).toEqual({
      workspaceId: WORKSPACE,
      meetingId: MEETING,
      email: "luis@example.com",
      response: "declined",
      sequence: 1,
    });
  });

  it("drops an answer sent for another guest", async () => {
    const reply = await readMeetingReply(
      mail(replyIcs("rosa@example.com")),
      "luis@example.com",
    );
    expect(reply).toBeNull();
  });

  it("drops a reply to an event work360 did not send", async () => {
    const reply = await readMeetingReply(
      mail(replyIcs("luis@example.com", "abc@google.com")),
      "luis@example.com",
    );
    expect(reply).toBeNull();
  });

  it("drops a mail without a calendar part", async () => {
    const plain = [
      "From: luis@example.com",
      "Subject: hola",
      "",
      "Sin calendario.",
    ].join("\r\n");
    expect(await readMeetingReply(plain, "luis@example.com")).toBeNull();
  });
});
