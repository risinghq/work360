// Builds the iCalendar invite (RFC 5545, iTIP RFC 5546) that a mail client
// adds to its calendar. A REQUEST with a higher SEQUENCE replaces the event
// with the same UID; a CANCEL removes it.

export type IcsPerson = { email: string; name: string | null };

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
  attendees: readonly IcsPerson[];
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
    `ORGANIZER${cn(event.organizer)}:mailto:${event.organizer.email}`,
    // Replies would reach the organizer's mailbox, not work360, so no RSVP.
    ...event.attendees.map(
      (person) =>
        `ATTENDEE${cn(person)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:${person.email}`,
    ),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
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
