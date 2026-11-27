import type { Kysely } from "kysely";

import type { UserId } from "~/domain/ids";
import type { WorkspaceDatabase } from "~/server/platform/database/types";

export type MemberConnectionProvider = "google";

export type MemberConnectionRow = {
  sealedConfig: string;
  label: string;
  calendarId: string | null;
  connectedAt: Date;
};

export function createMemberConnectionsRepo(db: Kysely<WorkspaceDatabase>) {
  return {
    async find(
      userId: UserId,
      provider: MemberConnectionProvider,
    ): Promise<MemberConnectionRow | null> {
      const row = await db
        .selectFrom("member_connections")
        .select(["sealed_config", "label", "calendar_id", "connected_at"])
        .where("user_id", "=", userId)
        .where("provider", "=", provider)
        .executeTakeFirst();
      return row
        ? {
            sealedConfig: row.sealed_config,
            label: row.label,
            calendarId: row.calendar_id,
            connectedAt: row.connected_at,
          }
        : null;
    },

    // A new connection starts without a calendar: the account may differ.
    async save(
      userId: UserId,
      provider: MemberConnectionProvider,
      row: { sealedConfig: string; label: string; connectedAt: Date },
    ): Promise<void> {
      const values = {
        sealed_config: row.sealedConfig,
        label: row.label,
        calendar_id: null,
        connected_at: row.connectedAt,
      };
      await db
        .insertInto("member_connections")
        .values({ user_id: userId, provider, ...values })
        .onConflict((oc) =>
          oc.columns(["user_id", "provider"]).doUpdateSet(values),
        )
        .execute();
    },

    async setCalendar(
      userId: UserId,
      provider: MemberConnectionProvider,
      calendarId: string,
    ): Promise<void> {
      await db
        .updateTable("member_connections")
        .set({ calendar_id: calendarId })
        .where("user_id", "=", userId)
        .where("provider", "=", provider)
        .execute();
    },

    async remove(
      userId: UserId,
      provider: MemberConnectionProvider,
    ): Promise<void> {
      await db
        .deleteFrom("member_connections")
        .where("user_id", "=", userId)
        .where("provider", "=", provider)
        .execute();
    },
  };
}
