import type { Kysely } from "kysely";

import type { MeetingId } from "~/domain/ids";
import type { WorkspaceDatabase } from "~/server/platform/database/types";
import {
  createJobStore,
  type JobStore,
} from "~/server/platform/jobs/job-store";

export type MeetingInviteJob = {
  id: string;
  attempt_count: number;
  max_attempts: number;
  meeting_id: MeetingId;
  recipient_email: string;
  method: "request" | "cancel";
  sequence: number;
};

export function createMeetingInviteStore(
  db: Kysely<WorkspaceDatabase>,
): JobStore<string, MeetingInviteJob> {
  return createJobStore<MeetingInviteJob, string>(db, "meeting_invites", [
    "id",
    "attempt_count",
    "max_attempts",
    "meeting_id",
    "recipient_email",
    "method",
    "sequence",
  ]);
}
