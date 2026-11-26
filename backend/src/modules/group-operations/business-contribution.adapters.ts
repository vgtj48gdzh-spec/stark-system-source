import { BadRequestException } from '@nestjs/common';
import {
  ContributionAttributionDto,
  ContributionDirectCostEvidenceDto,
  ContributionRevenueEvidenceDto,
  PublishContributionSourceAuthorityDto,
} from './dto/business-contribution.dto';
import {
  BUSINESS_CONTRIBUTION_DOMAINS,
  BusinessContributionDomain,
  CONTRIBUTION_ATTRIBUTION_ROLES,
} from './entities/business-contribution.entities';
import {
  ContributionCorrectionType,
  VerifiedContributionCorrectionSnapshot,
  VerifiedContributionReversalSnapshot,
  VerifiedContributionSourceSnapshot,
} from './business-contribution-source-authority';
import { GroupOperationsCalculator } from './group-operations.calculator';
import { GroupOperationsInvariants } from './group-operations.invariants';

export const CONTRIBUTION_ADAPTER_VERSION = 'gov1-s2-v1';

/**
 * The single, explicit, testable company settlement timezone. Natural settlement
 * months and their Beijing month-start UTC instants are always derived from this
 * fixed +08:00 offset, never from the host timezone or a UTC month boundary.
 */
export const COMPANY_SETTLEMENT_TIME_ZONE = 'Asia/Shanghai';
export const COMPANY_SETTLEMENT_UTC_OFFSET_MINUTES = 8 * 60;

export interface ContributionAdapterContract {
  businessDomain: BusinessContributionDomain;
  adapterVersion: typeof CONTRIBUTION_ADAPTER_VERSION;
  requiredSourceType: string;
  revenueRecognition: string;
  requiredCostCategories: readonly string[];
  formalAuthorityReadiness: 'blocked' | 'ready';
  formalAuthorityBlocker: string;
}

const CONTRACTS: Record<BusinessContributionDomain, ContributionAdapterContract> = {
  fresh: {
    businessDomain: 'fresh',
    adapterVersion: CONTRIBUTION_ADAPTER_VERSION,
    requiredSourceType: 'fresh_completed_order',
    revenueRecognition: 'completed_order_confirmed',
    requiredCostCategories: [
      'product_purchase',
      'direct_loss',
      'attributable_delivery',
      'special_direct',
      'refund',
    ],
    formalAuthorityReadiness: 'blocked',
    formalAuthorityBlocker: 'fresh_formal_source_adapter_unavailable',
  },
  water: {
    businessDomain: 'water',
    adapterVersion: CONTRIBUTION_ADAPTER_VERSION,
    requiredSourceType: 'water_confirmed_delivery',
    revenueRecognition: 'delivery_and_income_confirmed',
    requiredCostCategories: [
      'product_cost',
      'attributable_delivery',
      'barrel_direct',
      'refund_loss',
    ],
    formalAuthorityReadiness: 'blocked',
    formalAuthorityBlocker: 'water_formal_source_adapter_unavailable',
  },
  repair: {
    businessDomain: 'repair',
    adapterVersion: CONTRIBUTION_ADAPTER_VERSION,
    requiredSourceType: 'repair_delivered_work_order',
    revenueRecognition: 'delivery_finance_and_collection_evidence_confirmed',
    requiredCostCategories: ['parts', 'outsourced', 'other_direct', 'refund', 'rework'],
    formalAuthorityReadiness: 'blocked',
    formalAuthorityBlocker: 'repair_contribution_authorities_incomplete',
  },
  software: {
    businessDomain: 'software',
    adapterVersion: CONTRIBUTION_ADAPTER_VERSION,
    requiredSourceType: 'software_accepted_milestone',
    revenueRecognition: 'milestone_acceptance_and_period_revenue_confirmed',
    requiredCostCategories: ['third_party', 'dedicated_server', 'outsourced', 'other_direct'],
    formalAuthorityReadiness: 'blocked',
    formalAuthorityBlocker: 'software_formal_source_adapter_unavailable',
  },
};

export interface NormalizedContributionDraft {
  contract: ContributionAdapterContract;
  normalizedPayload: Record<string, unknown>;
  uniqueSourceKey: string;
  similarityClusterKey: string;
  economicFactKey: string;
  authoritySnapshotHash: string;
  recognitionPeriod: string;
  evidenceBundleHash: string;
  revenueCents: string;
  directCostTotalCents: string;
  validContributionMarginCents: string;
  revenueEvidence: ContributionRevenueEvidenceDto & { evidenceUniqueKey: string };
  directCosts: Array<ContributionDirectCostEvidenceDto & { evidenceUniqueKey: string }>;
  attributions: ContributionAttributionDto[];
}

export interface VerifiedContributionDraftContext {
  operatingGroupId: number;
  sourceAuthorityVersionId: number;
  attributions: ContributionAttributionDto[];
  reason: string;
  sourceChannel: string;
  correlationId: string;
}

export interface VerifiedContributionReversalContext {
  sourceAuthorityVersionId: number;
  sourceAuthorityRuleVersionId: string;
  adapterVersion: string;
  originalContributionId: number;
  businessDomain: BusinessContributionDomain;
  companyRef: string;
  businessSectorRef: string | null;
  storeRef: string | null;
  customerRef: string | null;
  operatingGroupId: number;
  sourceSystem: string;
  sourceType: string;
  sourceId: string;
  sourceVersion: string;
  sourceRecordHash: string;
  uniqueSourceKey: string;
  economicFactKey: string;
  similarityClusterKey: string;
  originalRecognitionAt: string;
  originalAttributionSnapshotHash: string;
  originalEvidenceBundleHash: string;
  originalAuthoritySnapshotHash: string;
  originalRevenueCents: string;
  originalDirectCostTotalCents: string;
  originalValidContributionMarginCents: string;
  originalAttributionShareTotalBps: number;
  originalConfirmationEvidenceHash: string;
  originalConfirmedAt: string;
  originalConfirmedVersion: number;
  originalConfirmedBy: number;
  currency: 'CNY';
}

export interface NormalizedContributionReversal {
  normalizedPayload: Record<string, unknown>;
  sourceSystem: string;
  sourceType: string;
  sourceId: string;
  sourceVersion: string;
  sourceRecordHash: string;
  sourceAllocationId: string;
  evidenceRef: string;
  evidenceHash: string;
  occurredAt: string;
  uniqueSourceKey: string;
  evidenceUniqueKey: string;
  authoritySnapshotHash: string;
}

export interface VerifiedContributionCorrectionContext {
  sourceAuthorityVersionId: number;
  sourceAuthorityRuleVersionId: string;
  adapterVersion: string;
  originalContributionId: number;
  correctionType: ContributionCorrectionType;
  businessDomain: BusinessContributionDomain;
  companyRef: string;
  businessSectorRef: string | null;
  storeRef: string | null;
  customerRef: string | null;
  operatingGroupId: number;
  selectedSourceSystem: string;
  selectedSourceType: string;
  selectedSourceId: string;
  selectedSourceVersion: string;
  selectedSourceRecordHash: string;
  originalUniqueSourceKey: string;
  originalEconomicFactKey: string;
  originalAttributionSnapshotHash: string;
  originalAuthoritySnapshotHash: string;
  originalEvidenceBundleHash: string;
  originalRecognitionAt: string;
  originalConfirmedAt: string;
  currency: 'CNY';
}

export interface NormalizedContributionCorrection {
  normalizedPayload: Record<string, unknown>;
  correctionType: ContributionCorrectionType;
  revenueDeltaCents: string;
  directCostDeltaCents: string;
  marginDeltaCents: string;
  sourceSystem: string;
  sourceType: string;
  sourceId: string;
  sourceVersion: string;
  sourceRecordHash: string;
  sourceAllocationId: string;
  evidenceRef: string;
  evidenceHash: string;
  occurredAt: string;
  uniqueSourceKey: string;
  evidenceUniqueKey: string;
  economicFactKey: string;
  attributionSnapshotHash: string;
  authoritySnapshotHash: string;
}

export class BusinessContributionAdapters {
  static listContracts(): ContributionAdapterContract[] {
    return BUSINESS_CONTRIBUTION_DOMAINS.map((domain) => ({
      ...CONTRACTS[domain],
      requiredCostCategories: [...CONTRACTS[domain].requiredCostCategories],
    }));
  }

  static contractFor(domain: BusinessContributionDomain): ContributionAdapterContract {
    const contract = CONTRACTS[domain];
    if (!contract) {
      throw new BadRequestException('[business_domain_invalid] 不支持的贡献业务域');
    }
    return contract;
  }

  static assertAuthorityContract(dto: PublishContributionSourceAuthorityDto): void {
    const contract = this.contractFor(dto.businessDomain);
    if (dto.adapterVersion.trim() !== contract.adapterVersion) {
      throw new BadRequestException(
        `[adapter_version_invalid] ${dto.businessDomain} 必须使用 ${contract.adapterVersion}`,
      );
    }
    if (this.normalizeCode(dto.sourceType, 'sourceType') !== contract.requiredSourceType) {
      throw new BadRequestException(
        `[source_type_invalid] ${dto.businessDomain} 来源类型必须为 ${contract.requiredSourceType}`,
      );
    }
    this.normalizeCode(dto.sourceSystem, 'sourceSystem');
    this.normalizeDate(dto.effectiveFrom, 'effectiveFrom');
    if (dto.effectiveTo) {
      const from = this.normalizeDate(dto.effectiveFrom, 'effectiveFrom');
      const to = this.normalizeDate(dto.effectiveTo, 'effectiveTo');
      if (to < from) throw new BadRequestException('[authority_date_range_invalid] 来源授权结束日早于开始日');
    }
  }

  static normalizeVerifiedDraft(
    snapshot: VerifiedContributionSourceSnapshot,
    context: VerifiedContributionDraftContext,
  ): NormalizedContributionDraft {
    const contract = this.contractFor(snapshot.businessDomain);
    const sourceSystem = this.normalizeCode(snapshot.sourceSystem, 'sourceSystem');
    const sourceType = this.normalizeCode(snapshot.sourceType, 'sourceType');
    const sourceId = this.normalizeCode(snapshot.sourceId, 'sourceId');
    const sourceVersion = this.normalizeCode(snapshot.sourceVersion, 'sourceVersion');
    if (sourceType !== contract.requiredSourceType) {
      throw new BadRequestException(
        `[source_type_invalid] ${snapshot.businessDomain} 来源类型必须为 ${contract.requiredSourceType}`,
      );
    }
    const sourceRecordHash = this.assertHash(snapshot.sourceRecordHash, 'sourceRecordHash');
    const recognitionAt = this.normalizeInstant(snapshot.recognitionAt, 'recognitionAt');
    const recognitionPeriod = this.settlementPeriodOfInstant(recognitionAt);
    const companyRef = this.normalizeReference(snapshot.companyRef, 'companyRef');
    const businessSectorRef = snapshot.businessSectorRef
      ? this.normalizeReference(snapshot.businessSectorRef, 'businessSectorRef')
      : null;
    const storeRef = snapshot.storeRef
      ? this.normalizeReference(snapshot.storeRef, 'storeRef')
      : null;
    const customerRef = snapshot.customerRef
      ? this.normalizeReference(snapshot.customerRef, 'customerRef')
      : null;
    if (snapshot.currency !== 'CNY') {
      throw new BadRequestException('[contribution_currency_invalid] 正式贡献当前只允许 CNY');
    }
    if (!Number.isInteger(snapshot.responsibilityEmployeeId) || snapshot.responsibilityEmployeeId <= 0) {
      throw new BadRequestException('[responsibility_employee_invalid] 来源权威责任员工无效');
    }
    if (!Number.isInteger(context.operatingGroupId) || context.operatingGroupId <= 0) {
      throw new BadRequestException('[operating_group_invalid] 服务端推导经营小组无效');
    }
    if (!Number.isInteger(context.sourceAuthorityVersionId) || context.sourceAuthorityVersionId <= 0) {
      throw new BadRequestException('[source_authority_version_invalid] 来源授权版本无效');
    }

    const revenueEvidence = this.normalizeRevenueEvidence(snapshot.revenueEvidence, recognitionAt);
    if (revenueEvidence.sourceSystem !== sourceSystem || revenueEvidence.sourceType !== sourceType) {
      throw new BadRequestException(
        '[revenue_source_binding_mismatch] 收入证据必须绑定贡献来源系统和来源类型',
      );
    }
    if (revenueEvidence.sourceId !== sourceId || revenueEvidence.sourceVersion !== sourceVersion) {
      throw new BadRequestException(
        '[revenue_source_identity_mismatch] 收入证据必须绑定贡献来源标识和版本',
      );
    }

    const directCosts = snapshot.directCosts
      .map((item) => this.normalizeDirectCostEvidence(item, recognitionAt))
      .sort((left, right) => left.costCategory.localeCompare(right.costCategory));
    this.assertCompleteCostChecklist(contract, directCosts);
    if (directCosts.some((item) => item.evidenceUniqueKey === revenueEvidence.evidenceUniqueKey)) {
      throw new BadRequestException(
        '[revenue_cost_evidence_reused] 同一证据分配不得同时计入收入和直接成本',
      );
    }

    const revenueValue = GroupOperationsCalculator.parseNonNegativeCents(
      revenueEvidence.amountCents,
      'revenueEvidence.amountCents',
    );
    if (revenueValue <= 0n) {
      throw new BadRequestException('[confirmed_revenue_invalid] 正常贡献的已确认收入必须大于 0');
    }
    const directCostValue = directCosts.reduce(
      (total, item, index) =>
        total +
        GroupOperationsCalculator.parseNonNegativeCents(
          item.amountCents,
          `directCosts[${index}].amountCents`,
        ),
      0n,
    );
    GroupOperationsCalculator.parseNonNegativeCents(
      directCostValue.toString(),
      'directCostTotalCents',
    );
    const margin = revenueValue - directCostValue;
    GroupOperationsCalculator.parseSignedCents(margin.toString(), 'validContributionMarginCents');

    const attributions = context.attributions
      .map((item) => this.normalizeAttribution(item))
      .sort(
        (left, right) =>
          left.role.localeCompare(right.role) ||
          left.employeeId - right.employeeId ||
          left.originBusinessDomain.localeCompare(right.originBusinessDomain),
      );
    this.assertAttributions(attributions);

    const uniqueSourceKey = this.sourceUniqueKey({
      businessDomain: snapshot.businessDomain,
      sourceSystem,
      sourceType,
      sourceId,
    });
    const similaritySubject = this.normalizeCanonicalIdentity(
      snapshot.canonicalSimilaritySubjectId,
      'canonicalSimilaritySubjectId',
    );
    const canonicalEconomicFactId = this.normalizeCanonicalIdentity(
      snapshot.canonicalEconomicFactId,
      'canonicalEconomicFactId',
    );
    const similarityClusterKey = GroupOperationsInvariants.payloadFingerprint({
      companyRef,
      similaritySubject,
      currency: snapshot.currency,
    });
    const economicFactKey = GroupOperationsInvariants.payloadFingerprint({
      companyRef,
      canonicalEconomicFactId,
    });
    const authoritySnapshotHash = GroupOperationsInvariants.payloadFingerprint({
      businessDomain: snapshot.businessDomain,
      companyRef,
      businessSectorRef,
      storeRef,
      sourceSystem,
      sourceType,
      sourceId,
      sourceVersion,
      sourceRecordHash,
      recognitionAt,
      customerRef,
      currency: snapshot.currency,
      responsibilityEmployeeId: snapshot.responsibilityEmployeeId,
      canonicalEconomicFactId,
      similaritySubject,
      revenueEvidence,
      directCosts,
    });
    const normalizedPayload: Record<string, unknown> = {
      businessDomain: snapshot.businessDomain,
      companyRef,
      businessSectorRef,
      storeRef,
      operatingGroupId: context.operatingGroupId,
      responsibilityEmployeeId: snapshot.responsibilityEmployeeId,
      sourceAuthorityVersionId: context.sourceAuthorityVersionId,
      adapterVersion: contract.adapterVersion,
      sourceSystem,
      sourceType,
      sourceId,
      sourceVersion,
      sourceRecordHash,
      uniqueSourceKey,
      similarityClusterKey,
      economicFactKey,
      authoritySnapshotHash,
      recognitionPeriod,
      recognitionAt,
      customerRef,
      currency: snapshot.currency,
      revenueEvidence,
      directCosts,
      attributions,
      reason: context.reason.trim(),
      sourceChannel: context.sourceChannel.trim(),
      correlationId: context.correlationId.trim(),
    };
    const evidenceBundleHash = GroupOperationsInvariants.payloadFingerprint({
      authoritySnapshotHash,
      revenueEvidence,
      directCosts,
      attributions,
    });
    return {
      contract,
      normalizedPayload,
      uniqueSourceKey,
      similarityClusterKey,
      economicFactKey,
      authoritySnapshotHash,
      recognitionPeriod,
      evidenceBundleHash,
      revenueCents: revenueValue.toString(),
      directCostTotalCents: directCostValue.toString(),
      validContributionMarginCents: margin.toString(),
      revenueEvidence,
      directCosts,
      attributions,
    };
  }

  static normalizeVerifiedReversal(
    snapshot: VerifiedContributionReversalSnapshot,
    context: VerifiedContributionReversalContext,
  ): NormalizedContributionReversal {
    const contract = this.contractFor(context.businessDomain);
    if (
      !Number.isInteger(context.sourceAuthorityVersionId) ||
      context.sourceAuthorityVersionId <= 0 ||
      context.adapterVersion !== contract.adapterVersion
    ) {
      throw new BadRequestException(
        '[reversal_authority_context_invalid] 冲销必须绑定有效的正式来源授权版本和适配器版本',
      );
    }
    if (
      snapshot.businessDomain !== context.businessDomain ||
      snapshot.originalContributionId !== context.originalContributionId ||
      snapshot.originalOperatingGroupId !== context.operatingGroupId ||
      snapshot.reversalKind !== 'full'
    ) {
      throw new BadRequestException(
        '[reversal_original_binding_mismatch] 正式冲销未绑定原贡献、经营小组或完整冲销语义',
      );
    }

    const nullableReference = (value: string | null, field: string) =>
      value ? this.normalizeReference(value, field) : null;
    const companyRef = this.normalizeReference(snapshot.companyRef, 'reversal.companyRef');
    const businessSectorRef = nullableReference(
      snapshot.businessSectorRef,
      'reversal.businessSectorRef',
    );
    const storeRef = nullableReference(snapshot.storeRef, 'reversal.storeRef');
    const customerRef = nullableReference(snapshot.customerRef, 'reversal.customerRef');
    if (
      companyRef !== context.companyRef.trim() ||
      businessSectorRef !== (context.businessSectorRef?.trim() || null) ||
      storeRef !== (context.storeRef?.trim() || null) ||
      customerRef !== (context.customerRef?.trim() || null) ||
      snapshot.currency !== 'CNY' ||
      context.currency !== 'CNY'
    ) {
      throw new BadRequestException(
        '[reversal_scope_binding_mismatch] 正式冲销组织、客户范围或币种与原贡献不一致',
      );
    }

    const originalSourceSystem = this.normalizeCode(
      snapshot.originalSourceSystem,
      'reversal.originalSourceSystem',
    );
    const originalSourceType = this.normalizeCode(
      snapshot.originalSourceType,
      'reversal.originalSourceType',
    );
    const originalSourceId = this.normalizeCode(
      snapshot.originalSourceId,
      'reversal.originalSourceId',
    );
    const originalSourceVersion = this.normalizeCode(
      snapshot.originalSourceVersion,
      'reversal.originalSourceVersion',
    );
    const originalSourceRecordHash = this.assertHash(
      snapshot.originalSourceRecordHash,
      'reversal.originalSourceRecordHash',
    );
    const originalEconomicFactKey = this.assertHash(
      snapshot.originalEconomicFactKey,
      'reversal.originalEconomicFactKey',
    );
    const originalSimilarityClusterKey = this.assertHash(
      snapshot.originalSimilarityClusterKey,
      'reversal.originalSimilarityClusterKey',
    );
    if (
      originalSourceSystem !== context.sourceSystem.trim().toLowerCase() ||
      originalSourceType !== context.sourceType.trim().toLowerCase() ||
      originalSourceId !== context.sourceId.trim().toLowerCase() ||
      originalSourceVersion !== context.sourceVersion.trim().toLowerCase() ||
      originalSourceRecordHash !== this.assertHash(context.sourceRecordHash, 'sourceRecordHash') ||
      originalEconomicFactKey !== this.assertHash(context.economicFactKey, 'economicFactKey') ||
      originalSimilarityClusterKey !==
        this.assertHash(context.similarityClusterKey, 'similarityClusterKey')
    ) {
      throw new BadRequestException(
        '[reversal_source_binding_mismatch] 正式冲销未绑定原来源版本、经济事实或相似性簇',
      );
    }

    const originalRecognitionAt = this.normalizeInstant(
      snapshot.originalRecognitionAt,
      'reversal.originalRecognitionAt',
    );
    const contextOriginalRecognitionAt = this.normalizeInstant(
      context.originalRecognitionAt,
      'originalRecognitionAt',
    );
    const originalAttributionSnapshotHash = this.assertHash(
      snapshot.originalAttributionSnapshotHash,
      'reversal.originalAttributionSnapshotHash',
    );
    const contextAttributionSnapshotHash = this.assertHash(
      context.originalAttributionSnapshotHash,
      'originalAttributionSnapshotHash',
    );

    const originalEvidenceBundleHash = this.assertHash(
      snapshot.originalEvidenceBundleHash,
      'reversal.originalEvidenceBundleHash',
    );
    const originalAuthoritySnapshotHash = this.assertHash(
      snapshot.originalAuthoritySnapshotHash,
      'reversal.originalAuthoritySnapshotHash',
    );
    const originalRevenueCents = GroupOperationsCalculator.parseSignedCents(
      snapshot.originalRevenueCents,
      'reversal.originalRevenueCents',
    ).toString();
    const originalDirectCostTotalCents = GroupOperationsCalculator.parseSignedCents(
      snapshot.originalDirectCostTotalCents,
      'reversal.originalDirectCostTotalCents',
    ).toString();
    const originalValidContributionMarginCents = GroupOperationsCalculator.parseSignedCents(
      snapshot.originalValidContributionMarginCents,
      'reversal.originalValidContributionMarginCents',
    ).toString();
    GroupOperationsCalculator.assertBasisPoints(
      snapshot.originalAttributionShareTotalBps,
      'reversal.originalAttributionShareTotalBps',
      false,
      10_000,
    );
    const originalAttributionShareTotalBps = snapshot.originalAttributionShareTotalBps;
    const originalConfirmationEvidenceHash = this.assertHash(
      snapshot.originalConfirmationEvidenceHash,
      'reversal.originalConfirmationEvidenceHash',
    );
    const originalConfirmedAt = this.normalizeInstant(
      snapshot.originalConfirmedAt,
      'reversal.originalConfirmedAt',
    );
    if (
      !Number.isInteger(snapshot.originalConfirmedVersion) ||
      snapshot.originalConfirmedVersion <= 0
    ) {
      throw new BadRequestException(
        '[reversal_original_confirmed_version_invalid] 原贡献确认版本无效',
      );
    }
    if (!Number.isInteger(snapshot.originalConfirmedBy) || snapshot.originalConfirmedBy <= 0) {
      throw new BadRequestException('[reversal_original_confirmed_by_invalid] 原贡献确认人无效');
    }
    const originalConfirmedVersion = snapshot.originalConfirmedVersion;
    const originalConfirmedBy = snapshot.originalConfirmedBy;

    const contextEvidenceBundleHash = this.assertHash(
      context.originalEvidenceBundleHash,
      'originalEvidenceBundleHash',
    );
    const contextAuthoritySnapshotHash = this.assertHash(
      context.originalAuthoritySnapshotHash,
      'originalAuthoritySnapshotHash',
    );
    const contextRevenueCents = GroupOperationsCalculator.parseSignedCents(
      context.originalRevenueCents,
      'originalRevenueCents',
    ).toString();
    const contextDirectCostTotalCents = GroupOperationsCalculator.parseSignedCents(
      context.originalDirectCostTotalCents,
      'originalDirectCostTotalCents',
    ).toString();
    const contextValidContributionMarginCents = GroupOperationsCalculator.parseSignedCents(
      context.originalValidContributionMarginCents,
      'originalValidContributionMarginCents',
    ).toString();
    GroupOperationsCalculator.assertBasisPoints(
      context.originalAttributionShareTotalBps,
      'originalAttributionShareTotalBps',
      false,
      10_000,
    );
    const contextAttributionShareTotalBps = context.originalAttributionShareTotalBps;
    const contextConfirmationEvidenceHash = this.assertHash(
      context.originalConfirmationEvidenceHash,
      'originalConfirmationEvidenceHash',
    );
    const contextConfirmedAt = this.normalizeInstant(
      context.originalConfirmedAt,
      'originalConfirmedAt',
    );
    if (
      !Number.isInteger(context.originalConfirmedVersion) ||
      context.originalConfirmedVersion <= 0
    ) {
      throw new BadRequestException(
        '[reversal_original_confirmed_version_invalid] 原贡献确认版本无效',
      );
    }
    if (!Number.isInteger(context.originalConfirmedBy) || context.originalConfirmedBy <= 0) {
      throw new BadRequestException('[reversal_original_confirmed_by_invalid] 原贡献确认人无效');
    }
    const contextConfirmedVersion = context.originalConfirmedVersion;
    const contextConfirmedBy = context.originalConfirmedBy;
    if (
      originalEvidenceBundleHash !== contextEvidenceBundleHash ||
      originalAuthoritySnapshotHash !== contextAuthoritySnapshotHash ||
      originalRecognitionAt !== contextOriginalRecognitionAt ||
      originalAttributionSnapshotHash !== contextAttributionSnapshotHash ||
      originalRevenueCents !== contextRevenueCents ||
      originalDirectCostTotalCents !== contextDirectCostTotalCents ||
      originalValidContributionMarginCents !== contextValidContributionMarginCents ||
      originalAttributionShareTotalBps !== contextAttributionShareTotalBps ||
      originalConfirmationEvidenceHash !== contextConfirmationEvidenceHash ||
      originalConfirmedAt !== contextConfirmedAt ||
      originalConfirmedVersion !== contextConfirmedVersion ||
      originalConfirmedBy !== contextConfirmedBy
    ) {
      throw new BadRequestException(
        '[reversal_original_fact_binding_mismatch] 正式冲销未完整绑定原贡献时间、归因快照、证据包、权威快照、金额、归因总额或确认事实',
      );
    }

    const occurredAt = this.normalizeInstant(snapshot.occurredAt, 'reversal.occurredAt');
    if (occurredAt < originalRecognitionAt) {
      throw new BadRequestException(
        '[reversal_before_original_forbidden] 正式冲销发生时间不得早于原贡献确认时间',
      );
    }
    if (occurredAt < originalConfirmedAt) {
      throw new BadRequestException(
        '[reversal_before_confirmation_forbidden] 正式冲销发生时间不得早于原贡献正式确认时间',
      );
    }

    const sourceSystem = this.normalizeCode(snapshot.sourceSystem, 'reversal.sourceSystem');
    const sourceType = this.normalizeCode(snapshot.sourceType, 'reversal.sourceType');
    const sourceId = this.normalizeCode(snapshot.sourceId, 'reversal.sourceId');
    const sourceVersion = this.normalizeCode(snapshot.sourceVersion, 'reversal.sourceVersion');
    const sourceRecordHash = this.assertHash(
      snapshot.sourceRecordHash,
      'reversal.sourceRecordHash',
    );
    const sourceAllocationId = this.normalizeCode(
      snapshot.sourceAllocationId,
      'reversal.sourceAllocationId',
    );
    const evidenceRef = this.assertSafeEvidenceRef(
      snapshot.evidenceRef,
      'reversal.evidenceRef',
    );
    const evidenceHash = this.assertHash(snapshot.evidenceHash, 'reversal.evidenceHash');
    const uniqueSourceKey = this.sourceUniqueKey({
      businessDomain: context.businessDomain,
      sourceSystem,
      sourceType,
      sourceId,
    });
    if (uniqueSourceKey === this.assertHash(context.uniqueSourceKey, 'uniqueSourceKey')) {
      throw new BadRequestException(
        '[reversal_source_not_distinct] 正式冲销来源必须与原贡献来源明确区分',
      );
    }
    const evidenceUniqueKey = this.evidenceUniqueKey({
      sourceSystem,
      sourceType,
      sourceId,
      sourceVersion,
      sourceAllocationId,
    });
    const sourceAuthorityRuleVersionId = this.normalizeReference(
      context.sourceAuthorityRuleVersionId,
      'sourceAuthorityRuleVersionId',
    );
    const normalizedPayload = {
      businessDomain: context.businessDomain,
      companyRef,
      businessSectorRef,
      storeRef,
      customerRef,
      originalContributionId: context.originalContributionId,
      originalOperatingGroupId: context.operatingGroupId,
      originalSourceSystem,
      originalSourceType,
      originalSourceId,
      originalSourceVersion,
      originalSourceRecordHash,
      originalEconomicFactKey,
      originalSimilarityClusterKey,
      originalRecognitionAt,
      originalAttributionSnapshotHash,
      originalEvidenceBundleHash,
      originalAuthoritySnapshotHash,
      originalRevenueCents,
      originalDirectCostTotalCents,
      originalValidContributionMarginCents,
      originalAttributionShareTotalBps,
      originalConfirmationEvidenceHash,
      originalConfirmedAt,
      originalConfirmedVersion,
      originalConfirmedBy,
      sourceAuthorityVersionId: context.sourceAuthorityVersionId,
      sourceAuthorityRuleVersionId,
      adapterVersion: context.adapterVersion,
      currency: snapshot.currency,
      reversalKind: snapshot.reversalKind,
      sourceSystem,
      sourceType,
      sourceId,
      sourceVersion,
      sourceRecordHash,
      sourceAllocationId,
      evidenceRef,
      evidenceHash,
      evidenceUniqueKey,
      occurredAt,
      uniqueSourceKey,
    };
    return {
      normalizedPayload,
      sourceSystem,
      sourceType,
      sourceId,
      sourceVersion,
      sourceRecordHash,
      sourceAllocationId,
      evidenceRef,
      evidenceHash,
      occurredAt,
      uniqueSourceKey,
      evidenceUniqueKey,
      authoritySnapshotHash: GroupOperationsInvariants.payloadFingerprint(normalizedPayload),
    };
  }

  static normalizeVerifiedCorrection(
    snapshot: VerifiedContributionCorrectionSnapshot,
    context: VerifiedContributionCorrectionContext,
  ): NormalizedContributionCorrection {
    const contract = this.contractFor(context.businessDomain);
    if (
      !Number.isInteger(context.sourceAuthorityVersionId) ||
      context.sourceAuthorityVersionId <= 0 ||
      context.adapterVersion !== contract.adapterVersion
    ) {
      throw new BadRequestException(
        '[correction_authority_context_invalid] 更正必须绑定有效的正式来源授权版本和适配器版本',
      );
    }
    if (
      snapshot.businessDomain !== context.businessDomain ||
      snapshot.originalContributionId !== context.originalContributionId ||
      snapshot.operatingGroupId !== context.operatingGroupId ||
      snapshot.correctionType !== context.correctionType ||
      snapshot.sourceAuthorityVersionId !== context.sourceAuthorityVersionId ||
      snapshot.currency !== context.currency
    ) {
      throw new BadRequestException(
        '[correction_original_binding_mismatch] 正式更正未绑定原贡献、经营小组、类型、币种或精确来源授权版本',
      );
    }

    const companyRef = this.normalizeReference(snapshot.companyRef, 'correction.companyRef');
    const businessSectorRef = snapshot.businessSectorRef
      ? this.normalizeReference(snapshot.businessSectorRef, 'correction.businessSectorRef')
      : null;
    const storeRef = snapshot.storeRef
      ? this.normalizeReference(snapshot.storeRef, 'correction.storeRef')
      : null;
    const customerRef = snapshot.customerRef
      ? this.normalizeReference(snapshot.customerRef, 'correction.customerRef')
      : null;
    if (
      companyRef !== context.companyRef.trim() ||
      businessSectorRef !== (context.businessSectorRef?.trim() || null) ||
      storeRef !== (context.storeRef?.trim() || null) ||
      customerRef !== (context.customerRef?.trim() || null)
    ) {
      throw new BadRequestException(
        '[correction_scope_binding_mismatch] 正式更正必须保持原贡献公司、板块、门店和客户范围',
      );
    }

    const economicFactKey = this.assertHash(
      snapshot.originalEconomicFactKey,
      'correction.originalEconomicFactKey',
    );
    const attributionSnapshotHash = this.assertHash(
      snapshot.originalAttributionSnapshotHash,
      'correction.originalAttributionSnapshotHash',
    );
    const originalAuthoritySnapshotHash = this.assertHash(
      snapshot.originalAuthoritySnapshotHash,
      'correction.originalAuthoritySnapshotHash',
    );
    const originalEvidenceBundleHash = this.assertHash(
      snapshot.originalEvidenceBundleHash,
      'correction.originalEvidenceBundleHash',
    );
    if (
      economicFactKey !== this.assertHash(context.originalEconomicFactKey, 'originalEconomicFactKey') ||
      attributionSnapshotHash !==
        this.assertHash(context.originalAttributionSnapshotHash, 'originalAttributionSnapshotHash') ||
      originalAuthoritySnapshotHash !==
        this.assertHash(context.originalAuthoritySnapshotHash, 'originalAuthoritySnapshotHash') ||
      originalEvidenceBundleHash !==
        this.assertHash(context.originalEvidenceBundleHash, 'originalEvidenceBundleHash')
    ) {
      throw new BadRequestException(
        '[correction_original_fact_binding_mismatch] 正式更正未完整绑定原经济事实、归因、权威或证据快照',
      );
    }

    const originalRecognitionAt = this.normalizeInstant(
      snapshot.originalRecognitionAt,
      'correction.originalRecognitionAt',
    );
    const originalConfirmedAt = this.normalizeInstant(
      snapshot.originalConfirmedAt,
      'correction.originalConfirmedAt',
    );
    if (
      originalRecognitionAt !== this.normalizeInstant(context.originalRecognitionAt, 'originalRecognitionAt') ||
      originalConfirmedAt !== this.normalizeInstant(context.originalConfirmedAt, 'originalConfirmedAt')
    ) {
      throw new BadRequestException(
        '[correction_original_time_binding_mismatch] 正式更正未绑定原贡献确认与归期时间',
      );
    }

    const sourceSystem = this.normalizeCode(snapshot.sourceSystem, 'correction.sourceSystem');
    const sourceType = this.normalizeCode(snapshot.sourceType, 'correction.sourceType');
    const sourceId = this.normalizeCode(snapshot.sourceId, 'correction.sourceId');
    const sourceVersion = this.normalizeCode(snapshot.sourceVersion, 'correction.sourceVersion');
    const sourceRecordHash = this.assertHash(
      snapshot.sourceRecordHash,
      'correction.sourceRecordHash',
    );
    if (
      sourceSystem !== this.normalizeCode(context.selectedSourceSystem, 'selectedSourceSystem') ||
      sourceType !== this.normalizeCode(context.selectedSourceType, 'selectedSourceType') ||
      sourceId !== this.normalizeCode(context.selectedSourceId, 'selectedSourceId') ||
      sourceVersion !== this.normalizeCode(context.selectedSourceVersion, 'selectedSourceVersion') ||
      sourceRecordHash !== this.assertHash(context.selectedSourceRecordHash, 'selectedSourceRecordHash')
    ) {
      throw new BadRequestException(
        '[correction_source_binding_mismatch] 正式更正权威事实与选定来源身份或版本不一致',
      );
    }
    const sourceAllocationId = this.normalizeCode(
      snapshot.sourceAllocationId,
      'correction.sourceAllocationId',
    );
    const evidenceRef = this.assertSafeEvidenceRef(
      snapshot.evidenceRef,
      'correction.evidenceRef',
    );
    const evidenceHash = this.assertHash(snapshot.evidenceHash, 'correction.evidenceHash');
    const occurredAt = this.normalizeInstant(snapshot.occurredAt, 'correction.occurredAt');
    if (occurredAt < originalRecognitionAt || occurredAt < originalConfirmedAt) {
      throw new BadRequestException(
        '[correction_before_original_forbidden] 正式更正发生时间不得早于原贡献归期或正式确认时间',
      );
    }

    const revenueDelta = GroupOperationsCalculator.parseSignedCents(
      snapshot.revenueDeltaCents,
      'correction.revenueDeltaCents',
    );
    const directCostDelta = GroupOperationsCalculator.parseSignedCents(
      snapshot.directCostDeltaCents,
      'correction.directCostDeltaCents',
    );
    const validShape =
      (snapshot.correctionType === 'customer_refund' && revenueDelta < 0n && directCostDelta === 0n) ||
      (snapshot.correctionType === 'rework_direct_cost' && revenueDelta === 0n && directCostDelta > 0n) ||
      (snapshot.correctionType === 'supplier_cost_recovery' && revenueDelta === 0n && directCostDelta < 0n) ||
      (snapshot.correctionType === 'full_void' && revenueDelta < 0n && directCostDelta <= 0n);
    if (!validShape) {
      throw new BadRequestException(
        '[correction_delta_shape_invalid] 正式更正金额方向与 correction 类型不一致',
      );
    }
    const marginDelta = revenueDelta - directCostDelta;
    GroupOperationsCalculator.parseSignedCents(marginDelta.toString(), 'correction.marginDeltaCents');

    const uniqueSourceKey = this.sourceUniqueKey({
      businessDomain: context.businessDomain,
      sourceSystem,
      sourceType,
      sourceId,
    });
    if (uniqueSourceKey === this.assertHash(context.originalUniqueSourceKey, 'originalUniqueSourceKey')) {
      throw new BadRequestException(
        '[correction_source_not_distinct] 正式更正来源必须与原贡献来源明确区分',
      );
    }
    const evidenceUniqueKey = this.evidenceUniqueKey({
      sourceSystem,
      sourceType,
      sourceId,
      sourceVersion,
      sourceAllocationId,
    });
    const sourceAuthorityRuleVersionId = this.normalizeReference(
      context.sourceAuthorityRuleVersionId,
      'sourceAuthorityRuleVersionId',
    );
    const normalizedPayload = {
      originalContributionId: context.originalContributionId,
      correctionType: snapshot.correctionType,
      businessDomain: context.businessDomain,
      companyRef,
      businessSectorRef,
      storeRef,
      customerRef,
      operatingGroupId: context.operatingGroupId,
      sourceAuthorityVersionId: context.sourceAuthorityVersionId,
      sourceAuthorityRuleVersionId,
      adapterVersion: context.adapterVersion,
      originalEconomicFactKey: economicFactKey,
      originalAttributionSnapshotHash: attributionSnapshotHash,
      originalAuthoritySnapshotHash,
      originalEvidenceBundleHash,
      originalRecognitionAt,
      originalConfirmedAt,
      revenueDeltaCents: revenueDelta.toString(),
      directCostDeltaCents: directCostDelta.toString(),
      marginDeltaCents: marginDelta.toString(),
      sourceSystem,
      sourceType,
      sourceId,
      sourceVersion,
      sourceRecordHash,
      sourceAllocationId,
      uniqueSourceKey,
      evidenceUniqueKey,
      evidenceRef,
      evidenceHash,
      occurredAt,
      currency: snapshot.currency,
    };
    return {
      normalizedPayload,
      correctionType: snapshot.correctionType,
      revenueDeltaCents: revenueDelta.toString(),
      directCostDeltaCents: directCostDelta.toString(),
      marginDeltaCents: marginDelta.toString(),
      sourceSystem,
      sourceType,
      sourceId,
      sourceVersion,
      sourceRecordHash,
      sourceAllocationId,
      evidenceRef,
      evidenceHash,
      occurredAt,
      uniqueSourceKey,
      evidenceUniqueKey,
      economicFactKey,
      attributionSnapshotHash,
      authoritySnapshotHash: GroupOperationsInvariants.payloadFingerprint(normalizedPayload),
    };
  }

  static reversalEvidenceBundleHash(
    reversal: NormalizedContributionReversal,
    recognitionPeriod: string,
    recognitionAt: string,
  ): string {
    const normalizedRecognitionAt = this.normalizeInstant(recognitionAt, 'recognitionAt');
    if (
      !/^20\d{2}-(0[1-9]|1[0-2])$/.test(recognitionPeriod) ||
      this.settlementPeriodOfInstant(normalizedRecognitionAt) !== recognitionPeriod ||
      normalizedRecognitionAt < reversal.occurredAt
    ) {
      throw new BadRequestException(
        '[reversal_recognition_invalid] 冲销入账时间必须属于服务端派生期间且不早于权威发生时间',
      );
    }
    return GroupOperationsInvariants.payloadFingerprint({
      authoritySnapshotHash: reversal.authoritySnapshotHash,
      reversalEvidence: {
        sourceSystem: reversal.sourceSystem,
        sourceType: reversal.sourceType,
        sourceId: reversal.sourceId,
        sourceVersion: reversal.sourceVersion,
        sourceRecordHash: reversal.sourceRecordHash,
        sourceAllocationId: reversal.sourceAllocationId,
        evidenceRef: reversal.evidenceRef,
        evidenceHash: reversal.evidenceHash,
        evidenceUniqueKey: reversal.evidenceUniqueKey,
        occurredAt: reversal.occurredAt,
      },
      recognitionPeriod,
      recognitionAt: normalizedRecognitionAt,
    });
  }

  static authorityScopeKey(input: {
    companyRef: string;
    businessSectorRef: string | null;
    storeRef: string | null;
    businessDomain: BusinessContributionDomain;
    sourceSystem: string;
    sourceType: string;
  }): string {
    return GroupOperationsInvariants.payloadFingerprint({
      companyRef: input.companyRef.trim(),
      businessSectorRef: input.businessSectorRef?.trim() || null,
      storeRef: input.storeRef?.trim() || null,
      businessDomain: input.businessDomain,
      sourceSystem: this.normalizeCode(input.sourceSystem, 'sourceSystem'),
      sourceType: this.normalizeCode(input.sourceType, 'sourceType'),
    });
  }

  static sourceUniqueKey(input: {
    businessDomain: BusinessContributionDomain;
    sourceSystem: string;
    sourceType: string;
    sourceId: string;
  }): string {
    return GroupOperationsInvariants.payloadFingerprint({
      businessDomain: input.businessDomain,
      sourceSystem: this.normalizeCode(input.sourceSystem, 'sourceSystem'),
      sourceType: this.normalizeCode(input.sourceType, 'sourceType'),
      sourceId: this.normalizeCode(input.sourceId, 'sourceId'),
    });
  }

  static evidenceUniqueKey(input: {
    sourceSystem: string;
    sourceType: string;
    sourceId: string;
    sourceVersion: string;
    sourceAllocationId: string;
  }): string {
    return GroupOperationsInvariants.payloadFingerprint({
      sourceSystem: this.normalizeCode(input.sourceSystem, 'sourceSystem'),
      sourceType: this.normalizeCode(input.sourceType, 'sourceType'),
      sourceId: this.normalizeCode(input.sourceId, 'sourceId'),
      sourceAllocationId: this.normalizeCode(input.sourceAllocationId, 'sourceAllocationId'),
    });
  }

  static assertSafeEvidenceRef(value: string, field: string): string {
    const normalized = value.trim();
    if (normalized.length < 3 || normalized.length > 500) {
      throw new BadRequestException(`[${field}_invalid] 证据引用长度无效`);
    }
    if (
      /(?:bearer|basic)\s+[a-z0-9._~+/=-]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/i.test(
        normalized,
      ) ||
      /(?:^|[?&\s;,])(?:access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key|token|secret|password|signature|sig)\s*[=:]/i.test(
        normalized,
      )
    ) {
      throw new BadRequestException(`[${field}_unsafe] 证据引用不得包含凭据或密钥`);
    }
    return normalized;
  }

  static assertHash(value: string, field: string): string {
    const normalized = value.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalized)) {
      throw new BadRequestException(`[${field}_invalid] ${field} 必须是 SHA-256`);
    }
    return normalized;
  }

  static normalizeInstant(value: string, field: string): string {
    const parsed = new Date(value);
    if (!value || Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`[${field}_invalid] ${field} 必须是有效 ISO 时间`);
    }
    return parsed.toISOString();
  }

  static normalizeDate(value: string, field: string): string {
    const date = value?.slice(0, 10) ?? '';
    const match = /^(20\d{2})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) throw new BadRequestException(`[${field}_invalid] 日期格式必须为 YYYY-MM-DD`);
    const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    if (parsed.toISOString().slice(0, 10) !== date) {
      throw new BadRequestException(`[${field}_invalid] 日期不是有效日历日期`);
    }
    return date;
  }

  static assertSettlementPeriod(recognitionPeriod: string): void {
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(recognitionPeriod)) {
      throw new BadRequestException('[recognition_period_invalid] 统计周期格式必须为 YYYY-MM');
    }
  }

  static settlementPeriodOfInstant(instant: string | Date): string {
    const millis = typeof instant === 'string'
      ? new Date(this.normalizeInstant(instant, 'settlementInstant')).getTime()
      : instant.getTime();
    if (Number.isNaN(millis)) {
      throw new BadRequestException('[settlement_instant_invalid] 结算时点无效');
    }
    const beijingWall = new Date(millis + COMPANY_SETTLEMENT_UTC_OFFSET_MINUTES * 60_000);
    return beijingWall.toISOString().slice(0, 7);
  }

  static settlementDateOfInstant(instant: string | Date): string {
    const millis = typeof instant === 'string'
      ? new Date(this.normalizeInstant(instant, 'settlementInstant')).getTime()
      : instant.getTime();
    if (Number.isNaN(millis)) {
      throw new BadRequestException('[settlement_instant_invalid] 结算时点无效');
    }
    const beijingWall = new Date(millis + COMPANY_SETTLEMENT_UTC_OFFSET_MINUTES * 60_000);
    return beijingWall.toISOString().slice(0, 10);
  }

  static settlementPeriodStartInstant(recognitionPeriod: string): string {
    this.assertSettlementPeriod(recognitionPeriod);
    const start = new Date(`${recognitionPeriod}-01T00:00:00.000+08:00`);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('[recognition_period_invalid] 统计周期格式必须为 YYYY-MM');
    }
    return start.toISOString();
  }

  static settlementPeriodHasStarted(recognitionPeriod: string, nowMillis = Date.now()): boolean {
    return new Date(this.settlementPeriodStartInstant(recognitionPeriod)).getTime() <= nowMillis;
  }

  static nextSettlementPeriod(recognitionPeriod: string): string {
    this.assertSettlementPeriod(recognitionPeriod);
    const [year, month] = recognitionPeriod.split('-').map(Number);
    const totalMonths = year * 12 + (month - 1) + 1;
    const nextYear = Math.floor(totalMonths / 12);
    const nextMonth = (totalMonths % 12) + 1;
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
  }

  private static normalizeRevenueEvidence(
    item: ContributionRevenueEvidenceDto,
    recognitionAt: string,
  ): ContributionRevenueEvidenceDto & { evidenceUniqueKey: string } {
    const normalized = {
      amountCents: GroupOperationsCalculator.parseNonNegativeCents(
        item.amountCents,
        'revenueEvidence.amountCents',
      ).toString(),
      sourceSystem: this.normalizeCode(item.sourceSystem, 'revenueEvidence.sourceSystem'),
      sourceType: this.normalizeCode(item.sourceType, 'revenueEvidence.sourceType'),
      sourceId: this.normalizeCode(item.sourceId, 'revenueEvidence.sourceId'),
      sourceVersion: this.normalizeCode(item.sourceVersion, 'revenueEvidence.sourceVersion'),
      sourceAllocationId: this.normalizeCode(
        item.sourceAllocationId,
        'revenueEvidence.sourceAllocationId',
      ),
      evidenceRef: this.assertSafeEvidenceRef(item.evidenceRef, 'revenueEvidence.evidenceRef'),
      evidenceHash: this.assertHash(item.evidenceHash, 'revenueEvidence.evidenceHash'),
      occurredAt: this.normalizeInstant(item.occurredAt, 'revenueEvidence.occurredAt'),
    };
    if (normalized.occurredAt > recognitionAt) {
      throw new BadRequestException(
        '[revenue_evidence_after_recognition] 收入证据时间不得晚于毛利确认时间',
      );
    }
    return {
      ...normalized,
      evidenceUniqueKey: this.evidenceUniqueKey(normalized),
    };
  }

  private static normalizeDirectCostEvidence(
    item: ContributionDirectCostEvidenceDto,
    recognitionAt: string,
  ): ContributionDirectCostEvidenceDto & { evidenceUniqueKey: string } {
    const normalized = {
      ...this.normalizeRevenueEvidence(item, recognitionAt),
      costCategory: item.costCategory,
      disposition: item.disposition,
    };
    if (normalized.disposition === 'not_applicable' && normalized.amountCents !== '0') {
      throw new BadRequestException(
        `[cost_not_applicable_amount_invalid] ${normalized.costCategory} 标记不适用时金额必须为 0`,
      );
    }
    return normalized;
  }

  private static normalizeAttribution(item: ContributionAttributionDto): ContributionAttributionDto {
    if (!CONTRIBUTION_ATTRIBUTION_ROLES.includes(item.role)) {
      throw new BadRequestException('[attribution_role_invalid] 归因角色无效');
    }
    if (!BUSINESS_CONTRIBUTION_DOMAINS.includes(item.originBusinessDomain)) {
      throw new BadRequestException('[origin_business_domain_invalid] 归因来源业务域无效');
    }
    if (!Number.isInteger(item.employeeId) || item.employeeId <= 0) {
      throw new BadRequestException('[attribution_employee_invalid] 归因员工无效');
    }
    if (!Number.isInteger(item.shareBps) || item.shareBps <= 0 || item.shareBps > 10_000) {
      throw new BadRequestException('[attribution_share_invalid] 每项归因份额必须在 1 到 10000 基点');
    }
    return {
      role: item.role,
      originBusinessDomain: item.originBusinessDomain,
      employeeId: item.employeeId,
      shareBps: item.shareBps,
      evidenceRef: this.assertSafeEvidenceRef(item.evidenceRef, 'attribution.evidenceRef'),
      evidenceHash: this.assertHash(item.evidenceHash, 'attribution.evidenceHash'),
    };
  }

  private static assertCompleteCostChecklist(
    contract: ContributionAdapterContract,
    directCosts: Array<ContributionDirectCostEvidenceDto & { evidenceUniqueKey: string }>,
  ): void {
    const categories = directCosts.map((item) => item.costCategory);
    if (new Set(categories).size !== categories.length) {
      throw new BadRequestException('[direct_cost_category_duplicate] 直接成本类别不得重复');
    }
    const expected = [...contract.requiredCostCategories].sort();
    const actual = [...categories].sort();
    if (expected.length !== actual.length || expected.some((value, index) => value !== actual[index])) {
      throw new BadRequestException(
        `[direct_cost_checklist_incomplete] ${contract.businessDomain} 必须逐项提供 ${expected.join(',')}`,
      );
    }
    const evidenceKeys = directCosts.map((item) => item.evidenceUniqueKey);
    if (new Set(evidenceKeys).size !== evidenceKeys.length) {
      throw new BadRequestException('[direct_cost_evidence_duplicate] 同一成本证据分配不得重复使用');
    }
  }

  private static assertAttributions(attributions: ContributionAttributionDto[]): void {
    const roleEmployeeKeys = attributions.map((item) => `${item.role}:${item.employeeId}`);
    if (new Set(roleEmployeeKeys).size !== roleEmployeeKeys.length) {
      throw new BadRequestException('[attribution_role_employee_duplicate] 同一角色员工归因不得重复');
    }
    for (const role of CONTRIBUTION_ATTRIBUTION_ROLES) {
      if (!attributions.some((item) => item.role === role)) {
        throw new BadRequestException(`[attribution_role_missing] 缺少 ${role} 归因`);
      }
    }
    const total = attributions.reduce((sum, item) => sum + item.shareBps, 0);
    if (total !== 10_000) {
      throw new BadRequestException('[attribution_share_total_invalid] 已确认归因份额必须精确合计 10000 基点');
    }
    const employeeTotals = new Map<number, number>();
    for (const item of attributions) {
      employeeTotals.set(item.employeeId, (employeeTotals.get(item.employeeId) ?? 0) + item.shareBps);
    }
    if ([...employeeTotals.values()].some((share) => share > 10_000)) {
      throw new BadRequestException('[attribution_employee_share_invalid] 同一员工合并份额不得超过 10000 基点');
    }
  }

  private static normalizeCode(value: string, field: string): string {
    const normalized = value?.trim().toLowerCase() ?? '';
    if (!/^[a-z0-9][a-z0-9._:-]{0,119}$/.test(normalized)) {
      throw new BadRequestException(`[${field}_invalid] ${field} 格式无效`);
    }
    return normalized;
  }

  private static normalizeReference(value: string, field: string): string {
    const normalized = value?.trim() ?? '';
    if (normalized.length < 2 || normalized.length > 100) {
      throw new BadRequestException(`[${field}_invalid] ${field} 长度无效`);
    }
    return normalized;
  }

  private static normalizeCanonicalIdentity(value: string, field: string): string {
    const normalized = value?.trim() ?? '';
    if (normalized.length < 3 || normalized.length > 240) {
      throw new BadRequestException(`[${field}_invalid] ${field} 长度无效`);
    }
    this.assertSafeEvidenceRef(normalized, field);
    return normalized;
  }
}
