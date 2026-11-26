import { ConflictException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  ContributionDirectCostEvidenceDto,
  ContributionRevenueEvidenceDto,
} from './dto/business-contribution.dto';
import {
  BusinessContributionDomain,
  ContributionSourceAuthorityVersion,
} from './entities/business-contribution.entities';
import type { BusinessContributionCorrectionType } from './entities/business-contribution-correction.entity';
import { composeRepairFirstFormalSourceBundleV1 } from './repair-formal-source-composer';
import type {
  VerifiedContributionAuthorityBundleV1,
  VerifiedContributionRbacContextV1,
} from './verified-contribution-authority-bundle.contract';
export {
  VERIFIED_CONTRIBUTION_AUTHORITY_BUNDLE_SCHEMA_VERSION,
} from './verified-contribution-authority-bundle.contract';
export type {
  VerifiedContributionAuthorityBundleV1,
  VerifiedContributionRbacContextV1,
} from './verified-contribution-authority-bundle.contract';

export interface ContributionSourceSelection {
  businessDomain: BusinessContributionDomain;
  sourceSystem: string;
  sourceType: string;
  sourceId: string;
  sourceVersion: string;
  sourceRecordHash: string;
}

/**
 * Immutable facts already persisted for the contribution being reversed.
 * They are supplied by the service, never copied from the HTTP command.
 */
export type ContributionCorrectionType = BusinessContributionCorrectionType;

export interface ContributionCorrectionSelection extends ContributionSourceSelection {
  originalContributionId: number;
  correctionType: ContributionCorrectionType;
  companyRef: string;
  businessSectorRef: string | null;
  storeRef: string | null;
  customerRef: string | null;
  operatingGroupId: number;
  sourceAuthorityVersionId: number;
  originalEconomicFactKey: string;
  originalAttributionSnapshotHash: string;
  originalAuthoritySnapshotHash: string;
  originalEvidenceBundleHash: string;
  originalRecognitionAt: string;
  originalConfirmedAt: string;
}

export interface VerifiedContributionCorrectionSnapshot {
  businessDomain: BusinessContributionDomain;
  companyRef: string;
  businessSectorRef: string | null;
  storeRef: string | null;
  customerRef: string | null;
  originalContributionId: number;
  operatingGroupId: number;
  correctionType: ContributionCorrectionType;
  originalEconomicFactKey: string;
  originalAttributionSnapshotHash: string;
  originalAuthoritySnapshotHash: string;
  originalEvidenceBundleHash: string;
  originalRecognitionAt: string;
  originalConfirmedAt: string;
  revenueDeltaCents: string;
  directCostDeltaCents: string;
  sourceSystem: string;
  sourceType: string;
  sourceId: string;
  sourceVersion: string;
  sourceRecordHash: string;
  sourceAllocationId: string;
  evidenceRef: string;
  evidenceHash: string;
  occurredAt: string;
  currency: 'CNY';
  sourceAuthorityVersionId: number;
}

export interface ContributionReversalSelection extends ContributionSourceSelection {
  originalContributionId: number;
  companyRef: string;
  businessSectorRef: string | null;
  storeRef: string | null;
  customerRef: string | null;
  operatingGroupId: number;
  sourceAuthorityVersionId: number;
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

/**
 * A snapshot returned by a server-side formal domain adapter. None of these
 * business facts may be copied from the HTTP contribution request.
 */
export interface VerifiedContributionSourceSnapshot {
  businessDomain: BusinessContributionDomain;
  companyRef: string;
  businessSectorRef: string | null;
  storeRef: string | null;
  sourceSystem: string;
  sourceType: string;
  sourceId: string;
  sourceVersion: string;
  sourceRecordHash: string;
  recognitionAt: string;
  customerRef: string | null;
  currency: 'CNY';
  responsibilityEmployeeId: number;
  /** Stable across retries, source versions, cancellations and recreations. */
  canonicalEconomicFactId: string;
  /** Stable subject used to open a broad duplicate/split-order review cluster. */
  canonicalSimilaritySubjectId: string;
  revenueEvidence: ContributionRevenueEvidenceDto;
  directCosts: ContributionDirectCostEvidenceDto[];
}

export type VerifiedContributionSourceResolution =
  | VerifiedContributionSourceSnapshot
  | VerifiedContributionAuthorityBundleV1;

/**
 * Server-side proof of one complete reversal. Accounting recognition is not
 * part of this snapshot: the service derives the first open posting period
 * after transactionally checking target and payroll freeze state.
 */
export interface VerifiedContributionReversalSnapshot {
  businessDomain: BusinessContributionDomain;
  companyRef: string;
  businessSectorRef: string | null;
  storeRef: string | null;
  customerRef: string | null;
  originalContributionId: number;
  originalOperatingGroupId: number;
  originalSourceSystem: string;
  originalSourceType: string;
  originalSourceId: string;
  originalSourceVersion: string;
  originalSourceRecordHash: string;
  originalEconomicFactKey: string;
  originalSimilarityClusterKey: string;
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
  reversalKind: 'full';
  sourceSystem: string;
  sourceType: string;
  sourceId: string;
  sourceVersion: string;
  sourceRecordHash: string;
  sourceAllocationId: string;
  evidenceRef: string;
  evidenceHash: string;
  occurredAt: string;
}

/**
 * The default production resolver is deliberately fail-closed until a domain
 * has a complete formal revenue, direct-cost and reversal authority. Tests may
 * inject a bounded fake resolver; production DI always uses this provider.
 */
@Injectable()
export class BusinessContributionSourceAuthorityResolver {
  async resolve(
    selection: ContributionSourceSelection,
    authority: ContributionSourceAuthorityVersion,
    manager: EntityManager,
    rbacContext?: VerifiedContributionRbacContextV1,
  ): Promise<VerifiedContributionSourceResolution> {
    this.assertSelectionMatchesAuthority(selection, authority, 'normal');
    switch (selection.businessDomain) {
      case 'repair':
        return this.resolveRepair(selection, authority, manager, rbacContext);
      case 'fresh':
        throw new ConflictException(
          '[fresh_formal_source_adapter_unavailable] 生鲜正式订单、采购、损耗、配送和退款权威链尚未接入，禁止形成正式贡献',
        );
      case 'water':
        throw new ConflictException(
          '[water_formal_source_adapter_unavailable] 桶装水正式配送、回桶、直接成本和退款损耗权威链尚未接入，禁止形成正式贡献',
        );
      case 'software':
        throw new ConflictException(
          '[software_formal_source_adapter_unavailable] 软件里程碑验收、分期收入和直接成本权威链尚未接入，禁止形成正式贡献',
        );
    }
  }

  async resolveReversal(
    selection: ContributionReversalSelection,
    authority: ContributionSourceAuthorityVersion,
    _manager: EntityManager,
  ): Promise<VerifiedContributionReversalSnapshot> {
    this.assertSelectionMatchesAuthority(selection, authority, 'historical_reversal');
    switch (selection.businessDomain) {
      case 'fresh':
        throw new ConflictException(
          '[fresh_formal_reversal_adapter_unavailable] 生鲜正式退款、损耗冲销及原经济事实绑定权威链尚未接入，禁止形成正式冲销',
        );
      case 'water':
        throw new ConflictException(
          '[water_formal_reversal_adapter_unavailable] 桶装水正式退款、回桶损耗冲销及原经济事实绑定权威链尚未接入，禁止形成正式冲销',
        );
      case 'repair':
        throw new ConflictException(
          '[repair_formal_reversal_adapter_unavailable] 汽修正式退款、返修冲销及原经济事实绑定权威链尚未接入，禁止形成正式冲销',
        );
      case 'software':
        throw new ConflictException(
          '[software_formal_reversal_adapter_unavailable] 软件退款、里程碑撤销及原经济事实绑定权威链尚未接入，禁止形成正式冲销',
        );
    }
  }

  async resolveCorrection(
    selection: ContributionCorrectionSelection,
    authority: ContributionSourceAuthorityVersion,
    _manager: EntityManager,
  ): Promise<VerifiedContributionCorrectionSnapshot> {
    this.assertSelectionMatchesAuthority(selection, authority, 'normal');
    switch (selection.businessDomain) {
      case 'repair':
        throw new ConflictException(
          '[repair_formal_correction_adapter_unavailable] 汽修正式退款、返修、恢复冲销的金额与时间权威尚未由 OWNER 定稿，禁止形成正式 correction delta',
        );
      case 'fresh':
        throw new ConflictException(
          '[fresh_formal_correction_adapter_unavailable] 生鲜正式退款、损耗冲销金额与时间权威尚未接入，禁止形成正式 correction delta',
        );
      case 'water':
        throw new ConflictException(
          '[water_formal_correction_adapter_unavailable] 桶装水正式退款、回桶损耗冲销金额与时间权威尚未接入，禁止形成正式 correction delta',
        );
      case 'software':
        throw new ConflictException(
          '[software_formal_correction_adapter_unavailable] 软件退款、里程碑撤销金额与时间权威尚未接入，禁止形成正式 correction delta',
        );
    }
  }

  private assertSelectionMatchesAuthority(
    selection: ContributionSourceSelection,
    authority: ContributionSourceAuthorityVersion,
    mode: 'normal' | 'historical_reversal',
  ) {
    const allowedStatuses: Array<'approved' | 'superseded'> =
      mode === 'normal' ? ['approved'] : ['approved', 'superseded'];
    if (
      !allowedStatuses.includes(authority.status) ||
      authority.businessDomain !== selection.businessDomain ||
      authority.sourceSystem !== selection.sourceSystem.trim().toLowerCase() ||
      authority.sourceType !== selection.sourceType.trim().toLowerCase()
    ) {
      throw new ConflictException(
        '[source_authority_selection_mismatch] 来源选择与服务端适配器授权不一致',
      );
    }
  }

  private async resolveRepair(
    selection: ContributionSourceSelection,
    authority: ContributionSourceAuthorityVersion,
    manager: EntityManager,
    rbacContext?: VerifiedContributionRbacContextV1,
  ): Promise<VerifiedContributionAuthorityBundleV1> {
    if (selection.sourceSystem.trim().toLowerCase() !== 'stark_repair') {
      throw new ConflictException(
        '[repair_source_system_invalid] 汽修正式贡献只能从 Stark 汽修权威域读取',
      );
    }
    const match = /^work-order:(\d+)$/.exec(selection.sourceId.trim().toLowerCase());
    if (!match) {
      throw new ConflictException(
        '[repair_source_id_invalid] 汽修贡献来源必须使用 work-order:<id> 的正式工单引用',
      );
    }
    if (!Number.isSafeInteger(Number(match[1])) || Number(match[1]) <= 0) {
      throw new ConflictException('[repair_source_id_invalid] 汽修工单引用超出安全范围');
    }
    // Source is intentionally present but terminally disabled in this Gate.
    // Flipping this literal is forbidden: production enablement requires a
    // separate exact-head Gate, migration/UAT evidence and adapter-status sync.
    const repairFirstFormalSourceComposerEnabled = false as const;
    if (!repairFirstFormalSourceComposerEnabled) {
      throw new ConflictException(
        '[repair_contribution_authorities_incomplete] 汽修首个正式来源 composer 已实现但保持硬禁用，正式迁移/UAT 与生产启用尚未授权',
      );
    }

    if (!rbacContext) {
      throw new ConflictException(
        '[repair_formal_composer_rbac_context_missing] 缺少同连接事务当前 RBAC 证明，禁止读取维修权威图',
      );
    }

    return composeRepairFirstFormalSourceBundleV1(
      selection,
      authority,
      manager,
      rbacContext,
    );
  }
}
