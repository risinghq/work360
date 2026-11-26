import type { CaseDetailView, CaseEventView } from "~/contracts/cases/views";
import type {
  Event,
  EventKind,
} from "~/features/record-show/tabs/timeline/model/event";

type EventText = Pick<Event, "author" | "action" | "subject"> & {
  kind: EventKind;
};

function eventText(event: CaseEventView, caseTypeName: string): EventText {
  const author = event.actorName ?? "Un usuario";
  switch (event.kind) {
    case "opened":
      return {
        author,
        action: "registró el caso",
        subject: caseTypeName,
        kind: "system",
      };
    case "stage_written":
      return {
        author,
        action: `guardó ${event.stageName ?? "una etapa"}:`,
        subject: event.status ?? "",
        kind: "stage-change",
      };
    case "reassigned":
      return {
        author,
        action: "pasó el caso a",
        subject: event.holderName ?? "otro responsable",
        kind: "assignment",
      };
    case "timed_out":
      return {
        author: "Sistema",
        action: `venció ${event.stageName ?? "una etapa"} y pasó a`,
        subject: event.status ?? "",
        kind: "stage-change",
      };
  }
}

// The view lists events oldest first; the timeline shows them newest first.
export function caseTimeline(
  events: CaseDetailView["events"],
  caseTypeName: string,
): Event[] {
  return events
    .map((event, index) => ({
      id: `${event.at}-${index}`,
      createdAt: event.at,
      name: `case.${event.kind}`,
      ...eventText(event, caseTypeName),
    }))
    .toReversed();
}
