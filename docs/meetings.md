# Meetings

A meeting is a work meeting a member schedules: an HR interview, a team
meeting called by a supervisor, or a meeting with a client company. work360
keeps the meeting and emails each guest a calendar invitation. The code is in
[`apps/web/src/server/meetings`](../apps/web/src/server/meetings) and
[`apps/web/src/features/meetings`](../apps/web/src/features/meetings).

## What a meeting holds

| Field       | Rule                                                       |
| ----------- | ---------------------------------------------------------- |
| title       | required                                                   |
| start, end  | the end follows the start by at most 24 hours              |
| video link  | optional, an `https://` URL such as a Google Meet link     |
| location    | optional free text                                         |
| description | optional agenda, sent in the invitation                    |
| company     | optional; set when the meeting is scheduled from a company |
| case        | optional; set when the meeting is scheduled from a case    |
| guests      | members, company contacts or any address, at most 50       |

The organizer is always a guest, so their own calendar gets the invitation.
Each address is listed once, compared in lower case. A member guest is stored
by user id and the server supplies the address, so a client cannot point a
member at another mailbox.

work360 does not create the video call. The organizer pastes a link from Meet,
Teams or Zoom. A link created through a connected Google or Microsoft account
is later work.

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

Every invitation of one meeting uses the UID `<meeting id>@work360`, so a
calendar replaces or removes the event it already holds. The `meeting-invites`
job queue in
[`invites/queue.ts`](../apps/web/src/server/meetings/invites/queue.ts) builds
the attachment at send time from the meeting as it stands. A later edit
supersedes any invitation still pending, so no guest receives stale fields
under a newer sequence.

## Where it shows

- **Reuniones** in the sidebar lists the meetings the viewer can see.
  "Nueva reunión" opens the form in the side panel.
- A meeting's page shows its fields, its guests and its description. The
  organizer edits it from the header and cancels it from the form's menu.
- The company page and the case page have a Reuniones card. Its `+` schedules a
  meeting linked to that record and offers the company's contacts as guests.

Times are entered and shown in Lima time (UTC−5), as everywhere in the app.
