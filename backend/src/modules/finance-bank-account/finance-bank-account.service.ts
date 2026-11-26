import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';
import { buildPaginationResult, getPagination } from '../../common/utils/pagination.util';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { OperationLogAction } from '../../shared/enums/operation-log-action.enum';
import { BankSmsTransaction } from '../finance-bank-sms/entities/bank-sms-transaction.entity';
import { BusinessFoundationService } from '../business-foundation/business-foundation.service';
import {
  assertPendingBindingReleaseReady,
  buildBankAccountRegistryUpdateAuditContract,
  buildPendingBindingReleaseChecklist,
  type BankAccountRegistryUpdateAuditContract,
  type PendingBindingReleaseChecklistResult,
  type PendingBindingReleaseChecklistStep,
} from '../finance-reconciliation/pending-binding-evidence.contract';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { Role } from '../roles/entities/role.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { User } from '../users/entities/user.entity';
import {
  bankAccountRegistryContentSnapshotHash,
  buildBankAccountRegistryReviewAuthorityHash,
} from './bank-account-registry-authority.contract';
import { QueryBankAccountRegistryDto } from './dto/query-bank-account-registry.dto';
import { ReviewBankAccountRegistryDto } from './dto/review-bank-account-registry.dto';
import { SaveBankAccountRegistryDto } from './dto/save-bank-account-registry.dto';
import { BankAccountRegistry } from './entities/bank-account-registry.entity';
import { BankAccountRegistryReviewAuthority } from './entities/bank-account-registry-review-authority.entity';

const WRITE_ROLES = ['admin', 'finance', 'super_admin', 'owner', 'finance_manager', 'finance_operator'] as const;
const READ_ROLES = [...WRITE_ROLES, 'auditor'] as const;
const REVIEW_ROLES = ['owner', 'super_admin', 'auditor', 'finance_manager'] as const;

type BankAccountRegistryAuditDto = SaveBankAccountRegistryDto & {
  changeReason?: string;
  evidenceSource?: string;
  approvedBy?: number | string | null;
};

export interface BackfillOptions {
  trigger?: 'registry_create' | 'registry_update' | 'manual_backfill';
  registryUpdateAuditPayload?: BankAccountRegistryUpdateAuditContract;
}

export interface BackfillBlockedResult {
  transactionId: number;
  rawSmsId: number;
  currentStatus: string;
  companyId: number | null;
  missingSteps: PendingBindingReleaseChecklistResult['missingSteps'];
  blockers: string[];
  guardReason: string;
  evidenceChecklist: PendingBindingReleaseChecklistStep[];
}

export interface BackfillReleasedResult {
  transactionId: number;
  rawSmsId: number;
  previousCompanyId: number | null;
  nextCompanyId: number;
  previousStatus: string;
  nextStatus: string;
  auditPayload: Record<string, unknown>;
}

export interface BackfillResult {
  affectedCount: number;
  blockedCount: number;
  skippedCount: number;
  evaluatedCount: number;
  trigger: BackfillOptions['trigger'];
  releasedResults: BackfillReleasedResult[];
  blockedResults: BackfillBlockedResult[];
  protectedWrites: {
    noConfirmedReconciliationCreated: true;
    noPaymentRecordsMutated: true;
    noWorkOrdersMutated: true;
    noVirtualLedgerWritten: true;
  };
}

@Injectable()
export class FinanceBankAccountService {
  constructor(
    @InjectRepository(BankAccountRegistry)
    private readonly bankAccountRegistryRepository: Repository<BankAccountRegistry>,
    @InjectRepository(BankAccountRegistryReviewAuthority)
    private readonly bankAccountRegistryReviewAuthorityRepository: Repository<BankAccountRegistryReviewAuthority>,
    @InjectRepository(BankSmsTransaction)
    private readonly bankSmsTransactionRepository: Repository<BankSmsTransaction>,
    private readonly businessFoundationService: BusinessFoundationService,
    private readonly operationLogsService: OperationLogsService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(query: QueryBankAccountRegistryDto, currentUser: CurrentUser) {
    this.assertReadable(currentUser);

    const { skip, take } = getPagination(query);
    const qb = this.bankAccountRegistryRepository.createQueryBuilder('registry');

    if (query.companyId) {
      qb.andWhere('registry.company_id = :companyId', { companyId: query.companyId });
    }
    if (query.bankName?.trim()) {
      qb.andWhere('registry.bank_name LIKE :bankName', { bankName: `%${query.bankName.trim()}%` });
    }
    if (query.smsSender?.trim()) {
      qb.andWhere('registry.sms_sender LIKE :smsSender', { smsSender: `%${query.smsSender.trim()}%` });
    }
    if (query.accountTail?.trim()) {
      qb.andWhere('registry.account_tail = :accountTail', { accountTail: query.accountTail.trim() });
    }
    if (query.status) {
      qb.andWhere('registry.status = :status', { status: query.status });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy('registry.created_at', 'DESC')
      .addOrderBy('registry.id', 'DESC')
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async findPendingMessages(query: QueryBankAccountRegistryDto, currentUser: CurrentUser) {
    this.assertReadable(currentUser);

    const { skip, take } = getPagination(query);
    const qb = this.bankSmsTransactionRepository
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.rawSms', 'rawSms')
      .where('tx.company_id IS NULL');

    if (query.bankName?.trim()) {
      qb.andWhere('tx.bank_name LIKE :bankName', { bankName: `%${query.bankName.trim()}%` });
    }
    if (query.smsSender?.trim()) {
      qb.andWhere('tx.sender LIKE :smsSender', { smsSender: `%${query.smsSender.trim()}%` });
    }
    if (query.accountTail?.trim()) {
      qb.andWhere('tx.account_tail = :accountTail', { accountTail: query.accountTail.trim() });
    }

    const total = await qb.getCount();
    const pendingTransactions = await qb
      .clone()
      .orderBy('tx.smsReceivedAt', 'DESC')
      .addOrderBy('tx.id', 'DESC')
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(
      query,
      pendingTransactions.map((item) => ({
        id: item.id,
        rawSmsId: item.rawSmsId,
        bankName: item.bankName,
        sender: item.sender,
        accountTail: item.accountTail,
        amount: item.amount,
        balanceAfter: item.balanceAfter,
        direction: item.direction,
        counterparty: item.counterparty,
        smsReceivedAt: item.smsReceivedAt.toISOString(),
        bankBusinessDate: item.bankBusinessDate.toISOString(),
        deviceId: item.rawSms?.deviceId ?? null,
        simSlot: item.rawSms?.simSlot ?? null,
        reconcileStatus: item.reconcileStatus,
      })),
      total,
    );
  }

  async create(dto: SaveBankAccountRegistryDto, currentUser: CurrentUser) {
    this.assertFormalRegistryAuthor(currentUser);
    this.assertWritable(currentUser);

    const activeScope = {
      companyId: dto.companyId,
      bankName: dto.bankName.trim(),
      smsSender: dto.smsSender.trim(),
      accountTail: dto.accountTail.trim(),
      status: dto.status ?? 'active',
    } as const;
    await this.assertActiveScopeAvailable(activeScope);

    const record = this.bankAccountRegistryRepository.create({
      companyId: activeScope.companyId,
      bankName: activeScope.bankName,
      smsSender: activeScope.smsSender,
      accountTail: activeScope.accountTail,
      accountAlias: dto.accountAlias.trim(),
      accountHolder: dto.accountHolder?.trim() || null,
      virtualLedgerId: dto.virtualLedgerId ?? null,
      accountUse: dto.accountUse?.trim() || null,
      evidenceSource: dto.evidenceSource?.trim() || null,
      evidenceRef: dto.evidenceRef?.trim() || null,
      createdBy: currentUser.id,
      lastEditedBy: currentUser.id,
      reviewedBy: null,
      reviewStatus: 'pending_review',
      reviewRemark: null,
      contentVersion: 1,
      formalReviewAuthorityId: null,
      formalReviewAuthorityHash: null,
      deviceId: dto.deviceId?.trim() || null,
      simSlot: dto.simSlot ?? null,
      status: activeScope.status,
    });
    const saved = await this.bankAccountRegistryRepository.save(record);

    await this.operationLogsService.create({
      module: 'finance_bank_account',
      targetId: saved.id,
      action: OperationLogAction.CREATE_BANK_ACCOUNT_BINDING,
      operatorId: currentUser.id,
      detail: `Created bank account binding ${saved.bankName} / ${saved.accountTail}`,
      detailJson: {
        companyId: saved.companyId,
        smsSender: saved.smsSender,
      },
    });

    const backfillResult = await this.backfill(saved.id, currentUser, false, {
      trigger: 'registry_create',
    });

    return {
      ...saved,
      backfilledCount: backfillResult.affectedCount,
      backfillResult,
    };
  }

  async update(id: number, dto: SaveBankAccountRegistryDto, currentUser: CurrentUser) {
    this.assertFormalRegistryAuthor(currentUser);
    this.assertWritable(currentUser);
    const transactionResult = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(BankAccountRegistry);
      const record = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!record) {
        throw new NotFoundException('The bank account binding does not exist.');
      }

      const activeScope = {
        companyId: dto.companyId,
        bankName: dto.bankName.trim(),
        smsSender: dto.smsSender.trim(),
        accountTail: dto.accountTail.trim(),
        status: dto.status ?? record.status,
      } as const;
      await this.assertActiveScopeAvailable(activeScope, record.id, repository);

      const beforeSnapshot = this.serializeRegistryAuditSnapshot(record);
      const auditDto = dto as BankAccountRegistryAuditDto;

      record.companyId = activeScope.companyId;
      record.bankName = activeScope.bankName;
      record.smsSender = activeScope.smsSender;
      record.accountTail = activeScope.accountTail;
      record.accountAlias = dto.accountAlias.trim();
      record.accountHolder = dto.accountHolder?.trim() || null;
      record.virtualLedgerId = dto.virtualLedgerId ?? null;
      record.accountUse = dto.accountUse?.trim() || null;
      record.evidenceSource = dto.evidenceSource?.trim() || null;
      record.evidenceRef = dto.evidenceRef?.trim() || null;
      record.lastEditedBy = currentUser.id;
      record.reviewedBy = null;
      record.reviewStatus = 'pending_review';
      record.reviewRemark = null;
      record.contentVersion = Math.max(record.contentVersion ?? 0, 0) + 1;
      record.formalReviewAuthorityId = null;
      record.formalReviewAuthorityHash = null;
      record.formalReviewAuthority = null;
      record.deviceId = dto.deviceId?.trim() || null;
      record.simSlot = dto.simSlot ?? null;
      record.status = activeScope.status;
      const saved = await repository.save(record);
      const afterSnapshot = this.serializeRegistryAuditSnapshot(saved);
      const auditPayload = buildBankAccountRegistryUpdateAuditContract({
        registryId: saved.id,
        operatorId: currentUser.id,
        operatorRole: currentUser.roleCodes[0] ?? null,
        beforeSnapshot,
        afterSnapshot,
        changeReason: auditDto.changeReason,
        evidenceSource: auditDto.evidenceSource,
        approvedBy: this.normalizeOptionalNumber(auditDto.approvedBy),
        reviewedBy: null,
      });
      const auditBlockers = [
        ...(auditPayload.changeReason ? [] : ['missing_change_reason']),
        ...(auditPayload.evidenceSource ? [] : ['missing_evidence_source']),
      ];

      await this.operationLogsService.create(
        {
          module: 'finance_bank_account',
          targetId: saved.id,
          action: OperationLogAction.UPDATE_BANK_ACCOUNT_BINDING,
          operatorId: currentUser.id,
          detail: `Updated bank account binding ${saved.bankName} / ${saved.accountTail}`,
          detailJson: {
            ...auditPayload,
            blockers: auditBlockers,
            formalReviewAuthorityInvalidated: true,
          },
        },
        manager,
      );

      return { saved, auditPayload, auditBlockers };
    });

    const backfillResult = await this.backfill(transactionResult.saved.id, currentUser, false, {
      trigger: 'registry_update',
      registryUpdateAuditPayload: transactionResult.auditPayload,
    });

    return {
      ...transactionResult.saved,
      backfilledCount: backfillResult.affectedCount,
      backfillResult,
      auditPayload: {
        ...transactionResult.auditPayload,
        blockers: transactionResult.auditBlockers,
        auditPersistence: 'operation_log_transactional',
      },
    };
  }

  async previewReview(id: number, currentUser: CurrentUser) {
    this.assertReviewable(currentUser);
    const registry = await this.bankAccountRegistryRepository.findOne({ where: { id } });
    if (!registry) {
      throw new NotFoundException('The bank account binding does not exist.');
    }
    await this.businessFoundationService.assertCompanyAccess(
      currentUser,
      registry.companyId,
      'finance:bank-account:review',
    );
    this.assertIndependentReviewer(registry, currentUser);
    const existingAuthority = await this.bankAccountRegistryReviewAuthorityRepository.findOne({
      where: { registryId: registry.id, contentVersion: registry.contentVersion },
    });
    if (existingAuthority) {
      throw new ConflictException(
        '[bank_account_registry_review_version_conflict] 该内容版本已完成复核，需先发生新的普通编辑',
      );
    }
    return {
      registryId: registry.id,
      companyId: registry.companyId,
      reviewStatus: registry.reviewStatus,
      contentVersion: registry.contentVersion,
      contentSnapshotHash: bankAccountRegistryContentSnapshotHash(registry),
      evidenceComplete: Boolean(registry.evidenceSource?.trim() && registry.evidenceRef?.trim()),
      reviewerId: currentUser.id,
      formalAuthorityWillRemainFailClosedUntilApproved: true,
    };
  }

  async review(id: number, dto: ReviewBankAccountRegistryDto, currentUser: CurrentUser) {
    this.assertReviewable(currentUser);
    const preRead = await this.bankAccountRegistryRepository.findOne({ where: { id } });
    if (!preRead) {
      throw new NotFoundException('The bank account binding does not exist.');
    }
    this.assertIndependentReviewer(preRead, currentUser);

    return this.dataSource.transaction(async (manager) => {
      await this.assertFormalReviewActorCurrent(currentUser, preRead, manager);
      await this.businessFoundationService.assertCompanyAccess(
        currentUser,
        preRead.companyId,
        'finance:bank-account:review',
        manager,
        { lockAuthorityRows: true },
      );
      const registryRepository = manager.getRepository(BankAccountRegistry);
      const authorityRepository = manager.getRepository(BankAccountRegistryReviewAuthority);
      const registry = await registryRepository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!registry) {
        throw new NotFoundException('The bank account binding does not exist.');
      }
      if (registry.companyId !== preRead.companyId) {
        throw new ConflictException(
          '[bank_account_registry_review_company_drift] 公司归属在复核期间发生变化',
        );
      }
      this.assertIndependentReviewer(registry, currentUser);

      if (registry.contentVersion !== dto.expectedContentVersion) {
        throw new ConflictException(
          '[bank_account_registry_review_version_drift] 内容版本已变化，请重新预览',
        );
      }
      const contentVersion = registry.contentVersion;
      const contentSnapshotHash = bankAccountRegistryContentSnapshotHash(registry);
      if (contentSnapshotHash !== dto.expectedContentSnapshotHash) {
        throw new ConflictException(
          '[bank_account_registry_review_snapshot_drift] 内容快照已变化，请重新预览',
        );
      }
      const existing = await authorityRepository.findOne({
        where: { registryId: registry.id, contentVersion },
      });
      if (existing) {
        throw new ConflictException(
          '[bank_account_registry_review_version_conflict] 该内容版本已完成复核，需先发生新的普通编辑',
        );
      }
      if (
        dto.decision === 'approved' &&
        (!registry.evidenceSource?.trim() || !registry.evidenceRef?.trim())
      ) {
        throw new ConflictException(
          '[bank_account_registry_review_evidence_missing] 正式批准必须具备完整证据来源与引用',
        );
      }

      const reviewedAt = new Date();
      const remark = dto.remark?.trim() || null;
      const authorityHash = buildBankAccountRegistryReviewAuthorityHash({
        registryId: registry.id,
        contentVersion,
        contentSnapshotHash,
        decision: dto.decision,
        reviewedBy: currentUser.id,
        reviewedAt,
        remark,
      });

      const created = authorityRepository.create({
        registryId: registry.id,
        contentVersion,
        contentSnapshotHash,
        decision: dto.decision,
        reviewedBy: currentUser.id,
        reviewedAt,
        remark,
        authorityHash,
      });
      const savedAuthority = await authorityRepository.save(created);

      registry.reviewedBy = currentUser.id;
      registry.reviewStatus = dto.decision === 'approved' ? 'reviewed' : 'rejected';
      registry.reviewRemark = remark;
      registry.formalReviewAuthorityId = dto.decision === 'approved' ? savedAuthority.id : null;
      registry.formalReviewAuthorityHash =
        dto.decision === 'approved' ? savedAuthority.authorityHash : null;
      const savedRegistry = await registryRepository.save(registry);

      await this.operationLogsService.create(
        {
          module: 'finance_bank_account',
          targetId: registry.id,
          action: OperationLogAction.REVIEW_BANK_ACCOUNT_BINDING,
          operatorId: currentUser.id,
          detail: `Reviewed bank account binding decision=${dto.decision}`,
          detailJson: {
            registryId: registry.id,
            companyId: registry.companyId,
            decision: dto.decision,
            contentVersion: savedAuthority.contentVersion,
            contentSnapshotHash: savedAuthority.contentSnapshotHash,
            authorityId: savedAuthority.id,
            authorityHash: savedAuthority.authorityHash,
          },
        },
        manager,
      );

      return {
        registry: savedRegistry,
        authority: savedAuthority,
        formalEligibilityActivated: dto.decision === 'approved',
      };
    });
  }

  async backfill(
    id: number,
    currentUser: CurrentUser,
    withAuditLog = true,
    options: BackfillOptions = {},
  ): Promise<BackfillResult> {
    this.assertWritable(currentUser);

    const registry = await this.bankAccountRegistryRepository.findOne({
      where: { id },
    });
    if (!registry) {
      throw new NotFoundException('The bank account binding does not exist.');
    }

    const candidates = await this.bankSmsTransactionRepository.find({
      where: {
        bankName: registry.bankName,
        sender: registry.smsSender,
        accountTail: registry.accountTail,
      },
      relations: {
        rawSms: true,
      },
    });

    let affectedCount = 0;
    let skippedCount = 0;
    const releasedResults: BackfillReleasedResult[] = [];
    const blockedResults: BackfillBlockedResult[] = [];
    for (const transaction of candidates) {
      if (registry.deviceId && transaction.rawSms?.deviceId !== registry.deviceId) {
        skippedCount += 1;
        continue;
      }
      if (registry.simSlot !== null && registry.simSlot !== undefined && transaction.rawSms?.simSlot !== registry.simSlot) {
        skippedCount += 1;
        continue;
      }

      const needsOwnershipOrStatusRelease =
        transaction.companyId !== registry.companyId ||
        transaction.reconcileStatus === 'pending_binding';
      if (!needsOwnershipOrStatusRelease) {
        skippedCount += 1;
        continue;
      }

      const checklistInput = this.buildBackfillReleaseChecklistInput(transaction, registry, currentUser);
      const checklist = buildPendingBindingReleaseChecklist(checklistInput);
      try {
        assertPendingBindingReleaseReady(checklistInput);
      } catch {
        blockedResults.push({
          transactionId: transaction.id,
          rawSmsId: transaction.rawSmsId,
          currentStatus: transaction.reconcileStatus,
          companyId: transaction.companyId,
          missingSteps: checklist.missingSteps,
          blockers: checklist.blockers,
          guardReason: checklist.guardReason,
          evidenceChecklist: checklist.evidenceChecklist,
        });
        continue;
      }

      const previousCompanyId = transaction.companyId;
      const previousStatus = transaction.reconcileStatus;
      transaction.companyId = registry.companyId;
      if (transaction.reconcileStatus === 'pending_binding') {
        transaction.reconcileStatus = 'pending';
      }
      await this.bankSmsTransactionRepository.save(transaction);
      affectedCount += 1;
      releasedResults.push({
        transactionId: transaction.id,
        rawSmsId: transaction.rawSmsId,
        previousCompanyId,
        nextCompanyId: registry.companyId,
        previousStatus,
        nextStatus: transaction.reconcileStatus,
        auditPayload: checklist.auditPayload,
      });
    }

    const result: BackfillResult = {
      affectedCount,
      blockedCount: blockedResults.length,
      skippedCount,
      evaluatedCount: candidates.length,
      trigger: options.trigger ?? (withAuditLog ? 'manual_backfill' : undefined),
      releasedResults,
      blockedResults,
      protectedWrites: {
        noConfirmedReconciliationCreated: true,
        noPaymentRecordsMutated: true,
        noWorkOrdersMutated: true,
        noVirtualLedgerWritten: true,
      },
    };

    if (withAuditLog) {
      await this.operationLogsService.create({
        module: 'finance_bank_account',
        targetId: registry.id,
        action: OperationLogAction.BACKFILL_BANK_ACCOUNT_BINDING,
        operatorId: currentUser.id,
        detail: `Rebound historical bank SMS ownership ${registry.bankName} / ${registry.accountTail}`,
        detailJson: {
          affectedCount,
          blockedCount: result.blockedCount,
          skippedCount: result.skippedCount,
          evaluatedCount: result.evaluatedCount,
          companyId: registry.companyId,
          trigger: result.trigger,
          registryUpdateAuditPayload: options.registryUpdateAuditPayload ?? null,
          releasedResults: releasedResults.slice(0, 50),
          blockedResults: blockedResults.slice(0, 50),
          protectedWrites: result.protectedWrites,
        },
      });
    }

    return result;
  }

  async findPromotionBindingCandidates(
    input: {
      bankName: string;
      sender: string;
      accountTail?: string | null;
      accountAlias?: string | null;
    },
    manager: EntityManager,
  ) {
    const normalizedTail = input.accountTail?.trim() || null;
    const normalizedAlias = input.accountAlias?.trim() || null;
    if (!normalizedTail && !normalizedAlias) {
      return [];
    }

    const repository = manager.getRepository(BankAccountRegistry);
    const candidates = await repository.find({
      where: {
        bankName: input.bankName.trim(),
        smsSender: input.sender.trim(),
        ...(normalizedTail ? { accountTail: normalizedTail } : {}),
      },
      order: {
        id: 'ASC',
      },
      relations: {
        formalReviewAuthority: true,
      },
      lock: { mode: 'pessimistic_read' },
    });

    return normalizedTail
      ? candidates
      : candidates.filter(
          (candidate) =>
            candidate.accountAlias.trim() === normalizedAlias ||
            candidate.accountHolder?.trim() === normalizedAlias,
        );
  }

  async resolveBinding(input: {
    bankName: string;
    sender: string;
    accountTail?: string | null;
    accountAlias?: string | null;
    deviceId?: string | null;
    simSlot?: number | null;
  }) {
    const normalizedTail = input.accountTail?.trim() || null;
    const normalizedAlias = input.accountAlias?.trim() || null;

    if (!normalizedTail && !normalizedAlias) {
      return null;
    }

    const bindings = await this.bankAccountRegistryRepository.find({
      where: {
        bankName: input.bankName,
        smsSender: input.sender,
        ...(normalizedTail ? { accountTail: normalizedTail } : {}),
        status: 'active',
      },
      order: {
        id: 'DESC',
      },
    });

    const matchedBindings = normalizedTail
      ? bindings
      : bindings.filter(
          (binding) =>
            binding.accountAlias === normalizedAlias || binding.accountHolder === normalizedAlias,
        );

    if (!matchedBindings.length) {
      return null;
    }

    const sorted = matchedBindings
      .map((binding) => ({
        binding,
        score: this.bindingScore(binding, input),
      }))
      .sort((left, right) => right.score - left.score || right.binding.id - left.binding.id);

    if (!normalizedTail) {
      const topScore = sorted[0]?.score ?? 0;
      if (sorted.filter((item) => item.score === topScore).length > 1) {
        return null;
      }
    }

    return sorted[0]?.binding ?? null;
  }

  private bindingScore(binding: BankAccountRegistry, input: { deviceId?: string | null; simSlot?: number | null }) {
    let score = 0;
    if (!binding.deviceId) {
      score += 1;
    } else if (binding.deviceId === input.deviceId) {
      score += 3;
    }

    if (binding.simSlot === null || binding.simSlot === undefined) {
      score += 1;
    } else if (binding.simSlot === input.simSlot) {
      score += 2;
    }

    return score;
  }

  private buildBackfillReleaseChecklistInput(
    transaction: BankSmsTransaction,
    registry: BankAccountRegistry,
    currentUser: CurrentUser,
  ) {
    return {
      transaction: {
        id: transaction.id,
        rawSmsId: transaction.rawSmsId,
        currentStatus: transaction.reconcileStatus,
        bankName: transaction.bankName,
        sender: transaction.sender,
        accountTail: transaction.accountTail,
        companyId: transaction.companyId,
        amount: transaction.amount,
        direction: transaction.direction,
      },
      registry: {
        id: registry.id,
        status: registry.status,
        bankName: registry.bankName,
        smsSender: registry.smsSender,
        accountTail: registry.accountTail,
        companyId: registry.companyId,
        evidenceSource: registry.evidenceSource ?? null,
        auditRef: registry.evidenceRef ?? `bank_account_registry#${registry.id}:operator#${currentUser.id}`,
        deviceId: registry.deviceId,
        simSlot: registry.simSlot,
      },
      mappingEvidence: [
        {
          kind: 'direct_account_tail' as const,
          accountTail: registry.accountTail,
          registryId: registry.id,
          evidenceSource: registry.evidenceSource ?? null,
          auditRef: registry.evidenceRef ?? `bank_sms_transaction#${transaction.id}`,
          derivedFromGuess: false,
        },
      ],
      attributionEvidence: {
        candidateOnly: true,
        requiresHumanOrOwnerApproval: true,
        targetType: 'reconciliation_candidate',
        targetId: null,
        willCreateConfirmedReconciliation: false,
        willMutatePaymentRecords: false,
        willMutateWorkOrders: false,
        willWriteVirtualLedger: false,
      },
      requestedBy: {
        operatorId: currentUser.id,
        operatorRole: currentUser.roleCodes[0] ?? null,
      },
    };
  }

  private serializeRegistryAuditSnapshot(record: BankAccountRegistry) {
    return {
      id: record.id,
      companyId: record.companyId,
      bankName: record.bankName,
      smsSender: record.smsSender,
      accountTail: record.accountTail,
      accountAlias: record.accountAlias,
      accountHolder: record.accountHolder,
      virtualLedgerId: record.virtualLedgerId,
      accountUse: record.accountUse,
      evidenceSource: record.evidenceSource,
      evidenceRef: record.evidenceRef,
      createdBy: record.createdBy,
      lastEditedBy: record.lastEditedBy,
      reviewedBy: record.reviewedBy,
      reviewStatus: record.reviewStatus,
      reviewRemark: record.reviewRemark,
      contentVersion: record.contentVersion,
      formalReviewAuthorityId: record.formalReviewAuthorityId,
      formalReviewAuthorityHash: record.formalReviewAuthorityHash,
      deviceId: record.deviceId,
      simSlot: record.simSlot,
      status: record.status,
      createdAt: record.createdAt?.toISOString?.() ?? null,
      updatedAt: record.updatedAt?.toISOString?.() ?? null,
    };
  }

  private async assertActiveScopeAvailable(
    scope: Pick<
      BankAccountRegistry,
      'companyId' | 'bankName' | 'smsSender' | 'accountTail' | 'status'
    >,
    excludeId?: number,
    repository: Repository<BankAccountRegistry> = this.bankAccountRegistryRepository,
  ) {
    if (scope.status !== 'active') {
      return;
    }

    const duplicated = await repository.findOne({
      where: {
        ...scope,
        ...(excludeId === undefined ? {} : { id: Not(excludeId) }),
      },
    });
    if (duplicated) {
      throw new BadRequestException('The bank account binding already exists.');
    }
  }

  private normalizeOptionalNumber(value?: number | string | null) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const numericValue = Number(value);
    return Number.isInteger(numericValue) ? numericValue : null;
  }

  private assertReadable(currentUser: CurrentUser) {
    if (
      currentUser.roleCodes.some((roleCode) =>
        READ_ROLES.includes(roleCode as (typeof READ_ROLES)[number]),
      )
    ) {
      return;
    }

    throw new ForbiddenException('The current role cannot view bank account bindings.');
  }

  private assertWritable(currentUser: CurrentUser) {
    if (
      currentUser.roleCodes.some((roleCode) =>
        WRITE_ROLES.includes(roleCode as (typeof WRITE_ROLES)[number]),
      )
    ) {
      return;
    }

    throw new ForbiddenException('The current role cannot maintain bank account bindings.');
  }

  private assertFormalRegistryAuthor(currentUser: CurrentUser) {
    if (currentUser.identitySource !== 'trusted_proxy') {
      throw new ForbiddenException(
        '[bank_account_registry_write_formal_actor_required] 银行账户创建或编辑需要可信代理正式身份',
      );
    }
  }

  private assertReviewable(currentUser: CurrentUser) {
    if (currentUser.identitySource !== 'trusted_proxy') {
      throw new ForbiddenException(
        '[bank_account_registry_review_formal_actor_required] 正式银行账户复核需要可信代理正式身份',
      );
    }
    if (
      currentUser.roleCodes.some((roleCode) =>
        REVIEW_ROLES.includes(roleCode as (typeof REVIEW_ROLES)[number]),
      )
    ) {
      return;
    }

    throw new ForbiddenException('The current role cannot formally review bank account bindings.');
  }

  private assertIndependentReviewer(
    registry: Pick<BankAccountRegistry, 'createdBy' | 'lastEditedBy'>,
    currentUser: CurrentUser,
  ) {
    if (
      !Number.isInteger(registry.createdBy) ||
      Number(registry.createdBy) <= 0 ||
      !Number.isInteger(registry.lastEditedBy) ||
      Number(registry.lastEditedBy) <= 0
    ) {
      throw new ConflictException(
        '[bank_account_registry_review_provenance_missing] 创建人或最后编辑人来源缺失，禁止正式复核',
      );
    }
    if (registry.createdBy === currentUser.id || registry.lastEditedBy === currentUser.id) {
      throw new ForbiddenException(
        '[bank_account_registry_self_review_forbidden] 创建者或最后编辑者不能复核自己的银行账户绑定',
      );
    }
  }

  /**
   * Re-check the formal reviewer against transaction-current RBAC state in the
   * shared global order User -> UserRole(id ASC) -> Role(id ASC).
   */
  private async assertFormalReviewActorCurrent(
    currentUser: CurrentUser,
    provenance: Pick<BankAccountRegistry, 'createdBy' | 'lastEditedBy'>,
    manager: EntityManager,
  ) {
    if (currentUser.identitySource !== 'trusted_proxy') {
      throw new ForbiddenException(
        '[bank_account_registry_review_formal_actor_required] 正式银行账户复核需要可信代理正式身份',
      );
    }

    this.assertIndependentReviewer(provenance, currentUser);
    const provenanceUserIds = [
      currentUser.id,
      Number(provenance.createdBy),
      Number(provenance.lastEditedBy),
    ];
    const userIds = [...new Set(provenanceUserIds)].sort((left, right) => left - right);
    const lockedUsers = new Map<number, User>();
    for (const id of userIds) {
      const lockedUser = await manager.getRepository(User).findOne({
        where: { id },
        lock: { mode: 'pessimistic_read' },
      });
      if (!lockedUser) {
        throw new ConflictException(
          '[bank_account_registry_review_provenance_user_missing] 创建人或最后编辑人用户记录不存在，禁止正式复核',
        );
      }
      lockedUsers.set(id, lockedUser);
    }

    const user = lockedUsers.get(currentUser.id);
    if (!user || user.status !== 1 || user.username !== currentUser.username) {
      throw new ForbiddenException(
        '[bank_account_registry_review_actor_revoked] 正式复核人员已禁用或身份已变化',
      );
    }

    const userRoles = await manager.getRepository(UserRole).find({
      where: { userId: user.id },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_read' },
    });
    const boundRoleIds = userRoles.map((item) => item.roleId);
    const roleIds = [...new Set(boundRoleIds)].sort((left, right) => left - right);
    if (roleIds.length !== boundRoleIds.length) {
      throw new ForbiddenException(
        '[bank_account_registry_review_role_binding_duplicate] 正式复核角色绑定重复，需先治理',
      );
    }

    const roles: Role[] = [];
    for (const id of roleIds) {
      const role = await manager.getRepository(Role).findOne({
        where: { id },
        lock: { mode: 'pessimistic_read' },
      });
      if (!role) {
        throw new ForbiddenException(
          '[bank_account_registry_review_role_revoked] 正式复核角色绑定已失效',
        );
      }
      roles.push(role);
    }
    if (
      !roles.some((role) =>
        REVIEW_ROLES.includes(role.code as (typeof REVIEW_ROLES)[number]),
      )
    ) {
      throw new ForbiddenException(
        '[bank_account_registry_review_role_revoked] 当前正式角色无权复核银行账户绑定',
      );
    }
  }
}
