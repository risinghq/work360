import type { BrandedId } from "./brand";
import { derivedKey, uuidId } from "./kind";

export type WorkspaceId = BrandedId<"WorkspaceId">;
export const WorkspaceId = uuidId("WorkspaceId");

export type UserId = BrandedId<"UserId">;
export const UserId = uuidId("UserId");

export type RoleId = BrandedId<"RoleId">;
export const RoleId = uuidId("RoleId");

export type TeamId = BrandedId<"TeamId">;
export const TeamId = uuidId("TeamId");

export type BranchId = BrandedId<"BranchId">;
export const BranchId = uuidId("BranchId");

export type OrganizationId = BrandedId<"OrganizationId">;
export const OrganizationId = uuidId("OrganizationId");

export type PersonId = BrandedId<"PersonId">;
export const PersonId = uuidId("PersonId");

export type ContactId = BrandedId<"ContactId">;
export const ContactId = uuidId("ContactId");

export type ContactHoldId = BrandedId<"ContactHoldId">;
export const ContactHoldId = uuidId("ContactHoldId");

export type ActivityId = BrandedId<"ActivityId">;
export const ActivityId = uuidId("ActivityId");

export type ActivityOutcomeId = BrandedId<"ActivityOutcomeId">;
export const ActivityOutcomeId = uuidId("ActivityOutcomeId");

export type CapacityRequestId = BrandedId<"CapacityRequestId">;
export const CapacityRequestId = uuidId("CapacityRequestId");

export type CapacityReservationId = BrandedId<"CapacityReservationId">;
export const CapacityReservationId = uuidId("CapacityReservationId");

export type EventId = BrandedId<"EventId">;
export const EventId = uuidId("EventId");

export type WorkflowLeadId = BrandedId<"WorkflowLeadId">;
export const WorkflowLeadId = uuidId("WorkflowLeadId");

export type WorkflowInquiryId = BrandedId<"WorkflowInquiryId">;
export const WorkflowInquiryId = uuidId("WorkflowInquiryId");

export type WorkflowRateProposalId = BrandedId<"WorkflowRateProposalId">;
export const WorkflowRateProposalId = uuidId("WorkflowRateProposalId");

export type WorkflowRateRevisionId = BrandedId<"WorkflowRateRevisionId">;
export const WorkflowRateRevisionId = uuidId("WorkflowRateRevisionId");

export type WorkflowRateRevisionFileId =
  BrandedId<"WorkflowRateRevisionFileId">;
export const WorkflowRateRevisionFileId = uuidId("WorkflowRateRevisionFileId");

export type FileAssetId = BrandedId<"FileAssetId">;
export const FileAssetId = uuidId("FileAssetId");

export type FileDownloadTokenId = BrandedId<"FileDownloadTokenId">;
export const FileDownloadTokenId = uuidId("FileDownloadTokenId");

export type WorkflowVenueId = BrandedId<"WorkflowVenueId">;
export const WorkflowVenueId = uuidId("WorkflowVenueId");

export type FulfillmentOrderId = BrandedId<"FulfillmentOrderId">;
export const FulfillmentOrderId = uuidId("FulfillmentOrderId");

export type GpvSnapshotId = BrandedId<"GpvSnapshotId">;
export const GpvSnapshotId = uuidId("GpvSnapshotId");

export type GpvSnapshotPlacementId = BrandedId<"GpvSnapshotPlacementId">;
export const GpvSnapshotPlacementId = uuidId("GpvSnapshotPlacementId");

export type GpvSnapshotIssueId = BrandedId<"GpvSnapshotIssueId">;
export const GpvSnapshotIssueId = uuidId("GpvSnapshotIssueId");

export type CommissionSchemeVersionId = BrandedId<"CommissionSchemeVersionId">;
export const CommissionSchemeVersionId = uuidId("CommissionSchemeVersionId");

export type OrganizationOwnershipId = BrandedId<"OrganizationOwnershipId">;
export const OrganizationOwnershipId = uuidId("OrganizationOwnershipId");

export type MerchantMonthCreditAdjustmentId =
  BrandedId<"MerchantMonthCreditAdjustmentId">;
export const MerchantMonthCreditAdjustmentId = uuidId(
  "MerchantMonthCreditAdjustmentId",
);

export type NotificationDeliveryId = BrandedId<"NotificationDeliveryId">;
export const NotificationDeliveryId = uuidId("NotificationDeliveryId");

export type AppNotificationId = BrandedId<"AppNotificationId">;
export const AppNotificationId = uuidId("AppNotificationId");

export type CompanyRegistryRecordId = BrandedId<"CompanyRegistryRecordId">;
export const CompanyRegistryRecordId = uuidId("CompanyRegistryRecordId");

export type UserInviteId = BrandedId<"UserInviteId">;
export const UserInviteId = uuidId("UserInviteId");

export type AuthLoginFlowId = BrandedId<"AuthLoginFlowId">;
export const AuthLoginFlowId = uuidId("AuthLoginFlowId");

export type WebauthnChallengeId = BrandedId<"WebauthnChallengeId">;
export const WebauthnChallengeId = uuidId("WebauthnChallengeId");

export type RecoveryCodeSetId = BrandedId<"RecoveryCodeSetId">;
export const RecoveryCodeSetId = uuidId("RecoveryCodeSetId");

export type RecoveryCodeId = BrandedId<"RecoveryCodeId">;
export const RecoveryCodeId = uuidId("RecoveryCodeId");

export type InstallationId = BrandedId<"InstallationId">;
export const InstallationId = uuidId("InstallationId");

export type ExtensionRecordingId = BrandedId<"ExtensionRecordingId">;
export const ExtensionRecordingId = uuidId("ExtensionRecordingId");

export type CaseTypeId = BrandedId<"CaseTypeId">;
export const CaseTypeId = uuidId("CaseTypeId");

export type CaseId = BrandedId<"CaseId">;
export const CaseId = uuidId("CaseId");

export type MeetingId = BrandedId<"MeetingId">;
export const MeetingId = uuidId("MeetingId");

export type CampaignId = BrandedId<"CampaignId">;
export const CampaignId = uuidId("CampaignId");

export type CampaignRecordId = BrandedId<"CampaignRecordId">;
export const CampaignRecordId = uuidId("CampaignRecordId");

// Derive deterministic idempotency keys from (sourceEventId, discriminator)
// instead of generating UUIDs.
export type NotificationIntentId = BrandedId<"NotificationIntentId">;
export const NotificationIntentId = derivedKey("NotificationIntentId");
