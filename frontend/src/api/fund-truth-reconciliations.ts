import http from './http';

export type FundTruthVisibilityScope = 'full' | 'restricted';

export type FundTruthMappingReadinessStatus =
  | 'ready'
  | 'partially_ready'
  | 'weak_anchor_only'
  | 'not_ready';

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
  anchorConfidence: 'high' | 'medium' | 'low';
  anchorPlanSummary: string;
  recommendedAnchorPlan: string;
  mappingEvidence: string[];
  futureTruthIngestionBoundary: string;
}

export interface FundTruthReconciliationRecord {
  recordKey: string;
  visibilityScope: FundTruthVisibilityScope;
  sourceRole: string;
  truthLevel: string;
  reconciliationStatus: string;
  primaryObjectType: string;
  primaryObjectId: number;
  primaryObjectNo: string | null;
  primaryObjectStatus: string | null;
  summary: string;
  listSummary: string;
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
  linkedObjectRefs: Record<string, number | null>;
  linkedObjectList: Array<{
    label: string;
    objectType: string;
    objectId: number;
    displayValue: string;
    note?: string | null;
  }>;
  auditHints: string[];
  basicInfo: Array<{
    key: string;
    label: string;
    value: string | number | Date | null;
    valueType?: 'text' | 'money' | 'datetime';
    span?: number;
  }>;
  truthGapPlan?: any;
  sortTime: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export function getFundTruthReconciliations(params?: {
  page?: number;
  pageSize?: number;
  primaryObjectType?: string;
  sourceRole?: string;
  truthLevel?: string;
  reconciliationStatus?: string;
}) {
  return http.get('/fund-truth-reconciliations', { params });
}

export function getFundTruthReconciliationDetail(
  primaryObjectType: string,
  primaryObjectId: string | number,
) {
  return http.get(`/fund-truth-reconciliations/${primaryObjectType}/${primaryObjectId}`);
}
