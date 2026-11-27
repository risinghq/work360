import { fail, type DomainError } from "~/domain/errors";
import type { CaseId, OrganizationId, UserId } from "~/domain/ids";
import { Err, Ok, type Result } from "~/shared/result";

const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_GUESTS = 50;

export type MeetingGuest = {
  email: string;
  name: string | null;
  memberUserId: UserId | null;
};

export type MeetingDraft = {
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  videoLink: string | null;
  organizationId: OrganizationId | null;
  caseId: CaseId | null;
  guests: MeetingGuest[];
};

export type Organizer = { userId: UserId; email: string; name: string };

// Checks the draft and returns it with each guest listed once, by lowercased
// email, and the organizer among them so their calendar gets the invite too.
export function settleDraft(
  draft: MeetingDraft,
  organizer: Organizer,
): Result<MeetingDraft, DomainError> {
  const span = draft.endsAt.getTime() - draft.startsAt.getTime();
  if (!(span > 0 && span <= MAX_DURATION_MS)) {
    return Err(fail("meeting_time_invalid", { fields: ["endsAt"] }));
  }
  const videoLink = draft.videoLink?.trim() || null;
  if (videoLink !== null && !isHttpsUrl(videoLink)) {
    return Err(fail("meeting_link_invalid", { fields: ["videoLink"] }));
  }

  const byEmail = new Map<string, MeetingGuest>();
  const add = (guest: MeetingGuest) => {
    const email = guest.email.trim().toLowerCase();
    if (!byEmail.has(email)) byEmail.set(email, { ...guest, email });
  };
  add({
    email: organizer.email,
    name: organizer.name,
    memberUserId: organizer.userId,
  });
  for (const guest of draft.guests) {
    if (!EMAIL_PATTERN.test(guest.email.trim())) {
      return Err(fail("meeting_guest_invalid", { fields: ["guests"] }));
    }
    add(guest);
  }
  if (byEmail.size > MAX_GUESTS) {
    return Err(fail("meeting_guest_invalid", { fields: ["guests"] }));
  }

  return Ok({
    ...draft,
    title: draft.title.trim(),
    description: draft.description.trim(),
    location: draft.location?.trim() || null,
    videoLink,
    guests: [...byEmail.values()],
  });
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export type InvitePlan = {
  email: string;
  name: string | null;
  method: "request" | "cancel";
};

// A change sends the new version to every current guest and a cancellation to
// each guest it removed.
export function planChangeInvites(
  before: readonly MeetingGuest[],
  after: readonly MeetingGuest[],
): InvitePlan[] {
  const kept = new Set(after.map((guest) => guest.email));
  return [
    ...after.map((guest) => ({
      email: guest.email,
      name: guest.name,
      method: "request" as const,
    })),
    ...before
      .filter((guest) => !kept.has(guest.email))
      .map((guest) => ({
        email: guest.email,
        name: guest.name,
        method: "cancel" as const,
      })),
  ];
}
