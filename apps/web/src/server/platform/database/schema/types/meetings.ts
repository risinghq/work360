import type { Generated } from "kysely";

import type {
  CaseId,
  IdColumn,
  MeetingId,
  NullableIdColumn,
  OrganizationId,
  UserId,
} from "~/domain/ids";

export interface MeetingsTable {
  id: IdColumn<MeetingId>;
  title: string;
  description: Generated<string>;
  starts_at: Date;
  ends_at: Date;
  location: string | null;
  video_link: string | null;
  organizer_user_id: IdColumn<UserId>;
  organization_id: NullableIdColumn<OrganizationId>;
  case_id: NullableIdColumn<CaseId>;
  status: Generated<"scheduled" | "canceled">;
  sequence: Generated<number>;
  created_at: Date;
  updated_at: Date;
}

export interface MeetingGuestsTable {
  meeting_id: IdColumn<MeetingId>;
  email: string;
  name: string | null;
  member_user_id: NullableIdColumn<UserId>;
}

export interface MeetingInvitesTable {
  id: string;
  meeting_id: IdColumn<MeetingId>;
  recipient_email: string;
  recipient_name: string | null;
  method: "request" | "cancel";
  sequence: number;
  queue_state: "pending" | "processing" | "done" | "failed";
  attempt_count: number;
  max_attempts: number;
  claimable_at: Date;
  provider: string | null;
  provider_message_id: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: Date;
  completed_at: Date | null;
}
