// Builds the iCalendar invite (RFC 5545, iTIP RFC 5546) that a mail client
// adds to its calendar, and reads the REPLY a guest's calendar sends back. A
// REQUEST with a higher SEQUENCE replaces the event with the same UID; a
// CANCEL removes it.

import type { MeetingGuestResponse } from "~/contracts/meetings/views";
import type { MeetingId, WorkspaceId } from "~/domain/ids";

export type IcsPerson = { email: string; name: string | null };

export type IcsAttendee = IcsPerson & { response: MeetingGuestResponse };

const UID_PATTERN = /^([0-9a-f-]{36})\.([0-9a-f-]{36})@work360$/i;

// The UID names the workspace too, so a reply that reaches the shared
// address finds the store that holds the meeting.
export function meetingUid(
  workspaceId: WorkspaceId,
  meetingId: MeetingId,
): string {
  return `${meetingId}.${workspaceId}@work360`;
}

export function parseMeetingUid(
  uid: string,
): { meetingId: string; workspaceId: string } | null {
  const [, meetingId, workspaceId] = UID_PATTERN.exec(uid) ?? [];
  return meetingId && workspaceId ? { meetingId, workspaceId } : null;
}

const PARTSTAT: Record<MeetingGuestResponse, string> = {
  needs_action: "NEEDS-ACTION",
  accepted: "ACCEPTED",
  declined: "DECLINED",
  tentative: "TENTATIVE",
};

export type IcsEvent = {
  uid: string;
  method: "request" | "cancel";
  sequence: number;
  title: string;
  description: string;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  stamp: Date;
  organizer: IcsPerson;
  attendees: readonly IcsAttendee[];
  // The address that collects replies, named as the organizer. Without one
  // the invite asks for none, since a reply would reach the organizer's own
  // mailbox and never work360.
  replyTo: string | null;
};

export function buildIcs(event: IcsEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//work360//Reuniones//ES",
    "CALSCALE:GREGORIAN",
    `METHOD:${event.method === "request" ? "REQUEST" : "CANCEL"}`,
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `SEQUENCE:${event.sequence}`,
    `DTSTAMP:${utc(event.stamp)}`,
    `DTSTART:${utc(event.startsAt)}`,
    `DTEND:${utc(event.endsAt)}`,
    `SUMMARY:${text(event.title)}`,
    ...(event.description ? [`DESCRIPTION:${text(event.description)}`] : []),
    ...(event.location ? [`LOCATION:${text(event.location)}`] : []),
    `STATUS:${event.method === "request" ? "CONFIRMED" : "CANCELLED"}`,
    `ORGANIZER${cn(event.organizer)}:mailto:${event.replyTo ?? event.organizer.email}`,
    ...event.attendees.map((person) => attendeeLine(person, event.replyTo)),
    // Outlook and Apple Calendar keep this reminder; Google Calendar applies
    // the guest's own default notifications instead.
    ...(event.method === "request"
      ? [
          "BEGIN:VALARM",
          "ACTION:DISPLAY",
          `DESCRIPTION:${text(event.title)}`,
          "TRIGGER:-PT15M",
          "END:VALARM",
        ]
      : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

function attendeeLine(person: IcsAttendee, replyTo: string | null): string {
  const partstat = replyTo ? PARTSTAT[person.response] : "NEEDS-ACTION";
  const rsvp = replyTo !== null && person.response === "needs_action";
  return `ATTENDEE${cn(person)};ROLE=REQ-PARTICIPANT;PARTSTAT=${partstat};RSVP=${rsvp ? "TRUE" : "FALSE"}:mailto:${person.email}`;
}

export type IcsReply = {
  uid: string;
  sequence: number;
  attendee: string;
  response: Exclude<MeetingGuestResponse, "needs_action">;
};

const REPLY_RESPONSES: Record<string, IcsReply["response"]> = {
  ACCEPTED: "accepted",
  DECLINED: "declined",
  TENTATIVE: "tentative",
};

// The answer in an iTIP REPLY, or null when the calendar is not a reply
// with one attendee's decision.
export function parseIcsReply(ics: string): IcsReply | null {
  const lines = ics.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const properties = lines.map(parseProperty);
  const method = properties.find((prop) => prop?.name === "METHOD");
  if (method?.value.toUpperCase() !== "REPLY") return null;
  const start = lines.findIndex((line) => line.trim() === "BEGIN:VEVENT");
  if (start < 0) return null;
  const event = properties.slice(start);
  const uid = event.find((prop) => prop?.name === "UID")?.value;
  const attendee = event.find((prop) => prop?.name === "ATTENDEE");
  if (!uid || !attendee) return null;
  const response =
    REPLY_RESPONSES[attendee.params.PARTSTAT?.toUpperCase() ?? ""];
  const email = attendee.value
    .replace(/^mailto:/i, "")
    .trim()
    .toLowerCase();
  if (!response || !email) return null;
  const sequence = Number(
    event.find((prop) => prop?.name === "SEQUENCE")?.value ?? "0",
  );
  return {
    uid: uid.trim(),
    sequence: Number.isInteger(sequence) ? sequence : 0,
    attendee: email,
    response,
  };
}

type Property = { name: string; params: Record<string, string>; value: string };

// NAME;PARAM=a;PARAM="b:c":value. A colon inside quotes is not the value's.
function parseProperty(line: string): Property | null {
  let quoted = false;
  let colon = -1;
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === '"') quoted = !quoted;
    else if (line[i] === ":" && !quoted) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;
  const [name = "", ...rawParams] = line.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  for (const raw of rawParams) {
    const eq = raw.indexOf("=");
    if (eq > 0) {
      params[raw.slice(0, eq).toUpperCase()] = raw
        .slice(eq + 1)
        .replace(/^"|"$/g, "");
    }
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

function utc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function text(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function cn(person: IcsPerson): string {
  if (!person.name) return "";
  return `;CN="${person.name.replace(/["\r\n]/g, "")}"`;
}

// Lines longer than 75 octets continue on the next line after a space. The
// split never cuts a UTF-8 character.
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const width = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (size + width > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += width;
  }
  parts.push(current);
  return parts.join("\r\n ");
}
