import { ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  assertNonNegativeCents,
  assertPositiveCents,
  decimalToCents,
} from '../../common/utils/decimal.util';

export const REPAIR_REVENUE_AUTHORITY_SCHEMA_VERSION =
  'repair-revenue-authority-candidate-v1' as const;
export const REPAIR_REVENUE_AUTHORITY_RULE_VERSION =
  'gov1-s2-repair-revenue-v1' as const;

const HEX_64 = /^[0-9a-f]{64}$/;
const FINANCE_REF = /^finance-collection-order:(\d+)$/;
const POSITIVE_INTEGER_CENTS = /^[1-9]\d*$/;
const STRICT_UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

type RepairRevenueDocumentType =
  | 'repair_plan'
  | 'quote'
  | 'customer_explanation';

export interface RepairRevenueProfileFactV1 {
  workOrderId: number;
  companyRef: string;
  businessSectorRef: string;
  storeRef: string;
  customerRef: string;
  vehicleId: number;
  lifecycleStatus: string;
  customerConfirmationState: string;
  activePlanVersion: number | null;
  activeQuoteVersion: number | null;
  activeExplanationVersion: number | null;
  latestApprovedDiagnosisVersion: number | null;
  scopeResolvedAt: Date | string;
  scopeSnapshotVersion: Record<string, number>;
  version: number;
}

export interface RepairRevenueWorkOrderFactV1 {
  id: number;
  workOrderNo: string;
}

export interface RepairRevenueDeliveryFactV1 {
  id: number;
  workOrderId: number;
  planVersion: number;
  quoteVersion: number;
  explanationVersion: number;
  financeEvidenceRefs: string[];
  quoteTotalSnapshot: string | number;
  financeReadyAmountSnapshot: string | number;
  customerAckEvidenceRef: string;
  deliveredByEmployeeId: number;
  deliveredAt: Date | string;
  createdBy: number;
  createdAt: Date | string;
}

export interface RepairRevenueDocumentFactV1 {
  id: number;
  workOrderId: number;
  documentType: RepairRevenueDocumentType;
  version: number;
  status: string;
  payload: Record<string, unknown>;
  reviewedBy: number | null;
  reviewedAt: Date | string | null;
}

export interface RepairRevenueConfirmationFactV1 {
  id: number;
  workOrderId: number;
  planVersion: number;
  quoteVersion: number;
  explanationVersion: number;
  requestFingerprint: string;
  status: string;
  decisionEvidenceRef: string | null;
  decidedBy: number | null;
  decidedAt: Date | string | null;
  version: number;
}

export interface RepairRevenueQualityFactV1 {
  id: number;
  workOrderId: number;
  result: string;
  inspectedByEmployeeId: number;
  createdBy: number;
  createdAt: Date | string;
}

/**
 * A projection produced only after the finance authority envelope has been
 * checked against its collection, bank, reconciliation, work-order, profile
 * and captured registry rows. Raw SMS, customer text and credentials are not
 * members of this contract.
 */
export interface RepairRevenueCollectionAuthorityFactV1 {
  collectionOrderId: number;
  workOrderId: number;
  authorityId: number;
  bankTransactionId: number;
  reconciliationLinkId: number;
  grossCents: string;
  currency: string;
  authorityCanonicalSnapshotHash: string;
  authorityConfirmedAt: Date | string;
  sourceOccurredAt: Date | string;
  envelopeProblems: readonly string[];
}

export interface RepairRevenueAuthorityCandidateInputV1 {
  profile: RepairRevenueProfileFactV1;
  workOrder: RepairRevenueWorkOrderFactV1;
  delivery: RepairRevenueDeliveryFactV1;
  documents: RepairRevenueDocumentFactV1[];
  confirmationRequests: RepairRevenueConfirmationFactV1[];
  qualityInspections: RepairRevenueQualityFactV1[];
  collections: RepairRevenueCollectionAuthorityFactV1[];
}

export interface VerifiedRepairRevenueAuthorityCandidateV1 {
  readonly candidateStatus: 'revenue_only_direct_costs_unresolved';
  readonly responsibilityAuthorityStatus: 'unresolved';
  readonly schemaVersion: typeof REPAIR_REVENUE_AUTHORITY_SCHEMA_VERSION;
  readonly ruleVersion: typeof REPAIR_REVENUE_AUTHORITY_RULE_VERSION;
  readonly businessDomain: 'repair';
  readonly companyRef: string;
  readonly businessSectorRef: string;
  readonly storeRef: string;
  readonly customerRef: string;
  readonly sourceSystem: 'stark_repair';
  readonly sourceType: 'repair_delivered_work_order';
  readonly sourceId: string;
  readonly sourceVersion: string;
  readonly sourceRecordHash: string;
  readonly authoritySnapshotHash: string;
  readonly recognitionAt: string;
  readonly canonicalEconomicFactId: string;
  readonly canonicalSimilaritySubjectId: string;
  readonly revenueCents: string;
  readonly collectionCoverageCents: string;
  readonly collectionCoverageExcessCents: string;
  readonly revenueEvidenceCandidate: Readonly<{
    amountCents: string;
    sourceSystem: 'stark_repair';
    sourceType: 'repair_delivered_work_order';
    sourceId: string;
    sourceVersion: string;
    sourceAllocationId: string;
    evidenceRef: string;
    evidenceHash: string;
    occurredAt: string;
  }>;
}

/**
 * Pure mapping contract for the first repair revenue authority candidate.
 *
 * This deliberately does NOT return VerifiedContributionSourceSnapshot and
 * contains no direct-cost checklist. Production contribution resolution must
 * remain fail closed until RBAC-before-domain-lock loading plus the complete
 * parts/outsourced/other-direct/correction authorities are independently
 * implemented and reviewed.
 */
export function buildRepairRevenueAuthorityCandidateV1(
  input: RepairRevenueAuthorityCandidateInputV1,
  serverObservedAt: Date,
): VerifiedRepairRevenueAuthorityCandidateV1 {
  const observedAt = assertInstant(serverObservedAt, 'serverObservedAt');
  const { profile, workOrder, delivery } = input;
  const workOrderId = assertPositiveInteger(profile.workOrderId, 'profile.workOrderId');

  if (
    workOrder.id !== workOrderId ||
    delivery.workOrderId !== workOrderId ||
    input.documents.some((item) => item.workOrderId !== workOrderId) ||
    input.confirmationRequests.some((item) => item.workOrderId !== workOrderId) ||
    input.qualityInspections.some((item) => item.workOrderId !== workOrderId) ||
    input.collections.some((item) => item.workOrderId !== workOrderId)
  ) {
    fail('repair_revenue_work_order_binding_invalid', '汽修收入候选的工单引用不一致');
  }
  if (
    profile.lifecycleStatus !== 'delivered' ||
    profile.customerConfirmationState !== 'confirmed'
  ) {
    fail('repair_revenue_lifecycle_incomplete', '汽修工单尚未同时完成客户确认与正式交车');
  }

  const planVersion = assertPositiveInteger(profile.activePlanVersion, 'activePlanVersion');
  const quoteVersion = assertPositiveInteger(profile.activeQuoteVersion, 'activeQuoteVersion');
  const explanationVersion = assertPositiveInteger(
    profile.activeExplanationVersion,
    'activeExplanationVersion',
  );
  const latestApprovedDiagnosisVersion = assertPositiveInteger(
    profile.latestApprovedDiagnosisVersion,
    'latestApprovedDiagnosisVersion',
  );
  if (
    delivery.planVersion !== planVersion ||
    delivery.quoteVersion !== quoteVersion ||
    delivery.explanationVersion !== explanationVersion
  ) {
    fail('repair_revenue_version_graph_invalid', '交车记录与生效决策包版本不一致');
  }

  const requiredTypes: RepairRevenueDocumentType[] = [
    'repair_plan',
    'quote',
    'customer_explanation',
  ];
  if (input.documents.length !== requiredTypes.length) {
    fail('repair_revenue_document_graph_ambiguous', '正式收入候选必须精确绑定三份决策文档');
  }
  const documents = requiredTypes.map((documentType) => {
    const matches = input.documents.filter((item) => item.documentType === documentType);
    if (matches.length !== 1) {
      fail('repair_revenue_document_graph_ambiguous', `文档 ${documentType} 不是唯一版本`);
    }
    const document = matches[0];
    const expectedVersion =
      documentType === 'repair_plan'
        ? planVersion
        : documentType === 'quote'
          ? quoteVersion
          : explanationVersion;
    if (
      document.status !== 'authorized' ||
      document.version !== expectedVersion ||
      !isPositiveInteger(document.reviewedBy) ||
      !document.reviewedAt
    ) {
      fail('repair_revenue_document_graph_invalid', `文档 ${documentType} 未形成完整授权版本`);
    }
    return document;
  });
  const documentReviewTimes = documents.map((document) =>
    assertInstant(document.reviewedAt!, `document.${document.documentType}.reviewedAt`),
  );
  const plan = documents.find((item) => item.documentType === 'repair_plan')!;
  const quote = documents.find((item) => item.documentType === 'quote')!;
  const explanation = documents.find(
    (item) => item.documentType === 'customer_explanation',
  )!;
  const planAuthority = assertRepairPlanAuthorityPayload(
    plan.payload,
    latestApprovedDiagnosisVersion,
  );
  const quoteAuthority = assertQuoteAuthorityPayload(
    quote.payload,
    planAuthority.planItemRefs,
    planVersion,
  );
  const quoteTotalCents = quoteAuthority.totalCents;
  assertCustomerExplanationAuthority(
    explanation.payload,
    planVersion,
    quoteVersion,
    quoteTotalCents,
    quoteAuthority.lineRefs,
  );
  const deliveryQuoteCents = assertPositiveCents(
    delivery.quoteTotalSnapshot,
    'delivery.quoteTotalSnapshot',
  );
  if (deliveryQuoteCents !== quoteTotalCents) {
    fail('repair_revenue_quote_snapshot_mismatch', '交车报价快照与客户已授权报价不一致');
  }

  const confirmedRequests = input.confirmationRequests.filter(
    (item) => item.status === 'confirmed',
  );
  if (confirmedRequests.length !== 1) {
    fail('repair_revenue_confirmation_ambiguous', '客户确认终态必须唯一');
  }
  const confirmation = confirmedRequests[0];
  if (
    confirmation.planVersion !== planVersion ||
    confirmation.quoteVersion !== quoteVersion ||
    confirmation.explanationVersion !== explanationVersion ||
    !isPositiveInteger(confirmation.decidedBy) ||
    !confirmation.decidedAt ||
    !confirmation.decisionEvidenceRef?.trim() ||
    !HEX_64.test(confirmation.requestFingerprint) ||
    !isPositiveInteger(confirmation.id) ||
    !isPositiveInteger(confirmation.version)
  ) {
    fail('repair_revenue_confirmation_invalid', '客户确认版本、人员、时间或证据不完整');
  }

  if (!input.qualityInspections.length) {
    fail('repair_revenue_quality_incomplete', '汽修收入候选缺少质检记录');
  }
  const qualityRows = input.qualityInspections.map((item) => ({
    ...item,
    id: assertPositiveInteger(item.id, 'quality.id'),
    inspectedByEmployeeId: assertPositiveInteger(
      item.inspectedByEmployeeId,
      'quality.inspectedByEmployeeId',
    ),
    createdBy: assertPositiveInteger(item.createdBy, 'quality.createdBy'),
    normalizedCreatedAt: assertInstant(item.createdAt, 'quality.createdAt'),
  }));
  if (new Set(qualityRows.map((item) => item.id)).size !== qualityRows.length) {
    fail('repair_revenue_quality_identity_ambiguous', '质检记录 ID 必须唯一');
  }
  const quality = [...qualityRows]
    .sort(
      (left, right) =>
        right.normalizedCreatedAt.getTime() - left.normalizedCreatedAt.getTime() ||
        right.id - left.id,
    )[0];
  if (quality.result !== 'passed') {
    fail('repair_revenue_latest_quality_not_passed', '全部质检中的最新一条必须是通过终态');
  }

  if (!input.collections.length) {
    fail('repair_revenue_collection_set_incomplete', '汽修收入候选缺少正式收款权威集合');
  }
  const collections = [...input.collections].sort(
    (left, right) => left.collectionOrderId - right.collectionOrderId,
  );
  const grossCentsByCollectionId = new Map<number, string>();
  assertUniquePositiveIntegers(
    collections.map((item) => item.collectionOrderId),
    'collectionOrderId',
  );
  assertUniquePositiveIntegers(
    collections.map((item) => item.authorityId),
    'authorityId',
  );
  assertUniquePositiveIntegers(
    collections.map((item) => item.bankTransactionId),
    'bankTransactionId',
  );
  assertUniquePositiveIntegers(
    collections.map((item) => item.reconciliationLinkId),
    'reconciliationLinkId',
  );
  for (const collection of collections) {
    if (
      collection.currency !== 'CNY' ||
      collection.envelopeProblems.length ||
      !HEX_64.test(collection.authorityCanonicalSnapshotHash)
    ) {
      fail('repair_revenue_collection_authority_invalid', '汽修收款正式权威 envelope 不完整或已漂移');
    }
    grossCentsByCollectionId.set(
      collection.collectionOrderId,
      assertPositiveIntegerCentsString(collection.grossCents, 'collection.grossCents'),
    );
  }

  const expectedRefs = collections.map(
    (item) => `finance-collection-order:${item.collectionOrderId}`,
  );
  const actualRefs = delivery.financeEvidenceRefs.map((item) => item.trim()).sort(compareOrdinal);
  if (
    actualRefs.some((item) => !FINANCE_REF.test(item)) ||
    new Set(actualRefs).size !== actualRefs.length ||
    JSON.stringify(actualRefs) !== JSON.stringify([...expectedRefs].sort(compareOrdinal))
  ) {
    fail('repair_revenue_finance_evidence_set_mismatch', '交车资金证据引用与完整收款集合不一致');
  }

  const collectionCoverageCents = collections.reduce(
    (total, item) => total + BigInt(grossCentsByCollectionId.get(item.collectionOrderId)!),
    0n,
  );
  const deliveryFinanceCents = decimalToCents(
    delivery.financeReadyAmountSnapshot,
    'delivery.financeReadyAmountSnapshot',
  );
  if (deliveryFinanceCents !== collectionCoverageCents) {
    fail('repair_revenue_finance_snapshot_mismatch', '交车资金快照与正式收款权威合计不一致');
  }
  if (collectionCoverageCents < quoteTotalCents) {
    fail('repair_revenue_collection_underpaid', '正式收款权威尚未覆盖客户已授权报价');
  }

  const deliveryCreatedAt = assertInstant(delivery.createdAt, 'delivery.createdAt');
  const deliveryOccurredAt = assertInstant(delivery.deliveredAt, 'delivery.deliveredAt');
  const customerAckEvidenceRef = assertEvidenceReference(
    delivery.customerAckEvidenceRef,
    'delivery.customerAckEvidenceRef',
  );
  const confirmationDecidedAt = assertInstant(confirmation.decidedAt!, 'confirmation.decidedAt');
  const authorityTimes = collections.flatMap((item) => [
    assertInstant(item.authorityConfirmedAt, 'authority.authorityConfirmedAt'),
    assertInstant(item.sourceOccurredAt, 'authority.sourceOccurredAt'),
  ]);
  const recognitionAt = latestInstant([
    deliveryCreatedAt,
    confirmationDecidedAt,
    quality.normalizedCreatedAt,
    ...documentReviewTimes,
    ...collections.map((item) =>
      assertInstant(item.authorityConfirmedAt, 'authority.authorityConfirmedAt'),
    ),
  ]);
  for (const [label, instant] of [
    ['profile.scopeResolvedAt', assertInstant(profile.scopeResolvedAt, 'profile.scopeResolvedAt')],
    ['delivery.deliveredAt', deliveryOccurredAt],
    ['delivery.createdAt', deliveryCreatedAt],
    ['confirmation.decidedAt', confirmationDecidedAt],
    ['quality.createdAt', quality.normalizedCreatedAt],
    ...documentReviewTimes.map(
      (instant, index) => [`documentReviewTime[${index}]`, instant] as const,
    ),
    ...authorityTimes.map((instant, index) => [`authorityTime[${index}]`, instant] as const),
  ] as Array<readonly [string, Date]>) {
    if (instant.getTime() > observedAt.getTime()) {
      fail('repair_revenue_authority_time_in_future', `${label} 晚于服务器观察时间`);
    }
  }
  if (
    deliveryOccurredAt.getTime() < confirmationDecidedAt.getTime() ||
    deliveryOccurredAt.getTime() < quality.normalizedCreatedAt.getTime()
  ) {
    fail(
      'repair_revenue_delivery_chronology_invalid',
      '交车时间不得早于客户确认或最近一次通过质检',
    );
  }

  const normalizedScope = {
    companyRef: assertReference(profile.companyRef, 'companyRef'),
    businessSectorRef: assertReference(profile.businessSectorRef, 'businessSectorRef'),
    storeRef: assertReference(profile.storeRef, 'storeRef'),
    customerRef: assertReference(profile.customerRef, 'customerRef'),
  };
  const sourceId = `work-order:${workOrderId}`;
  const profileVersion = assertPositiveInteger(profile.version, 'profile.version');
  const scopeResolvedAt = assertInstant(profile.scopeResolvedAt, 'profile.scopeResolvedAt');
  const scopeSnapshotVersionHash = hashJson(
    assertVersionMap(profile.scopeSnapshotVersion, 'profile.scopeSnapshotVersion'),
  );
  const documentAuthorityAnchors = documents.map((document) => ({
    id: assertPositiveInteger(document.id, 'document.id'),
    type: document.documentType,
    version: document.version,
    status: document.status,
    payloadHash: hashJson(document.payload),
    reviewedBy: document.reviewedBy,
    reviewedAt: assertInstant(document.reviewedAt!, 'document.reviewedAt').toISOString(),
  }));
  const decisionEvidenceRefHash = hashText(
    assertEvidenceReference(
      confirmation.decisionEvidenceRef!,
      'confirmation.decisionEvidenceRef',
    ),
  );
  const collectionAuthorityAnchors = collections.map((item) => ({
    collectionOrderId: item.collectionOrderId,
    authorityId: item.authorityId,
    bankTransactionId: item.bankTransactionId,
    reconciliationLinkId: item.reconciliationLinkId,
    grossCents: grossCentsByCollectionId.get(item.collectionOrderId)!,
    currency: item.currency,
    authorityCanonicalSnapshotHash: item.authorityCanonicalSnapshotHash,
    authorityConfirmedAt: assertInstant(
      item.authorityConfirmedAt,
      'authority.authorityConfirmedAt',
    ).toISOString(),
    sourceOccurredAt: assertInstant(
      item.sourceOccurredAt,
      'authority.sourceOccurredAt',
    ).toISOString(),
  }));
  const deliveryId = assertPositiveInteger(delivery.id, 'delivery.id');
  const deliveryRecordedByEmployeeId = assertPositiveInteger(
    delivery.deliveredByEmployeeId,
    'deliveredByEmployeeId',
  );
  const workOrderNo = assertReference(workOrder.workOrderNo, 'workOrderNo');
  const vehicleId = assertPositiveInteger(profile.vehicleId, 'vehicleId');
  const deliveryCreatedBy = assertPositiveInteger(delivery.createdBy, 'delivery.createdBy');
  const customerAckEvidenceRefHash = hashText(customerAckEvidenceRef);
  const collectionCoverageExcessCents = collectionCoverageCents - quoteTotalCents;
  const canonicalAuthorityGraph = {
    schemaVersion: REPAIR_REVENUE_AUTHORITY_SCHEMA_VERSION,
    ruleVersion: REPAIR_REVENUE_AUTHORITY_RULE_VERSION,
    source: {
      system: 'stark_repair',
      type: 'repair_delivered_work_order',
      id: sourceId,
    },
    workOrder: {
      id: workOrderId,
      no: workOrderNo,
      vehicleId,
    },
    scope: normalizedScope,
    profile: {
      lifecycleStatus: profile.lifecycleStatus,
      customerConfirmationState: profile.customerConfirmationState,
      latestApprovedDiagnosisVersion,
      planVersion,
      quoteVersion,
      explanationVersion,
      version: profileVersion,
      scopeResolvedAt: scopeResolvedAt.toISOString(),
      scopeSnapshotVersionHash,
    },
    documents: documentAuthorityAnchors,
    confirmation: {
      id: confirmation.id,
      version: confirmation.version,
      planVersion,
      quoteVersion,
      explanationVersion,
      status: confirmation.status,
      fingerprint: confirmation.requestFingerprint,
      decidedBy: confirmation.decidedBy,
      decidedAt: confirmationDecidedAt.toISOString(),
      decisionEvidenceRefHash,
    },
    quality: {
      id: quality.id,
      result: quality.result,
      inspectedByEmployeeId: quality.inspectedByEmployeeId,
      createdBy: quality.createdBy,
      createdAt: quality.normalizedCreatedAt.toISOString(),
    },
    delivery: {
      id: deliveryId,
      versions: { planVersion, quoteVersion, explanationVersion },
      quoteTotalCents: quoteTotalCents.toString(),
      financeReadyCents: collectionCoverageCents.toString(),
      financeEvidenceRefs: [...expectedRefs].sort(compareOrdinal),
      customerAckEvidenceRefHash,
      deliveryRecordedByEmployeeId,
      deliveredAt: deliveryOccurredAt.toISOString(),
      createdBy: deliveryCreatedBy,
      createdAt: deliveryCreatedAt.toISOString(),
    },
    collections: collectionAuthorityAnchors,
    revenue: {
      recognizedCents: quoteTotalCents.toString(),
      collectionCoverageCents: collectionCoverageCents.toString(),
      collectionCoverageExcessCents: collectionCoverageExcessCents.toString(),
      recognitionAt: recognitionAt.toISOString(),
    },
  };
  const sourceVersionGraphHash = hashJson(canonicalAuthorityGraph);
  const sourceVersion = `${REPAIR_REVENUE_AUTHORITY_RULE_VERSION}:${sourceVersionGraphHash}`;
  const canonicalSnapshot = {
    object: 'verified_repair_revenue_authority_candidate',
    ...canonicalAuthorityGraph,
    source: {
      ...canonicalAuthorityGraph.source,
      version: sourceVersion,
    },
  };
  const sourceRecordHash = hashJson(canonicalSnapshot);
  const evidenceHash = hashJson({
    schemaVersion: REPAIR_REVENUE_AUTHORITY_SCHEMA_VERSION,
    sourceRecordHash,
    documentPayloadHashes: canonicalSnapshot.documents.map((item) => item.payloadHash),
    collectionAuthorityHashes: canonicalSnapshot.collections.map(
      (item) => item.authorityCanonicalSnapshotHash,
    ),
    decisionEvidenceRefHash: canonicalSnapshot.confirmation.decisionEvidenceRefHash,
    customerAckEvidenceRefHash: canonicalSnapshot.delivery.customerAckEvidenceRefHash,
  });
  return deepFreeze({
    candidateStatus: 'revenue_only_direct_costs_unresolved',
    responsibilityAuthorityStatus: 'unresolved',
    schemaVersion: REPAIR_REVENUE_AUTHORITY_SCHEMA_VERSION,
    ruleVersion: REPAIR_REVENUE_AUTHORITY_RULE_VERSION,
    businessDomain: 'repair',
    ...normalizedScope,
    sourceSystem: 'stark_repair',
    sourceType: 'repair_delivered_work_order',
    sourceId,
    sourceVersion,
    sourceRecordHash,
    authoritySnapshotHash: sourceRecordHash,
    recognitionAt: recognitionAt.toISOString(),
    canonicalEconomicFactId: `repair-work-order:${workOrderId}`,
    canonicalSimilaritySubjectId: `repair-vehicle:${profile.vehicleId}`,
    revenueCents: quoteTotalCents.toString(),
    collectionCoverageCents: collectionCoverageCents.toString(),
    collectionCoverageExcessCents: collectionCoverageExcessCents.toString(),
    revenueEvidenceCandidate: {
      amountCents: quoteTotalCents.toString(),
      sourceSystem: 'stark_repair',
      sourceType: 'repair_delivered_work_order',
      sourceId,
      sourceVersion,
      sourceAllocationId: `repair-revenue:${workOrderId}:delivery:${deliveryId}`,
      evidenceRef: `repair-authority://work-order/${workOrderId}/delivery/${deliveryId}`,
      evidenceHash,
      occurredAt: recognitionAt.toISOString(),
    },
  });
}

function fail(code: string, message: string): never {
  throw new ConflictException(`[${code}] ${message}`);
}

function assertRepairPlanAuthorityPayload(
  planPayload: Record<string, unknown>,
  expectedDiagnosisVersion: number,
): { planItemRefs: string[] } {
  if (
    assertPayloadPositiveInteger(planPayload.diagnosisVersion, 'plan.diagnosisVersion') !==
    expectedDiagnosisVersion
  ) {
    fail('repair_revenue_plan_diagnosis_version_mismatch', '维修方案未绑定最新已审核诊断版本');
  }
  if (!Array.isArray(planPayload.items) || !planPayload.items.length) {
    fail('repair_revenue_plan_payload_invalid', '维修方案 items 必须是非空数组');
  }
  if (!Array.isArray(planPayload.risks)) {
    fail('repair_revenue_plan_payload_invalid', '维修方案 risks 必须是数组');
  }
  const planItemRefs = planPayload.items.map((item, index) => {
    if (!item || typeof item !== 'object') {
      fail('repair_revenue_plan_payload_invalid', `维修方案第 ${index + 1} 项必须是对象`);
    }
    const record = item as Record<string, unknown>;
    const itemRef = assertOpaqueIdentifier(record.itemRef, `plan.items[${index}].itemRef`);
    if (typeof record.action !== 'string' || !record.action.trim()) {
      fail('repair_revenue_plan_payload_invalid', `维修方案第 ${index + 1} 项缺少明确 action`);
    }
    return itemRef;
  });
  if (new Set(planItemRefs).size !== planItemRefs.length) {
    fail('repair_revenue_plan_payload_invalid', '维修方案 itemRef 不得重复');
  }
  return { planItemRefs };
}

function assertQuoteAuthorityPayload(
  quotePayload: Record<string, unknown>,
  planItemRefs: readonly string[],
  expectedPlanVersion: number,
): { totalCents: bigint; lineRefs: string[] } {
  if (assertPayloadPositiveInteger(quotePayload.planVersion, 'quote.planVersion') !== expectedPlanVersion) {
    fail('repair_revenue_quote_plan_version_mismatch', '报价 payload 未绑定生效维修方案版本');
  }

  const totals = {
    labor: assertNonNegativeCents(quotePayload.laborTotal as string | number, 'quote.laborTotal'),
    part: assertNonNegativeCents(quotePayload.partsTotal as string | number, 'quote.partsTotal'),
    other: assertNonNegativeCents(quotePayload.otherTotal as string | number, 'quote.otherTotal'),
  };
  const totalCents = assertPositiveCents(
    quotePayload.total as string | number | null | undefined,
    'authorizedQuote.payload.total',
  );
  if (totals.labor + totals.part + totals.other !== totalCents) {
    fail('repair_revenue_quote_arithmetic_invalid', '报价分项与总额不一致');
  }
  if (!Array.isArray(quotePayload.lineItems) || !quotePayload.lineItems.length) {
    fail('repair_revenue_quote_lines_invalid', '报价 lineItems 必须是非空数组');
  }
  const planItemRefSet = new Set(planItemRefs);
  const planItemCoverageCounts = new Map<string, number>(
    planItemRefs.map((itemRef) => [itemRef, 0]),
  );
  const lineRefs: string[] = [];
  const categorySums = { labor: 0n, part: 0n, other: 0n };
  let lineTotal = 0n;
  for (const [index, item] of quotePayload.lineItems.entries()) {
    if (!item || typeof item !== 'object') {
      fail('repair_revenue_quote_lines_invalid', `报价第 ${index + 1} 行必须是对象`);
    }
    const line = item as Record<string, unknown>;
    const lineRef = assertOpaqueIdentifier(line.lineRef, `quote.lineItems[${index}].lineRef`);
    lineRefs.push(lineRef);
    const category = String(line.category ?? '');
    if (!['labor', 'part', 'other'].includes(category)) {
      fail('repair_revenue_quote_lines_invalid', `报价第 ${index + 1} 行 category 无效`);
    }
    const planItemRef = String(line.planItemRef ?? '').trim();
    const approvedFeeBasisRef = String(line.approvedFeeBasisRef ?? '').trim();
    if (!planItemRef && !approvedFeeBasisRef) {
      fail('repair_revenue_quote_lines_invalid', `报价第 ${index + 1} 行缺少方案或费用依据`);
    }
    if (planItemRef) {
      const normalizedPlanItemRef = assertOpaqueIdentifier(
        planItemRef,
        `quote.lineItems[${index}].planItemRef`,
      );
      if (!planItemRefSet.has(normalizedPlanItemRef)) {
        fail('repair_revenue_quote_plan_coverage_invalid', '报价引用了不存在的维修方案项目');
      }
      planItemCoverageCounts.set(
        normalizedPlanItemRef,
        planItemCoverageCounts.get(normalizedPlanItemRef)! + 1,
      );
    }
    if (approvedFeeBasisRef) {
      assertOpaqueIdentifier(
        approvedFeeBasisRef,
        `quote.lineItems[${index}].approvedFeeBasisRef`,
      );
    }
    const amount = assertNonNegativeCents(
      line.amount as string | number,
      `quote.lineItems[${index}].amount`,
    );
    categorySums[category as keyof typeof categorySums] += amount;
    lineTotal += amount;
  }
  if (new Set(lineRefs).size !== lineRefs.length) {
    fail('repair_revenue_quote_lines_invalid', '报价 lineRef 不得重复');
  }
  if ([...planItemCoverageCounts.values()].some((count) => count !== 1)) {
    fail('repair_revenue_quote_plan_coverage_invalid', '每个生效维修方案项目必须由且仅由一条报价行覆盖');
  }
  if (
    lineTotal !== totalCents ||
    categorySums.labor !== totals.labor ||
    categorySums.part !== totals.part ||
    categorySums.other !== totals.other
  ) {
    fail('repair_revenue_quote_arithmetic_invalid', '报价行、分类分项与总额不一致');
  }
  return { totalCents, lineRefs };
}

function assertCustomerExplanationAuthority(
  payload: Record<string, unknown>,
  planVersion: number,
  quoteVersion: number,
  quoteTotalCents: bigint,
  quoteLineRefs: string[],
): void {
  if (
    assertPayloadPositiveInteger(payload.planVersion, 'explanation.planVersion') !== planVersion ||
    assertPayloadPositiveInteger(payload.quoteVersion, 'explanation.quoteVersion') !== quoteVersion
  ) {
    fail('repair_revenue_explanation_version_invalid', '客户说明未绑定生效方案和报价版本');
  }
  if (
    assertPositiveCents(
      payload.quoteTotal as string | number | null | undefined,
      'explanation.quoteTotal',
    ) !== quoteTotalCents
  ) {
    fail('repair_revenue_explanation_total_invalid', '客户说明报价总额与授权报价不一致');
  }
  if (typeof payload.explanation !== 'string' || !payload.explanation.trim()) {
    fail('repair_revenue_explanation_payload_invalid', '客户说明正文不能为空');
  }
  if (!Array.isArray(payload.exclusions)) {
    fail('repair_revenue_explanation_payload_invalid', '客户说明 exclusions 必须是数组');
  }
  if (!Array.isArray(payload.includedLineRefs) || !payload.includedLineRefs.length) {
    fail('repair_revenue_explanation_payload_invalid', '客户说明必须绑定完整报价行');
  }
  const includedLineRefs = payload.includedLineRefs.map((item, index) =>
    assertOpaqueIdentifier(item, `explanation.includedLineRefs[${index}]`),
  );
  if (
    new Set(includedLineRefs).size !== includedLineRefs.length ||
    JSON.stringify([...includedLineRefs].sort(compareOrdinal)) !==
      JSON.stringify([...quoteLineRefs].sort(compareOrdinal))
  ) {
    fail('repair_revenue_explanation_payload_invalid', '客户说明与报价行集合不一致');
  }
}

function assertPayloadPositiveInteger(value: unknown, label: string): number {
  const normalized = String(value ?? '').trim();
  if (!/^[1-9]\d*$/.test(normalized)) {
    fail('repair_revenue_payload_version_invalid', `${label} 必须是正整数版本`);
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) {
    fail('repair_revenue_payload_version_invalid', `${label} 超出安全整数范围`);
  }
  return parsed;
}

function assertOpaqueIdentifier(value: unknown, label: string): string {
  const normalized = String(value ?? '').trim();
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._:/-]{2,254}$/.test(normalized) ||
    normalized.includes('://') ||
    normalized.includes('..')
  ) {
    fail('repair_revenue_identifier_invalid', `${label} 引用无效`);
  }
  return normalized;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function assertPositiveInteger(value: unknown, label: string): number {
  if (!isPositiveInteger(value)) {
    fail('repair_revenue_integer_invalid', `${label} 必须是正整数`);
  }
  return Number(value);
}

function assertReference(value: string, label: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.length > 100) {
    fail('repair_revenue_reference_invalid', `${label} 引用无效`);
  }
  return normalized;
}

function assertEvidenceReference(value: string, label: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.length > 255) {
    fail('repair_revenue_evidence_reference_invalid', `${label} 证据引用无效`);
  }
  return normalized;
}

function assertPositiveIntegerCentsString(value: string, label: string): string {
  const normalized = String(value ?? '').trim();
  if (!POSITIVE_INTEGER_CENTS.test(normalized)) {
    fail('repair_revenue_integer_cents_invalid', `${label} 必须是正整数分`);
  }
  return normalized;
}

function assertVersionMap(value: Record<string, number>, label: string): Record<string, number> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    fail('repair_revenue_version_map_invalid', `${label} 版本映射无效`);
  }
  const entries = Object.entries(value);
  if (
    !entries.length ||
    entries.some(([key, version]) => !key.trim() || key.length > 100 || !isPositiveInteger(version))
  ) {
    fail('repair_revenue_version_map_invalid', `${label} 版本映射无效`);
  }
  return Object.fromEntries(entries.sort(([left], [right]) => compareOrdinal(left, right)));
}

function assertInstant(value: Date | string, label: string): Date {
  if (typeof value === 'string' && !STRICT_UTC_INSTANT.test(value)) {
    fail('repair_revenue_time_invalid', `${label} 必须是规范 UTC 时间`);
  }
  const instant = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (
    Number.isNaN(instant.getTime()) ||
    (typeof value === 'string' && instant.toISOString() !== value)
  ) {
    fail('repair_revenue_time_invalid', `${label} 时间无效`);
  }
  return instant;
}

function latestInstant(instants: Date[]): Date {
  return new Date(Math.max(...instants.map((item) => item.getTime())));
}

function assertUniquePositiveIntegers(values: number[], label: string): void {
  if (values.some((value) => !isPositiveInteger(value)) || new Set(values).size !== values.length) {
    fail('repair_revenue_collection_identity_reused', `${label} 必须是唯一正整数`);
  }
}

function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      compareOrdinal(left, right),
    );
    return `{${entries
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashJson(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function hashText(value: string): string {
  return createHash('sha256').update(String(value).trim()).digest('hex');
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}
