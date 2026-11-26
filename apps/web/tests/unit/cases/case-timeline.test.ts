import { describe, expect, it } from "vitest";

import { caseTimeline } from "~/features/cases/model/case-timeline";

describe("case timeline", () => {
  it("lists case events newest first with the stage status as subject", () => {
    const events = caseTimeline(
      [
        {
          kind: "opened",
          stageName: null,
          status: null,
          actorName: "Ana",
          holderName: null,
          at: 1_000,
        },
        {
          kind: "stage_written",
          stageName: "Validación",
          status: "Aprobado",
          actorName: null,
          holderName: null,
          at: 2_000,
        },
        {
          kind: "timed_out",
          stageName: "Firma",
          status: "Vencido",
          actorName: null,
          holderName: null,
          at: 3_000,
        },
      ],
      "Afiliación",
    );

    expect(
      events.map(({ kind, author, action, subject }) => ({
        kind,
        author,
        action,
        subject,
      })),
    ).toEqual([
      {
        kind: "stage-change",
        author: "Sistema",
        action: "venció Firma y pasó a",
        subject: "Vencido",
      },
      {
        kind: "stage-change",
        author: "Un usuario",
        action: "guardó Validación:",
        subject: "Aprobado",
      },
      {
        kind: "system",
        author: "Ana",
        action: "registró el caso",
        subject: "Afiliación",
      },
    ]);
  });
});
