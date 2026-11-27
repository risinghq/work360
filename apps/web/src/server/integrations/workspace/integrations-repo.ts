import type { Kysely } from "kysely";

import type { UserId } from "~/domain/ids";
import type { WorkspaceDatabase } from "~/server/platform/database/types";

export type IntegrationProvider = "zoom";

export type IntegrationRow = {
  provider: IntegrationProvider;
  sealedConfig: string;
  label: string;
  connectedByUserId: UserId;
  connectedByName: string;
  connectedAt: Date;
};

export function createIntegrationsRepo(db: Kysely<WorkspaceDatabase>) {
  return {
    async find(provider: IntegrationProvider): Promise<IntegrationRow | null> {
      const row = await db
        .selectFrom("workspace_integrations")
        .innerJoin(
          "members",
          "members.user_id",
          "workspace_integrations.connected_by_user_id",
        )
        .select([
          "workspace_integrations.provider",
          "workspace_integrations.sealed_config",
          "workspace_integrations.label",
          "workspace_integrations.connected_by_user_id",
          "workspace_integrations.connected_at",
          "members.names",
          "members.first_surname",
        ])
        .where("workspace_integrations.provider", "=", provider)
        .executeTakeFirst();
      if (!row) return null;
      return {
        provider: row.provider,
        sealedConfig: row.sealed_config,
        label: row.label,
        connectedByUserId: row.connected_by_user_id,
        connectedByName: `${row.names} ${row.first_surname}`.trim(),
        connectedAt: row.connected_at,
      };
    },

    async save(row: {
      provider: IntegrationProvider;
      sealedConfig: string;
      label: string;
      connectedByUserId: UserId;
      connectedAt: Date;
    }): Promise<void> {
      const values = {
        sealed_config: row.sealedConfig,
        label: row.label,
        connected_by_user_id: row.connectedByUserId,
        connected_at: row.connectedAt,
      };
      await db
        .insertInto("workspace_integrations")
        .values({ provider: row.provider, ...values })
        .onConflict((oc) => oc.column("provider").doUpdateSet(values))
        .execute();
    },

    async remove(provider: IntegrationProvider): Promise<void> {
      await db
        .deleteFrom("workspace_integrations")
        .where("provider", "=", provider)
        .execute();
    },
  };
}
