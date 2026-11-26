import type { JSX } from "@solidjs/web";

import MapIcon from "~/components/icons/map";
import Package from "~/components/icons/package";
import Phone from "~/components/icons/phone";
import Plus from "~/components/icons/plus";
import TimelineEvent from "~/components/icons/timeline-event";

import type { EventKind } from "../../model/event";

export function eventIcon(kind: EventKind): JSX.Element {
  if (kind === "stage-change") {
    return <Package size={14} />;
  }

  if (kind === "note") {
    return <Plus size={14} />;
  }

  if (kind === "call") {
    return <Phone size={14} />;
  }

  if (kind === "visit") {
    return <MapIcon size={14} />;
  }

  return <TimelineEvent size={14} />;
}
