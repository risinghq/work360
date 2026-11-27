import { sql, type SqlBool } from "kysely";

export type JobTableName =
  | "company_registry_record"
  | "notification_intents"
  | "notification_deliveries"
  | "whatsapp_inbound_events"
  | "outbound_whatsapp_messages"
  | "meeting_invites";

// Literal states, so the claim query matches the partial claim indexes, whose
// predicates are written the same way.
export const CLAIMABLE_STATES = sql<SqlBool>`queue_state in ('pending', 'processing')`;
