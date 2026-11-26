import type { CompanyDetailView } from "~/contracts/companies/views";
import { ACTIVITY_CHANNEL_LABELS } from "~/domain/activities/channel";
import type { Event } from "~/features/record-show/tabs/timeline/model/event";

export function companyTimeline(
  activities: CompanyDetailView["activities"],
): Event[] {
  return activities
    .toSorted((a, b) => b.startedAt - a.startedAt)
    .map((activity, index) => ({
      id: `${activity.startedAt}-${index}`,
      createdAt: activity.startedAt,
      name: `company.${activity.channel}`,
      author: activity.userName,
      action:
        activity.channel === "call"
          ? "registró una llamada"
          : "registró una visita",
      subject:
        activity.outcomeLabel ?? ACTIVITY_CHANNEL_LABELS[activity.channel],
      description: activity.notes ?? undefined,
      kind: activity.channel,
    }));
}
