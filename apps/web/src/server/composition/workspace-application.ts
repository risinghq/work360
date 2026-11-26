import { createActivitiesRuntime } from "~/server/activities/runtime";
import { createAuditActionPoliciesRepo } from "~/server/audit-reader/audit-policy-repo";
import { createAuditPolicyService } from "~/server/audit-reader/policy-service";
import { createAuthWorkspace } from "~/server/auth/infrastructure/workspace-port";
import { workspaceCleanupDuty } from "~/server/auth/session/cleanup";
import { createCallsRuntime } from "~/server/calls/runtime";
import { createCampaignsRuntime } from "~/server/campaigns/runtime";
import { createCapacityRuntime } from "~/server/capacity/runtime";
import { caseTimeoutDuty } from "~/server/cases/case-timeout-maintenance";
import { createCasesRuntime } from "~/server/cases/runtime";
import type { CompanyRegistryClient } from "~/server/client-search/ports";
import { createEnrichmentProjector } from "~/server/client-search/realtime";
import { createClientSearchRuntime } from "~/server/client-search/runtime";
import { createCompaniesRuntime } from "~/server/companies/runtime";
import { createContactHoldsRuntime } from "~/server/contacts/runtime";
import { createIngestWatch } from "~/server/data-source-uploads/ingest-watch";
import { createIngestJobProjector } from "~/server/data-source-uploads/realtime";
import { createDataSourceUploadsRuntime } from "~/server/data-source-uploads/runtime";
import {
  createEventLogsChannel,
  startEventLogsTail,
} from "~/server/event-logs/realtime";
import { createEventLogsService } from "~/server/event-logs/service";
import { createExtensionRuntime } from "~/server/extension/runtime";
import { createFilesRuntime } from "~/server/files/runtime";
import type { EngineClient } from "~/server/integrations/engine/client";
import type { InvitePlatformPort } from "~/server/invites/application/types";
import { createWorkspaceInvites } from "~/server/invites/infrastructure/invite-service-factory";
import { createJobsChannel } from "~/server/jobs/channel";
import { createMerchantStatsRuntime } from "~/server/merchant-stats/infrastructure/runtime";
import type { MessagingGateway } from "~/server/notifications/channels/messaging-gateway";
import { createNotificationsRuntime } from "~/server/notifications/runtime";
import { createOrganizationEnrichmentProjection } from "~/server/organization/apply-enrichment";
import type { OrganizationEnrichment } from "~/server/organization/enrichment";
import { createOrganizationRepo } from "~/server/organization/organization-repo";
import type {
  appConfig,
  notificationsConfig,
} from "~/server/platform/config/env";
import type { WorkspaceInfrastructure } from "~/server/platform/infrastructure";
import { queueDuty } from "~/server/platform/jobs/job-queue";
import type { Duty } from "~/server/platform/schedule/schedule";
import { createRealtimeService } from "~/server/realtime/runtime";
import type { RealtimeSockets } from "~/server/realtime/sockets";
import { createRecordImportsRuntime } from "~/server/records/imports/runtime";
import { createReportsRuntime } from "~/server/reports/runtime";
import { createRolesRuntime } from "~/server/roles/runtime";
import { createSearchRuntime } from "~/server/search/runtime";
import { createWorkspaceSessions } from "~/server/sessions/workspace-sessions";
import { createTeamRuntime } from "~/server/team/runtime";
import { accountLifecycleDuties } from "~/server/users/account-lifecycle-maintenance";
import type { MemberAccountsPort } from "~/server/users/application/ports";
import type { AvatarService } from "~/server/users/avatar-service";
import { createMemberWriteContext } from "~/server/users/infrastructure/member-write-context";
import { createMembersRepo } from "~/server/users/repos-members";
import { createUsersRuntime } from "~/server/users/runtime";
import { createViewsRuntime } from "~/server/views/runtime";
import { leadReservationDuty } from "~/server/workflow/maintenance/lead-reservation-maintenance";
import { createWorkflowRuntime } from "~/server/workflow/runtime";

// What a workspace asks of the platform store. The platform application's
// `inbound` implements it; another store reaches it only through this shape.
export interface PlatformPorts {
  accounts: MemberAccountsPort;
  invites: InvitePlatformPort;
  avatars: AvatarService;
}

// What every workspace app shares with the host it runs in.
export interface WorkspaceHostServices {
  platform: PlatformPorts;
  registry: CompanyRegistryClient;
  messaging: MessagingGateway;
  engine: EngineClient;
  organizationEnrichment: OrganizationEnrichment;
  config: {
    app: ReturnType<typeof appConfig>;
    notifications: ReturnType<typeof notificationsConfig>;
  };
}

// One workspace's application, built over its own store and the realtime
// sockets its host keeps for it.
export function createWorkspaceApplication(
  workspace: WorkspaceInfrastructure,
  host: WorkspaceHostServices,
  sockets: RealtimeSockets,
) {
  const { db } = workspace;
  const { publicOrigin } = host.config.app;

  const realtime = createRealtimeService({
    channels: () => [
      createEventLogsChannel(eventLogs),
      createJobsChannel([
        createIngestJobProjector(dataSourceUploads),
        createEnrichmentProjector(clientSearch),
      ]),
    ],
    effects: workspace.effects,
    sockets,
  });
  const eventLogs = createEventLogsService(db);
  const stopEventLogsTail = startEventLogsTail({
    db,
    effects: workspace.effects,
    realtime,
  });

  const files = createFilesRuntime(workspace);
  const extension = createExtensionRuntime(workspace, files.storage);
  const notifications = createNotificationsRuntime(workspace, {
    messaging: host.messaging,
    config: host.config.notifications,
    app: host.config.app,
  });

  const clientSearch = createClientSearchRuntime(workspace, {
    registry: host.registry,
    realtime,
    projectOrganization: createOrganizationEnrichmentProjection(
      createOrganizationRepo(db),
    ),
  });
  const merchantStats = createMerchantStatsRuntime({ db });

  const dataSourceUploads = createDataSourceUploadsRuntime(host.engine);
  const ingestJobs = createIngestWatch({
    db,
    realtime,
    getJob: dataSourceUploads.getJob,
  });

  const cases = createCasesRuntime({ executor: db, files });

  // The store's alarm runs these in order, so a queue a sweep feeds drains in
  // the same firing: notification expansion before dispatch.
  function createDuties(): Duty[] {
    const notificationQueues = notifications.createQueues();
    return [
      ...accountLifecycleDuties({
        ...createMemberWriteContext(db, host.platform.accounts),
        messaging: host.messaging,
      }),
      leadReservationDuty(db),
      caseTimeoutDuty(db),
      extension.idleRecordingsDuty,
      workspaceCleanupDuty(db),
      ingestJobs.duty,
      ...[
        notificationQueues.expansion,
        notificationQueues.dispatch,
        notificationQueues.whatsappInbound,
        notificationQueues.outboundWhatsApp,
      ].map(queueDuty),
    ];
  }

  // What the platform and registry stores may ask of this workspace. On Bun
  // the host calls it directly; the Worker calls it over the workspace
  // object's RPC.
  const members = createMembersRepo(db);
  const memberInvites = createWorkspaceInvites({
    workspaceId: workspace.workspaceId,
    db,
    platform: host.platform.invites,
  });
  const inbound = {
    auth: createAuthWorkspace(db, workspace.workspaceId),
    placeMember: (...args: Parameters<typeof memberInvites.placeMember>) =>
      memberInvites.placeMember(...args),
    updateMemberIdentity: (
      ...args: Parameters<typeof members.updateIdentity>
    ) => members.updateIdentity(...args),
    receiveWhatsApp: notifications.webhooks.receiveKapso,
    applyEnrichment: clientSearch.applyEnrichment,
    publishEnrichment: clientSearch.publishEnrichment,
  };

  return {
    workspaceId: workspace.workspaceId,
    inbound,
    activities: createActivitiesRuntime({ executor: db }),
    admin: createAuditPolicyService({
      auditActionPolicies: createAuditActionPoliciesRepo(db),
    }),
    calls: createCallsRuntime({ executor: db, cases }),
    campaigns: createCampaignsRuntime({ executor: db }),
    capacity: createCapacityRuntime(workspace),
    cases,
    clientSearch,
    companies: createCompaniesRuntime({ executor: db }),
    contactHolds: createContactHoldsRuntime({
      executor: db,
      engine: host.engine,
    }),
    dataSourceUploads,
    ingestJobs: { track: ingestJobs.track },
    eventLogs,
    extension,
    files: { download: files.download },
    createDuties,
    merchantStats,
    notifications,
    realtime: {
      connect: realtime.connect,
      stop: stopEventLogsTail,
    },
    recordImports: createRecordImportsRuntime({ executor: db }),
    reports: createReportsRuntime({ executor: db, cases }),
    roles: createRolesRuntime(db),
    search: createSearchRuntime(workspace, host.engine),
    sessions: createWorkspaceSessions(db, workspace.workspaceId),
    team: createTeamRuntime(workspace, {
      platform: host.platform.invites,
      publicOrigin,
      messaging: host.messaging,
    }),
    users: createUsersRuntime(workspace, {
      accounts: host.platform.accounts,
      avatars: host.platform.avatars,
      publicOrigin,
    }),
    views: createViewsRuntime({ executor: db }),
    workflow: createWorkflowRuntime(workspace, {
      files,
      organizationEnrichment: host.organizationEnrichment,
      enrichmentQueue: clientSearch,
      registry: host.registry,
    }),
  };
}

export type WorkspaceApplication = ReturnType<
  typeof createWorkspaceApplication
>;
