export type FundTruthSourceRole =
  | 'approval_control'
  | 'business_arrival_semantics'
  | 'payout_registration'
  | 'sync_replica'
  | 'report_only';

export type FundTruthLevel =
  | 'supporting_source'
  | 'replica_only'
  | 'not_truth_source';

export type FundTruthReconciliationStatus =
  | 'aligned'
  | 'partially_aligned'
  | 'missing_link'
  | 'no_truth_source'
  | 'needs_manual_review';

export type FundTruthPrimaryObjectType =
  | 'approval_request'
  | 'payment_record'
  | 'payout_record'
  | 'abc_sync_fund';

export type FundTruthLinkedObjectType = FundTruthPrimaryObjectType | 'work_order';

export type FundTruthVisibilityScope = 'full' | 'restricted';

export type FundTruthActionStatus = 'pending' | 'ready' | 'blocked' | 'done' | 'not_applicable';

export type FundTruthBasicInfoValueType = 'text' | 'money' | 'datetime';

export type FundTruthMappingReadinessStatus =
  | 'ready'
  | 'partially_ready'
  | 'weak_anchor_only'
  | 'not_ready';

export type FundTruthAnchorConfidence = 'high' | 'medium' | 'low';

export interface FundTruthBasicInfoItem {
  key: string;
  label: string;
  value: string | number | Date | null;
  valueType?: FundTruthBasicInfoValueType;
  span?: number;
}

export interface FundTruthLinkedObjectRefs {
  approvalRequestId: number | null;
  paymentRecordId: number | null;
  payoutRecordId: number | null;
  abcSyncFundId: number | null;
  workOrderId: number | null;
}

export interface FundTruthLinkedObjectItem {
  label: string;
  objectType: FundTruthLinkedObjectType;
  objectId: number;
  displayValue: string;
  note?: string | null;
}

export interface FundTruthActionItem {
  actionKey: string;
  title: string;
  description: string;
  ownerScope: string;
  status: FundTruthActionStatus;
}

export interface FundTruthMappingKeyItem {
  key: string;
  label: string;
  value: string | number | null;
  sourceField: string;
  note: string;
}

export interface FundTruthMissingAnchorItem {
  key: string;
  label: string;
  description: string;
  ownerScope: string;
}

export interface FundTruthMappingReadiness {
  visibilityScope: FundTruthVisibilityScope;
  mappingReadinessStatus: FundTruthMappingReadinessStatus;
  stableMappingKeys: FundTruthMappingKeyItem[];
  weakMatchingHints: FundTruthMappingKeyItem[];
  missingAnchors: FundTruthMissingAnchorItem[];
  anchorConfidence: FundTruthAnchorConfidence;
  anchorPlanSummary: string;
  recommendedAnchorPlan: string;
  mappingEvidence: string[];
  futureTruthIngestionBoundary: string;
}

export interface FundTruthGapPlan {
  visibilityScope: FundTruthVisibilityScope;
  summary: string;
  listSummary: string;
  diagnosis: {
    sourceRole: FundTruthSourceRole;
    truthLevel: FundTruthLevel;
    reconciliationStatus: FundTruthReconciliationStatus;
    currentArrivalBasis: string | null;
    currentPayoutBasis: string | null;
    currentApprovalBasis: string | null;
    gapSummary: string;
    nextOwnerRole: string;
    recommendedNextStep: string;
  };
  boundary: {
    sourceOfTruthBoundary: string;
    humanConfirmationBoundary: string;
    payrollBoundary: string;
    writeBoundary: string;
  };
  actionItems: FundTruthActionItem[];
  auditHints: string[];
}

export interface FundTruthReconciliationViewModel {
  recordKey: string;
  visibilityScope: FundTruthVisibilityScope;
  sourceRole: FundTruthSourceRole;
  truthLevel: FundTruthLevel;
  reconciliationStatus: FundTruthReconciliationStatus;
  primaryObjectType: FundTruthPrimaryObjectType;
  primaryObjectId: number;
  primaryObjectNo: string | null;
  primaryObjectStatus: string | null;
  summary: string;
  listSummary: string;
  linkedObjectRefs: FundTruthLinkedObjectRefs;
  linkedObjectList: FundTruthLinkedObjectItem[];
  currentArrivalBasis: string | null;
  currentPayoutBasis: string | null;
  currentApprovalBasis: string | null;
  sourceOfTruthBoundary: string;
  gapSummary: string;
  nextOwnerRole: string;
  recommendedNextStep: string;
  mappingReadinessStatus: FundTruthMappingReadinessStatus;
  anchorPlanSummary: string;
  mappingReadiness: FundTruthMappingReadiness;
  auditHints: string[];
  basicInfo: FundTruthBasicInfoItem[];
  truthGapPlan: FundTruthGapPlan;
  sortTime: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}
