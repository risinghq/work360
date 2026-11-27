import { describe, expect, it } from "vitest";

import { MeetingId, WorkspaceId } from "~/domain/ids";
import {
  buildIcs,
  meetingUid,
  parseIcsReply,
  parseMeetingUid,
  type IcsEvent,
} from "~/server/meetings/domain/ics";

const EVENT: IcsEvent = {
  uid: "m1@work360",
  method: "request",
  sequence: 2,
  title:
    "Reunión de coordinación con el área de Operaciones y Logística — revisión trimestral",
  description: "Línea uno\nLínea dos",
  location: null,
  startsAt: new Date("2026-12-01T15:00:00.000Z"),
  endsAt: new Date("2026-12-01T16:30:00.000Z"),
  stamp: new Date("2026-11-27T10:00:00.000Z"),
  organizer: { email: "ana@example.com", name: 'Ana "Jefa" Pérez' },
  attendees: [
    { email: "luis@example.com", name: null, response: "needs_action" },
    { email: "rosa@example.com", name: "Rosa", response: "accepted" },
  ],
  replyTo: null,
};

describe("buildIcs", () => {
  it("folds long lines at 75 octets without splitting a character", () => {
    const ics = buildIcs(EVENT);
    const encoder = new TextEncoder();
    for (const line of ics.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain(`SUMMARY:${EVENT.title}\r\n`);
  });

  it("escapes newlines and strips quotes from a common name", () => {
    const ics = buildIcs(EVENT);
    expect(ics).toContain("DESCRIPTION:Línea uno\\nLínea dos\r\n");
    expect(ics).toContain(
      'ORGANIZER;CN="Ana Jefa Pérez":mailto:ana@example.com',
    );
    expect(ics).toContain("ATTENDEE;ROLE=REQ-PARTICIPANT");
    expect(ics).not.toContain("LOCATION");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("asks for no replies without a reply address", () => {
    const unfolded = buildIcs(EVENT).replace(/\r\n /g, "");
    expect(unfolded).not.toContain("RSVP=TRUE");
    expect(unfolded).toContain(
      'ATTENDEE;CN="Rosa";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:rosa@example.com',
    );
  });

  it("names the reply address as organizer and keeps known answers", () => {
    const unfolded = buildIcs({
      ...EVENT,
      replyTo: "reuniones@rising.sh",
    }).replace(/\r\n /g, "");
    expect(unfolded).toContain(
      'ORGANIZER;CN="Ana Jefa Pérez":mailto:reuniones@rising.sh',
    );
    expect(unfolded).toContain(
      "PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:luis@example.com",
    );
    expect(unfolded).toContain(
      "PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:rosa@example.com",
    );
  });

  it("marks a cancel as cancelled", () => {
    const ics = buildIcs({ ...EVENT, method: "cancel" });
    expect(ics).toContain("METHOD:CANCEL\r\n");
    expect(ics).toContain("STATUS:CANCELLED\r\n");
  });
});

describe("meetingUid", () => {
  it("round-trips the meeting and workspace ids", () => {
    const meetingId = MeetingId.mint();
    const workspaceId = WorkspaceId.mint();
    expect(parseMeetingUid(meetingUid(workspaceId, meetingId))).toEqual({
      meetingId,
      workspaceId,
    });
    expect(parseMeetingUid(`${meetingId}@work360`)).toBeNull();
    expect(parseMeetingUid("event-123@google.com")).toBeNull();
  });
});

// Google Calendar's REPLY, trimmed to the properties it sends.
const REPLY = [
  "BEGIN:VCALENDAR",
  "PRODID:-//Google Inc//Google Calendar 70.9054//EN",
  "VERSION:2.0",
  "METHOD:REPLY",
  "BEGIN:VEVENT",
  "DTSTART:20261201T150000Z",
  'ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN="Luis',
  ' Díaz: Ventas";X-NUM-GUESTS=0:mailto:Luis@Example.com',
  "SEQUENCE:3",
  "UID:m1@work360",
  "END:VEVENT",
  "END:VCALENDAR",
  "",
].join("\r\n");

describe("parseIcsReply", () => {
  it("reads the attendee's answer from a folded reply", () => {
    expect(parseIcsReply(REPLY)).toEqual({
      uid: "m1@work360",
      sequence: 3,
      attendee: "luis@example.com",
      response: "accepted",
    });
  });

  it("ignores a request and an answer without a decision", () => {
    expect(parseIcsReply(REPLY.replace("METHOD:REPLY", "METHOD:REQUEST"))).toBe(
      null,
    );
    expect(
      parseIcsReply(REPLY.replace("PARTSTAT=ACCEPTED", "PARTSTAT=DELEGATED")),
    ).toBeNull();
  });

  it("reads a decline and a tentative answer", () => {
    expect(
      parseIcsReply(REPLY.replace("PARTSTAT=ACCEPTED", "PARTSTAT=DECLINED"))
        ?.response,
    ).toBe("declined");
    expect(
      parseIcsReply(REPLY.replace("PARTSTAT=ACCEPTED", "PARTSTAT=TENTATIVE"))
        ?.response,
    ).toBe("tentative");
  });
});
