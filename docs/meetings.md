# Meetings

A meeting is a work meeting a member schedules: an HR interview, a team meeting
called by a supervisor, or a meeting with a client company. work360 keeps the
meeting and emails each guest a calendar invitation. The code is in
[`apps/web/src/server/meetings`](../apps/web/src/server/meetings) and
[`apps/web/src/features/meetings`](../apps/web/src/features/meetings).

## What a meeting holds

| Field       | Rule                                                       |
| ----------- | ---------------------------------------------------------- |
| title       | required                                                   |
| start, end  | the end follows the start by at most 24 hours              |
| video       | none, a pasted `https://` link, or a hosted Zoom room      |
| location    | optional free text                                         |
| description | optional agenda, sent in the invitation                    |
| company     | optional; set when the meeting is scheduled from a company |
| case        | optional; set when the meeting is scheduled from a case    |
| guests      | members, company contacts or any address, at most 50       |

The organizer is always a guest, so their own calendar gets the invitation. Each
address is listed once, compared in lower case. A member guest is stored by user
id and the server supplies the address, so a client cannot point a member at
another mailbox.

## Video calls

The form's "Videollamada" picks one of these:

- **Ninguna**: the meeting has no call.
- **Enlace propio**: the organizer pastes a link from any service.
- **Zoom**: work360 creates the room in the workspace's Zoom account. The option
  is disabled until an admin connects Zoom.
- **Google Meet**: work360 creates the room in the organizer's own Google
  account. The option is disabled until the organizer connects Google.

An admin connects Zoom in Ajustes > Integraciones with a Zoom Server-to-Server
OAuth app that holds the scopes `meeting:write:admin` and `user:read:admin`.
work360 checks the credentials against Zoom before it stores them, sealed with
`INTEGRATIONS_ENCRYPTION_KEY`. The room belongs to the account, not to the
organizer, so guests may join before a host.

A member connects Google in Ajustes > Cuentas conectadas. The flow at
`/api/integrations/google` uses the app's Google OAuth client and asks only for
`calendar.app.created`: work360 can manage the calendars it creates and cannot
read the member's other calendars. The first Meet room creates a calendar named
"work360" in the member's account, and each room is an event in it with a Meet
conference and no guests, so Google sends no invitation of its own. If the
member deletes that calendar, the next room creates a new one. The refresh token
is sealed with `INTEGRATIONS_ENCRYPTION_KEY`. Disconnecting deletes it and
revokes the grant at Google.

[`runtime.ts`](../apps/web/src/server/meetings/runtime.ts) keeps the room in
step with the meeting:

- Scheduling creates the room before the meeting is saved, so the first
  invitation carries its link. If the provider refuses, nothing is saved. If the
  save fails, the room is removed.
- Editing moves the room to the new time and keeps its link. Switching to
  another option removes the old room.
- Cancelling removes the room.

A room left behind by a failed removal is reported to Sentry and does not fail
the request. Microsoft Teams rooms are later work.

## Who can do what

| Permission         | Allows                                       |
| ------------------ | -------------------------------------------- |
| any member         | see meetings they organize or are invited to |
| `meeting:schedule` | schedule a meeting and list guests to invite |
| `meeting:view:all` | see every meeting in the workspace           |

[`rbac.ts`](../apps/web/src/domain/auth/access/rbac.ts) lists the roles that
hold each permission. HR, supervisors, sales managers and executives can
schedule. Only the organizer changes or cancels a meeting, and a cancelled
meeting cannot change again.

## Invitations

Every save queues one email per guest through Resend. The email carries an
iCalendar (`.ics`) attachment, so Gmail, Outlook and Apple Calendar offer to add
the event.

- Scheduling sends a `REQUEST` to every guest.
- Editing sends a new `REQUEST` with a higher `SEQUENCE` to every current guest,
  and a `CANCEL` to each guest the edit removed.
- Cancelling the meeting sends a `CANCEL` to every guest.

Every invitation of one meeting uses the UID
`<meeting id>.<workspace id>@work360`, so a calendar replaces or removes the
event it already holds. The `meeting-invites` job queue in
[`invites/queue.ts`](../apps/web/src/server/meetings/invites/queue.ts) builds
the attachment at send time from the meeting as it stands. A later edit
supersedes any invitation still pending, so no guest receives stale fields under
a newer sequence.

## Replies

When `MEETING_REPLY_ADDRESS` is set, it is the invitation's `ORGANIZER` and each
guest is asked to answer (`RSVP=TRUE`). A guest's Aceptar, Rechazar or Quizás
mails an iTIP `REPLY` to that address. Email Routing hands the mail to the
Worker's `email` handler, and
[`invites/reply-mail.ts`](../apps/web/src/server/meetings/invites/reply-mail.ts)
reads it. The workspace and meeting come from the UID.

A reply counts only when all of these hold:

- the envelope sender is the guest the reply names, so nobody answers for
  another guest;
- the meeting is still scheduled;
- the reply's `SEQUENCE` is not older than the meeting's.

The meeting's page shows each guest's answer. An edit keeps the answers unless
it moves the time; then every guest is asked again. The organizer always shows
as accepted. [deployment.md](deployment.md) describes the routing rule.

## Where it shows

- **Reuniones** in the sidebar lists the meetings the viewer can see. "Nueva
  reunión" opens the form in the side panel.
- A meeting's page shows its fields, its guests and its description. The
  organizer edits it from the header and cancels it from the form's menu.
- The company page and the case page have a Reuniones card. Its `+` schedules a
  meeting linked to that record and offers the company's contacts as guests.

Times are entered and shown in Lima time (UTC−5), as everywhere in the app.
