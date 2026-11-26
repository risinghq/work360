import { describe, expect, it } from "vitest";

import { companyTimeline } from "~/features/companies/model/company-timeline";

describe("company timeline", () => {
  it("lists calls and visits newest first with their outcome as subject", () => {
    const events = companyTimeline([
      {
        channel: "call",
        startedAt: 1_000,
        userName: "Ana",
        outcomeLabel: null,
        notes: null,
      },
      {
        channel: "visit",
        startedAt: 2_000,
        userName: "Luis",
        outcomeLabel: "Interesado",
        notes: "Volver el lunes",
      },
    ]);

    expect(
      events.map(({ kind, author, subject, description }) => ({
        kind,
        author,
        subject,
        description,
      })),
    ).toEqual([
      {
        kind: "visit",
        author: "Luis",
        subject: "Interesado",
        description: "Volver el lunes",
      },
      {
        kind: "call",
        author: "Ana",
        subject: "Llamada",
        description: undefined,
      },
    ]);
  });
});
