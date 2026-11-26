import type * as activities from "./schema/types/activities";
import type * as auth from "./schema/types/auth";
import type * as campaigns from "./schema/types/campaigns";
import type * as capacity from "./schema/types/capacity";
import type * as cases from "./schema/types/cases";
import type * as contactHolds from "./schema/types/contact-holds";
import type * as core from "./schema/types/core";
import type * as extensions from "./schema/types/extensions";
import type * as files from "./schema/types/files";
import type * as fulfillment from "./schema/types/fulfillment";
import type * as identity from "./schema/types/identity";
import type * as ingest from "./schema/types/ingest";
import type * as merchantStats from "./schema/types/merchant-stats";
import type * as notifications from "./schema/types/notifications";
import type * as observability from "./schema/types/observability";
import type * as organization from "./schema/types/organization";
import type * as platform from "./schema/types/platform";
import type * as pricing from "./schema/types/pricing";
import type * as sales from "./schema/types/sales";
import type * as search from "./schema/types/search";
import type * as views from "./schema/types/views";
import type * as workflow from "./schema/types/workflow";

export type * from "./schema/types/activities";
export type * from "./schema/types/auth";
export type * from "./schema/types/campaigns";
export type * from "./schema/types/capacity";
export type * from "./schema/types/cases";
export type * from "./schema/types/contact-holds";
export type * from "./schema/types/core";
export type * from "./schema/types/extensions";
export type * from "./schema/types/files";
export type * from "./schema/types/ingest";
export type * from "./schema/types/fulfillment";
export type * from "./schema/types/identity";
export type * from "./schema/types/merchant-stats";
export type * from "./schema/types/notifications";
export type * from "./schema/types/observability";
export type * from "./schema/types/organization";
export type * from "./schema/types/platform";
export type * from "./schema/types/pricing";
export type * from "./schema/types/sales";
export type * from "./schema/types/search";
export type * from "./schema/types/views";
export type * from "./schema/types/workflow";

// One interface per store, matching the DDL in schema/platform.ts,
// schema/registry.ts and schema/workspace.ts.

export interface PlatformDatabase {
  workspaces: core.WorkspacesTable;
  whatsapp_numbers: core.WhatsAppNumbersTable;
  accounts: identity.AccountsTable;
  memberships: identity.MembershipsTable;
  invites: auth.InvitesTable;
  auth_throttle_counters: observability.AuthThrottleCountersTable;
  auth_events: observability.AuthEventsTable;
  passkeys: auth.PasskeysTable;
  webauthn_challenges: auth.WebauthnChallengesTable;
  user_totp_factors: auth.UserTotpFactorsTable;
  recovery_code_set: auth.RecoveryCodeSetTable;
  recovery_code: auth.RecoveryCodeTable;
  user_oauth_accounts: auth.UserOAuthAccountsTable;
  login_flows: auth.LoginFlowsTable;
  password_reset_tokens: auth.PasswordResetTokensTable;
}

export interface RegistryDatabase {
  company_registry_record: search.CompanyRegistryRecordTable;
  company_registry_subscriptions: search.CompanyRegistrySubscriptionsTable;
}

export interface WorkspaceDatabase {
  workspace_settings: core.WorkspaceSettingsTable;
  branches: core.BranchesTable;
  teams: core.TeamsTable;
  workspace_roles: identity.WorkspaceRolesTable;
  workspace_role_assignables: identity.WorkspaceRoleAssignablesTable;
  members: identity.MembersTable;
  user_sessions: auth.UserSessionsTable;
  branch_supervisors: core.BranchSupervisorsTable;
  back_office_teams: core.BackOfficeTeamsTable;

  people: organization.PeopleTable;
  organizations: organization.OrganizationsTable;
  organizations_count: organization.OrganizationsCountTable;
  organizations_search: organization.OrganizationsSearchTable;
  organization_ownerships: organization.OrganizationOwnershipsTable;
  organization_current_owners: organization.OrganizationCurrentOwnersView;
  contacts: organization.ContactsTable;
  contact_roles: organization.ContactRolesTable;
  contact_holds: contactHolds.ContactHoldsTable;
  contact_cadence: contactHolds.ContactCadenceTable;
  campaigns: campaigns.CampaignsTable;
  campaign_records: campaigns.CampaignRecordsTable;
  campaign_holds: campaigns.CampaignHoldsTable;

  search_policy_defaults: capacity.SearchPolicyDefaultsTable;
  search_policy_overrides: capacity.SearchPolicyOverridesTable;
  draw_policy_defaults: capacity.DrawPolicyDefaultsTable;
  draw_policy_overrides: capacity.DrawPolicyOverridesTable;
  capacity_grants: capacity.CapacityGrantsTable;
  capacity_reservations: capacity.CapacityReservationsTable;
  capacity_commits: capacity.CapacityCommitsTable;
  capacity_requests: capacity.CapacityRequestsTable;

  user_channel_addresses: notifications.UserChannelAddressesTable;
  notification_opt_outs: notifications.NotificationOptOutsTable;
  notification_intents: notifications.NotificationIntentsTable;
  notification_deliveries: notifications.NotificationDeliveriesTable;
  app_notifications: notifications.AppNotificationsTable;
  whatsapp_sessions: notifications.WhatsAppSessionsTable;
  kapso_webhook_deliveries: notifications.KapsoWebhookDeliveriesTable;
  whatsapp_inbound_events: notifications.WhatsAppInboundEventsTable;
  outbound_whatsapp_messages: notifications.OutboundWhatsAppMessagesTable;

  events: platform.EventsTable;
  audit_action_policies: platform.AuditActionPoliciesTable;
  action_rate_limit_counters: observability.ActionRateLimitCountersTable;

  file_assets: files.FileAssetsTable;
  file_download_tokens: files.FileDownloadTokensTable;
  ingest_watches: ingest.IngestWatchesTable;

  workflow_collection_mode_kinds: workflow.WorkflowCollectionModeKindsTable;
  workflow_currency_kinds: sales.WorkflowCurrencyKindsTable;
  workflow_account_type_kinds: sales.WorkflowAccountTypeKindsTable;
  workflow_settlement_banks: sales.WorkflowSettlementBanksTable;
  workflow_leads: workflow.WorkflowLeadsTable;
  workflow_inquiries: workflow.WorkflowInquiriesTable;
  workflow_lead_digital_policy: workflow.WorkflowLeadDigitalPolicyTable;
  workflow_lead_favorites: workflow.WorkflowLeadFavoritesTable;
  workflow_sale_proof_files: files.WorkflowSaleProofFilesTable;
  workflow_rate_proposals: pricing.WorkflowRateProposalsTable;
  workflow_rate_proposal_policies: pricing.WorkflowRateProposalPoliciesTable;
  workflow_pending_quotation_policies: pricing.WorkflowPendingQuotationPoliciesTable;
  workflow_rate_revisions: pricing.WorkflowRateRevisionsTable;
  workflow_rate_revision_files: pricing.WorkflowRateRevisionFilesTable;
  workflow_lead_venues: sales.WorkflowLeadVenuesTable;
  workflow_lead_venue_accounts: sales.WorkflowLeadVenueAccountsTable;
  lead_fulfillment_orders: fulfillment.LeadFulfillmentOrdersTable;
  lead_fulfillment_units: fulfillment.LeadFulfillmentUnitsTable;
  lead_fulfillment_documents: fulfillment.LeadFulfillmentDocumentsTable;

  case_types: cases.CaseTypesTable;
  case_stages: cases.CaseStagesTable;
  case_fields: cases.CaseFieldsTable;
  cases: cases.CasesTable;
  case_stage_states: cases.CaseStageStatesTable;
  case_events: cases.CaseEventsTable;
  activity_outcomes: activities.ActivityOutcomesTable;
  activities: activities.ActivitiesTable;
  extension_handoffs: extensions.ExtensionHandoffsTable;
  extension_installation_sessions: extensions.ExtensionInstallationSessionsTable;
  extension_runtime_events: extensions.ExtensionRuntimeEventsTable;
  extension_executive_statuses: extensions.ExtensionExecutiveStatusesTable;
  extension_recordings: extensions.ExtensionRecordingsTable;
  extension_recording_segments: extensions.ExtensionRecordingSegmentsTable;

  merchant_gpv_dataset: merchantStats.MerchantGpvDatasetTable;
  gpv_snapshots: merchantStats.GpvSnapshotsTable;
  gpv_snapshot_placements: merchantStats.GpvSnapshotPlacementsTable;
  gpv_snapshot_observations: merchantStats.GpvSnapshotObservationsTable;
  gpv_snapshot_issues: merchantStats.GpvSnapshotIssuesTable;
  merchant_month_credits: merchantStats.MerchantMonthCreditsTable;
  merchant_month_credit_adjustments: merchantStats.MerchantMonthCreditAdjustmentsTable;
  commission_scheme_versions: merchantStats.CommissionSchemeVersionsTable;
  merchant_gpv_targets: merchantStats.MerchantGpvTargetsTable;
  merchant_sales: merchantStats.MerchantSalesView;
  merchant_sale_gpv: merchantStats.MerchantSaleGpvView;
  merchant_monthly_gpv: merchantStats.MerchantMonthlyGpvView;
  merchant_month_credit: merchantStats.MerchantMonthCreditView;

  saved_views: views.SavedViewsTable;
}
