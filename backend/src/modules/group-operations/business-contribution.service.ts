import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import {
  BusinessCompanyRef,
  BusinessScopeGrant,
  BusinessSector,
  BusinessStore,
  CompanySectorAssignment,
  CustomerMasterRecord,
  StoreSectorAssignment,
} from '../business-foundation/entities/business-foundation.entities';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { Employee } from '../performance/entities/employee.entity';
import { OperationLog } from '../operation-logs/entities/operation-log.entity';
import { Role } from '../roles/entities/role.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { User } from '../users/entities/user.entity';
import {
  BusinessContributionAccessPolicy,
  ContributionReadAccess,
  ContributionWritePermission,
} from './business-contribution.access-policy';
import {
  BusinessContributionAdapters,
  NormalizedContributionCorrection,
  NormalizedContributionDraft,
} from './business-contribution.adapters';
import {
  BusinessContributionSourceAuthorityResolver,
  ContributionCorrectionSelection,
  ContributionReversalSelection,
  ContributionSourceSelection,
  VerifiedContributionAuthorityBundleV1,
  VerifiedContributionRbacContextV1,
  VerifiedContributionSourceResolution,
  VerifiedContributionSourceSnapshot,
} from './business-contribution-source-authority';
import {
  ConfirmBusinessContributionDto,
  ContributionAttributionDto,
  CreateBusinessContributionCorrectionDto,
  CreateBusinessContributionDto,
  PublishContributionSourceAuthorityDto,
  QueryBusinessContributionsDto,
  QueryContributionAnomaliesDto,
  QueryContributionSourceAuthoritiesDto,
  ResolveBusinessContributionAnomalyDto,
  ReverseBusinessContributionDto,
} from './dto/business-contribution.dto';
import {
  BUSINESS_CONTRIBUTION_CORRECTION_REASON_BY_TYPE,
  BusinessContributionCorrection,
  BusinessContributionCorrectionReasonCode,
  BusinessContributionCorrectionType,
} from './entities/business-contribution-correction.entity';
import {
  BusinessContributionIdentityAllocation,
  BusinessContributionIdentityKind,
  BusinessContributionIdentityOwnerKind,
} from './entities/business-contribution-identity-allocation.entity';
import {
  BusinessContribution,
  BusinessContributionAnomaly,
  BusinessContributionAttribution,
  BusinessContributionEvidence,
  ContributionAnomalyType,
  ContributionSourceAuthorityVersion,
} from './entities/business-contribution.entities';
import {
  GroupMember,
  GroupTarget,
  LaborCostSnapshot,
  OrganizationGroup,
} from './entities/group-operations.entities';
import { GroupOperationsCalculator } from './group-operations.calculator';
import { GroupOperationsInvariants } from './group-operations.invariants';
import { RepairWorkOrderProfile } from '../repair-shop/entities/repair-shop.entities';

interface ContributionScope {
  companyRef: string;
  businessSectorRef: string | null;
  storeRef: string | null;
  customerRef: string | null;
}

interface CommandMetadata {
  reason: string;
  sourceChannel: string;
  correlationId: string;
  idempotencyKey: string;
}

interface ContributionPeriodLockInspection {
  groupTargetRowCount: number;
  laborCostSnapshotRowCount: number;
  lockedReasons: string[];
}

interface ReversalRecognitionDecision {
  recognitionPeriod: string;
  recognitionAt: string;
  authoritativeOccurredAt: string;
  deferredFromPeriod: string | null;
  skippedLockedPeriods: Array<{
    recognitionPeriod: string;
    lockedReasons: string[];
  }>;
}

interface CorrectionBalance {
  revenueDeltaCents: bigint;
  directCostDeltaCents: bigint;
  remainingRevenueCents: bigint;
  remainingDirectCostCents: bigint;
}

interface ContributionWritePreview {
  id: number;
  version: number;
  scope: ContributionScope;
}

interface LockedContributionActor {
  currentUser: CurrentUser;
  employeeId: number;
}

interface ContributionCreateScopeLocator {
  authority: ContributionSourceAuthorityVersion;
  scope: ContributionScope;
}

interface ContributionIdentityKey {
  identityKind: BusinessContributionIdentityKind;
  identityHash: string;
}

interface ContributionIdentityReservation extends ContributionIdentityKey {
  ownerKind: BusinessContributionIdentityOwnerKind;
  ownerId: number;
}

const CONTRIBUTION_ANOMALY_RULE_VERSION = 'gov1-s2-dedupe-v1';
const CONTRIBUTION_PERIOD_LOCK_GUARD_VERSION = 'gov1-s2-period-lock-v1';
const MAX_REVERSAL_PERIOD_SCAN_MONTHS = 24;

@Injectable()
export class BusinessContributionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly operationLogsService: OperationLogsService,
    private readonly sourceAuthorityResolver: BusinessContributionSourceAuthorityResolver,
  ) {}

  listAdapterContracts() {
    return BusinessContributionAdapters.listContracts();
  }

  async publishSourceAuthority(
    dto: PublishContributionSourceAuthorityDto,
    currentUser: CurrentUser,
  ) {
    this.assertCommandMetadata(dto);
    BusinessContributionAdapters.assertAuthorityContract(dto);
    const payload = this.authorityCommandPayload(dto);
    const replayPreview = await this.dataSource
      .getRepository(ContributionSourceAuthorityVersion)
      .findOne({ where: { idempotencyKey: dto.idempotencyKey.trim() } });
    const requestedScope = this.dtoScope(dto, null);
    const writeScope = replayPreview ? this.authorityScope(replayPreview) : requestedScope;
    return this.runMutation(async (manager) => {
      await this.assertWriteScope(
        currentUser,
        writeScope,
        'gov1.contribution.rule.write',
        manager,
      );
      const repo = manager.getRepository(ContributionSourceAuthorityVersion);
      const replay = await repo.findOne({
        where: { idempotencyKey: dto.idempotencyKey.trim() },
        lock: { mode: 'pessimistic_write' },
      });
      if (replay) {
        if (
          (replayPreview &&
            (replay.id !== replayPreview.id || replay.version !== replayPreview.version)) ||
          !this.scopesEqual(this.authorityScope(replay), writeScope)
        ) {
          throw new ConflictException(
            '[source_authority_replay_changed] 来源授权幂等记录在锁定期间发生身份或范围漂移',
          );
        }
        await this.assertAuthorityStructuralIntegrity(replay, manager);
        this.assertAuthorityReplayFingerprint(
          replay.requestFingerprint,
          payload,
          replay.version,
          '贡献来源授权发布',
        );
        return replay;
      }

      if (replayPreview) {
        throw new ConflictException(
          '[source_authority_replay_changed] 来源授权幂等记录在锁定期间消失',
        );
      }
      const scope = requestedScope;
      const effectiveFrom = BusinessContributionAdapters.normalizeDate(
        dto.effectiveFrom,
        'effectiveFrom',
      );
      const effectiveTo = dto.effectiveTo
        ? BusinessContributionAdapters.normalizeDate(dto.effectiveTo, 'effectiveTo')
        : null;
      await this.assertOrganizationScope(scope, new Date(`${effectiveFrom}T12:00:00.000Z`), manager);

      const authorityScopeKey = BusinessContributionAdapters.authorityScopeKey({
        companyRef: scope.companyRef,
        businessSectorRef: scope.businessSectorRef,
        storeRef: scope.storeRef,
        businessDomain: dto.businessDomain,
        sourceSystem: dto.sourceSystem,
        sourceType: dto.sourceType,
      });
      const existing = await repo.find({
        where: { authorityScopeKey },
        order: { version: 'ASC', id: 'ASC' },
      });
      this.assertAuthorityVersionSequence(existing);
      if (
        existing.some(
          (item) =>
            item.status === 'approved' &&
            this.dateRangesOverlap(
              effectiveFrom,
              effectiveTo,
              item.effectiveFrom,
              item.effectiveTo,
            ),
        )
      ) {
        throw new ConflictException(
          '[source_authority_period_overlap] 同一来源授权范围的批准版本生效区间不得重叠',
        );
      }
      if (await repo.findOne({ where: { ruleVersionId: dto.ruleVersionId.trim() } })) {
        throw new ConflictException('[source_authority_rule_version_duplicate] 来源授权规则版本已存在');
      }
      const version = existing.length + 1;
      const record = await repo.save(
        repo.create({
          ruleVersionId: payload.ruleVersionId,
          authorityScopeKey,
          companyRef: scope.companyRef,
          businessSectorRef: scope.businessSectorRef,
          storeRef: scope.storeRef,
          businessDomain: dto.businessDomain,
          sourceSystem: dto.sourceSystem.trim().toLowerCase(),
          sourceType: dto.sourceType.trim().toLowerCase(),
          adapterVersion: dto.adapterVersion.trim(),
          effectiveFrom,
          effectiveTo,
          currency: 'CNY',
          status: 'approved',
          version,
          changeReason: dto.reason.trim(),
          sourceChannel: dto.sourceChannel.trim(),
          correlationId: dto.correlationId.trim(),
          idempotencyKey: dto.idempotencyKey.trim(),
          requestFingerprint: GroupOperationsInvariants.payloadFingerprint({ ...payload, version }),
          createdBy: currentUser.id,
          approvedBy: currentUser.id,
        }),
      );
      await this.audit(record.id, 'business_contribution.authority.publish', currentUser, dto, manager, {
        ruleVersionId: record.ruleVersionId,
        authorityScopeKey: record.authorityScopeKey,
        businessDomain: record.businessDomain,
        sourceSystem: record.sourceSystem,
        sourceType: record.sourceType,
        version: record.version,
        authorityImmutableSnapshotHash: this.authorityImmutableSnapshotHash(record),
      });
      return record;
    });
  }

  async listSourceAuthorities(
    query: QueryContributionSourceAuthoritiesDto,
    currentUser: CurrentUser,
  ) {
    const qb = this.dataSource
      .getRepository(ContributionSourceAuthorityVersion)
      .createQueryBuilder('authority');
    if (query.companyRef) qb.andWhere('authority.company_ref = :companyRef', query);
    if (query.businessDomain) qb.andWhere('authority.business_domain = :businessDomain', query);
    if (query.status) qb.andWhere('authority.status = :status', query);
    await this.applyAuthorityReadScopeSql(qb, 'authority', currentUser);
    return qb.orderBy('authority.id', 'DESC').take(200).getMany();
  }

  async createContribution(dto: CreateBusinessContributionDto, currentUser: CurrentUser) {
    this.assertCommandMetadata(dto);
    const payload = this.createCommandPayload(dto);
    const permission = 'gov1.contribution.draft.write' as const;
    return this.runContributionMutation(async (manager) => {
      const actor = await this.lockCurrentWriteActor(currentUser, permission, manager);
      const repo = manager.getRepository(BusinessContribution);
      const replayLocator = await repo.findOne({
        where: { idempotencyKey: dto.idempotencyKey.trim() },
      });
      if (replayLocator) {
        const replayPreview = this.contributionWritePreview(replayLocator);
        await this.assertLockedActorScope(actor, replayPreview.scope, permission, manager);
        const replay = await this.loadContribution(replayPreview.id, manager, true);
        this.assertContributionMatchesPreview(replay, replayPreview);
        GroupOperationsInvariants.assertReplayFingerprint(
          replay.requestFingerprint,
          payload,
          '业务贡献草稿创建',
        );
        return this.loadContributionBundle(replay.id, manager);
      }

      const locator = await this.loadContributionCreateScopeLocator(dto, manager);
      const lockedCurrentUser = await this.assertLockedActorScope(
        actor,
        locator.scope,
        permission,
        manager,
      );
      const authority = dto.businessDomain === 'repair'
        ? locator.authority
        : await this.loadAuthorityForSelection(dto, manager);
      if (
        dto.businessDomain !== 'repair' &&
        this.authorityImmutableSnapshotHash(authority) !==
          this.authorityImmutableSnapshotHash(locator.authority)
      ) {
        throw new ConflictException(
          '[source_authority_locator_changed] 来源授权在范围校验后发生变化，请刷新后重试',
        );
      }
      const resolution = await this.sourceAuthorityResolver.resolve(
        this.selectionFromDto(dto),
        authority,
        manager,
        this.verifiedRbacContext(actor, permission, locator.scope, null),
      );
      const verifiedSource = this.sourceSnapshotOf(resolution);
      this.assertExpectedSourceSnapshot(dto, verifiedSource);
      const scope = this.verifiedSourceScope(verifiedSource);
      if (
        scope.companyRef !== locator.scope.companyRef ||
        scope.businessSectorRef !== locator.scope.businessSectorRef ||
        scope.storeRef !== locator.scope.storeRef ||
        (dto.businessDomain === 'repair' && scope.customerRef !== locator.scope.customerRef)
      ) {
        throw new ConflictException(
          '[source_authority_scope_changed] 来源权威范围与事务当前 RBAC 范围不一致',
        );
      }
      if (dto.businessDomain !== 'repair' && scope.customerRef !== locator.scope.customerRef) {
        await this.assertLockedActorScope(actor, scope, permission, manager);
      }
      const recognitionAt = new Date(
        BusinessContributionAdapters.normalizeInstant(
          verifiedSource.recognitionAt,
          'recognitionAt',
        ),
      );
      if (recognitionAt.getTime() > Date.now()) {
        throw new BadRequestException('[future_contribution_forbidden] 有效贡献确认时间不得晚于当前时间');
      }
      await this.assertOrganizationScope(scope, recognitionAt, manager);
      await this.assertCustomer(scope.customerRef, manager);
      const group = await this.resolveOperatingGroupFromResponsibility(
        verifiedSource.responsibilityEmployeeId,
        recognitionAt,
        scope,
        manager,
      );
      this.assertGroupScope(group, scope, recognitionAt);
      await this.assertDraftGroupResponsibility(lockedCurrentUser, group, manager);
      if (!this.isAuthorityBundle(resolution)) {
        this.assertAuthoritySnapshot(authority, verifiedSource, recognitionAt);
      }
      const normalized = BusinessContributionAdapters.normalizeVerifiedDraft(verifiedSource, {
        operatingGroupId: group.id,
        sourceAuthorityVersionId: authority.id,
        attributions: this.authoritativeAttributionsForResolution(
          resolution,
          dto.attributions,
          dto.businessDomain,
        ),
        reason: dto.reason,
        sourceChannel: dto.sourceChannel,
        correlationId: dto.correlationId,
      });

      if (await repo.findOne({ where: { uniqueSourceKey: normalized.uniqueSourceKey } })) {
        throw new ConflictException('[contribution_source_duplicate] 同一正式来源记录只能形成一笔贡献记录，变更版本不得绕过去重');
      }
      const evidenceKeys = [
        normalized.revenueEvidence.evidenceUniqueKey,
        ...normalized.directCosts.map((item) => item.evidenceUniqueKey),
      ];
      await this.assertEvidenceKeysUnused(evidenceKeys, manager);
      await this.assertIdentityKeysAvailable(
        [
          { identityKind: 'source', identityHash: normalized.uniqueSourceKey },
          ...evidenceKeys.map((identityHash) => ({
            identityKind: 'evidence' as const,
            identityHash,
          })),
        ],
        manager,
      );
      const attributionSnapshots = await this.resolveAttributionGroupSnapshots(
        normalized,
        recognitionAt,
        scope.companyRef,
        manager,
      );
      await this.lockSimilarityCluster(normalized.similarityClusterKey, currentUser.id, manager);
      const anomalyCandidates = await this.loadAnomalyCandidates(normalized, manager);

      const contribution = await repo.save(
        repo.create({
          businessDomain: dto.businessDomain,
          companyRef: scope.companyRef,
          businessSectorRef: scope.businessSectorRef,
          storeRef: scope.storeRef,
          operatingGroupId: group.id,
          responsibilityEmployeeIdSnapshot: verifiedSource.responsibilityEmployeeId,
          canonicalEconomicFactRootId: this.isAuthorityBundle(resolution)
            ? resolution.authorityPins.economicRootId
            : null,
          sourceAuthorityVersionId: authority.id,
          adapterVersion: normalized.contract.adapterVersion,
          sourceSystem: String(normalized.normalizedPayload.sourceSystem),
          sourceType: String(normalized.normalizedPayload.sourceType),
          sourceId: String(normalized.normalizedPayload.sourceId),
          sourceVersion: String(normalized.normalizedPayload.sourceVersion),
          sourceRecordHash: BusinessContributionAdapters.assertHash(
            verifiedSource.sourceRecordHash,
            'sourceRecordHash',
          ),
          uniqueSourceKey: normalized.uniqueSourceKey,
          similarityClusterKey: normalized.similarityClusterKey,
          economicFactKey: normalized.economicFactKey,
          authoritySnapshotHash: normalized.authoritySnapshotHash,
          recognitionPeriod: normalized.recognitionPeriod,
          recognitionAt,
          customerRef: scope.customerRef,
          revenueCents: normalized.revenueCents,
          directCostTotalCents: normalized.directCostTotalCents,
          validContributionMarginCents: normalized.validContributionMarginCents,
          currency: 'CNY',
          evidenceBundleHash: normalized.evidenceBundleHash,
          attributionShareTotalBps: 10_000,
          confirmationStatus: 'pending_confirmation',
          reversalOfContributionId: null,
          reversedByContributionId: null,
          changeReason: dto.reason.trim(),
          sourceChannel: dto.sourceChannel.trim(),
          correlationId: dto.correlationId.trim(),
          idempotencyKey: dto.idempotencyKey.trim(),
          requestFingerprint: GroupOperationsInvariants.payloadFingerprint(payload),
          confirmationIdempotencyKey: null,
          confirmationRequestFingerprint: null,
          confirmationEvidenceRef: null,
          confirmationEvidenceHash: null,
          reversalIdempotencyKey: null,
          reversalRequestFingerprint: null,
          version: 1,
          createdBy: currentUser.id,
          confirmedBy: null,
          confirmedAt: null,
        }),
      );
      const evidenceRepo = manager.getRepository(BusinessContributionEvidence);
      const savedEvidence = await evidenceRepo.save([
        evidenceRepo.create({
          contributionId: contribution.id,
          evidenceRole: 'revenue',
          costCategory: null,
          disposition: 'included',
          amountCents: normalized.revenueEvidence.amountCents,
          sourceSystem: normalized.revenueEvidence.sourceSystem,
          sourceType: normalized.revenueEvidence.sourceType,
          sourceId: normalized.revenueEvidence.sourceId,
          sourceVersion: normalized.revenueEvidence.sourceVersion,
          sourceAllocationId: normalized.revenueEvidence.sourceAllocationId,
          evidenceRef: normalized.revenueEvidence.evidenceRef,
          evidenceHash: normalized.revenueEvidence.evidenceHash,
          evidenceUniqueKey: normalized.revenueEvidence.evidenceUniqueKey,
          occurredAt: new Date(normalized.revenueEvidence.occurredAt),
          createdBy: currentUser.id,
        }),
        ...normalized.directCosts.map((item) =>
          evidenceRepo.create({
            contributionId: contribution.id,
            evidenceRole: 'direct_cost',
            costCategory: item.costCategory,
            disposition: item.disposition,
            amountCents: item.amountCents,
            sourceSystem: item.sourceSystem,
            sourceType: item.sourceType,
            sourceId: item.sourceId,
            sourceVersion: item.sourceVersion,
            sourceAllocationId: item.sourceAllocationId,
            evidenceRef: item.evidenceRef,
            evidenceHash: item.evidenceHash,
            evidenceUniqueKey: item.evidenceUniqueKey,
            occurredAt: new Date(item.occurredAt),
            createdBy: currentUser.id,
          }),
        ),
      ]);
      await this.reserveIdentityAllocations(
        [
          {
            identityKind: 'source',
            identityHash: normalized.uniqueSourceKey,
            ownerKind: 'contribution',
            ownerId: contribution.id,
          },
          ...savedEvidence.map((item) => ({
            identityKind: 'evidence' as const,
            identityHash: item.evidenceUniqueKey,
            ownerKind: 'contribution_evidence' as const,
            ownerId: item.id,
          })),
        ],
        manager,
      );
      const attributionRepo = manager.getRepository(BusinessContributionAttribution);
      const savedAttributions = await attributionRepo.save(
        normalized.attributions.map((item) =>
          attributionRepo.create({
            contributionId: contribution.id,
            role: item.role,
            originBusinessDomain: item.originBusinessDomain,
            employeeId: item.employeeId,
            employeeGroupIdSnapshot: attributionSnapshots.get(item.employeeId)!,
            shareBps: item.shareBps,
            evidenceRef: item.evidenceRef.trim(),
            evidenceHash: item.evidenceHash.trim().toLowerCase(),
            status: 'pending',
            createdBy: currentUser.id,
            confirmedBy: null,
            confirmedAt: null,
          }),
        ),
      );
      const draftAttributionSnapshotHash = this.attributionSnapshotHash(savedAttributions);
      const anomalies = await this.createAnomalies(
        contribution,
        anomalyCandidates,
        currentUser,
        manager,
      );
      await this.audit(contribution.id, 'business_contribution.draft.create', currentUser, dto, manager, {
        businessDomain: contribution.businessDomain,
        operatingGroupId: contribution.operatingGroupId,
          uniqueSourceKey: contribution.uniqueSourceKey,
          authoritySnapshotHash: contribution.authoritySnapshotHash,
          responsibilityEmployeeIdSnapshot: contribution.responsibilityEmployeeIdSnapshot,
          evidenceBundleHash: contribution.evidenceBundleHash,
          attributionSnapshotHash: draftAttributionSnapshotHash,
        validContributionMarginCents: contribution.validContributionMarginCents,
        openAnomalyCount: anomalies.length,
      });
      return this.loadContributionBundle(contribution.id, manager);
    });
  }

  async confirmContribution(
    contributionId: number,
    dto: ConfirmBusinessContributionDto,
    currentUser: CurrentUser,
  ) {
    this.assertCommandMetadata(dto);
    const payload = this.confirmCommandPayload(contributionId, dto);
    const permission = 'gov1.contribution.confirm' as const;
    return this.runContributionMutation(async (manager) => {
      const actor = await this.lockCurrentWriteActor(currentUser, permission, manager);
      const repo = manager.getRepository(BusinessContribution);
      const replayLocator = await repo.findOne({
        where: { confirmationIdempotencyKey: dto.idempotencyKey.trim() },
      });
      const targetLocator = replayLocator ?? await repo.findOne({ where: { id: contributionId } });
      if (!targetLocator) {
        throw new NotFoundException('[contribution_not_found] 未找到业务贡献记录');
      }
      const preview = this.contributionWritePreview(targetLocator);
      await this.assertLockedActorScope(actor, preview.scope, permission, manager);
      if (replayLocator) {
        const replay = await this.loadContribution(preview.id, manager, true);
        this.assertContributionMatchesPreview(replay, preview);
        GroupOperationsInvariants.assertReplayFingerprint(
          replay.confirmationRequestFingerprint ?? '',
          payload,
          '业务贡献确认',
        );
        return this.loadContributionBundle(replay.id, manager);
      }

      const authorityLocator = await this.loadAuthoritySelectionPreview(
        this.selectionFromContribution(targetLocator),
        targetLocator.sourceAuthorityVersionId,
        manager,
      );
      const authority = targetLocator.businessDomain === 'repair'
        ? authorityLocator
        : await this.loadAuthorityRecord(targetLocator.sourceAuthorityVersionId, manager);
      if (
        targetLocator.businessDomain !== 'repair' &&
        this.authorityImmutableSnapshotHash(authority) !==
          this.authorityImmutableSnapshotHash(authorityLocator)
      ) {
        throw new ConflictException(
          '[source_authority_locator_changed] 来源授权在范围校验后发生变化，请刷新后重试',
        );
      }
      const resolution = await this.sourceAuthorityResolver.resolve(
        this.selectionFromContribution(targetLocator),
        authority,
        manager,
        this.verifiedRbacContext(actor, permission, preview.scope, preview.id),
      );
      const verifiedSource = this.sourceSnapshotOf(resolution);

      const contribution = await this.loadContribution(preview.id, manager, true);
      this.assertContributionMatchesPreview(contribution, preview);
      const persistedAttributions = await manager
        .getRepository(BusinessContributionAttribution)
        .find({ where: { contributionId: contribution.id }, order: { id: 'ASC' } });
      if (!persistedAttributions.length) {
        throw new ConflictException('[contribution_attribution_missing] 贡献缺少可追溯归因');
      }
      await this.lockContributionMutationScope(
        contribution.operatingGroupId,
        persistedAttributions.map((item) => item.employeeGroupIdSnapshot),
        [
          contribution.responsibilityEmployeeIdSnapshot,
          ...persistedAttributions.map((item) => item.employeeId),
        ],
        manager,
        true,
      );
      if (contribution.reversalOfContributionId) {
        throw new BadRequestException('[reversal_confirmation_forbidden] 冲销记录在创建事务中直接确认');
      }
      if (contribution.confirmationStatus !== 'pending_confirmation') {
        throw new ConflictException('[contribution_not_pending] 只有待确认贡献可以确认');
      }
      if (contribution.version !== dto.expectedContributionVersion) {
        throw new ConflictException('[contribution_version_mismatch] 贡献版本已变化，请刷新后重试');
      }
      this.assertDraftAttributionLifecycle(persistedAttributions);
      const confirmationAttributionSnapshotHash = this.attributionSnapshotHash(
        persistedAttributions,
      );
      await this.assertAttributionAuditAnchor(
        contribution.id,
        'business_contribution.draft.create',
        confirmationAttributionSnapshotHash,
        manager,
      );
      const openAnomalies = await manager.getRepository(BusinessContributionAnomaly).find({
        where: [
          { contributionId: contribution.id, status: 'open' },
          { candidateContributionId: contribution.id, status: 'open' },
        ],
        order: { id: 'ASC' },
      });
      if (openAnomalies.length) {
        throw new ConflictException(
          '[contribution_anomaly_open] 贡献存在未解决的重复或拆单风险，禁止确认进入经营成绩',
        );
      }
      this.assertPersistedSourceSnapshot(contribution, verifiedSource);
      if (verifiedSource.responsibilityEmployeeId !== contribution.responsibilityEmployeeIdSnapshot) {
        throw new ConflictException(
          '[contribution_authority_changed] 来源责任员工已漂移，禁止在旧草稿确认时取得新小组锁',
        );
      }
      const verifiedScope = this.verifiedSourceScope(verifiedSource);
      const verifiedRecognitionAt = new Date(
        BusinessContributionAdapters.normalizeInstant(
          verifiedSource.recognitionAt,
          'recognitionAt',
        ),
      );
      const verifiedGroup = await this.resolveOperatingGroupFromResponsibility(
        verifiedSource.responsibilityEmployeeId,
        verifiedRecognitionAt,
        verifiedScope,
        manager,
        contribution.operatingGroupId,
      );
      if (!this.isAuthorityBundle(resolution)) {
        this.assertAuthoritySnapshot(authority, verifiedSource, verifiedRecognitionAt);
      }
      const authoritativeAttributions = this.authoritativeAttributionsForResolution(
        resolution,
        persistedAttributions.map((item) => ({
          role: item.role,
          originBusinessDomain: item.originBusinessDomain,
          employeeId: item.employeeId,
          shareBps: item.shareBps,
          evidenceRef: item.evidenceRef,
          evidenceHash: item.evidenceHash,
        })),
        contribution.businessDomain,
      );
      if (this.isAuthorityBundle(resolution)) {
        this.assertPersistedAttributionsMatchAuthority(
          persistedAttributions,
          authoritativeAttributions,
        );
        if (contribution.canonicalEconomicFactRootId !== resolution.authorityPins.economicRootId) {
          throw new ConflictException(
            '[contribution_economic_root_changed] 草稿绑定的维修经济根与当前权威 bundle 不一致',
          );
        }
      }
      const recomputed = BusinessContributionAdapters.normalizeVerifiedDraft(verifiedSource, {
        operatingGroupId: verifiedGroup.id,
        sourceAuthorityVersionId: authority.id,
        attributions: authoritativeAttributions,
        reason: contribution.changeReason,
        sourceChannel: contribution.sourceChannel,
        correlationId: contribution.correlationId,
      });
      await this.resolveAttributionGroupSnapshots(
        recomputed,
        verifiedRecognitionAt,
        verifiedScope.companyRef,
        manager,
        new Map(
          persistedAttributions.map((item) => [item.employeeId, item.employeeGroupIdSnapshot]),
        ),
      );
      if (
        recomputed.authoritySnapshotHash !== contribution.authoritySnapshotHash ||
        recomputed.evidenceBundleHash !== contribution.evidenceBundleHash ||
        recomputed.evidenceBundleHash !== dto.expectedEvidenceBundleHash.trim().toLowerCase()
      ) {
        throw new ConflictException('[contribution_evidence_changed] 服务端来源权威快照或贡献证据包哈希不一致');
      }
      if (
        verifiedGroup.id !== contribution.operatingGroupId ||
        verifiedSource.responsibilityEmployeeId !== contribution.responsibilityEmployeeIdSnapshot ||
        recomputed.uniqueSourceKey !== contribution.uniqueSourceKey ||
        recomputed.similarityClusterKey !== contribution.similarityClusterKey ||
        recomputed.economicFactKey !== contribution.economicFactKey ||
        recomputed.recognitionPeriod !== contribution.recognitionPeriod ||
        verifiedRecognitionAt.getTime() !== contribution.recognitionAt.getTime() ||
        recomputed.revenueCents !== contribution.revenueCents ||
        recomputed.directCostTotalCents !== contribution.directCostTotalCents ||
        recomputed.validContributionMarginCents !== contribution.validContributionMarginCents
      ) {
        throw new ConflictException('[contribution_authority_changed] 来源责任、小组、事实身份或金额已变化，禁止确认旧草稿');
      }
      const confirmationPeriodInspection = await this.assertContributionPeriodOpen(
        contribution.operatingGroupId,
        recomputed.recognitionPeriod,
        persistedAttributions.map((item) => item.employeeId),
        manager,
      );

      contribution.confirmationStatus = 'confirmed';
      contribution.confirmationIdempotencyKey = dto.idempotencyKey.trim();
      contribution.confirmationRequestFingerprint = GroupOperationsInvariants.payloadFingerprint(payload);
      contribution.confirmationEvidenceRef = BusinessContributionAdapters.assertSafeEvidenceRef(
        dto.confirmationEvidenceRef,
        'confirmationEvidenceRef',
      );
      contribution.confirmationEvidenceHash = BusinessContributionAdapters.assertHash(
        dto.confirmationEvidenceHash,
        'confirmationEvidenceHash',
      );
      contribution.confirmedBy = currentUser.id;
      contribution.confirmedAt = new Date();
      contribution.version += 1;
      await repo.save(contribution);
      await manager.getRepository(BusinessContributionAttribution).update(
        { contributionId: contribution.id },
        {
          status: 'confirmed',
          confirmedBy: currentUser.id,
          confirmedAt: contribution.confirmedAt,
        },
      );
      await this.audit(contribution.id, 'business_contribution.confirm', currentUser, dto, manager, {
        evidenceBundleHash: contribution.evidenceBundleHash,
        revenueCents: contribution.revenueCents,
        directCostTotalCents: contribution.directCostTotalCents,
        validContributionMarginCents: contribution.validContributionMarginCents,
        confirmationEvidenceHash: contribution.confirmationEvidenceHash,
        attributionSnapshotHash: confirmationAttributionSnapshotHash,
        recognitionPeriod: contribution.recognitionPeriod,
        periodLockGuardVersion: CONTRIBUTION_PERIOD_LOCK_GUARD_VERSION,
        groupTargetRowCount: confirmationPeriodInspection.groupTargetRowCount,
        laborCostSnapshotRowCount: confirmationPeriodInspection.laborCostSnapshotRowCount,
      });
      return this.loadContributionBundle(contribution.id, manager);
    });
  }

  async reverseContribution(
    contributionId: number,
    dto: ReverseBusinessContributionDto,
    currentUser: CurrentUser,
  ) {
    this.assertCommandMetadata(dto);
    const payload = this.reverseCommandPayload(contributionId, dto);
    const replayPreviewRecord = await this.dataSource.getRepository(BusinessContribution).findOne({
      where: { reversalIdempotencyKey: dto.idempotencyKey.trim() },
    });
    const preview = replayPreviewRecord
      ? this.contributionWritePreview(replayPreviewRecord)
      : await this.loadContributionWritePreview(contributionId);
    return this.runMutation(async (manager) => {
      await this.assertWriteScope(
        currentUser,
        preview.scope,
        'gov1.contribution.reverse',
        manager,
      );
      const repo = manager.getRepository(BusinessContribution);
      const original = await this.loadContribution(preview.id, manager, true);
      this.assertContributionMatchesPreview(original, preview);
      if (original.reversalIdempotencyKey === dto.idempotencyKey.trim()) {
        GroupOperationsInvariants.assertReplayFingerprint(
          original.reversalRequestFingerprint ?? '',
          payload,
          '业务贡献冲销',
        );
        if (!original.reversedByContributionId) {
          throw new ConflictException('[reversal_replay_incomplete] 冲销幂等记录缺少冲销结果');
        }
        return this.loadContributionBundle(original.reversedByContributionId, manager);
      }
      const originalAttributions = await manager
        .getRepository(BusinessContributionAttribution)
        .find({ where: { contributionId: original.id }, order: { id: 'ASC' } });
      if (!originalAttributions.length) {
        throw new ConflictException('[reversal_attribution_missing] 原贡献缺少可追溯归因');
      }
      await this.lockContributionMutationScope(
        original.operatingGroupId,
        originalAttributions.map((item) => item.employeeGroupIdSnapshot),
        [
          original.responsibilityEmployeeIdSnapshot,
          ...originalAttributions.map((item) => item.employeeId),
        ],
        manager,
        false,
      );
      if (original.reversalOfContributionId) {
        throw new BadRequestException('[nested_reversal_forbidden] 冲销记录不得再次冲销');
      }
      if (original.confirmationStatus !== 'confirmed' || original.reversedByContributionId) {
        throw new ConflictException('[contribution_not_reversible] 只有未冲销的已确认贡献可以冲销');
      }
      if (original.version !== dto.expectedContributionVersion) {
        throw new ConflictException('[contribution_version_mismatch] 贡献版本已变化，请刷新后重试');
      }
      const existingCorrection = await manager
        .getRepository(BusinessContributionCorrection)
        .findOne({
          where: { originalContributionId: original.id },
          order: { sequence: 'ASC', id: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        });
      if (existingCorrection) {
        throw new ConflictException(
          '[full_reversal_after_correction_forbidden] 原贡献已有 append-only correction，禁止再执行旧式完整冲销',
        );
      }
      this.assertConfirmedAttributionLifecycle(original, originalAttributions);
      const originalAttributionSnapshotHash = this.attributionSnapshotHash(originalAttributions);
      await this.assertAttributionAuditAnchor(
        original.id,
        'business_contribution.confirm',
        originalAttributionSnapshotHash,
        manager,
      );
      const authority = await this.loadHistoricalReversalAuthority(
        original.sourceAuthorityVersionId,
        manager,
      );
      this.assertHistoricalReversalAuthority(original, authority);
      await this.assertAuthorityPublishAnchor(authority, manager);
      const verifiedReversal = await this.sourceAuthorityResolver.resolveReversal(
        this.reversalSelectionFromContribution(original, originalAttributionSnapshotHash),
        authority,
        manager,
      );
      const normalizedReversal = BusinessContributionAdapters.normalizeVerifiedReversal(
        verifiedReversal,
        {
          sourceAuthorityVersionId: authority.id,
          sourceAuthorityRuleVersionId: authority.ruleVersionId,
          adapterVersion: authority.adapterVersion,
          originalContributionId: original.id,
          businessDomain: original.businessDomain,
          companyRef: original.companyRef,
          businessSectorRef: original.businessSectorRef,
          storeRef: original.storeRef,
          customerRef: original.customerRef,
          operatingGroupId: original.operatingGroupId,
          sourceSystem: original.sourceSystem,
          sourceType: original.sourceType,
          sourceId: original.sourceId,
          sourceVersion: original.sourceVersion,
          sourceRecordHash: original.sourceRecordHash,
          uniqueSourceKey: original.uniqueSourceKey,
          economicFactKey: original.economicFactKey,
          similarityClusterKey: original.similarityClusterKey,
          originalRecognitionAt: original.recognitionAt.toISOString(),
          originalAttributionSnapshotHash,
          originalEvidenceBundleHash: original.evidenceBundleHash,
          originalAuthoritySnapshotHash: original.authoritySnapshotHash,
          originalRevenueCents: original.revenueCents,
          originalDirectCostTotalCents: original.directCostTotalCents,
          originalValidContributionMarginCents: original.validContributionMarginCents,
          originalAttributionShareTotalBps: original.attributionShareTotalBps,
          originalConfirmationEvidenceHash: original.confirmationEvidenceHash ?? '',
          originalConfirmedAt: original.confirmedAt?.toISOString() ?? '',
          originalConfirmedVersion: original.version,
          originalConfirmedBy: original.confirmedBy ?? 0,
          currency: original.currency,
        },
      );
      if (new Date(normalizedReversal.occurredAt).getTime() > Date.now()) {
        throw new BadRequestException(
          '[future_reversal_forbidden] 正式冲销发生时间不得晚于当前时间',
        );
      }
      if (await repo.findOne({ where: { uniqueSourceKey: normalizedReversal.uniqueSourceKey } })) {
        throw new ConflictException('[reversal_source_duplicate] 同一冲销来源版本已使用');
      }
      await this.assertEvidenceKeysUnused([normalizedReversal.evidenceUniqueKey], manager);
      await this.assertIdentityKeysAvailable(
        [
          { identityKind: 'source', identityHash: normalizedReversal.uniqueSourceKey },
          { identityKind: 'evidence', identityHash: normalizedReversal.evidenceUniqueKey },
        ],
        manager,
      );

      const recognitionDecision = await this.resolveReversalRecognition(
        original.operatingGroupId,
        originalAttributions.map((item) => item.employeeId),
        normalizedReversal.occurredAt,
        manager,
      );
      const reversalBundleHash = BusinessContributionAdapters.reversalEvidenceBundleHash(
        normalizedReversal,
        recognitionDecision.recognitionPeriod,
        recognitionDecision.recognitionAt,
      );
      const recognitionAt = new Date(recognitionDecision.recognitionAt);
      const now = new Date();
      const reversal = await repo.save(
        repo.create({
          businessDomain: original.businessDomain,
          companyRef: original.companyRef,
          businessSectorRef: original.businessSectorRef,
          storeRef: original.storeRef,
          operatingGroupId: original.operatingGroupId,
          responsibilityEmployeeIdSnapshot: original.responsibilityEmployeeIdSnapshot,
          sourceAuthorityVersionId: original.sourceAuthorityVersionId,
          adapterVersion: original.adapterVersion,
          sourceSystem: normalizedReversal.sourceSystem,
          sourceType: normalizedReversal.sourceType,
          sourceId: normalizedReversal.sourceId,
          sourceVersion: normalizedReversal.sourceVersion,
          sourceRecordHash: normalizedReversal.sourceRecordHash,
          uniqueSourceKey: normalizedReversal.uniqueSourceKey,
          similarityClusterKey: original.similarityClusterKey,
          economicFactKey: original.economicFactKey,
          authoritySnapshotHash: normalizedReversal.authoritySnapshotHash,
          recognitionPeriod: recognitionDecision.recognitionPeriod,
          recognitionAt,
          customerRef: original.customerRef,
          revenueCents: (-BigInt(original.revenueCents)).toString(),
          directCostTotalCents: (-BigInt(original.directCostTotalCents)).toString(),
          validContributionMarginCents: (-BigInt(original.validContributionMarginCents)).toString(),
          currency: original.currency,
          evidenceBundleHash: reversalBundleHash,
          attributionShareTotalBps: original.attributionShareTotalBps,
          confirmationStatus: 'confirmed',
          reversalOfContributionId: original.id,
          reversedByContributionId: null,
          changeReason: dto.reason.trim(),
          sourceChannel: dto.sourceChannel.trim(),
          correlationId: dto.correlationId.trim(),
          idempotencyKey: dto.idempotencyKey.trim(),
          requestFingerprint: GroupOperationsInvariants.payloadFingerprint(payload),
          confirmationIdempotencyKey: null,
          confirmationRequestFingerprint: null,
          confirmationEvidenceRef: normalizedReversal.evidenceRef,
          confirmationEvidenceHash: normalizedReversal.evidenceHash,
          reversalIdempotencyKey: null,
          reversalRequestFingerprint: null,
          version: 1,
          createdBy: currentUser.id,
          confirmedBy: currentUser.id,
          confirmedAt: now,
        }),
      );
      const evidenceRepo = manager.getRepository(BusinessContributionEvidence);
      const reversalEvidence = await evidenceRepo.save(
        evidenceRepo.create({
          contributionId: reversal.id,
          evidenceRole: 'reversal',
          costCategory: null,
          disposition: 'included',
          amountCents: reversal.validContributionMarginCents,
          sourceSystem: normalizedReversal.sourceSystem,
          sourceType: normalizedReversal.sourceType,
          sourceId: normalizedReversal.sourceId,
          sourceVersion: normalizedReversal.sourceVersion,
          sourceAllocationId: normalizedReversal.sourceAllocationId,
          evidenceRef: normalizedReversal.evidenceRef,
          evidenceHash: normalizedReversal.evidenceHash,
          evidenceUniqueKey: normalizedReversal.evidenceUniqueKey,
          occurredAt: new Date(normalizedReversal.occurredAt),
          createdBy: currentUser.id,
        }),
      );
      await this.reserveIdentityAllocations(
        [
          {
            identityKind: 'source',
            identityHash: normalizedReversal.uniqueSourceKey,
            ownerKind: 'contribution',
            ownerId: reversal.id,
          },
          {
            identityKind: 'evidence',
            identityHash: normalizedReversal.evidenceUniqueKey,
            ownerKind: 'contribution_evidence',
            ownerId: reversalEvidence.id,
          },
        ],
        manager,
      );
      const attributionRepo = manager.getRepository(BusinessContributionAttribution);
      await attributionRepo.save(
        originalAttributions.map((item) =>
          attributionRepo.create({
            contributionId: reversal.id,
            role: item.role,
            originBusinessDomain: item.originBusinessDomain,
            employeeId: item.employeeId,
            employeeGroupIdSnapshot: item.employeeGroupIdSnapshot,
            shareBps: item.shareBps,
            evidenceRef: item.evidenceRef,
            evidenceHash: item.evidenceHash,
            status: 'confirmed',
            createdBy: currentUser.id,
            confirmedBy: currentUser.id,
            confirmedAt: now,
          }),
        ),
      );
      await attributionRepo.update(
        { contributionId: original.id },
        { status: 'reversed' },
      );
      original.confirmationStatus = 'reversed';
      original.reversedByContributionId = reversal.id;
      original.reversalIdempotencyKey = dto.idempotencyKey.trim();
      original.reversalRequestFingerprint = GroupOperationsInvariants.payloadFingerprint(payload);
      original.version += 1;
      await repo.save(original);
      await this.audit(original.id, 'business_contribution.reverse', currentUser, dto, manager, {
        reversalContributionId: reversal.id,
        originalMarginCents: original.validContributionMarginCents,
        reversalMarginCents: reversal.validContributionMarginCents,
        reversalAuthoritySnapshotHash: normalizedReversal.authoritySnapshotHash,
        reversalSourceSystem: normalizedReversal.sourceSystem,
        reversalSourceType: normalizedReversal.sourceType,
        reversalSourceId: normalizedReversal.sourceId,
        reversalSourceVersion: normalizedReversal.sourceVersion,
        reversalSourceRecordHash: normalizedReversal.sourceRecordHash,
        reversalEvidenceHash: normalizedReversal.evidenceHash,
        authoritativeOccurredAt: recognitionDecision.authoritativeOccurredAt,
        recognitionPeriod: recognitionDecision.recognitionPeriod,
        recognitionAt: recognitionDecision.recognitionAt,
        deferredFromPeriod: recognitionDecision.deferredFromPeriod,
        skippedLockedPeriods: recognitionDecision.skippedLockedPeriods,
        periodLockGuardVersion: CONTRIBUTION_PERIOD_LOCK_GUARD_VERSION,
      });
      await this.audit(reversal.id, 'business_contribution.reversal.create', currentUser, dto, manager, {
        reversalOfContributionId: original.id,
        evidenceBundleHash: reversal.evidenceBundleHash,
        authoritySnapshotHash: reversal.authoritySnapshotHash,
        authoritativeOccurredAt: recognitionDecision.authoritativeOccurredAt,
        recognitionPeriod: recognitionDecision.recognitionPeriod,
        recognitionAt: recognitionDecision.recognitionAt,
        periodLockGuardVersion: CONTRIBUTION_PERIOD_LOCK_GUARD_VERSION,
      });
      return this.loadContributionBundle(reversal.id, manager);
    });
  }

  async createCorrection(
    contributionId: number,
    dto: CreateBusinessContributionCorrectionDto,
    currentUser: CurrentUser,
  ) {
    this.assertCommandMetadata(dto);
    const reasonCode = this.assertCorrectionReasonCode(dto.reason, dto.correctionType);
    const payload = this.correctionCommandPayload(contributionId, {
      ...dto,
      reason: reasonCode,
    });
    const replayPreview = await this.dataSource
      .getRepository(BusinessContributionCorrection)
      .findOne({ where: { idempotencyKey: dto.idempotencyKey.trim() } });
    const preview = await this.loadContributionWritePreview(
      replayPreview?.originalContributionId ?? contributionId,
    );
    return this.runMutation(async (manager) => {
      await this.assertWriteScope(
        currentUser,
        preview.scope,
        'gov1.contribution.reverse',
        manager,
      );
      const original = await this.loadContribution(preview.id, manager, true);
      this.assertContributionMatchesPreview(original, preview);
      const correctionRepo = manager.getRepository(BusinessContributionCorrection);
      const lockedReplay = await correctionRepo.findOne({
        where: { idempotencyKey: dto.idempotencyKey.trim() },
        lock: { mode: 'pessimistic_write' },
      });
      if (lockedReplay) {
        if (lockedReplay.originalContributionId !== original.id) {
          throw new ConflictException(
            '[correction_replay_changed] append-only correction replay 在锁定期间发生不可接受的身份漂移',
          );
        }
        GroupOperationsInvariants.assertReplayFingerprint(
          lockedReplay.requestFingerprint,
          payload,
          '业务贡献更正',
        );
        return this.loadCorrectionResult(lockedReplay, manager);
      }
      if (replayPreview || original.id !== contributionId) {
        throw new ConflictException(
          '[correction_replay_changed] append-only correction replay 在锁定期间消失或改绑',
        );
      }
      const originalAttributions = await manager
        .getRepository(BusinessContributionAttribution)
        .find({ where: { contributionId: original.id }, order: { id: 'ASC' } });
      if (!originalAttributions.length) {
        throw new ConflictException('[correction_attribution_missing] 原贡献缺少可追溯归因');
      }
      await this.lockContributionMutationScope(
        original.operatingGroupId,
        originalAttributions.map((item) => item.employeeGroupIdSnapshot),
        [
          original.responsibilityEmployeeIdSnapshot,
          ...originalAttributions.map((item) => item.employeeId),
        ],
        manager,
        false,
      );
      if (original.reversalOfContributionId) {
        throw new BadRequestException('[correction_on_reversal_forbidden] 冲销记录不得追加更正');
      }
      if (original.confirmationStatus !== 'confirmed' || original.reversedByContributionId) {
        throw new ConflictException(
          '[contribution_not_correctable] 只有未完整冲销的已确认原贡献可以追加更正',
        );
      }
      if (original.version !== dto.expectedContributionVersion) {
        throw new ConflictException('[contribution_version_mismatch] 贡献版本已变化，请刷新后重试');
      }
      this.assertConfirmedAttributionLifecycle(original, originalAttributions);
      const originalAttributionSnapshotHash = this.attributionSnapshotHash(originalAttributions);
      await this.assertAttributionAuditAnchor(
        original.id,
        'business_contribution.confirm',
        originalAttributionSnapshotHash,
        manager,
      );

      const existingCorrections = await this.loadCorrectionRowsForUpdate(original.id, manager);
      this.assertCorrectionSequence(existingCorrections);
      this.assertCorrectionTypeCompatibility(existingCorrections, dto.correctionType);

      const authority = await this.loadAuthorityRecord(dto.sourceAuthorityVersionId, manager);
      this.assertCorrectionAuthoritySelection(original, dto, authority);
      await this.assertAuthorityPublishAnchor(authority, manager);
      const verifiedCorrection = await this.sourceAuthorityResolver.resolveCorrection(
        this.correctionSelectionFromDto(
          original,
          originalAttributionSnapshotHash,
          dto,
        ),
        authority,
        manager,
      );
      const normalizedCorrection = BusinessContributionAdapters.normalizeVerifiedCorrection(
        verifiedCorrection,
        {
          sourceAuthorityVersionId: authority.id,
          sourceAuthorityRuleVersionId: authority.ruleVersionId,
          adapterVersion: authority.adapterVersion,
          originalContributionId: original.id,
          correctionType: dto.correctionType,
          businessDomain: original.businessDomain,
          companyRef: original.companyRef,
          businessSectorRef: original.businessSectorRef,
          storeRef: original.storeRef,
          customerRef: original.customerRef,
          operatingGroupId: original.operatingGroupId,
          selectedSourceSystem: dto.sourceSystem,
          selectedSourceType: dto.sourceType,
          selectedSourceId: dto.sourceId,
          selectedSourceVersion: dto.sourceVersion,
          selectedSourceRecordHash: dto.sourceRecordHash,
          originalUniqueSourceKey: original.uniqueSourceKey,
          originalEconomicFactKey: original.economicFactKey,
          originalAttributionSnapshotHash,
          originalAuthoritySnapshotHash: original.authoritySnapshotHash,
          originalEvidenceBundleHash: original.evidenceBundleHash,
          originalRecognitionAt: original.recognitionAt.toISOString(),
          originalConfirmedAt: original.confirmedAt?.toISOString() ?? '',
          currency: original.currency,
        },
      );
      if (new Date(normalizedCorrection.occurredAt).getTime() > Date.now()) {
        throw new BadRequestException(
          '[future_correction_forbidden] 正式更正发生时间不得晚于当前时间',
        );
      }
      this.assertCorrectionAuthorityAt(authority, original, normalizedCorrection.occurredAt);
      await this.assertCorrectionSourceAndEvidenceUnused(normalizedCorrection, manager);
      await this.assertIdentityKeysAvailable(
        [
          { identityKind: 'source', identityHash: normalizedCorrection.uniqueSourceKey },
          { identityKind: 'evidence', identityHash: normalizedCorrection.evidenceUniqueKey },
        ],
        manager,
      );
      const balance = this.assertCorrectionBalance(
        original,
        existingCorrections,
        normalizedCorrection,
      );
      const recognitionDecision = await this.resolveReversalRecognition(
        original.operatingGroupId,
        originalAttributions.map((item) => item.employeeId),
        normalizedCorrection.occurredAt,
        manager,
      );
      const sequence = existingCorrections.length + 1;
      const correction = await correctionRepo.save(
        correctionRepo.create({
          originalContributionId: original.id,
          correctionType: normalizedCorrection.correctionType,
          sequence,
          revenueDeltaCents: normalizedCorrection.revenueDeltaCents,
          directCostDeltaCents: normalizedCorrection.directCostDeltaCents,
          marginDeltaCents: normalizedCorrection.marginDeltaCents,
          businessDomain: original.businessDomain,
          companyRef: original.companyRef,
          businessSectorRef: original.businessSectorRef,
          storeRef: original.storeRef,
          customerRef: original.customerRef,
          operatingGroupId: original.operatingGroupId,
          sourceAuthorityVersionId: authority.id,
          adapterVersion: authority.adapterVersion,
          sourceSystem: normalizedCorrection.sourceSystem,
          sourceType: normalizedCorrection.sourceType,
          sourceId: normalizedCorrection.sourceId,
          sourceVersion: normalizedCorrection.sourceVersion,
          sourceRecordHash: normalizedCorrection.sourceRecordHash,
          sourceAllocationId: normalizedCorrection.sourceAllocationId,
          uniqueSourceKey: normalizedCorrection.uniqueSourceKey,
          evidenceUniqueKey: normalizedCorrection.evidenceUniqueKey,
          economicFactKey: normalizedCorrection.economicFactKey,
          authoritySnapshotHash: normalizedCorrection.authoritySnapshotHash,
          evidenceHash: normalizedCorrection.evidenceHash,
          evidenceRef: normalizedCorrection.evidenceRef,
          attributionSnapshotHash: normalizedCorrection.attributionSnapshotHash,
          occurredAt: new Date(normalizedCorrection.occurredAt),
          recognitionPeriod: recognitionDecision.recognitionPeriod,
          recognitionAt: new Date(recognitionDecision.recognitionAt),
          currency: original.currency,
          idempotencyKey: dto.idempotencyKey.trim(),
          requestFingerprint: GroupOperationsInvariants.payloadFingerprint(payload),
          createdBy: currentUser.id,
          reason: reasonCode,
          sourceChannel: dto.sourceChannel.trim(),
          correlationId: dto.correlationId.trim(),
        }),
      );
      await this.reserveIdentityAllocations(
        [
          {
            identityKind: 'source',
            identityHash: normalizedCorrection.uniqueSourceKey,
            ownerKind: 'correction',
            ownerId: correction.id,
          },
          {
            identityKind: 'evidence',
            identityHash: normalizedCorrection.evidenceUniqueKey,
            ownerKind: 'correction',
            ownerId: correction.id,
          },
        ],
        manager,
      );
      await this.audit(
        original.id,
        'business_contribution.correction.create',
        currentUser,
        { ...dto, reason: reasonCode },
        manager,
        {
          correctionId: correction.id,
          correctionType: correction.correctionType,
          sequence,
          revenueDeltaCents: correction.revenueDeltaCents,
          directCostDeltaCents: correction.directCostDeltaCents,
          marginDeltaCents: correction.marginDeltaCents,
          remainingRevenueCents: balance.remainingRevenueCents.toString(),
          remainingDirectCostCents: balance.remainingDirectCostCents.toString(),
          authoritySnapshotHash: correction.authoritySnapshotHash,
          evidenceHash: correction.evidenceHash,
          economicFactKey: correction.economicFactKey,
          attributionSnapshotHash: correction.attributionSnapshotHash,
          authoritativeOccurredAt: recognitionDecision.authoritativeOccurredAt,
          recognitionPeriod: recognitionDecision.recognitionPeriod,
          recognitionAt: recognitionDecision.recognitionAt,
          deferredFromPeriod: recognitionDecision.deferredFromPeriod,
          skippedLockedPeriods: recognitionDecision.skippedLockedPeriods,
          periodLockGuardVersion: CONTRIBUTION_PERIOD_LOCK_GUARD_VERSION,
        },
      );
      return this.loadCorrectionResult(correction, manager);
    });
  }

  async listContributions(query: QueryBusinessContributionsDto, currentUser: CurrentUser) {
    const qb = this.dataSource.getRepository(BusinessContribution).createQueryBuilder('contribution');
    if (query.operatingGroupId) qb.andWhere('contribution.operating_group_id = :operatingGroupId', query);
    if (query.recognitionPeriod) qb.andWhere('contribution.recognition_period = :recognitionPeriod', query);
    if (query.businessDomain) qb.andWhere('contribution.business_domain = :businessDomain', query);
    if (query.confirmationStatus) qb.andWhere('contribution.confirmation_status = :confirmationStatus', query);
    if (query.beforeId) qb.andWhere('contribution.id < :beforeId', { beforeId: query.beforeId });
    await this.applyContributionReadScopeSql(qb, 'contribution', currentUser, true);
    const records = await qb
      .orderBy('contribution.id', 'DESC')
      .take(query.limit ?? 100)
      .getMany();
    const visible: Array<Record<string, unknown> | BusinessContribution> = [];
    for (const record of records) {
      const access = await this.resolveContributionReadAccess(record, currentUser);
      if (access !== 'none') visible.push(this.projectContributionRecord(record, access));
    }
    return visible;
  }

  async getContribution(contributionId: number, currentUser: CurrentUser) {
    const contribution = await this.loadContribution(contributionId);
    const access = await this.resolveContributionReadAccess(contribution, currentUser);
    if (access === 'none') {
      throw new ForbiddenException('[contribution_scope_denied] 当前用户无权查看该贡献记录');
    }
    return this.loadContributionBundle(contribution.id, this.dataSource.manager, currentUser, access);
  }

  async listAnomalies(query: QueryContributionAnomaliesDto, currentUser: CurrentUser) {
    const qb = this.dataSource
      .getRepository(BusinessContributionAnomaly)
      .createQueryBuilder('anomaly')
      .innerJoin(BusinessContribution, 'leftContribution', 'leftContribution.id = anomaly.contribution_id')
      .innerJoin(BusinessContribution, 'rightContribution', 'rightContribution.id = anomaly.candidate_contribution_id');
    if (query.contributionId) {
      qb.andWhere(
        '(anomaly.contribution_id = :contributionId OR anomaly.candidate_contribution_id = :contributionId)',
        { contributionId: query.contributionId },
      );
    }
    if (query.anomalyType) qb.andWhere('anomaly.anomaly_type = :anomalyType', query);
    if (query.status) qb.andWhere('anomaly.status = :status', query);
    if (query.beforeId) qb.andWhere('anomaly.id < :beforeId', { beforeId: query.beforeId });
    // Anomaly pairs expose both parties. Attribution-only L0 access is not
    // sufficient; each side must pass a full row-scope or leader/owner check.
    await this.applyContributionReadScopeSql(qb, 'leftContribution', currentUser, false);
    await this.applyContributionReadScopeSql(qb, 'rightContribution', currentUser, false);
    return qb.orderBy('anomaly.id', 'DESC').take(query.limit ?? 100).getMany();
  }

  async resolveAnomaly(
    anomalyId: number,
    dto: ResolveBusinessContributionAnomalyDto,
    currentUser: CurrentUser,
  ) {
    this.assertCommandMetadata(dto);
    const payload = this.resolveAnomalyCommandPayload(anomalyId, dto);
    const replayPreview = await this.dataSource
      .getRepository(BusinessContributionAnomaly)
      .findOne({ where: { resolutionIdempotencyKey: dto.idempotencyKey.trim() } });
    const anomalyPreview = replayPreview ?? await this.loadAnomaly(anomalyId);
    const contributionPreview = await this.loadContributionWritePreview(
      anomalyPreview.contributionId,
    );
    const candidatePreview = await this.loadContributionWritePreview(
      anomalyPreview.candidateContributionId,
    );
    return this.runMutation(async (manager) => {
      await this.assertWriteScope(
        currentUser,
        contributionPreview.scope,
        'gov1.contribution.anomaly.resolve',
        manager,
      );
      await this.assertWriteScope(
        currentUser,
        candidatePreview.scope,
        'gov1.contribution.anomaly.resolve',
        manager,
      );
      const anomalyRepo = manager.getRepository(BusinessContributionAnomaly);
      const anomaly = await this.loadAnomaly(anomalyPreview.id, manager, true);
      if (
        anomaly.version !== anomalyPreview.version ||
        anomaly.contributionId !== anomalyPreview.contributionId ||
        anomaly.candidateContributionId !== anomalyPreview.candidateContributionId
      ) {
        throw new ConflictException(
          '[contribution_anomaly_preview_changed] 贡献异常在权限重验后发生身份或版本漂移',
        );
      }
      const lockedContributions = new Map<number, BusinessContribution>();
      for (const preview of [contributionPreview, candidatePreview].sort(
        (left, right) => left.id - right.id,
      )) {
        const locked = await this.loadContribution(preview.id, manager, true);
        this.assertContributionMatchesPreview(locked, preview);
        lockedContributions.set(locked.id, locked);
      }
      const contribution = lockedContributions.get(contributionPreview.id)!;
      const candidate = lockedContributions.get(candidatePreview.id)!;
      if (anomaly.resolutionIdempotencyKey === dto.idempotencyKey.trim()) {
        GroupOperationsInvariants.assertReplayFingerprint(
          anomaly.resolutionRequestFingerprint ?? '',
          payload,
          '贡献异常处理',
        );
        return {
          anomaly,
          contribution: await this.loadContributionBundle(
            anomaly.duplicateContributionId ?? anomaly.contributionId,
            manager,
          ),
        };
      }
      if (replayPreview || anomaly.id !== anomalyId) {
        throw new ConflictException(
          '[contribution_anomaly_replay_changed] 贡献异常幂等记录在锁定期间消失或改绑',
        );
      }
      if (anomaly.status !== 'open') {
        throw new ConflictException('[contribution_anomaly_not_open] 只有未处理异常可以审核');
      }
      if (anomaly.version !== dto.expectedAnomalyVersion) {
        throw new ConflictException('[contribution_anomaly_version_mismatch] 异常版本已变化，请刷新后重试');
      }
      const resolutionEvidenceRef = BusinessContributionAdapters.assertSafeEvidenceRef(
        dto.resolutionEvidenceRef,
        'resolutionEvidenceRef',
      );
      const resolutionEvidenceHash = BusinessContributionAdapters.assertHash(
        dto.resolutionEvidenceHash,
        'resolutionEvidenceHash',
      );
      const now = new Date();
      let affectedContribution = contribution;
      if (dto.resolution === 'duplicate_void_draft') {
        const pairIds = [contribution.id, candidate.id].sort((left, right) => left - right);
        const canonicalContributionId = dto.canonicalContributionId;
        const duplicateContributionId = dto.duplicateContributionId;
        if (
          !canonicalContributionId ||
          !duplicateContributionId ||
          canonicalContributionId === duplicateContributionId ||
          !pairIds.includes(canonicalContributionId) ||
          !pairIds.includes(duplicateContributionId)
        ) {
          throw new BadRequestException(
            '[duplicate_resolution_pair_invalid] 重复结案必须明确该异常对内的保留贡献与重复贡献',
          );
        }
        const canonical = canonicalContributionId === contribution.id ? contribution : candidate;
        const duplicate = duplicateContributionId === contribution.id ? contribution : candidate;
        if (canonical.confirmationStatus === 'voided' || canonical.reversalOfContributionId) {
          throw new ConflictException(
            '[duplicate_canonical_invalid] 保留贡献不得是已作废记录或冲销记录',
          );
        }
        if (duplicate.confirmationStatus === 'confirmed') {
          throw new ConflictException(
            '[duplicate_confirmed_requires_reversal] 已确认重复贡献必须先建立正式冲销，禁止静默作废或删除',
          );
        }
        if (!['pending_confirmation', 'voided', 'reversed'].includes(duplicate.confirmationStatus)) {
          throw new ConflictException('[duplicate_resolution_status_invalid] 重复贡献状态不可结案');
        }
        if (duplicate.confirmationStatus === 'pending_confirmation') {
          duplicate.confirmationStatus = 'voided';
          duplicate.version += 1;
          await manager.getRepository(BusinessContribution).save(duplicate);
          await manager.getRepository(BusinessContributionAttribution).update(
            { contributionId: duplicate.id, status: 'pending' },
            { status: 'voided' },
          );
        }
        anomaly.canonicalContributionId = canonical.id;
        anomaly.duplicateContributionId = duplicate.id;
        affectedContribution = duplicate;
        anomaly.status = 'resolved_duplicate';
      } else {
        if (dto.canonicalContributionId || dto.duplicateContributionId) {
          throw new BadRequestException(
            '[not_duplicate_pair_fields_forbidden] 非重复结案不得指定保留或重复贡献',
          );
        }
        anomaly.canonicalContributionId = null;
        anomaly.duplicateContributionId = null;
        anomaly.status = 'resolved_not_duplicate';
      }
      anomaly.resolution = dto.resolution;
      anomaly.resolutionReason = dto.reason.trim();
      anomaly.resolutionEvidenceRef = resolutionEvidenceRef;
      anomaly.resolutionEvidenceHash = resolutionEvidenceHash;
      anomaly.resolutionIdempotencyKey = dto.idempotencyKey.trim();
      anomaly.resolutionRequestFingerprint = GroupOperationsInvariants.payloadFingerprint(payload);
      anomaly.version += 1;
      anomaly.resolvedBy = currentUser.id;
      anomaly.resolvedAt = now;
      await anomalyRepo.save(anomaly);
      await this.audit(anomaly.id, 'business_contribution.anomaly.resolve', currentUser, dto, manager, {
        contributionId: contribution.id,
        candidateContributionId: anomaly.candidateContributionId,
        canonicalContributionId: anomaly.canonicalContributionId,
        duplicateContributionId: anomaly.duplicateContributionId,
        anomalyType: anomaly.anomalyType,
        resolution: anomaly.resolution,
        contributionVoided: affectedContribution.confirmationStatus === 'voided',
        resolutionEvidenceHash,
      });
      return {
        anomaly,
        contribution: await this.loadContributionBundle(affectedContribution.id, manager),
      };
    });
  }

  async getGroupPeriodSummary(
    groupId: number,
    recognitionPeriod: string,
    currentUser: CurrentUser,
  ) {
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(recognitionPeriod)) {
      throw new BadRequestException('[recognition_period_invalid] 统计周期格式必须为 YYYY-MM');
    }
    const group = await this.loadGroup(groupId);
    const periodEnd = this.settlementPeriodEnd(recognitionPeriod);
    if (!(await this.canReadGroup(group, periodEnd, currentUser))) {
      throw new ForbiddenException('[contribution_scope_denied] 当前用户无权查看该小组贡献汇总');
    }
    const records = await this.dataSource.getRepository(BusinessContribution).find({
      where: {
        operatingGroupId: groupId,
        recognitionPeriod,
        confirmationStatus: In(['confirmed', 'reversed']),
      },
      order: { id: 'ASC' },
    });
    const corrections = await this.dataSource.getRepository(BusinessContributionCorrection).find({
      where: { operatingGroupId: groupId, recognitionPeriod },
      order: { id: 'ASC' },
    });
    const byDomain: Record<
      string,
      { count: number; correctionCount: number; marginCents: string }
    > = {};
    let margin = 0n;
    for (const record of records) {
      const value = GroupOperationsCalculator.parseSignedCents(
        record.validContributionMarginCents,
        'validContributionMarginCents',
      );
      margin += value;
      const current = byDomain[record.businessDomain] ?? {
        count: 0,
        correctionCount: 0,
        marginCents: '0',
      };
      byDomain[record.businessDomain] = {
        count: current.count + 1,
        correctionCount: current.correctionCount,
        marginCents: (BigInt(current.marginCents) + value).toString(),
      };
    }
    for (const correction of corrections) {
      const value = GroupOperationsCalculator.parseSignedCents(
        correction.marginDeltaCents,
        'correction.marginDeltaCents',
      );
      margin += value;
      const current = byDomain[correction.businessDomain] ?? {
        count: 0,
        correctionCount: 0,
        marginCents: '0',
      };
      byDomain[correction.businessDomain] = {
        count: current.count,
        correctionCount: current.correctionCount + 1,
        marginCents: (BigInt(current.marginCents) + value).toString(),
      };
    }
    GroupOperationsCalculator.parseSignedCents(margin.toString(), 'groupValidContributionMarginCents');
    const target = await this.dataSource.getRepository(GroupTarget).findOne({
      where: { groupId, settlementPeriod: recognitionPeriod },
      order: { calculationVersion: 'DESC' },
    });
    const formalSourceCoverage = this.formalSourceCoverageSummary();
    const achievement = this.groupAchievementSummary(
      margin.toString(),
      target,
      formalSourceCoverage.status === 'complete',
    );
    return {
      groupId,
      recognitionPeriod,
      currency: 'CNY',
      confirmedAndReversedRecordCount: records.length,
      appendOnlyCorrectionCount: corrections.length,
      validContributionMarginCents: margin.toString(),
      byBusinessDomain: byDomain,
      targetSnapshot: target
        ? {
            calculationVersion: target.calculationVersion,
            calculationStatus: target.calculationStatus,
            groupFixedLaborCostCents: target.groupFixedLaborCostCents,
            breakEvenTargetCents: target.breakEvenTargetCents,
            currency: target.currency,
          }
        : null,
      formalSourceCoverage,
      achievement,
      calculationRule:
        'confirmed_plus_reversed_original_plus_negative_reversal_plus_append_only_correction_delta',
    };
  }

  private groupAchievementSummary(
    validContributionMarginCents: string,
    target: GroupTarget | null,
    formalSourceCoverageComplete: boolean,
  ) {
    const blocked = (blockedReasonCode: string) => ({
      calculationStatus: 'calculation_blocked' as const,
      achievementRateBps: null,
      operatingStatus: 'calculation_blocked' as const,
      excessMarginCents: '0',
      rewardGateOpen: false,
      blockedReasonCode,
    });
    if (!target) return blocked('group_target_missing');
    if (!['calculated', 'locked'].includes(target.calculationStatus)) {
      return blocked(`group_target_${target.calculationStatus}`);
    }
    const statusLocked = target.calculationStatus === 'locked';
    if (statusLocked !== (target.lockedAt != null)) {
      return blocked('group_target_lock_state_inconsistent');
    }
    if (
      target.currency !== 'CNY' ||
      !/^[1-9]\d*$/.test(String(target.breakEvenTargetCents ?? '')) ||
      !/^[1-9]\d*$/.test(String(target.groupFixedLaborCostCents ?? '')) ||
      target.blockedReason != null
    ) {
      return blocked('group_target_snapshot_invalid');
    }
    if (!formalSourceCoverageComplete) {
      return blocked('formal_contribution_source_coverage_incomplete');
    }
    return {
      calculationStatus: 'calculated' as const,
      ...GroupOperationsCalculator.groupAchievement(
        validContributionMarginCents,
        target.breakEvenTargetCents,
      ),
      blockedReasonCode: null,
    };
  }

  private formalSourceCoverageSummary() {
    const contracts = BusinessContributionAdapters.listContracts();
    const readyContracts = contracts.filter(
      (contract) => contract.formalAuthorityReadiness === 'ready',
    );
    return {
      status:
        readyContracts.length === contracts.length
          ? ('complete' as const)
          : ('incomplete' as const),
      requiredDomainCount: contracts.length,
      readyDomainCount: readyContracts.length,
      readyDomains: readyContracts.map((contract) => contract.businessDomain),
      blockedDomains: contracts
        .filter((contract) => contract.formalAuthorityReadiness !== 'ready')
        .map((contract) => ({
          businessDomain: contract.businessDomain,
          blockerCode: contract.formalAuthorityBlocker,
        })),
    };
  }

  private async resolveAttributionGroupSnapshots(
    normalized: NormalizedContributionDraft,
    recognitionAt: Date,
    contributionCompanyRef: string,
    manager: EntityManager,
    expectedSnapshots?: Map<number, number>,
  ) {
    const date = BusinessContributionAdapters.settlementDateOfInstant(recognitionAt);
    const employeeIds = [...new Set(normalized.attributions.map((item) => item.employeeId))];
    const employees = await manager.getRepository(Employee).find({
      where: { id: In(employeeIds), status: 1 },
      order: { id: 'ASC' },
    });
    if (employees.length !== employeeIds.length) {
      throw new BadRequestException('[attribution_employee_invalid] 归因员工不存在或已停用');
    }
    const snapshots = new Map<number, number>();
    for (const employeeId of employeeIds) {
      const memberships = await manager
        .getRepository(GroupMember)
        .createQueryBuilder('member')
        .setLock('pessimistic_read')
        .where('member.employee_id = :employeeId', { employeeId })
        .andWhere('member.is_primary = 1')
        .andWhere('member.effective_from <= :date', { date })
        .andWhere('(member.effective_to IS NULL OR member.effective_to >= :date)', { date })
        .orderBy('member.group_id', 'ASC')
        .getMany();
      if (memberships.length !== 1) {
        throw new ConflictException(
          `[attribution_primary_group_invalid] 员工 ${employeeId} 在贡献确认日必须恰有一个主小组`,
        );
      }
      const membershipGroupId = memberships[0].groupId;
      if (
        expectedSnapshots &&
        expectedSnapshots.get(employeeId) !== membershipGroupId
      ) {
        throw new ConflictException(
          `[contribution_attribution_snapshot_changed] 员工 ${employeeId} 的确认日主小组已偏离草稿审计快照`,
        );
      }
      const snapshotGroup = await this.loadGroup(membershipGroupId, manager, true);
      if (
        snapshotGroup.companyRef !== contributionCompanyRef ||
        snapshotGroup.establishedAt > date ||
        Boolean(snapshotGroup.closedAt && snapshotGroup.closedAt < date)
      ) {
        throw new ConflictException(
          `[attribution_group_company_mismatch] 员工 ${employeeId} 的主小组不属于贡献公司或在确认日无效`,
        );
      }
      snapshots.set(employeeId, snapshotGroup.id);
    }
    return snapshots;
  }

  private async loadAuthorityRow(id: number, manager: EntityManager) {
    return manager.getRepository(ContributionSourceAuthorityVersion).findOne({
      where: { id },
      lock: { mode: 'pessimistic_read' },
    });
  }

  private async loadAuthorityRecord(id: number, manager: EntityManager) {
    const authority = await this.loadAuthorityRow(id, manager);
    if (!authority) {
      throw new BadRequestException('[source_authority_missing] 未找到来源授权版本');
    }
    if (authority.status !== 'approved') {
      throw new BadRequestException('[source_authority_not_approved] 来源授权版本未获批准');
    }
    await this.assertAuthorityStructuralIntegrity(authority, manager);
    return authority;
  }

  /**
   * Loads the exact historical authority a confirmed contribution was created
   * against. Unlike `loadAuthorityRecord`, this path intentionally accepts an
   * authority that has since validly become `superseded`, so a later formal
   * reversal can still bind the original record. It is used only by the
   * historical reversal path; normal draft/create/confirm selection must keep
   * the approved-only loader.
   *
   * There is no fallback to any newer/replacement authority: the contribution
   * persists `sourceAuthorityVersionId` as the primary key of the exact
   * authority row, and this loader queries that exact id only. The
   * `(authorityScopeKey, version)` unique index means the exact id is the
   * unambiguous original version, so a replacement row with a different id or
   * version can never be selected here.
   */
  private async loadHistoricalReversalAuthority(id: number, manager: EntityManager) {
    const authority = await this.loadAuthorityRow(id, manager);
    const historicalStatuses: Array<'approved' | 'superseded'> = ['approved', 'superseded'];
    if (!authority) {
      throw new BadRequestException(
        '[source_authority_missing] 未找到原始来源授权版本，正式冲销保持关闭',
      );
    }
    if (!historicalStatuses.includes(authority.status)) {
      throw new BadRequestException(
        '[source_authority_status_invalid] 原始来源授权状态非法，正式冲销保持关闭',
      );
    }
    await this.assertAuthorityStructuralIntegrity(authority, manager);
    return authority;
  }

  /**
   * Status-agnostic self-integrity checks shared by the approved-only normal
   * loader and the historical reversal loader. They never relax the status
   * gate; they only anchor the authority row to its own immutable facts so a
   * tampered or drift row cannot be accepted as the original.
   */
  private async assertAuthorityStructuralIntegrity(
    authority: ContributionSourceAuthorityVersion,
    manager: EntityManager,
  ): Promise<void> {
    const recomputedScopeKey = BusinessContributionAdapters.authorityScopeKey({
      companyRef: authority.companyRef,
      businessSectorRef: authority.businessSectorRef,
      storeRef: authority.storeRef,
      businessDomain: authority.businessDomain,
      sourceSystem: authority.sourceSystem,
      sourceType: authority.sourceType,
    });
    if (recomputedScopeKey !== authority.authorityScopeKey) {
      throw new ConflictException(
        '[source_authority_scope_key_mismatch] 来源授权范围键与来源事实不一致',
      );
    }
    if (!Number.isInteger(authority.version) || authority.version < 1) {
      throw new ConflictException('[source_authority_version_invalid] 来源授权版本序列无效');
    }
    const canonicalRuleVersionId = this.canonicalRuleVersionId(authority.ruleVersionId);
    if (canonicalRuleVersionId !== authority.ruleVersionId) {
      throw new ConflictException('[source_authority_rule_version_invalid] 来源授权规则版本无效');
    }
    await this.assertPersistedAuthorityVersionSequence(authority, manager);
    const fingerprintPayload = {
      ruleVersionId: authority.ruleVersionId,
      companyRef: authority.companyRef,
      businessSectorRef: authority.businessSectorRef,
      storeRef: authority.storeRef,
      businessDomain: authority.businessDomain,
      sourceSystem: authority.sourceSystem,
      sourceType: authority.sourceType,
      adapterVersion: authority.adapterVersion,
      effectiveFrom: authority.effectiveFrom,
      effectiveTo: authority.effectiveTo,
      currency: authority.currency,
      reason: authority.changeReason,
      sourceChannel: authority.sourceChannel,
      correlationId: authority.correlationId,
      idempotencyKey: authority.idempotencyKey,
    };
    const versionedFingerprint = GroupOperationsInvariants.payloadFingerprint({
      ...fingerprintPayload,
      version: authority.version,
    });
    const legacyFingerprint = GroupOperationsInvariants.payloadFingerprint(fingerprintPayload);
    if (
      !/^[a-f0-9]{64}$/.test(authority.requestFingerprint) ||
      (authority.requestFingerprint !== versionedFingerprint &&
        authority.requestFingerprint !== legacyFingerprint)
    ) {
      throw new ConflictException(
        '[source_authority_fingerprint_mismatch] 来源授权不可变请求指纹不匹配',
      );
    }
  }

  private assertAuthorityReplayFingerprint(
    actualFingerprint: string,
    payload: Record<string, unknown>,
    version: number,
    subject: string,
  ): void {
    const versionedFingerprint = GroupOperationsInvariants.payloadFingerprint({ ...payload, version });
    const legacyFingerprint = GroupOperationsInvariants.payloadFingerprint(payload);
    if (
      !/^[a-f0-9]{64}$/.test(actualFingerprint) ||
      (actualFingerprint !== versionedFingerprint && actualFingerprint !== legacyFingerprint)
    ) {
      throw new ConflictException(
        `[idempotency_payload_mismatch] 幂等键对应不同${subject}请求载荷`,
      );
    }
  }

  private async assertPersistedAuthorityVersionSequence(
    authority: ContributionSourceAuthorityVersion,
    manager: EntityManager,
  ): Promise<void> {
    const rows = await manager.getRepository(ContributionSourceAuthorityVersion).find({
      where: { authorityScopeKey: authority.authorityScopeKey },
      order: { version: 'ASC', id: 'ASC' },
    });
    this.assertAuthorityVersionSequence(rows);
    const persisted = rows.find((item) => item.id === authority.id);
    if (!persisted || persisted.version !== authority.version) {
      throw new ConflictException(
        '[source_authority_version_sequence_invalid] 来源授权版本与其范围内序列不一致',
      );
    }
  }

  private assertAuthorityVersionSequence(
    authorities: ContributionSourceAuthorityVersion[],
  ): void {
    const ordered = [...authorities].sort(
      (left, right) => left.version - right.version || left.id - right.id,
    );
    if (
      ordered.some(
        (item, index) =>
          !Number.isInteger(item.version) ||
          item.version !== index + 1 ||
          (index > 0 && item.id === ordered[index - 1].id),
      )
    ) {
      throw new ConflictException(
        '[source_authority_version_sequence_invalid] 来源授权版本序列必须从 1 开始连续且唯一',
      );
    }
  }

  /**
   * Reversal-specific binding: the loaded historical authority must still be
   * the exact original authority and must match the contribution's persisted
   * immutable facts. Only the `status` field may validly differ
   * (approved -> superseded); every other drift fails closed before the formal
   * reversal resolver runs.
   */
  private assertHistoricalReversalAuthority(
    original: BusinessContribution,
    authority: ContributionSourceAuthorityVersion,
  ): void {
    if (authority.id !== original.sourceAuthorityVersionId) {
      throw new ConflictException(
        '[reversal_authority_id_mismatch] 历史冲销必须绑定原贡献精确来源授权版本',
      );
    }
    if (authority.status !== 'approved' && authority.status !== 'superseded') {
      throw new ConflictException(
        '[reversal_authority_status_invalid] 历史来源授权状态非法，正式冲销保持关闭',
      );
    }
    const date = BusinessContributionAdapters.settlementDateOfInstant(original.recognitionAt);
    if (
      authority.companyRef !== original.companyRef ||
      authority.businessSectorRef !== (original.businessSectorRef ?? null) ||
      authority.storeRef !== (original.storeRef ?? null) ||
      authority.businessDomain !== original.businessDomain ||
      authority.sourceSystem !== original.sourceSystem ||
      authority.sourceType !== original.sourceType ||
      authority.adapterVersion !== original.adapterVersion ||
      authority.currency !== original.currency ||
      authority.effectiveFrom > date ||
      Boolean(authority.effectiveTo && authority.effectiveTo < date)
    ) {
      throw new ConflictException(
        '[reversal_authority_fact_drift] 历史来源授权与已确认贡献的不可变事实不一致，正式冲销保持关闭',
      );
    }
  }

  /**
   * Immutable authority snapshot: anchors every non-status authority fact,
   * including the exact id, scope, source, adapter, effective range, currency,
   * version and the publish request fingerprint. `status` is deliberately
   * excluded so a valid approved -> superseded transition does not invalidate
   * the anchor.
   */
  private authorityImmutableSnapshotHash(authority: ContributionSourceAuthorityVersion): string {
    return GroupOperationsInvariants.payloadFingerprint({
      id: authority.id,
      ruleVersionId: authority.ruleVersionId,
      authorityScopeKey: authority.authorityScopeKey,
      companyRef: authority.companyRef,
      businessSectorRef: authority.businessSectorRef,
      storeRef: authority.storeRef,
      businessDomain: authority.businessDomain,
      sourceSystem: authority.sourceSystem,
      sourceType: authority.sourceType,
      adapterVersion: authority.adapterVersion,
      effectiveFrom: authority.effectiveFrom,
      effectiveTo: authority.effectiveTo,
      currency: authority.currency,
      version: authority.version,
      requestFingerprint: authority.requestFingerprint,
    });
  }

  /**
   * Requires exactly one immutable publish anchor for the authority and that
   * its snapshot hash equals the current authority's immutable snapshot. This
   * is the version/fact anchor that a mere recomputation of `requestFingerprint`
   * cannot forge: the anchor was written once at publish time. Missing,
   * duplicate, malformed or drifted anchors all fail closed. Migration 0064
   * supplies the exact `(module,target_id,action,id)` lookup/order index while
   * preserving this `take: 2` duplicate-detection behavior.
   */
  private async assertAuthorityPublishAnchor(
    authority: ContributionSourceAuthorityVersion,
    manager: EntityManager,
  ): Promise<void> {
    const anchors = await manager.getRepository(OperationLog).find({
      where: {
        module: 'group_operations',
        targetId: authority.id,
        action: 'business_contribution.authority.publish',
      },
      order: { id: 'ASC' },
      take: 2,
    });
    if (anchors.length > 1) {
      throw new ConflictException(
        '[source_authority_publish_anchor_ambiguous] 来源授权存在重复发布审计锚点，正式冲销保持关闭',
      );
    }
    const anchoredHash = anchors[0]?.detailJson?.authorityImmutableSnapshotHash;
    if (typeof anchoredHash !== 'string') {
      throw new ConflictException(
        '[source_authority_publish_anchor_missing] 缺少不可变来源授权发布审计锚点，正式冲销保持关闭',
      );
    }
    const normalizedAnchor = BusinessContributionAdapters.assertHash(
      anchoredHash,
      'authorityImmutableSnapshotHash',
    );
    if (normalizedAnchor !== this.authorityImmutableSnapshotHash(authority)) {
      throw new ConflictException(
        '[source_authority_publish_anchor_changed] 来源授权不可变事实或版本已漂移，正式冲销保持关闭',
      );
    }
  }

  private async loadAuthorityForSelection(
    dto: CreateBusinessContributionDto,
    manager: EntityManager,
  ) {
    const selection = this.selectionFromDto(dto);
    const preview = await this.loadAuthoritySelectionPreview(
      selection,
      dto.sourceAuthorityVersionId,
      manager,
    );
    const authority = await this.loadAuthorityRecord(dto.sourceAuthorityVersionId, manager);
    if (
      this.authorityImmutableSnapshotHash(preview) !==
      this.authorityImmutableSnapshotHash(authority)
    ) {
      throw new ConflictException(
        '[source_authority_locator_changed] 来源授权在事务锁定前发生变化，请刷新后重试',
      );
    }
    return authority;
  }

  private async loadAuthoritySelectionPreview(
    selection: ContributionSourceSelection,
    sourceAuthorityVersionId: number,
    manager: EntityManager,
  ): Promise<ContributionSourceAuthorityVersion> {
    const authority = await manager.getRepository(ContributionSourceAuthorityVersion).findOne({
      where: { id: sourceAuthorityVersionId },
    });
    if (!authority) {
      throw new BadRequestException('[source_authority_missing] 未找到来源授权版本');
    }
    if (authority.status !== 'approved') {
      throw new BadRequestException('[source_authority_not_approved] 来源授权版本未获批准');
    }
    if (
      authority.businessDomain !== selection.businessDomain ||
      authority.sourceSystem !== selection.sourceSystem.trim().toLowerCase() ||
      authority.sourceType !== selection.sourceType.trim().toLowerCase() ||
      authority.adapterVersion !==
        BusinessContributionAdapters.contractFor(selection.businessDomain).adapterVersion ||
      authority.currency !== 'CNY'
    ) {
      throw new BadRequestException('[source_authority_mismatch] 来源授权版本与所选服务端适配器不匹配');
    }
    return authority;
  }

  private async loadContributionCreateScopeLocator(
    dto: CreateBusinessContributionDto,
    manager: EntityManager,
  ): Promise<ContributionCreateScopeLocator> {
    const authority = await this.loadAuthoritySelectionPreview(
      this.selectionFromDto(dto),
      dto.sourceAuthorityVersionId,
      manager,
    );
    if (dto.businessDomain !== 'repair') {
      return { authority, scope: this.authorityScope(authority) };
    }
    const match = /^work-order:(\d+)$/.exec(dto.sourceId.trim().toLowerCase());
    const workOrderId = match ? Number(match[1]) : Number.NaN;
    if (!Number.isSafeInteger(workOrderId) || workOrderId <= 0) {
      throw new ConflictException(
        '[repair_source_id_invalid] 汽修贡献来源必须使用 work-order:<id> 的正式工单引用',
      );
    }
    const profile = await manager.getRepository(RepairWorkOrderProfile).findOne({
      where: { workOrderId },
    });
    if (!profile) {
      throw new ConflictException(
        '[repair_formal_composer_profile_missing] 汽修工单缺少正式范围定位，禁止进入来源权威锁序',
      );
    }
    const scope: ContributionScope = {
      companyRef: profile.companyRef,
      businessSectorRef: profile.businessSectorRef,
      storeRef: profile.storeRef,
      customerRef: profile.customerRef,
    };
    if (
      authority.companyRef !== scope.companyRef ||
      authority.businessSectorRef !== scope.businessSectorRef ||
      authority.storeRef !== scope.storeRef
    ) {
      throw new ConflictException(
        '[repair_formal_composer_authority_scope_mismatch] 来源授权与汽修档案范围不一致',
      );
    }
    return { authority, scope };
  }

  private assertAuthoritySnapshot(
    authority: ContributionSourceAuthorityVersion,
    snapshot: VerifiedContributionSourceSnapshot,
    recognitionAt: Date,
  ) {
    const date = BusinessContributionAdapters.settlementDateOfInstant(recognitionAt);
    if (
      authority.companyRef !== snapshot.companyRef.trim() ||
      authority.businessSectorRef !== (snapshot.businessSectorRef?.trim() || null) ||
      authority.storeRef !== (snapshot.storeRef?.trim() || null) ||
      authority.businessDomain !== snapshot.businessDomain ||
      authority.sourceSystem !== snapshot.sourceSystem.trim().toLowerCase() ||
      authority.sourceType !== snapshot.sourceType.trim().toLowerCase() ||
      authority.adapterVersion !== BusinessContributionAdapters.contractFor(snapshot.businessDomain).adapterVersion ||
      authority.currency !== 'CNY' ||
      authority.effectiveFrom > date ||
      Boolean(authority.effectiveTo && authority.effectiveTo < date)
    ) {
      throw new BadRequestException('[source_authority_mismatch] 来源授权版本与服务端权威快照或确认时间不匹配');
    }
  }

  private selectionFromDto(dto: CreateBusinessContributionDto): ContributionSourceSelection {
    return {
      businessDomain: dto.businessDomain,
      sourceSystem: dto.sourceSystem.trim().toLowerCase(),
      sourceType: dto.sourceType.trim().toLowerCase(),
      sourceId: dto.sourceId.trim().toLowerCase(),
      sourceVersion: dto.sourceVersion.trim().toLowerCase(),
      sourceRecordHash: BusinessContributionAdapters.assertHash(
        dto.sourceRecordHash,
        'sourceRecordHash',
      ),
    };
  }

  private selectionFromContribution(record: BusinessContribution): ContributionSourceSelection {
    return {
      businessDomain: record.businessDomain,
      sourceSystem: record.sourceSystem,
      sourceType: record.sourceType,
      sourceId: record.sourceId,
      sourceVersion: record.sourceVersion,
      sourceRecordHash: record.sourceRecordHash,
    };
  }

  private reversalSelectionFromContribution(
    record: BusinessContribution,
    originalAttributionSnapshotHash: string,
  ): ContributionReversalSelection {
    return {
      ...this.selectionFromContribution(record),
      originalContributionId: record.id,
      companyRef: record.companyRef,
      businessSectorRef: record.businessSectorRef,
      storeRef: record.storeRef,
      customerRef: record.customerRef,
      operatingGroupId: record.operatingGroupId,
      sourceAuthorityVersionId: record.sourceAuthorityVersionId,
      economicFactKey: record.economicFactKey,
      similarityClusterKey: record.similarityClusterKey,
      originalRecognitionAt: record.recognitionAt.toISOString(),
      originalAttributionSnapshotHash,
      originalEvidenceBundleHash: record.evidenceBundleHash,
      originalAuthoritySnapshotHash: record.authoritySnapshotHash,
      originalRevenueCents: record.revenueCents,
      originalDirectCostTotalCents: record.directCostTotalCents,
      originalValidContributionMarginCents: record.validContributionMarginCents,
      originalAttributionShareTotalBps: record.attributionShareTotalBps,
      originalConfirmationEvidenceHash: record.confirmationEvidenceHash ?? '',
      originalConfirmedAt: record.confirmedAt?.toISOString() ?? '',
      originalConfirmedVersion: record.version,
      originalConfirmedBy: record.confirmedBy ?? 0,
      currency: record.currency,
    };
  }

  private attributionSnapshotHash(
    attributions: BusinessContributionAttribution[],
  ): string {
    const canonical = attributions
      .map((item) => ({
        role: item.role,
        originBusinessDomain: item.originBusinessDomain,
        employeeId: item.employeeId,
        employeeGroupIdSnapshot: item.employeeGroupIdSnapshot,
        shareBps: item.shareBps,
        evidenceRef: item.evidenceRef.trim(),
        evidenceHash: BusinessContributionAdapters.assertHash(
          item.evidenceHash,
          'attribution.evidenceHash',
        ),
      }))
      .sort(
        (left, right) =>
          left.role.localeCompare(right.role) ||
          left.employeeId - right.employeeId ||
          left.originBusinessDomain.localeCompare(right.originBusinessDomain) ||
          left.employeeGroupIdSnapshot - right.employeeGroupIdSnapshot ||
          left.shareBps - right.shareBps ||
          left.evidenceRef.localeCompare(right.evidenceRef) ||
          left.evidenceHash.localeCompare(right.evidenceHash),
      );
    return GroupOperationsInvariants.payloadFingerprint({ attributions: canonical });
  }

  private async assertAttributionAuditAnchor(
    contributionId: number,
    action: 'business_contribution.draft.create' | 'business_contribution.confirm',
    currentSnapshotHash: string,
    manager: EntityManager,
  ): Promise<void> {
    const anchors = await manager.getRepository(OperationLog).find({
      where: {
        module: 'group_operations',
        targetId: contributionId,
        action,
      },
      order: { id: 'ASC' },
      take: 2,
    });
    if (anchors.length > 1) {
      throw new ConflictException(
        `[contribution_attribution_anchor_ambiguous] ${action} 存在重复归因审计锚点，正式确认或冲销保持关闭`,
      );
    }
    const anchor = anchors[0];
    const anchoredHash = anchor?.detailJson?.attributionSnapshotHash;
    if (typeof anchoredHash !== 'string') {
      throw new ConflictException(
        `[contribution_attribution_anchor_missing] ${action} 缺少不可变归因快照审计锚点`,
      );
    }
    const normalizedAnchor = BusinessContributionAdapters.assertHash(
      anchoredHash,
      'attributionSnapshotHash',
    );
    if (normalizedAnchor !== currentSnapshotHash) {
      throw new ConflictException(
        `[contribution_attribution_snapshot_changed] ${action} 后归因快照已变化，正式确认或冲销保持关闭`,
      );
    }
  }

  private assertDraftAttributionLifecycle(
    attributions: BusinessContributionAttribution[],
  ): void {
    if (
      attributions.some(
        (item) =>
          item.status !== 'pending' ||
          item.confirmedBy !== null ||
          item.confirmedAt !== null,
      )
    ) {
      throw new ConflictException(
        '[contribution_attribution_lifecycle_changed] 待确认贡献的归因生命周期已变化，禁止覆盖后确认',
      );
    }
  }

  private assertConfirmedAttributionLifecycle(
    contribution: BusinessContribution,
    attributions: BusinessContributionAttribution[],
  ): void {
    if (!contribution.confirmedBy || !contribution.confirmedAt) {
      throw new ConflictException(
        '[contribution_attribution_lifecycle_changed] 已确认贡献缺少确认生命周期元数据，禁止冲销',
      );
    }
    const confirmedAt = contribution.confirmedAt.getTime();
    if (
      attributions.some(
        (item) =>
          item.status !== 'confirmed' ||
          item.confirmedBy !== contribution.confirmedBy ||
          !item.confirmedAt ||
          item.confirmedAt.getTime() !== confirmedAt,
      )
    ) {
      throw new ConflictException(
        '[contribution_attribution_lifecycle_changed] 已确认贡献的归因生命周期与主记录不一致，禁止冲销',
      );
    }
  }

  private assertExpectedSourceSnapshot(
    dto: CreateBusinessContributionDto,
    snapshot: VerifiedContributionSourceSnapshot,
  ) {
    if (
      snapshot.businessDomain !== dto.businessDomain ||
      snapshot.sourceSystem.trim().toLowerCase() !== dto.sourceSystem.trim().toLowerCase() ||
      snapshot.sourceType.trim().toLowerCase() !== dto.sourceType.trim().toLowerCase() ||
      snapshot.sourceId.trim().toLowerCase() !== dto.sourceId.trim().toLowerCase() ||
      snapshot.sourceVersion.trim().toLowerCase() !== dto.sourceVersion.trim().toLowerCase() ||
      BusinessContributionAdapters.assertHash(snapshot.sourceRecordHash, 'sourceRecordHash') !==
        BusinessContributionAdapters.assertHash(dto.sourceRecordHash, 'sourceRecordHash')
    ) {
      throw new ConflictException(
        '[source_snapshot_expectation_mismatch] 正式来源版本或哈希已变化，请刷新来源后重新创建草稿',
      );
    }
  }

  private assertPersistedSourceSnapshot(
    record: BusinessContribution,
    snapshot: VerifiedContributionSourceSnapshot,
  ) {
    if (
      snapshot.businessDomain !== record.businessDomain ||
      snapshot.sourceSystem.trim().toLowerCase() !== record.sourceSystem ||
      snapshot.sourceType.trim().toLowerCase() !== record.sourceType ||
      snapshot.sourceId.trim().toLowerCase() !== record.sourceId ||
      snapshot.sourceVersion.trim().toLowerCase() !== record.sourceVersion ||
      BusinessContributionAdapters.assertHash(snapshot.sourceRecordHash, 'sourceRecordHash') !==
        record.sourceRecordHash
    ) {
      throw new ConflictException(
        '[source_snapshot_changed] 来源权威记录在草稿后发生变化，禁止确认旧草稿',
      );
    }
  }

  private verifiedSourceScope(snapshot: VerifiedContributionSourceSnapshot): ContributionScope {
    return {
      companyRef: snapshot.companyRef.trim(),
      businessSectorRef: snapshot.businessSectorRef?.trim() || null,
      storeRef: snapshot.storeRef?.trim() || null,
      customerRef: snapshot.customerRef?.trim() || null,
    };
  }

  private isAuthorityBundle(
    resolution: VerifiedContributionSourceResolution,
  ): resolution is VerifiedContributionAuthorityBundleV1 {
    return 'sourceSnapshot' in resolution && 'authorityBundleHash' in resolution;
  }

  private sourceSnapshotOf(
    resolution: VerifiedContributionSourceResolution,
  ): VerifiedContributionSourceSnapshot {
    return this.isAuthorityBundle(resolution)
      ? resolution.sourceSnapshot
      : resolution;
  }

  private authoritativeAttributionsForResolution(
    resolution: VerifiedContributionSourceResolution,
    legacyAttributions: ContributionAttributionDto[],
    businessDomain: BusinessContribution['businessDomain'],
  ): ContributionAttributionDto[] {
    if (this.isAuthorityBundle(resolution)) {
      if (businessDomain !== 'repair' || resolution.sourceSnapshot.businessDomain !== 'repair') {
        throw new ConflictException(
          '[contribution_authority_bundle_domain_invalid] 正式来源 bundle 只能绑定其权威业务域',
        );
      }
      return resolution.attributions.map((item) => ({ ...item }));
    }
    if (businessDomain === 'repair') {
      throw new ConflictException(
        '[repair_formal_authority_bundle_required] 汽修正式贡献不得使用 caller 归因，必须由完整权威 bundle 提供',
      );
    }
    return legacyAttributions.map((item) => ({ ...item }));
  }

  private assertPersistedAttributionsMatchAuthority(
    persisted: BusinessContributionAttribution[],
    authoritative: ContributionAttributionDto[],
  ): void {
    const canonical = (
      items: Array<{
        role: string;
        originBusinessDomain: string;
        employeeId: number;
        shareBps: number;
        evidenceRef: string;
        evidenceHash: string;
      }>,
    ) => items
      .map((item) => ({
        role: item.role,
        originBusinessDomain: item.originBusinessDomain,
        employeeId: item.employeeId,
        shareBps: item.shareBps,
        evidenceRef: item.evidenceRef.trim(),
        evidenceHash: BusinessContributionAdapters.assertHash(
          item.evidenceHash,
          'attribution.evidenceHash',
        ),
      }))
      .sort(
        (left, right) =>
          left.role.localeCompare(right.role) ||
          left.employeeId - right.employeeId ||
          left.originBusinessDomain.localeCompare(right.originBusinessDomain) ||
          left.shareBps - right.shareBps ||
          left.evidenceRef.localeCompare(right.evidenceRef) ||
          left.evidenceHash.localeCompare(right.evidenceHash),
      );
    if (
      GroupOperationsInvariants.payloadFingerprint({ attributions: canonical(persisted) }) !==
      GroupOperationsInvariants.payloadFingerprint({ attributions: canonical(authoritative) })
    ) {
      throw new ConflictException(
        '[contribution_attribution_authority_changed] 草稿归因与当前维修权威 bundle 不一致',
      );
    }
  }

  private verifiedRbacContext(
    actor: LockedContributionActor,
    permission: VerifiedContributionRbacContextV1['permission'],
    scope: ContributionScope,
    expectedContributionId: number | null,
  ): VerifiedContributionRbacContextV1 {
    return Object.freeze({
      permission,
      userId: actor.currentUser.id,
      employeeId: actor.employeeId,
      companyRef: scope.companyRef,
      businessSectorRef: scope.businessSectorRef,
      storeRef: scope.storeRef,
      customerRef: scope.customerRef,
      expectedContributionId,
    });
  }

  private async resolveOperatingGroupFromResponsibility(
    responsibilityEmployeeId: number,
    recognitionAt: Date,
    scope: ContributionScope,
    manager: EntityManager,
    expectedOperatingGroupId?: number,
  ) {
    const employee = await manager.getRepository(Employee).findOne({
      where: { id: responsibilityEmployeeId, status: 1 },
    });
    if (!employee) {
      throw new ConflictException('[responsibility_employee_missing] 来源权威责任员工不存在或已停用');
    }
    const date = BusinessContributionAdapters.settlementDateOfInstant(recognitionAt);
    const memberships = await manager
      .getRepository(GroupMember)
      .createQueryBuilder('member')
      .setLock('pessimistic_read')
      .where('member.employee_id = :employeeId', { employeeId: responsibilityEmployeeId })
      .andWhere('member.is_primary = 1')
      .andWhere('member.effective_from <= :date', { date })
      .andWhere('(member.effective_to IS NULL OR member.effective_to >= :date)', { date })
      .orderBy('member.group_id', 'ASC')
      .getMany();
    if (memberships.length !== 1) {
      throw new ConflictException(
        '[responsibility_primary_group_invalid] 来源责任员工在贡献确认日必须恰有一个主经营小组',
      );
    }
    const membershipGroupId = memberships[0].groupId;
    if (
      expectedOperatingGroupId != null &&
      membershipGroupId !== expectedOperatingGroupId
    ) {
      throw new ConflictException(
        '[contribution_authority_changed] 责任员工主小组已漂移，禁止在旧草稿确认时取得新小组锁',
      );
    }
    const group = await this.loadGroup(membershipGroupId, manager, true);
    this.assertGroupScope(group, scope, recognitionAt);
    return group;
  }

  private async assertEvidenceKeysUnused(keys: string[], manager: EntityManager) {
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('[contribution_evidence_duplicate] 同一贡献内证据分配不得重复');
    }
    const existing = await manager.getRepository(BusinessContributionEvidence).find({
      where: { evidenceUniqueKey: In(keys) },
      order: { id: 'ASC' },
    });
    if (existing.length) {
      throw new ConflictException('[contribution_evidence_already_allocated] 证据分配已被其他贡献使用');
    }
  }

  private async lockContributionMutationScope(
    operatingGroupId: number,
    attributionSnapshotGroupIds: number[],
    attributionEmployeeIds: number[],
    manager: EntityManager,
    requireActiveEmployees: boolean,
  ): Promise<void> {
    const rawGroupIds = [operatingGroupId, ...attributionSnapshotGroupIds];
    if (rawGroupIds.some((id) => !Number.isInteger(id) || id <= 0)) {
      throw new BadRequestException('[operating_group_invalid] 贡献相关经营小组标识无效');
    }
    const groupIds = [...new Set(rawGroupIds)].sort((left, right) => left - right);
    const repo = manager.getRepository(OrganizationGroup);
    for (const groupId of groupIds) {
      const group = await repo.findOne({
        where: { id: groupId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!group) {
        throw new BadRequestException(`[operating_group_missing] 经营小组 ${groupId} 不存在`);
      }
    }

    if (attributionEmployeeIds.some((id) => !Number.isInteger(id) || id <= 0)) {
      throw new BadRequestException('[attribution_employee_invalid] 贡献归因员工标识无效');
    }
    const employeeIds = [...new Set(attributionEmployeeIds)].sort((left, right) => left - right);
    const employees = await manager
      .getRepository(Employee)
      .createQueryBuilder('employee')
      .setLock('pessimistic_write')
      .where('employee.id IN (:...employeeIds)', { employeeIds })
      .orderBy('employee.id', 'ASC')
      .getMany();
    if (employees.length !== employeeIds.length) {
      const found = new Set(employees.map((employee) => employee.id));
      const missing = employeeIds.find((employeeId) => !found.has(employeeId));
      throw new BadRequestException(
        `[contribution_employee_missing] 归因员工 ${missing ?? 'unknown'} 不存在`,
      );
    }
    if (requireActiveEmployees && employees.some((employee) => employee.status !== 1)) {
      throw new BadRequestException('[contribution_employee_inactive] 归因员工已停用，禁止确认进入经营成绩');
    }
  }

  private async assertContributionPeriodOpen(
    operatingGroupId: number,
    recognitionPeriod: string,
    attributionEmployeeIds: number[],
    manager: EntityManager,
  ): Promise<ContributionPeriodLockInspection> {
    const inspection = await this.inspectContributionPeriodLocks(
      operatingGroupId,
      recognitionPeriod,
      attributionEmployeeIds,
      manager,
    );
    if (inspection.lockedReasons.length) {
      throw new ConflictException(
        '[contribution_confirmation_period_locked] 已冻结目标或人工成本工资快照的周期不得确认贡献进入经营成绩',
      );
    }
    return inspection;
  }

  private async resolveReversalRecognition(
    operatingGroupId: number,
    attributionEmployeeIds: number[],
    authoritativeOccurredAt: string,
    manager: EntityManager,
  ): Promise<ReversalRecognitionDecision> {
    const occurredAt = BusinessContributionAdapters.normalizeInstant(
      authoritativeOccurredAt,
      'reversal.occurredAt',
    );
    const occurredPeriod = BusinessContributionAdapters.settlementPeriodOfInstant(occurredAt);
    let recognitionPeriod = occurredPeriod;
    const skippedLockedPeriods: ReversalRecognitionDecision['skippedLockedPeriods'] = [];
    for (let index = 0; index < MAX_REVERSAL_PERIOD_SCAN_MONTHS; index += 1) {
      const periodStartIso = BusinessContributionAdapters.settlementPeriodStartInstant(
        recognitionPeriod,
      );
      if (!BusinessContributionAdapters.settlementPeriodHasStarted(recognitionPeriod)) {
        throw new ConflictException(
          '[reversal_open_period_not_started] 尚无已开始的后续开放周期，正式冲销保持关闭',
        );
      }
      const inspection = await this.inspectContributionPeriodLocks(
        operatingGroupId,
        recognitionPeriod,
        attributionEmployeeIds,
        manager,
      );
      if (!inspection.lockedReasons.length) {
        return {
          recognitionPeriod,
          recognitionAt: recognitionPeriod === occurredPeriod ? occurredAt : periodStartIso,
          authoritativeOccurredAt: occurredAt,
          deferredFromPeriod: recognitionPeriod === occurredPeriod ? null : occurredPeriod,
          skippedLockedPeriods,
        };
      }
      skippedLockedPeriods.push({
        recognitionPeriod,
        lockedReasons: inspection.lockedReasons,
      });
      recognitionPeriod = BusinessContributionAdapters.nextSettlementPeriod(recognitionPeriod);
    }
    throw new ConflictException(
      `[reversal_open_period_not_found] ${MAX_REVERSAL_PERIOD_SCAN_MONTHS} 个月扫描上限内没有可用开放周期`,
    );
  }

  private assertCorrectionAuthoritySelection(
    original: BusinessContribution,
    dto: CreateBusinessContributionCorrectionDto,
    authority: ContributionSourceAuthorityVersion,
  ): void {
    if (
      authority.companyRef !== original.companyRef ||
      authority.businessSectorRef !== original.businessSectorRef ||
      authority.storeRef !== original.storeRef ||
      authority.businessDomain !== original.businessDomain ||
      authority.sourceSystem !== dto.sourceSystem.trim().toLowerCase() ||
      authority.sourceType !== dto.sourceType.trim().toLowerCase() ||
      authority.adapterVersion !==
        BusinessContributionAdapters.contractFor(original.businessDomain).adapterVersion ||
      authority.currency !== original.currency
    ) {
      throw new BadRequestException(
        '[correction_authority_selection_mismatch] 更正来源授权必须覆盖原贡献精确范围、业务域、来源和币种',
      );
    }
  }

  private sortIdentityKeys<T extends ContributionIdentityKey>(items: T[]): T[] {
    const compare = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);
    return [...items].sort(
      (left, right) =>
        compare(left.identityKind, right.identityKind) ||
        compare(left.identityHash, right.identityHash),
    );
  }

  /**
   * Friendly diagnosis only. The cross-table concurrency authority is the
   * registry's unique (identity_kind, identity_hash) insert in the same
   * transaction as the owning business row.
   */
  private async assertIdentityKeysAvailable(
    keys: ContributionIdentityKey[],
    manager: EntityManager,
  ): Promise<void> {
    const sorted = this.sortIdentityKeys(keys);
    const canonical = sorted.map((item) => `${item.identityKind}:${item.identityHash}`);
    if (new Set(canonical).size !== canonical.length) {
      throw new BadRequestException('[contribution_identity_duplicate_in_command] 同一命令内身份分配不得重复');
    }
    const repo = manager.getRepository(BusinessContributionIdentityAllocation);
    for (const key of sorted) {
      if (!/^[0-9a-f]{64}$/.test(key.identityHash)) {
        throw new BadRequestException('[contribution_identity_hash_invalid] 正式来源或证据身份必须是小写 SHA-256');
      }
      const existing = await repo.findOne({
        where: { identityKind: key.identityKind, identityHash: key.identityHash },
      });
      if (existing) {
        throw new ConflictException(
          `[contribution_identity_already_allocated] ${key.identityKind} 身份已被正式业务行占用`,
        );
      }
    }
  }

  private async reserveIdentityAllocations(
    reservations: ContributionIdentityReservation[],
    manager: EntityManager,
  ): Promise<void> {
    const sorted = this.sortIdentityKeys(reservations);
    const canonical = sorted.map((item) => `${item.identityKind}:${item.identityHash}`);
    if (new Set(canonical).size !== canonical.length) {
      throw new BadRequestException('[contribution_identity_duplicate_in_command] 同一命令内身份分配不得重复');
    }
    const repo = manager.getRepository(BusinessContributionIdentityAllocation);
    for (const reservation of sorted) {
      if (!Number.isInteger(reservation.ownerId) || reservation.ownerId < 1) {
        throw new BadRequestException('[contribution_identity_owner_invalid] 正式身份分配缺少有效目标行');
      }
      // Do not catch ER_DUP_ENTRY here: the error must abort and roll back the
      // complete business transaction. runMutation translates it after rollback.
      await repo.save(repo.create(reservation));
    }
  }

  private assertCorrectionAuthorityAt(
    authority: ContributionSourceAuthorityVersion,
    original: BusinessContribution,
    occurredAt: string,
  ): void {
    const date = BusinessContributionAdapters.settlementDateOfInstant(occurredAt);
    if (
      authority.companyRef !== original.companyRef ||
      authority.businessSectorRef !== original.businessSectorRef ||
      authority.storeRef !== original.storeRef ||
      authority.businessDomain !== original.businessDomain ||
      authority.currency !== original.currency ||
      authority.effectiveFrom > date ||
      Boolean(authority.effectiveTo && authority.effectiveTo < date)
    ) {
      throw new ConflictException(
        '[correction_authority_not_effective] 更正发生日不在精确来源授权范围或有效期内',
      );
    }
  }

  private async loadCorrectionRowsForUpdate(
    originalContributionId: number,
    manager: EntityManager,
  ): Promise<BusinessContributionCorrection[]> {
    return manager
      .getRepository(BusinessContributionCorrection)
      .createQueryBuilder('correction')
      .setLock('pessimistic_write')
      .where('correction.original_contribution_id = :originalContributionId', {
        originalContributionId,
      })
      .orderBy('correction.sequence', 'ASC')
      .addOrderBy('correction.id', 'ASC')
      .getMany();
  }

  private assertCorrectionSequence(rows: BusinessContributionCorrection[]): void {
    for (let index = 0; index < rows.length; index += 1) {
      if (rows[index].sequence !== index + 1) {
        throw new ConflictException(
          '[correction_sequence_invalid] 原贡献更正序列必须从 1 开始连续且不可重复',
        );
      }
    }
  }

  private assertCorrectionTypeCompatibility(
    existing: BusinessContributionCorrection[],
    incomingType: BusinessContributionCorrection['correctionType'],
  ): void {
    if (
      existing.some((item) => item.correctionType === 'full_void') ||
      (incomingType === 'full_void' && existing.length > 0)
    ) {
      throw new ConflictException(
        '[full_void_partial_correction_conflict] full_void 与任何 partial correction 必须严格互斥',
      );
    }
  }

  private assertCorrectionDeltaShape(
    correctionType: BusinessContributionCorrection['correctionType'],
    revenueDelta: bigint,
    directCostDelta: bigint,
  ): void {
    const valid =
      (correctionType === 'customer_refund' && revenueDelta < 0n && directCostDelta === 0n) ||
      (correctionType === 'rework_direct_cost' && revenueDelta === 0n && directCostDelta > 0n) ||
      (correctionType === 'supplier_cost_recovery' &&
        revenueDelta === 0n &&
        directCostDelta < 0n) ||
      (correctionType === 'full_void' && revenueDelta < 0n && directCostDelta <= 0n);
    if (!valid) {
      throw new ConflictException(
        '[correction_delta_shape_invalid] 更正金额方向与 correction 类型不一致',
      );
    }
  }

  private calculateCorrectionBalance(
    original: BusinessContribution,
    rows: BusinessContributionCorrection[],
    originalAttributionSnapshotHash: string,
  ): CorrectionBalance {
    this.assertCorrectionSequence(rows);
    if (rows.some((item) => item.correctionType === 'full_void') && rows.length !== 1) {
      throw new ConflictException(
        '[full_void_partial_correction_conflict] full_void 与任何 partial correction 必须严格互斥',
      );
    }
    let revenueDeltaCents = 0n;
    let directCostDeltaCents = 0n;
    for (const row of rows) {
      if (
        row.originalContributionId !== original.id ||
        row.businessDomain !== original.businessDomain ||
        row.companyRef !== original.companyRef ||
        row.businessSectorRef !== original.businessSectorRef ||
        row.storeRef !== original.storeRef ||
        row.customerRef !== original.customerRef ||
        row.operatingGroupId !== original.operatingGroupId ||
        row.economicFactKey !== original.economicFactKey ||
        row.attributionSnapshotHash !== originalAttributionSnapshotHash ||
        row.currency !== original.currency
      ) {
        throw new ConflictException(
          '[correction_persisted_binding_invalid] 已保存更正与原贡献范围、经济事实或归因快照不一致',
        );
      }
      const revenueDelta = GroupOperationsCalculator.parseSignedCents(
        row.revenueDeltaCents,
        'correction.revenueDeltaCents',
      );
      const directCostDelta = GroupOperationsCalculator.parseSignedCents(
        row.directCostDeltaCents,
        'correction.directCostDeltaCents',
      );
      const marginDelta = GroupOperationsCalculator.parseSignedCents(
        row.marginDeltaCents,
        'correction.marginDeltaCents',
      );
      this.assertCorrectionDeltaShape(row.correctionType, revenueDelta, directCostDelta);
      if (marginDelta !== revenueDelta - directCostDelta) {
        throw new ConflictException(
          '[correction_margin_formula_invalid] 已保存更正不满足 delta margin 公式',
        );
      }
      revenueDeltaCents += revenueDelta;
      directCostDeltaCents += directCostDelta;
    }
    const remainingRevenueCents = BigInt(original.revenueCents) + revenueDeltaCents;
    const remainingDirectCostCents = BigInt(original.directCostTotalCents) + directCostDeltaCents;
    if (remainingRevenueCents < 0n || remainingDirectCostCents < 0n) {
      throw new ConflictException(
        '[correction_cumulative_balance_invalid] 已保存更正累计金额超过原贡献可更正余额',
      );
    }
    return {
      revenueDeltaCents,
      directCostDeltaCents,
      remainingRevenueCents,
      remainingDirectCostCents,
    };
  }

  private assertCorrectionBalance(
    original: BusinessContribution,
    existing: BusinessContributionCorrection[],
    incoming: NormalizedContributionCorrection,
  ): CorrectionBalance {
    const current = this.calculateCorrectionBalance(
      original,
      existing,
      incoming.attributionSnapshotHash,
    );
    const revenueDelta = BigInt(incoming.revenueDeltaCents);
    const directCostDelta = BigInt(incoming.directCostDeltaCents);
    this.assertCorrectionDeltaShape(incoming.correctionType, revenueDelta, directCostDelta);
    if (
      incoming.correctionType === 'full_void' &&
      (
        existing.length !== 0 ||
        revenueDelta !== -BigInt(original.revenueCents) ||
        directCostDelta !== -BigInt(original.directCostTotalCents)
      )
    ) {
      throw new ConflictException(
        '[full_void_amount_mismatch] full_void 必须在零既有 correction 时精确抵消原收入和原直接成本',
      );
    }
    const remainingRevenueCents = current.remainingRevenueCents + revenueDelta;
    const remainingDirectCostCents = current.remainingDirectCostCents + directCostDelta;
    if (remainingRevenueCents < 0n) {
      throw new ConflictException(
        '[correction_revenue_exceeds_remaining] 客户退款累计不得超过原贡献剩余正式收入',
      );
    }
    if (remainingDirectCostCents < 0n) {
      throw new ConflictException(
        '[correction_cost_recovery_exceeds_remaining] 供应商成本回收累计不得超过剩余正式直接成本',
      );
    }
    return {
      revenueDeltaCents: current.revenueDeltaCents + revenueDelta,
      directCostDeltaCents: current.directCostDeltaCents + directCostDelta,
      remainingRevenueCents,
      remainingDirectCostCents,
    };
  }

  private async assertCorrectionSourceAndEvidenceUnused(
    correction: NormalizedContributionCorrection,
    manager: EntityManager,
  ): Promise<void> {
    const correctionRepo = manager.getRepository(BusinessContributionCorrection);
    if (
      await correctionRepo.findOne({ where: { uniqueSourceKey: correction.uniqueSourceKey } })
    ) {
      throw new ConflictException('[correction_source_duplicate] 同一正式更正来源已使用');
    }
    if (
      await manager
        .getRepository(BusinessContribution)
        .findOne({ where: { uniqueSourceKey: correction.uniqueSourceKey } })
    ) {
      throw new ConflictException(
        '[correction_source_reuses_contribution] 更正来源不得复用任何正式贡献来源',
      );
    }
    if (
      await correctionRepo.findOne({ where: { evidenceUniqueKey: correction.evidenceUniqueKey } })
    ) {
      throw new ConflictException('[correction_evidence_duplicate] 同一正式更正证据已使用');
    }
    await this.assertEvidenceKeysUnused([correction.evidenceUniqueKey], manager);
  }

  private async inspectContributionPeriodLocks(
    operatingGroupId: number,
    recognitionPeriod: string,
    attributionEmployeeIds: number[],
    manager: EntityManager,
  ): Promise<ContributionPeriodLockInspection> {
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(recognitionPeriod)) {
      throw new BadRequestException('[recognition_period_invalid] 统计周期格式必须为 YYYY-MM');
    }
    const groupTargets = await manager
      .getRepository(GroupTarget)
      .createQueryBuilder('target')
      .setLock('pessimistic_write')
      .where('target.group_id = :operatingGroupId', { operatingGroupId })
      .andWhere('target.settlement_period = :recognitionPeriod', { recognitionPeriod })
      .orderBy('target.calculation_version', 'ASC')
      .addOrderBy('target.id', 'ASC')
      .getMany();
    const employeeIds = [...new Set(attributionEmployeeIds)].sort((left, right) => left - right);
    if (!employeeIds.length) {
      throw new ConflictException(
        '[contribution_period_guard_attribution_missing] 期间冻结守卫缺少归因员工范围',
      );
    }
    const laborCostSnapshots = await manager
      .getRepository(LaborCostSnapshot)
      .createQueryBuilder('snapshot')
      .setLock('pessimistic_write')
      .where('snapshot.settlement_period = :recognitionPeriod', { recognitionPeriod })
      .andWhere(
        '(snapshot.group_id = :operatingGroupId OR snapshot.employee_id IN (:...employeeIds))',
        { operatingGroupId, employeeIds },
      )
      .orderBy('snapshot.group_id', 'ASC')
      .addOrderBy('snapshot.employee_id', 'ASC')
      .addOrderBy('snapshot.calculation_version', 'ASC')
      .addOrderBy('snapshot.id', 'ASC')
      .getMany();
    const lockedReasons: string[] = [];
    for (const target of groupTargets) {
      if (
        this.assertPeriodLockState(
          'group_target',
          target.id,
          target.calculationStatus,
          target.lockedAt,
        )
      ) {
        lockedReasons.push(`group_target:${target.id}`);
      }
    }
    for (const snapshot of laborCostSnapshots) {
      if (
        this.assertPeriodLockState(
          'labor_cost_snapshot',
          snapshot.id,
          snapshot.snapshotStatus,
          snapshot.lockedAt,
        )
      ) {
        lockedReasons.push(`labor_cost_snapshot:${snapshot.id}`);
      }
    }
    return {
      groupTargetRowCount: groupTargets.length,
      laborCostSnapshotRowCount: laborCostSnapshots.length,
      lockedReasons,
    };
  }

  private assertPeriodLockState(
    recordType: 'group_target' | 'labor_cost_snapshot',
    recordId: number,
    status: string,
    lockedAt: Date | null,
  ): boolean {
    if (!['calculated', 'calculation_blocked', 'recalculation_required', 'locked'].includes(status)) {
      throw new ConflictException(
        `[period_lock_state_unknown] ${recordType} ${recordId} 存在未知冻结状态，正式贡献写入保持关闭`,
      );
    }
    const statusLocked = status === 'locked';
    const timestampLocked = lockedAt != null;
    if (statusLocked !== timestampLocked) {
      throw new ConflictException(
        `[period_lock_state_inconsistent] ${recordType} ${recordId} 的状态与 lockedAt 不一致，正式贡献写入保持关闭`,
      );
    }
    return statusLocked;
  }

  private async loadAnomalyCandidates(
    normalized: NormalizedContributionDraft,
    manager: EntityManager,
  ) {
    const records = await manager.getRepository(BusinessContribution).find({
      where: { similarityClusterKey: normalized.similarityClusterKey },
      order: { id: 'ASC' },
    });
    return records.filter(
      (record) =>
        record.reversalOfContributionId == null &&
        record.confirmationStatus !== 'voided' &&
        record.uniqueSourceKey !== normalized.uniqueSourceKey &&
        (
          record.economicFactKey === normalized.economicFactKey ||
          (
            record.businessDomain === normalized.normalizedPayload.businessDomain &&
            record.sourceSystem === normalized.normalizedPayload.sourceSystem &&
            record.sourceType === normalized.normalizedPayload.sourceType
          )
        ),
    );
  }

  private async lockSimilarityCluster(
    clusterKey: string,
    currentUserId: number,
    manager: EntityManager,
  ) {
    BusinessContributionAdapters.assertHash(clusterKey, 'similarityClusterKey');
    await manager.query(
      `INSERT INTO business_contribution_similarity_clusters (cluster_key, created_by)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE cluster_key = VALUES(cluster_key)`,
      [clusterKey, currentUserId],
    );
    // The INSERT/UPDATE keeps an exclusive row lock until the surrounding transaction commits.
  }

  private classifyAnomaly(
    contribution: BusinessContribution,
    candidate: BusinessContribution,
  ): ContributionAnomalyType {
    if (contribution.economicFactKey !== candidate.economicFactKey) return 'split_order_risk';
    if (contribution.businessDomain !== candidate.businessDomain) return 'cross_business_duplicate';
    if (contribution.sourceId === candidate.sourceId) return 'cancel_recreate';
    return 'similar_economic_fact';
  }

  private async createAnomalies(
    contribution: BusinessContribution,
    candidates: BusinessContribution[],
    currentUser: CurrentUser,
    manager: EntityManager,
  ) {
    if (!candidates.length) return [];
    const repo = manager.getRepository(BusinessContributionAnomaly);
    return repo.save(
      candidates.map((candidate) => {
        const ids = [contribution.id, candidate.id].sort((left, right) => left - right);
        const leftContribution = ids[0] === contribution.id ? contribution : candidate;
        const rightContribution = ids[1] === contribution.id ? contribution : candidate;
        const anomalyType = this.classifyAnomaly(contribution, candidate);
        const pairKey = GroupOperationsInvariants.payloadFingerprint({
          detectionRuleVersion: CONTRIBUTION_ANOMALY_RULE_VERSION,
          contributionIds: ids,
        });
        return repo.create({
          contributionId: leftContribution.id,
          candidateContributionId: rightContribution.id,
          anomalyType,
          pairKey,
          similarityClusterKey: contribution.similarityClusterKey,
          economicFactKey: contribution.economicFactKey,
          detectionRuleVersion: CONTRIBUTION_ANOMALY_RULE_VERSION,
          detectedPayloadHash: GroupOperationsInvariants.payloadFingerprint({
            anomalyType,
            contributionId: contribution.id,
            contributionUniqueSourceKey: contribution.uniqueSourceKey,
            contributionRevenueCents: contribution.revenueCents,
            candidateContributionId: candidate.id,
            candidateUniqueSourceKey: candidate.uniqueSourceKey,
            candidateRevenueCents: candidate.revenueCents,
            similarityClusterKey: contribution.similarityClusterKey,
            economicFactKey: contribution.economicFactKey,
          }),
          status: 'open',
          resolution: null,
          canonicalContributionId: null,
          duplicateContributionId: null,
          resolutionReason: null,
          resolutionEvidenceRef: null,
          resolutionEvidenceHash: null,
          resolutionIdempotencyKey: null,
          resolutionRequestFingerprint: null,
          version: 1,
          createdBy: currentUser.id,
          resolvedBy: null,
          resolvedAt: null,
        });
      }),
    );
  }

  private async loadAnomaly(
    id: number,
    manager = this.dataSource.manager,
    lock = false,
  ) {
    const repo = manager.getRepository(BusinessContributionAnomaly);
    const record = lock
      ? await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } })
      : await repo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('业务贡献异常记录不存在');
    return record;
  }

  private async loadContribution(
    id: number,
    manager = this.dataSource.manager,
    lock = false,
  ) {
    const repo = manager.getRepository(BusinessContribution);
    const record = lock
      ? await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } })
      : await repo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('业务贡献记录不存在');
    return record;
  }

  private async loadContributionBundle(
    id: number,
    manager = this.dataSource.manager,
    currentUser?: CurrentUser,
    knownAccess?: ContributionReadAccess,
  ) {
    const contribution = await this.loadContribution(id, manager);
    const evidence = await manager.getRepository(BusinessContributionEvidence).find({
      where: { contributionId: id },
      order: { evidenceRole: 'ASC', costCategory: 'ASC', id: 'ASC' },
    });
    const attributions = await manager.getRepository(BusinessContributionAttribution).find({
      where: { contributionId: id },
      order: { role: 'ASC', employeeId: 'ASC', id: 'ASC' },
    });
    const anomalies = await manager.getRepository(BusinessContributionAnomaly).find({
      where: [{ contributionId: id }, { candidateContributionId: id }],
      order: { id: 'ASC' },
    });
    const corrections = await manager.getRepository(BusinessContributionCorrection).find({
      where: { originalContributionId: id },
      order: { sequence: 'ASC', id: 'ASC' },
    });
    if (!currentUser) {
      return {
        projection: 'full' as const,
        contribution,
        evidence,
        attributions,
        anomalies,
        corrections,
      };
    }
    const access = knownAccess ?? await this.resolveContributionReadAccess(contribution, currentUser);
    if (access === 'none') {
      throw new ForbiddenException('[contribution_scope_denied] 当前用户无权查看该贡献记录');
    }
    if (access === 'full') {
      return {
        projection: 'full' as const,
        contribution,
        evidence,
        attributions,
        anomalies,
        corrections,
      };
    }
    const linked = await manager.getRepository(Employee).findOne({
      where: { linkedUserId: currentUser.id, status: 1 },
    });
    return {
      projection: 'own_attribution' as const,
      contribution: this.projectContributionRecord(contribution, access),
      evidence: [],
      attributions: linked
        ? attributions.filter((item) => item.employeeId === linked.id)
        : [],
      anomalies: [],
      corrections: corrections.map((item) => this.projectCorrectionRecord(item)),
    };
  }

  private correctionSelectionFromDto(
    original: BusinessContribution,
    originalAttributionSnapshotHash: string,
    dto: CreateBusinessContributionCorrectionDto,
  ): ContributionCorrectionSelection {
    return {
      businessDomain: original.businessDomain,
      sourceSystem: dto.sourceSystem.trim().toLowerCase(),
      sourceType: dto.sourceType.trim().toLowerCase(),
      sourceId: dto.sourceId.trim().toLowerCase(),
      sourceVersion: dto.sourceVersion.trim().toLowerCase(),
      sourceRecordHash: BusinessContributionAdapters.assertHash(
        dto.sourceRecordHash,
        'sourceRecordHash',
      ),
      originalContributionId: original.id,
      correctionType: dto.correctionType,
      companyRef: original.companyRef,
      businessSectorRef: original.businessSectorRef,
      storeRef: original.storeRef,
      customerRef: original.customerRef,
      operatingGroupId: original.operatingGroupId,
      sourceAuthorityVersionId: dto.sourceAuthorityVersionId,
      originalEconomicFactKey: original.economicFactKey,
      originalAttributionSnapshotHash,
      originalAuthoritySnapshotHash: original.authoritySnapshotHash,
      originalEvidenceBundleHash: original.evidenceBundleHash,
      originalRecognitionAt: original.recognitionAt.toISOString(),
      originalConfirmedAt: original.confirmedAt?.toISOString() ?? '',
    };
  }

  private async loadCorrectionResult(
    correction: BusinessContributionCorrection,
    manager: EntityManager,
  ) {
    const original = await this.loadContribution(correction.originalContributionId, manager);
    const attributions = await manager.getRepository(BusinessContributionAttribution).find({
      where: { contributionId: original.id },
      order: { id: 'ASC' },
    });
    if (!attributions.length) {
      throw new ConflictException('[correction_attribution_missing] 原贡献缺少可追溯归因');
    }
    const rows = await manager.getRepository(BusinessContributionCorrection).find({
      where: { originalContributionId: original.id },
      order: { sequence: 'ASC', id: 'ASC' },
    });
    const balance = this.calculateCorrectionBalance(
      original,
      rows,
      this.attributionSnapshotHash(attributions),
    );
    return {
      correction,
      remainingRevenueCents: balance.remainingRevenueCents.toString(),
      remainingDirectCostCents: balance.remainingDirectCostCents.toString(),
      contribution: await this.loadContributionBundle(original.id, manager),
    };
  }

  private async loadGroup(id: number, manager = this.dataSource.manager, lock = false) {
    const repo = manager.getRepository(OrganizationGroup);
    const group = lock
      ? await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_read' } })
      : await repo.findOne({ where: { id } });
    if (!group) throw new BadRequestException('[operating_group_missing] 经营小组不存在');
    return group;
  }

  private assertGroupScope(group: OrganizationGroup, scope: ContributionScope, at: Date) {
    const date = BusinessContributionAdapters.settlementDateOfInstant(at);
    if (
      group.companyRef !== scope.companyRef ||
      group.businessSectorRef !== scope.businessSectorRef ||
      group.storeRef !== scope.storeRef ||
      group.establishedAt > date ||
      Boolean(group.closedAt && group.closedAt < date)
    ) {
      throw new BadRequestException('[operating_group_scope_mismatch] 经营小组不属于贡献确认日的组织范围');
    }
  }

  private async assertOrganizationScope(scope: ContributionScope, at: Date, manager: EntityManager) {
    const company = await manager.getRepository(BusinessCompanyRef).findOne({
      where: { companyRef: scope.companyRef, status: 'active' },
    });
    if (!company || !this.isEffectiveAt(company.validFrom, company.validUntil, at)) {
      throw new BadRequestException('[company_scope_invalid] 公司引用不存在或不在有效期');
    }
    if (scope.storeRef && !scope.businessSectorRef) {
      throw new BadRequestException('[store_sector_required] 门店范围必须指定业务板块');
    }
    if (!scope.businessSectorRef) return;
    const sector = await manager.getRepository(BusinessSector).findOne({
      where: { businessSectorRef: scope.businessSectorRef, status: 'active' },
    });
    const companySector = await manager.getRepository(CompanySectorAssignment).findOne({
      where: {
        companyRef: scope.companyRef,
        businessSectorRef: scope.businessSectorRef,
        status: 'active',
      },
    });
    if (!sector || !companySector || !this.isEffectiveAt(companySector.validFrom, companySector.validUntil, at)) {
      throw new BadRequestException('[sector_scope_invalid] 业务板块未获公司有效授权');
    }
    if (!scope.storeRef) return;
    const store = await manager.getRepository(BusinessStore).findOne({
      where: { storeRef: scope.storeRef, status: 'active' },
    });
    const storeSector = await manager.getRepository(StoreSectorAssignment).findOne({
      where: {
        storeRef: scope.storeRef,
        businessSectorRef: scope.businessSectorRef,
        status: 'active',
      },
    });
    if (
      !store ||
      store.companyRef !== scope.companyRef ||
      !this.isEffectiveAt(store.validFrom, store.validUntil, at) ||
      !storeSector ||
      !this.isEffectiveAt(storeSector.validFrom, storeSector.validUntil, at)
    ) {
      throw new BadRequestException('[store_scope_invalid] 门店不属于公司/板块有效范围');
    }
  }

  private async assertCustomer(customerRef: string | null, manager: EntityManager) {
    if (!customerRef) return;
    const customer = await manager.getRepository(CustomerMasterRecord).findOne({
      where: { customerRef },
    });
    if (!customer || !['active', 'merged'].includes(customer.status)) {
      throw new BadRequestException('[customer_ref_invalid] 客户主数据不存在或不可用');
    }
  }

  private async assertWriteScope(
    currentUser: CurrentUser,
    scope: ContributionScope,
    permission: ContributionWritePermission,
    manager: EntityManager,
  ): Promise<CurrentUser> {
    const actor = await this.lockCurrentWriteActor(currentUser, permission, manager);
    return this.assertLockedActorScope(actor, scope, permission, manager);
  }

  private async lockCurrentWriteActor(
    currentUser: CurrentUser,
    permission: ContributionWritePermission,
    manager: EntityManager,
  ): Promise<LockedContributionActor> {
    if (currentUser.identitySource !== 'trusted_proxy') {
      throw new ForbiddenException('[contribution_write_denied] 当前角色或身份来源无权执行贡献写命令');
    }

    // Formal contribution writes use transaction-current RBAC. The request
    // guard is only a fast rejection layer; it is never the write authority.
    // Keep the global order stable before any contribution/group/correction
    // write lock: User -> UserRole(id) -> Role(id) -> Employee(id) -> Grant(id).
    const user = await manager.getRepository(User).findOne({
      where: { id: currentUser.id },
      lock: { mode: 'pessimistic_read' },
    });
    if (!user || user.status !== 1 || user.username !== currentUser.username) {
      throw new ForbiddenException('[contribution_write_actor_revoked] 当前正式人员已禁用或身份已变化');
    }

    const userRoles = await manager.getRepository(UserRole).find({
      where: { userId: user.id },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_read' },
    });
    const boundRoleIds = userRoles.map((item) => item.roleId);
    const roleIds = [...new Set(boundRoleIds)].sort((left, right) => left - right);
    if (boundRoleIds.length !== roleIds.length) {
      throw new ForbiddenException('[contribution_write_role_binding_duplicate] 当前正式人员角色绑定重复');
    }
    const roles: Role[] = [];
    for (const roleId of roleIds) {
      const role = await manager.getRepository(Role).findOne({
        where: { id: roleId },
        lock: { mode: 'pessimistic_read' },
      });
      if (!role) {
        throw new ForbiddenException('[contribution_write_role_revoked] 当前正式角色绑定已失效');
      }
      roles.push(role);
    }
    const lockedCurrentUser: CurrentUser = {
      ...currentUser,
      username: user.username,
      realName: user.realName,
      roleCodes: roles.map((role) => role.code),
    };
    if (!BusinessContributionAccessPolicy.canUseWritePermission(lockedCurrentUser, permission)) {
      throw new ForbiddenException('[contribution_write_role_revoked] 事务当前角色无权执行贡献写命令');
    }

    const employees = await manager.getRepository(Employee).find({
      where: { linkedUserId: user.id, status: 1 },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_read' },
    });
    if (employees.length !== 1) {
      throw new ForbiddenException('[contribution_write_employee_revoked] 当前人员缺少唯一有效员工绑定');
    }
    return {
      currentUser: lockedCurrentUser,
      employeeId: employees[0].id,
    };
  }

  private async assertLockedActorScope(
    actor: LockedContributionActor,
    scope: ContributionScope,
    permission: ContributionWritePermission,
    manager: EntityManager,
  ): Promise<CurrentUser> {
    const grants = await manager.getRepository(BusinessScopeGrant).find({
      where: {
        userId: actor.currentUser.id,
        employeeId: actor.employeeId,
        companyRef: scope.companyRef,
        status: 'active',
      },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_read' },
    });
    const now = new Date();
    const matching = grants.filter(
      (grant) =>
        grant.validFrom <= now &&
        (!grant.validUntil || grant.validUntil >= now) &&
        Array.isArray(grant.permissions) &&
        (grant.permissions.includes('*') || grant.permissions.includes(permission)) &&
        (!grant.businessSectorRef || grant.businessSectorRef === scope.businessSectorRef) &&
        (!grant.storeRef || grant.storeRef === scope.storeRef) &&
        (!grant.customerRef || grant.customerRef === scope.customerRef),
    );
    if (matching.some((grant) => grant.effect === 'deny')) {
      throw new ForbiddenException('[business_scope_denied] 当前人员被明确禁止在该组织范围执行贡献写命令');
    }
    if (!matching.some((grant) => grant.effect === 'allow')) {
      throw new ForbiddenException('[business_scope_missing] 当前人员缺少该组织范围的贡献写权限');
    }
    return actor.currentUser;
  }

  private async resolveContributionReadAccess(
    record: BusinessContribution,
    currentUser: CurrentUser,
    manager = this.dataSource.manager,
  ): Promise<ContributionReadAccess> {
    const linked = await manager.getRepository(Employee).findOne({
      where: { linkedUserId: currentUser.id, status: 1 },
    });
    const group = await this.loadGroup(record.operatingGroupId, manager);
    const attributions = await manager.getRepository(BusinessContributionAttribution).find({
      where: { contributionId: record.id },
      order: { id: 'ASC' },
    });
    const grants = await this.loadScopeGrantFacts(
      this.contributionScope(record),
      currentUser,
      'gov1.contribution.read',
      manager,
    );
    return BusinessContributionAccessPolicy.contributionReadAccess(currentUser, {
      linkedEmployeeId: linked?.id ?? null,
      leaderEmployeeId: group.leaderEmployeeId,
      businessOwnerEmployeeId: group.businessOwnerEmployeeId,
      activeMemberEmployeeIds: [],
      attributionEmployeeIds: attributions.map((item) => item.employeeId),
      scopeGranted: grants.granted,
      scopeDenied: grants.denied,
    });
  }

  private projectContributionRecord(
    record: BusinessContribution,
    access: ContributionReadAccess,
  ): BusinessContribution | Record<string, unknown> {
    if (access === 'full') return record;
    return {
      id: record.id,
      businessDomain: record.businessDomain,
      operatingGroupId: record.operatingGroupId,
      sourceSystem: record.sourceSystem,
      sourceType: record.sourceType,
      sourceId: record.sourceId,
      recognitionPeriod: record.recognitionPeriod,
      recognitionAt: record.recognitionAt,
      revenueCents: record.revenueCents,
      directCostTotalCents: record.directCostTotalCents,
      validContributionMarginCents: record.validContributionMarginCents,
      currency: record.currency,
      confirmationStatus: record.confirmationStatus,
      reversalOfContributionId: record.reversalOfContributionId,
      reversedByContributionId: record.reversedByContributionId,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private projectCorrectionRecord(record: BusinessContributionCorrection) {
    return {
      id: record.id,
      originalContributionId: record.originalContributionId,
      correctionType: record.correctionType,
      sequence: record.sequence,
      revenueDeltaCents: record.revenueDeltaCents,
      directCostDeltaCents: record.directCostDeltaCents,
      marginDeltaCents: record.marginDeltaCents,
      recognitionPeriod: record.recognitionPeriod,
      recognitionAt: record.recognitionAt,
      currency: record.currency,
      createdAt: record.createdAt,
    };
  }

  private async applyAuthorityReadScopeSql(
    qb: SelectQueryBuilder<ContributionSourceAuthorityVersion>,
    alias: string,
    currentUser: CurrentUser,
  ) {
    const linked = await this.dataSource.getRepository(Employee).findOne({
      where: { linkedUserId: currentUser.id, status: 1 },
    });
    if (!linked) {
      qb.andWhere('1 = 0');
      return;
    }
    const prefix = `${alias.replace(/[^A-Za-z0-9]/g, '')}AuthorityScope`;
    const permissionSql = this.scopePermissionSql(alias, prefix, false);
    qb.andWhere(
      `NOT EXISTS (${permissionSql.deny}) AND EXISTS (${permissionSql.allow})`,
      this.scopePermissionParameters(prefix, currentUser.id, linked.id),
    );
  }

  private async applyContributionReadScopeSql(
    qb: SelectQueryBuilder<ObjectLiteral>,
    alias: string,
    currentUser: CurrentUser,
    includeAttribution: boolean,
  ) {
    const linked = await this.dataSource.getRepository(Employee).findOne({
      where: { linkedUserId: currentUser.id, status: 1 },
    });
    if (!linked) {
      qb.andWhere('1 = 0');
      return;
    }
    const prefix = `${alias.replace(/[^A-Za-z0-9]/g, '')}ContributionScope`;
    const permissionSql = this.scopePermissionSql(alias, prefix, true);
    const groupResponsibility = `EXISTS (
      SELECT 1 FROM organization_groups ${prefix}_group
      WHERE ${prefix}_group.id = ${alias}.operating_group_id
        AND (${prefix}_group.leader_employee_id = :${prefix}EmployeeId
          OR ${prefix}_group.business_owner_employee_id = :${prefix}EmployeeId)
    )`;
    const attribution = includeAttribution
      ? ` OR EXISTS (
          SELECT 1 FROM business_contribution_attributions ${prefix}_attribution
          WHERE ${prefix}_attribution.contribution_id = ${alias}.id
            AND ${prefix}_attribution.employee_id = :${prefix}EmployeeId
            AND ${prefix}_attribution.status IN ('pending','confirmed','reversed')
        )`
      : '';
    qb.andWhere(
      `NOT EXISTS (${permissionSql.deny}) AND (
        EXISTS (${permissionSql.allow})
        OR ${groupResponsibility}
        ${attribution}
      )`,
      this.scopePermissionParameters(prefix, currentUser.id, linked.id),
    );
  }

  private scopePermissionSql(alias: string, prefix: string, hasCustomer: boolean) {
    const common = (effect: 'allow' | 'deny') => `
      SELECT 1 FROM business_scope_grants ${prefix}_${effect}
      WHERE ${prefix}_${effect}.user_id = :${prefix}UserId
        AND ${prefix}_${effect}.employee_id = :${prefix}EmployeeId
        AND ${prefix}_${effect}.company_ref = ${alias}.company_ref
        AND ${prefix}_${effect}.status = 'active'
        AND ${prefix}_${effect}.effect = '${effect}'
        AND ${prefix}_${effect}.valid_from <= :${prefix}Now
        AND (${prefix}_${effect}.valid_until IS NULL OR ${prefix}_${effect}.valid_until >= :${prefix}Now)
        AND (
          JSON_CONTAINS(${prefix}_${effect}.permissions, JSON_QUOTE(:${prefix}WildcardPermission)) = 1
          OR JSON_CONTAINS(${prefix}_${effect}.permissions, JSON_QUOTE(:${prefix}ReadPermission)) = 1
        )
        AND (${prefix}_${effect}.business_sector_ref IS NULL
          OR ${prefix}_${effect}.business_sector_ref <=> ${alias}.business_sector_ref)
        AND (${prefix}_${effect}.store_ref IS NULL
          OR ${prefix}_${effect}.store_ref <=> ${alias}.store_ref)
        ${hasCustomer
          ? `AND (${prefix}_${effect}.customer_ref IS NULL
            OR ${prefix}_${effect}.customer_ref <=> ${alias}.customer_ref)`
          : `AND ${prefix}_${effect}.customer_ref IS NULL`}
    `;
    return { allow: common('allow'), deny: common('deny') };
  }

  private scopePermissionParameters(prefix: string, userId: number, employeeId: number) {
    return {
      [`${prefix}UserId`]: userId,
      [`${prefix}EmployeeId`]: employeeId,
      [`${prefix}Now`]: new Date(),
      [`${prefix}WildcardPermission`]: '*',
      [`${prefix}ReadPermission`]: 'gov1.contribution.read',
    };
  }

  private async canReadGroup(group: OrganizationGroup, at: Date, currentUser: CurrentUser) {
    const linked = await this.dataSource.getRepository(Employee).findOne({
      where: { linkedUserId: currentUser.id, status: 1 },
    });
    const date = at.toISOString().slice(0, 10);
    const members = await this.dataSource
      .getRepository(GroupMember)
      .createQueryBuilder('member')
      .where('member.group_id = :groupId', { groupId: group.id })
      .andWhere('member.effective_from <= :date', { date })
      .andWhere('(member.effective_to IS NULL OR member.effective_to >= :date)', { date })
      .getMany();
    const grants = await this.loadScopeGrantFacts(
      { ...this.groupScope(group), customerRef: null },
      currentUser,
      'gov1.contribution.read',
      this.dataSource.manager,
    );
    return BusinessContributionAccessPolicy.canReadGroupSummary(currentUser, {
      linkedEmployeeId: linked?.id ?? null,
      leaderEmployeeId: group.leaderEmployeeId,
      businessOwnerEmployeeId: group.businessOwnerEmployeeId,
      activeMemberEmployeeIds: members.map((item) => item.employeeId),
      attributionEmployeeIds: [],
      scopeGranted: grants.granted,
      scopeDenied: grants.denied,
    });
  }

  private async loadScopeGrantFacts(
    scope: ContributionScope,
    currentUser: CurrentUser,
    permission: string,
    manager: EntityManager,
  ) {
    const linked = await manager.getRepository(Employee).findOne({
      where: { linkedUserId: currentUser.id, status: 1 },
    });
    if (!linked) return { granted: false, denied: false };
    const grants = await manager.getRepository(BusinessScopeGrant).find({
      where: {
        userId: currentUser.id,
        employeeId: linked.id,
        companyRef: scope.companyRef,
        status: 'active',
      },
      order: { id: 'ASC' },
    });
    const now = new Date();
    const matching = grants.filter(
      (grant) =>
        grant.validFrom <= now &&
        (!grant.validUntil || grant.validUntil >= now) &&
        Array.isArray(grant.permissions) &&
        (grant.permissions.includes('*') || grant.permissions.includes(permission)) &&
        (!grant.businessSectorRef || grant.businessSectorRef === scope.businessSectorRef) &&
        (!grant.storeRef || grant.storeRef === scope.storeRef) &&
        (!grant.customerRef || grant.customerRef === scope.customerRef),
    );
    return {
      granted: matching.some((grant) => grant.effect === 'allow'),
      denied: matching.some((grant) => grant.effect === 'deny'),
    };
  }

  private async assertDraftGroupResponsibility(
    currentUser: CurrentUser,
    group: OrganizationGroup,
    manager: EntityManager,
  ) {
    if (
      BusinessContributionAccessPolicy.canUseWritePermission(
        currentUser,
        'gov1.contribution.confirm',
      )
    ) {
      return;
    }
    const linked = await manager.getRepository(Employee).findOne({
      where: { linkedUserId: currentUser.id, status: 1 },
    });
    if (
      !linked ||
      (group.leaderEmployeeId !== linked.id && group.businessOwnerEmployeeId !== linked.id)
    ) {
      throw new ForbiddenException(
        '[draft_group_responsibility_missing] 组长或业务负责人只能为本人负责的小组创建贡献草稿',
      );
    }
  }

  private settlementPeriodEnd(recognitionPeriod: string): Date {
    const [year, month] = recognitionPeriod.split('-').map(Number);
    return new Date(Date.UTC(year, month, 0, 12, 0, 0, 0));
  }

  private authorityCommandPayload(dto: PublishContributionSourceAuthorityDto) {
    return {
      ruleVersionId: this.canonicalRuleVersionId(dto.ruleVersionId),
      companyRef: dto.companyRef.trim(),
      businessSectorRef: dto.businessSectorRef?.trim() || null,
      storeRef: dto.storeRef?.trim() || null,
      businessDomain: dto.businessDomain,
      sourceSystem: dto.sourceSystem.trim().toLowerCase(),
      sourceType: dto.sourceType.trim().toLowerCase(),
      adapterVersion: dto.adapterVersion.trim(),
      effectiveFrom: BusinessContributionAdapters.normalizeDate(dto.effectiveFrom, 'effectiveFrom'),
      effectiveTo: dto.effectiveTo
        ? BusinessContributionAdapters.normalizeDate(dto.effectiveTo, 'effectiveTo')
        : null,
      currency: dto.currency,
      ...this.commandPayload(dto),
    };
  }

  private canonicalRuleVersionId(value: string): string {
    if (typeof value !== 'string') {
      throw new ConflictException('[source_authority_rule_version_invalid] 来源授权规则版本无效');
    }
    const normalized = value.trim();
    const codePointLength = Array.from(normalized).length;
    if (codePointLength < 2 || codePointLength > 100) {
      throw new ConflictException('[source_authority_rule_version_invalid] 来源授权规则版本无效');
    }
    return normalized;
  }

  private createCommandPayload(dto: CreateBusinessContributionDto) {
    return {
      ...this.selectionFromDto(dto),
      sourceAuthorityVersionId: dto.sourceAuthorityVersionId,
      attributions: dto.attributions
        .map((item) => ({
          role: item.role,
          originBusinessDomain: item.originBusinessDomain,
          employeeId: item.employeeId,
          shareBps: item.shareBps,
          evidenceRef: item.evidenceRef.trim(),
          evidenceHash: item.evidenceHash.trim().toLowerCase(),
        }))
        .sort(
          (left, right) =>
            left.role.localeCompare(right.role) ||
            left.employeeId - right.employeeId ||
            left.originBusinessDomain.localeCompare(right.originBusinessDomain),
        ),
      ...this.commandPayload(dto),
    };
  }

  private confirmCommandPayload(contributionId: number, dto: ConfirmBusinessContributionDto) {
    return {
      contributionId,
      expectedContributionVersion: dto.expectedContributionVersion,
      expectedEvidenceBundleHash: dto.expectedEvidenceBundleHash.trim().toLowerCase(),
      confirmationEvidenceRef: dto.confirmationEvidenceRef.trim(),
      confirmationEvidenceHash: dto.confirmationEvidenceHash.trim().toLowerCase(),
      ...this.commandPayload(dto),
    };
  }

  private reverseCommandPayload(contributionId: number, dto: ReverseBusinessContributionDto) {
    return {
      contributionId,
      expectedContributionVersion: dto.expectedContributionVersion,
      ...this.commandPayload(dto),
    };
  }

  private correctionCommandPayload(
    contributionId: number,
    dto: CreateBusinessContributionCorrectionDto,
  ) {
    return {
      contributionId,
      correctionType: dto.correctionType,
      expectedContributionVersion: dto.expectedContributionVersion,
      sourceAuthorityVersionId: dto.sourceAuthorityVersionId,
      sourceSystem: dto.sourceSystem.trim().toLowerCase(),
      sourceType: dto.sourceType.trim().toLowerCase(),
      sourceId: dto.sourceId.trim().toLowerCase(),
      sourceVersion: dto.sourceVersion.trim().toLowerCase(),
      sourceRecordHash: BusinessContributionAdapters.assertHash(
        dto.sourceRecordHash,
        'sourceRecordHash',
      ),
      ...this.commandPayload(dto),
    };
  }

  private resolveAnomalyCommandPayload(
    anomalyId: number,
    dto: ResolveBusinessContributionAnomalyDto,
  ) {
    return {
      anomalyId,
      expectedAnomalyVersion: dto.expectedAnomalyVersion,
      resolution: dto.resolution,
      canonicalContributionId: dto.canonicalContributionId ?? null,
      duplicateContributionId: dto.duplicateContributionId ?? null,
      resolutionEvidenceRef: dto.resolutionEvidenceRef.trim(),
      resolutionEvidenceHash: dto.resolutionEvidenceHash.trim().toLowerCase(),
      ...this.commandPayload(dto),
    };
  }

  private commandPayload(command: CommandMetadata) {
    return {
      reason: command.reason.trim(),
      sourceChannel: command.sourceChannel.trim(),
      correlationId: command.correlationId.trim(),
      idempotencyKey: command.idempotencyKey.trim(),
    };
  }

  private assertCommandMetadata(command: CommandMetadata) {
    if (!command.reason?.trim() || command.reason.trim().length > 500) {
      throw new BadRequestException('[command_reason_invalid] 写命令必须提供有效原因');
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{1,49}$/.test(command.sourceChannel?.trim())) {
      throw new BadRequestException('[source_channel_invalid] 写命令来源渠道格式无效');
    }
    const key = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/;
    if (!key.test(command.correlationId?.trim()) || !key.test(command.idempotencyKey?.trim())) {
      throw new BadRequestException('[command_key_invalid] 关联标识或幂等键格式无效');
    }
  }

  private assertCorrectionReasonCode(
    reason: string,
    correctionType: BusinessContributionCorrectionType,
  ): BusinessContributionCorrectionReasonCode {
    const normalized = reason?.trim() ?? '';
    const expected = BUSINESS_CONTRIBUTION_CORRECTION_REASON_BY_TYPE[correctionType];
    if (!expected || normalized !== expected) {
      throw new BadRequestException(
        '[correction_reason_code_invalid] 更正原因必须使用与更正类型严格对应的服务端固定规范码',
      );
    }
    return expected;
  }

  private dtoScope(
    dto: { companyRef: string; businessSectorRef?: string; storeRef?: string },
    customerRef: string | null,
  ): ContributionScope {
    return {
      companyRef: dto.companyRef.trim(),
      businessSectorRef: dto.businessSectorRef?.trim() || null,
      storeRef: dto.storeRef?.trim() || null,
      customerRef,
    };
  }

  private authorityScope(record: ContributionSourceAuthorityVersion): ContributionScope {
    return {
      companyRef: record.companyRef,
      businessSectorRef: record.businessSectorRef,
      storeRef: record.storeRef,
      customerRef: null,
    };
  }

  private contributionScope(record: BusinessContribution): ContributionScope {
    return {
      companyRef: record.companyRef,
      businessSectorRef: record.businessSectorRef,
      storeRef: record.storeRef,
      customerRef: record.customerRef,
    };
  }

  private scopesEqual(left: ContributionScope, right: ContributionScope): boolean {
    return (
      left.companyRef === right.companyRef &&
      left.businessSectorRef === right.businessSectorRef &&
      left.storeRef === right.storeRef &&
      left.customerRef === right.customerRef
    );
  }

  private contributionWritePreview(record: BusinessContribution): ContributionWritePreview {
    return {
      id: record.id,
      version: record.version,
      scope: this.contributionScope(record),
    };
  }

  private async loadContributionWritePreview(id: number): Promise<ContributionWritePreview> {
    const record = await this.dataSource.getRepository(BusinessContribution).findOne({ where: { id } });
    if (!record) throw new NotFoundException('[contribution_not_found] 未找到业务贡献记录');
    return this.contributionWritePreview(record);
  }

  private assertContributionMatchesPreview(
    locked: BusinessContribution,
    preview: ContributionWritePreview,
  ): void {
    const scope = this.contributionScope(locked);
    if (
      locked.id !== preview.id ||
      locked.version !== preview.version ||
      scope.companyRef !== preview.scope.companyRef ||
      scope.businessSectorRef !== preview.scope.businessSectorRef ||
      scope.storeRef !== preview.scope.storeRef ||
      scope.customerRef !== preview.scope.customerRef
    ) {
      throw new ConflictException(
        '[contribution_write_preview_changed] 贡献身份、范围或版本在事务锁定前已变化，请刷新后重试',
      );
    }
  }

  private groupScope(group: OrganizationGroup) {
    return {
      companyRef: group.companyRef,
      businessSectorRef: group.businessSectorRef,
      storeRef: group.storeRef,
    };
  }

  private dateRangesOverlap(
    leftFrom: string,
    leftTo: string | null,
    rightFrom: string,
    rightTo: string | null,
  ) {
    return leftFrom <= (rightTo ?? '9999-12-31') && rightFrom <= (leftTo ?? '9999-12-31');
  }

  private isEffectiveAt(from: Date, until: Date | null, at: Date) {
    return from <= at && (!until || until >= at);
  }

  private async runContributionMutation<T>(
    callback: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.dataSource.transaction('REPEATABLE READ', async (manager) => {
        await this.assertContributionTransactionContext(manager);
        return callback(manager);
      });
    } catch (error) {
      const code =
        (error as { driverError?: { code?: string }; code?: string })?.driverError?.code ??
        (error as { code?: string })?.code;
      if (code === 'ER_DUP_ENTRY') {
        throw new ConflictException('[contribution_duplicate_write] 并发写入触发唯一性保护，请刷新后重试');
      }
      throw error;
    }
  }

  private async assertContributionTransactionContext(manager: EntityManager): Promise<void> {
    const runner = manager.queryRunner;
    if (
      manager.connection !== this.dataSource ||
      !runner ||
      !runner.isTransactionActive ||
      runner.manager !== manager ||
      runner.connection !== this.dataSource
    ) {
      throw new ConflictException(
        '[contribution_transaction_manager_invalid] 创建/确认贡献必须共用同一活动 QueryRunner 与连接',
      );
    }
    let rows: Array<{ state?: unknown; isolationLevel?: unknown; autocommit?: unknown }>;
    try {
      rows = await manager.query(
        `SELECT trx.STATE AS state,
                trx.ISOLATION_LEVEL AS isolationLevel,
                trx.AUTOCOMMIT AS autocommit
           FROM performance_schema.events_transactions_current trx
           JOIN performance_schema.threads th ON th.THREAD_ID = trx.THREAD_ID
          WHERE th.PROCESSLIST_ID = CONNECTION_ID()`,
      ) as typeof rows;
    } catch {
      throw new ConflictException(
        '[contribution_transaction_oracle_unavailable] 无法核验贡献写事务隔离与提交状态',
      );
    }
    const isolation = String(rows[0]?.isolationLevel ?? '')
      .trim()
      .toUpperCase()
      .replace(/[-_\s]+/g, ' ');
    if (
      rows.length !== 1 ||
      String(rows[0]?.state ?? '').trim().toUpperCase() !== 'ACTIVE' ||
      isolation !== 'REPEATABLE READ' ||
      !['NO', '0'].includes(String(rows[0]?.autocommit ?? '').trim().toUpperCase())
    ) {
      throw new ConflictException(
        '[contribution_transaction_isolation_invalid] 创建/确认贡献只接受 ACTIVE REPEATABLE READ 非自动提交事务',
      );
    }
  }

  private async runMutation<T>(callback: (manager: EntityManager) => Promise<T>): Promise<T> {
    try {
      return await this.dataSource.transaction(callback);
    } catch (error) {
      const code = (error as { driverError?: { code?: string }; code?: string })?.driverError?.code ??
        (error as { code?: string })?.code;
      if (code === 'ER_DUP_ENTRY') {
        throw new ConflictException('[contribution_duplicate_write] 并发写入触发唯一性保护，请刷新后重试');
      }
      throw error;
    }
  }

  private async audit(
    targetId: number,
    action: string,
    currentUser: CurrentUser,
    command: CommandMetadata,
    manager: EntityManager,
    detail: Record<string, unknown>,
  ) {
    await this.operationLogsService.create(
      {
        module: 'group_operations',
        targetId,
        action,
        operatorId: currentUser.id,
        detail: command.reason.trim(),
        detailJson: {
          ...detail,
          reason: command.reason.trim(),
          sourceChannel: command.sourceChannel.trim(),
          correlationId: command.correlationId.trim(),
          idempotencyKey: command.idempotencyKey.trim(),
          actorIdentitySource: currentUser.identitySource ?? null,
        },
      },
      manager,
    );
  }
}
