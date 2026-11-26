import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  paginateArray,
  type PaginationResult,
} from '../../common/utils/pagination.util';
import { BankAccountRegistry } from '../finance-bank-account/entities/bank-account-registry.entity';
import { BankSmsTransaction } from '../finance-bank-sms/entities/bank-sms-transaction.entity';
import { SmsMessageClassification } from '../message-hub/entities/sms-message-classification.entity';
import { FinanceReconciliationLink } from './entities/finance-reconciliation-link.entity';
import {
  type FinanceEvidenceQueueItem,
  type FinanceEvidenceQueueSafetyFlags,
  type FinanceEvidenceRiskLevel,
  type PendingAccountEvidenceQueueItem,
  type UnmatchedExceptionPoolItem,
} from './evidence-queue.contract';
import { QueryEvidenceQueueDto } from './dto/query-evidence-queue.dto';

const DEFAULT_SAFETY_FLAGS: FinanceEvidenceQueueSafetyFlags = {
  readOnly: true,
  canConfirm: false,
  canAffectLedger: false,
  writesBankSmsTransaction: false,
  createsConfirmedReconciliation: false,
  mutatesPaymentRecords: false,
  mutatesWorkOrders: false,
  writesVirtualLedger: false,
  redacted: true,
};

type EvidenceQueueResult<T extends FinanceEvidenceQueueItem> = PaginationResult<T> & {
  safetyFlags: FinanceEvidenceQueueSafetyFlags;
};

@Injectable()
export class FinanceEvidenceQueueService {
  constructor(
    @InjectRepository(BankSmsTransaction)
    private readonly bankSmsTransactionRepository: Repository<BankSmsTransaction>,
    @InjectRepository(SmsMessageClassification)
    private readonly smsMessageClassificationRepository: Repository<SmsMessageClassification>,
    @InjectRepository(BankAccountRegistry)
    private readonly bankAccountRegistryRepository: Repository<BankAccountRegistry>,
    @InjectRepository(FinanceReconciliationLink)
    private readonly financeReconciliationLinkRepository: Repository<FinanceReconciliationLink>,
  ) {}

  async findEvidenceQueue(
    query: QueryEvidenceQueueDto,
  ): Promise<EvidenceQueueResult<FinanceEvidenceQueueItem>> {
    const requestedType = query.type ?? query.status;
    if (requestedType === 'unmatched_exception') {
      return this.findUnmatchedExceptions(query);
    }

    const pendingItems = await this.buildPendingAccountEvidenceItems(query);
    if (requestedType === 'pending_account_evidence' || requestedType === 'pending_binding') {
      return this.withSafetyFlags(paginateArray(pendingItems, query));
    }

    const unmatchedItems = await this.buildUnmatchedExceptionItems(query);
    return this.withSafetyFlags(
      paginateArray([...pendingItems, ...unmatchedItems].sort((left, right) => {
        return this.sortByQuery(left, right, query);
      }), query),
    );
  }

  async findPendingAccountEvidence(
    query: QueryEvidenceQueueDto,
  ): Promise<EvidenceQueueResult<PendingAccountEvidenceQueueItem>> {
    const items = await this.buildPendingAccountEvidenceItems({
      ...query,
      type: query.type === 'pending_binding' ? 'pending_binding' : 'pending_account_evidence',
    });
    return this.withSafetyFlags(paginateArray(items, query));
  }

  async findUnmatchedExceptions(
    query: QueryEvidenceQueueDto,
  ): Promise<EvidenceQueueResult<UnmatchedExceptionPoolItem>> {
    const items = await this.buildUnmatchedExceptionItems(query);
    return this.withSafetyFlags(paginateArray(items, query));
  }

  private async buildPendingAccountEvidenceItems(
    query: QueryEvidenceQueueDto,
  ): Promise<PendingAccountEvidenceQueueItem[]> {
    const requestedType = query.type ?? query.status;
    const [activeRegistries, bankTransactions, classifications] = await Promise.all([
      this.loadActiveRegistries(),
      this.loadBankTransactionsForEvidenceQueue(query),
      this.loadUnpromotedBankClassifications(query),
    ]);
    const registryByKey = this.buildRegistryKeyMap(activeRegistries);
    const items: PendingAccountEvidenceQueueItem[] = [];

    for (const transaction of bankTransactions) {
      const registry = registryByKey.get(this.registryKey(
        transaction.bankName,
        transaction.sender,
        transaction.accountTail,
      ));
      const missingEvidence = this.buildTransactionMissingEvidence(transaction, registry);
      const isPendingBinding = transaction.reconcileStatus === 'pending_binding';
      const evidenceStatus = isPendingBinding ? 'pending_binding' : 'pending_account_evidence';
      if (!missingEvidence.length && transaction.reconcileStatus !== 'pending_evidence') {
        continue;
      }
      if (requestedType === 'pending_binding' && !isPendingBinding) {
        continue;
      }
      if (requestedType === 'pending_account_evidence' && isPendingBinding) {
        continue;
      }

      items.push({
        queueType: evidenceStatus,
        transactionId: transaction.id,
        sourceId: transaction.id,
        sourceTable: 'bank_sms_transaction',
        bankName: transaction.bankName,
        direction: transaction.direction,
        amount: transaction.amount,
        balanceAfter: transaction.balanceAfter,
        accountTail: this.toNullableTrimmed(transaction.accountTail),
        accountAliasMasked: registry ? this.maskText(registry.accountAlias) : null,
        evidenceStatus,
        missingEvidence,
        suggestedAction: isPendingBinding
          ? 'Complete formal account registry ownership evidence, then run guarded backfill review.'
          : 'Supplement account tail or auditable registry mapping evidence before any ledger use.',
        sourceCreatedAt: this.toIsoString(transaction.createdAt),
        lastClassifiedAt: null,
        riskLevel: this.resolveEvidenceRisk(missingEvidence, isPendingBinding),
        canPromoteToBankTransaction: false,
        canConfirm: false,
        canAffectLedger: false,
      });
    }

    if (requestedType !== 'pending_binding') {
      for (const classification of classifications) {
        const parsed = this.extractParsedBankCandidate(classification);
        const registry = registryByKey.get(this.registryKey(
          parsed.bankName,
          parsed.sender,
          parsed.accountTail,
        ));
        const missingEvidence = this.buildClassificationMissingEvidence(parsed, registry);
        if (!missingEvidence.length) {
          continue;
        }
        items.push({
          queueType: 'pending_account_evidence',
          transactionId: null,
          sourceId: classification.id,
          sourceTable: 'sms_message_classification',
          bankName: parsed.bankName,
          direction: parsed.direction,
          amount: parsed.amount,
          balanceAfter: parsed.balanceAfter,
          accountTail: parsed.accountTail,
          accountAliasMasked: this.maskText(parsed.accountAlias),
          evidenceStatus: 'pending_account_evidence',
          missingEvidence,
          suggestedAction:
            'Supplement account evidence before this candidate can be promoted into bank_sms_transaction.',
          sourceCreatedAt: this.toIsoString(classification.rawSms?.createdAt ?? classification.createdAt),
          lastClassifiedAt: this.toIsoString(classification.createdAt),
          riskLevel: this.resolveEvidenceRisk(missingEvidence, false),
          canPromoteToBankTransaction: 'candidate_only',
          canConfirm: false,
          canAffectLedger: false,
        });
      }
    }

    return this.applyCommonFilters(items, query).sort((left, right) => this.sortByQuery(left, right, query));
  }

  private async buildUnmatchedExceptionItems(
    query: QueryEvidenceQueueDto,
  ): Promise<UnmatchedExceptionPoolItem[]> {
    const [activeRegistries, transactions] = await Promise.all([
      this.loadActiveRegistries(),
      this.loadBankTransactionsForUnmatchedPool(query),
    ]);
    const registryByKey = this.buildRegistryKeyMap(activeRegistries);
    const transactionIds = transactions.map((item) => item.id);
    const links = transactionIds.length
      ? await this.financeReconciliationLinkRepository.find({
          where: {
            bankSmsTransactionId: In(transactionIds),
          },
        })
      : [];
    const activeLinkTransactionIds = new Set(
      links
        .filter((item) => item.status === 'suggested' || item.status === 'confirmed')
        .map((item) => item.bankSmsTransactionId),
    );

    const items: UnmatchedExceptionPoolItem[] = transactions
      .filter((transaction) => !activeLinkTransactionIds.has(transaction.id))
      .map((transaction) => {
        const registry = registryByKey.get(this.registryKey(
          transaction.bankName,
          transaction.sender,
          transaction.accountTail,
        ));
        const unmatchedReason = this.buildUnmatchedReasons(transaction, registry);
        return {
          queueType: 'unmatched_exception' as const,
          transactionId: transaction.id,
          bankName: transaction.bankName,
          direction: transaction.direction,
          amount: transaction.amount,
          balanceAfter: transaction.balanceAfter,
          accountTail: this.toNullableTrimmed(transaction.accountTail),
          companyId: transaction.companyId as number,
          accountRegistryId: registry?.id ?? null,
          reconcileStatus: transaction.reconcileStatus,
          unmatchedReason,
          possibleMatchHints: this.buildPossibleMatchHints(transaction),
          suggestedNextAction:
            'Review against work order receipt, receivable, approval payout, internal fund flow, tax, fee, or other formal object. Keep candidate-only until approved.',
          canConfirm: false as const,
          canAffectLedger: false as const,
          createdAt: this.toIsoString(transaction.createdAt),
          updatedAt: null,
        };
      });

    return this.applyCommonFilters(items, query).sort((left, right) => this.sortByQuery(left, right, query));
  }

  private loadBankTransactionsForEvidenceQueue(query: QueryEvidenceQueueDto) {
    const qb = this.bankSmsTransactionRepository
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.rawSms', 'rawSms')
      .where('tx.reconcile_status IN (:...statuses)', {
        statuses: ['pending_binding', 'pending_evidence', 'pending'],
      });
    this.applyTransactionFilters(qb, query);
    return qb
      .orderBy('tx.created_at', 'DESC')
      .addOrderBy('tx.id', 'DESC')
      .take(1000)
      .getMany();
  }

  private loadBankTransactionsForUnmatchedPool(query: QueryEvidenceQueueDto) {
    const qb = this.bankSmsTransactionRepository
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.rawSms', 'rawSms')
      .where('tx.company_id IS NOT NULL')
      .andWhere('tx.reconcile_status IN (:...statuses)', {
        statuses: ['pending', 'pending_evidence', 'suggested'],
      });
    this.applyTransactionFilters(qb, query);
    return qb
      .orderBy('tx.created_at', 'DESC')
      .addOrderBy('tx.id', 'DESC')
      .take(1000)
      .getMany();
  }

  private loadUnpromotedBankClassifications(query: QueryEvidenceQueueDto) {
    const qb = this.smsMessageClassificationRepository
      .createQueryBuilder('classification')
      .leftJoinAndSelect('classification.rawSms', 'rawSms')
      .leftJoin(BankSmsTransaction, 'tx', 'tx.raw_sms_id = classification.raw_sms_id')
      .where('classification.classify_type = :classifyType', {
        classifyType: 'bank_transaction',
      })
      .andWhere('tx.id IS NULL');
    if (query.dateFrom) {
      qb.andWhere('classification.created_at >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('classification.created_at <= :dateTo', { dateTo: query.dateTo });
    }
    return qb
      .orderBy('classification.created_at', 'DESC')
      .addOrderBy('classification.id', 'DESC')
      .take(1000)
      .getMany();
  }

  private async loadActiveRegistries() {
    return this.bankAccountRegistryRepository.find({
      where: {
        status: 'active',
      },
      order: {
        id: 'DESC',
      },
    });
  }

  private applyTransactionFilters(
    qb: ReturnType<Repository<BankSmsTransaction>['createQueryBuilder']>,
    query: QueryEvidenceQueueDto,
  ) {
    if (query.direction) {
      qb.andWhere('tx.direction = :direction', { direction: query.direction });
    }
    if (query.minAmount) {
      qb.andWhere('tx.amount >= :minAmount', { minAmount: query.minAmount });
    }
    if (query.maxAmount) {
      qb.andWhere('tx.amount <= :maxAmount', { maxAmount: query.maxAmount });
    }
    if (query.bankName?.trim()) {
      qb.andWhere('tx.bank_name LIKE :bankName', { bankName: `%${query.bankName.trim()}%` });
    }
    if (query.companyId) {
      qb.andWhere('tx.company_id = :companyId', { companyId: query.companyId });
    }
    if (query.accountTail?.trim()) {
      qb.andWhere('tx.account_tail = :accountTail', { accountTail: query.accountTail.trim() });
    }
    if (query.accountTailPresence === 'present') {
      qb.andWhere("tx.account_tail IS NOT NULL AND tx.account_tail <> ''");
    }
    if (query.accountTailPresence === 'missing') {
      qb.andWhere("(tx.account_tail IS NULL OR tx.account_tail = '')");
    }
    if (query.dateFrom) {
      qb.andWhere('tx.created_at >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('tx.created_at <= :dateTo', { dateTo: query.dateTo });
    }
  }

  private applyCommonFilters<T extends FinanceEvidenceQueueItem>(items: T[], query: QueryEvidenceQueueDto): T[] {
    return items.filter((item) => {
      if (query.direction && item.direction !== query.direction) {
        return false;
      }
      if (query.bankName?.trim() && !(item.bankName ?? '').includes(query.bankName.trim())) {
        return false;
      }
      if (query.minAmount && Number(item.amount ?? Number.NaN) < Number(query.minAmount)) {
        return false;
      }
      if (query.maxAmount && Number(item.amount ?? Number.NaN) > Number(query.maxAmount)) {
        return false;
      }
      const itemAccountTail = this.itemAccountTail(item);
      if (query.accountTail?.trim() && itemAccountTail !== query.accountTail.trim()) {
        return false;
      }
      if (query.accountTailPresence === 'present' && !itemAccountTail) {
        return false;
      }
      if (query.accountTailPresence === 'missing' && itemAccountTail) {
        return false;
      }
      if ('companyId' in item && query.companyId && item.companyId !== query.companyId) {
        return false;
      }
      return true;
    });
  }

  private sortByQuery(left: FinanceEvidenceQueueItem, right: FinanceEvidenceQueueItem, query: QueryEvidenceQueueDto) {
    const direction = String(query.sortOrder ?? 'desc').toLowerCase() === 'asc' ? 1 : -1;
    const sortBy = query.sortBy ?? 'sourceCreatedAt';
    if (sortBy === 'amount') {
      return direction * (Number(left.amount ?? 0) - Number(right.amount ?? 0));
    }
    if (sortBy === 'bankName') {
      return direction * String(left.bankName ?? '').localeCompare(String(right.bankName ?? ''), 'zh-CN');
    }
    if (sortBy === 'riskLevel') {
      return direction * (this.riskOrder(this.riskOf(left)) - this.riskOrder(this.riskOf(right)));
    }
    return direction * (this.timeOf(left) - this.timeOf(right));
  }

  private withSafetyFlags<T extends FinanceEvidenceQueueItem>(
    result: PaginationResult<T>,
  ): EvidenceQueueResult<T> {
    return {
      ...result,
      safetyFlags: DEFAULT_SAFETY_FLAGS,
    };
  }

  private itemAccountTail(item: FinanceEvidenceQueueItem) {
    return 'accountTail' in item ? item.accountTail : null;
  }

  private buildRegistryKeyMap(registries: BankAccountRegistry[]) {
    const result = new Map<string, BankAccountRegistry>();
    for (const registry of registries) {
      result.set(this.registryKey(registry.bankName, registry.smsSender, registry.accountTail), registry);
    }
    return result;
  }

  private registryKey(bankName?: string | null, sender?: string | null, accountTail?: string | null) {
    return [
      this.toNullableTrimmed(bankName)?.toLowerCase() ?? '',
      this.toNullableTrimmed(sender)?.toLowerCase() ?? '',
      this.toNullableTrimmed(accountTail) ?? '',
    ].join('|');
  }

  private buildTransactionMissingEvidence(
    transaction: BankSmsTransaction,
    registry: BankAccountRegistry | undefined,
  ) {
    const missing: string[] = [];
    if (!this.toNullableTrimmed(transaction.accountTail)) {
      missing.push('account_tail_missing');
    }
    if (!registry) {
      missing.push('active_bank_account_registry_missing');
    }
    if (transaction.companyId === null || transaction.companyId === undefined) {
      missing.push('company_ownership_missing');
    }
    if (transaction.reconcileStatus === 'pending_binding') {
      missing.push('pending_binding_release_checklist_required');
    }
    if (transaction.reconcileStatus === 'pending_evidence') {
      missing.push('account_evidence_incomplete');
    }
    return Array.from(new Set(missing));
  }

  private buildClassificationMissingEvidence(
    parsed: ReturnType<FinanceEvidenceQueueService['extractParsedBankCandidate']>,
    registry: BankAccountRegistry | undefined,
  ) {
    const missing: string[] = [];
    if (!parsed.accountTail) {
      missing.push('account_tail_missing');
    }
    if (!registry) {
      missing.push('active_bank_account_registry_missing');
    }
    if (!parsed.bankName) {
      missing.push('bank_name_missing');
    }
    if (!parsed.direction) {
      missing.push('direction_missing');
    }
    if (!parsed.amount) {
      missing.push('amount_missing');
    }
    return Array.from(new Set(missing));
  }

  private buildUnmatchedReasons(
    transaction: BankSmsTransaction,
    registry: BankAccountRegistry | undefined,
  ) {
    const reasons = ['no_suggested_or_confirmed_reconciliation_link'];
    if (!registry) {
      reasons.push('active_registry_not_found_for_bound_transaction');
    }
    if (transaction.reconcileStatus === 'pending_evidence') {
      reasons.push('transaction_still_has_pending_evidence_status');
    }
    reasons.push(
      transaction.direction === 'income'
        ? 'no_work_order_receivable_wechat_or_other_income_match'
        : 'no_approval_internal_fund_fee_tax_or_other_expense_match',
    );
    return reasons;
  }

  private buildPossibleMatchHints(transaction: BankSmsTransaction) {
    const hints = [
      transaction.direction === 'income'
        ? 'review_receipt_item_or_receivable_tracking'
        : 'review_payment_approval_or_internal_fund_flow',
    ];
    if (transaction.counterparty) {
      hints.push('counterparty_present_redacted');
    }
    if (Number(transaction.amount) <= 50 && transaction.direction === 'expense') {
      hints.push('small_expense_possible_fee_candidate');
    }
    return hints;
  }

  private extractParsedBankCandidate(classification: SmsMessageClassification) {
    const parsed = classification.parsedJson ?? {};
    return {
      bankName: this.readString(parsed.bankName),
      sender: this.readString(parsed.sender) ?? classification.rawSms?.sender ?? null,
      accountTail: this.readString(parsed.accountTail),
      accountAlias: this.readString(parsed.accountAlias),
      direction: this.readDirection(parsed.direction),
      amount: this.readString(parsed.amount),
      balanceAfter: this.readString(parsed.balanceAfter),
    };
  }

  private resolveEvidenceRisk(missingEvidence: string[], isPendingBinding: boolean): FinanceEvidenceRiskLevel {
    if (
      missingEvidence.includes('account_tail_missing') ||
      missingEvidence.includes('active_bank_account_registry_missing')
    ) {
      return 'high';
    }
    if (isPendingBinding || missingEvidence.length > 0) {
      return 'medium';
    }
    return 'low';
  }

  private timeOf(item: FinanceEvidenceQueueItem) {
    const value =
      'sourceCreatedAt' in item ? item.sourceCreatedAt : item.createdAt;
    return value ? new Date(value).getTime() : 0;
  }

  private riskOf(item: FinanceEvidenceQueueItem): FinanceEvidenceRiskLevel {
    if ('riskLevel' in item) {
      return item.riskLevel;
    }
    return item.unmatchedReason.length > 1 ? 'medium' : 'low';
  }

  private riskOrder(value: FinanceEvidenceRiskLevel) {
    return {
      low: 1,
      medium: 2,
      high: 3,
    }[value];
  }

  private readString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private readDirection(value: unknown): 'income' | 'expense' | null {
    return value === 'income' || value === 'expense' ? value : null;
  }

  private toNullableTrimmed(value?: string | null) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private toIsoString(value?: Date | string | null) {
    if (!value) {
      return null;
    }
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private maskText(value?: string | null) {
    const normalized = this.toNullableTrimmed(value);
    if (!normalized) {
      return null;
    }
    if (normalized.length <= 2) {
      return `${normalized.slice(0, 1)}*`;
    }
    return `${normalized.slice(0, 1)}***${normalized.slice(-1)}`;
  }
}
