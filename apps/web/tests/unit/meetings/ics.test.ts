import { describe, expect, it } from "vitest";

import { buildIcs, type IcsEvent } from "~/server/meetings/domain/ics";

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
  attendees: [{ email: "luis@example.com", name: null }],
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

  it("marks a cancel as cancelled", () => {
    const ics = buildIcs({ ...EVENT, method: "cancel" });
    expect(ics).toContain("METHOD:CANCEL\r\n");
    expect(ics).toContain("STATUS:CANCELLED\r\n");
  });
});
