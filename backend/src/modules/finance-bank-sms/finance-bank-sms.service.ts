import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { buildPaginationResult, getPagination } from '../../common/utils/pagination.util';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { ApprovalStatus } from '../../shared/enums/approval-status.enum';
import { OperationLogAction } from '../../shared/enums/operation-log-action.enum';
import { BankAccountRegistry } from '../finance-bank-account/entities/bank-account-registry.entity';
import { FinanceBankAccountService } from '../finance-bank-account/finance-bank-account.service';
import { FinanceInternalFundFlowService } from '../finance-internal-fund-flow/finance-internal-fund-flow.service';
import { FinanceSafetyService } from '../finance-safety/finance-safety.service';
import { FinanceWechatService } from '../finance-wechat/finance-wechat.service';
import { WechatSettlementBatch } from '../finance-wechat/entities/wechat-settlement-batch.entity';
import { FinanceReconciliationLink } from '../finance-reconciliation/entities/finance-reconciliation-link.entity';
import {
  FinanceReconciliationService,
  type BankSmsCollectionOrderBridgeResult,
} from '../finance-reconciliation/finance-reconciliation.service';
import { SmsMessageClassification } from '../message-hub/entities/sms-message-classification.entity';
import { SmsMessageRaw } from '../message-hub/entities/sms-message-raw.entity';
import { MobileSmsEvent } from '../mobile-bridge/entities/mobile-sms-event.entity';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { ApprovalRequest } from '../approval-requests/entities/approval-request.entity';
import { BusinessFoundationService } from '../business-foundation/business-foundation.service';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { assertWorkOrderNotUnquoted, isWorkOrderUnquoted } from '../work-orders/work-order-intake.policy';
import { ConfirmApplyBankSmsTransactionDto } from './dto/confirm-apply-bank-sms-transaction.dto';
import { IgnoreBankSmsTransactionDto } from './dto/ignore-bank-sms-transaction.dto';
import {
  PendingBankSmsLedgerStatus,
  QueryPendingBankSmsLedgerDto,
} from './dto/query-pending-bank-sms-ledger.dto';
import { QueryBankSmsTransactionsDto } from './dto/query-bank-sms-transactions.dto';
import { ReconcileBankSmsTransactionDto } from './dto/reconcile-bank-sms-transaction.dto';
import { BankSmsTransaction } from './entities/bank-sms-transaction.entity';
import {
  buildBankSmsFingerprint,
  buildManualFeeCandidate,
  extractBankSmsBusinessHint,
  normalizeBankSmsPartyName,
  rankBankSmsCandidates,
  type CandidateMatchInput,
} from './utils/boc-bank-sms.util';
import {
  assessBankSmsEvidence,
  buildBankSmsPromotionAdmissionKey,
  collectBankSmsPromotionLineageProblems,
  decideBankSmsPromotionAdmission,
  fingerprintSummary,
  hashText,
  readBankSmsDurableAdmissionMetadata,
  resolveBankSmsHistoricalCutoff,
  type BankSmsPromotionWindow,
} from './utils/bank-sms-promotion-policy.util';

const WRITE_ROLES = ['admin', 'finance', 'super_admin', 'owner', 'finance_manager', 'finance_operator'] as const;
const READ_ROLES = [...WRITE_ROLES, 'auditor'] as const;

import { User } from '../users/entities/user.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { Role } from '../roles/entities/role.entity';
const SMALL_MANUAL_FEE_THRESHOLD = 50;
const PENDING_RECONCILE_STATUSES = ['pending', 'suggested', 'pending_evidence'];
const PENDING_LEDGER_LOAD_LIMIT = 1000;
const FULL_FINANCIAL_FIELD_ROLES = ['owner', 'super_admin', 'admin', 'finance_manager'] as const;
const PENDING_BANK_SMS_LEDGER_SAFETY_FLAGS = {
  readOnly: true,
  canConfirm: false,
  canPromote: false,
  canAffectLedger: false,
  writesBankSmsTransaction: false,
  writesFinanceInternalFundFlow: false,
  writesVirtualAccount: false,
  createsConfirmedReconciliation: false,
  returnsRawSmsBody: false,
  returnsSecurityCredentialBody: false,
  redactedByDefault: true,
} as const;
const COLLECTION_REQUIRED_CONFIRM_LINK_TYPES = new Set(['receipt_item', 'receivable_tracking']);
const NON_COLLECTION_CONFIRM_EXCEPTION_LINK_TYPES = new Set([
  'approval_order',
  'manual_fee',
  'wechat_settlement_batch',
  'internal_fund_flow',
  'ignore',
]);
const INTERNAL_FUND_FLOW_TYPE_LABELS: Record<string, string> = {
  loan_interest_expense: '\u8d37\u6b3e\u5229\u606f\u652f\u51fa',
  internal_transfer_in: '\u5185\u90e8\u8c03\u62e8\u8f6c\u5165',
  internal_transfer_out: '\u5185\u90e8\u8c03\u62e8\u8f6c\u51fa',
  loan_in: '\u501f\u5165',
  loan_out: '\u501f\u51fa',
  repayment_in: '\u8fd8\u6b3e\u6536\u56de',
  repayment_out: '\u8fd8\u6b3e\u652f\u51fa',
};

type BankSmsConfirmApplyBlockedReasonCode =
  | 'no_collection_order'
  | 'multiple_collection_orders'
  | 'amount_mismatch'
  | 'target_mismatch'
  | 'unreviewed_or_incomplete'
  | 'unknown_link_type'
  | 'missing_suggested_link'
  | 'already_confirmed'
  | 'ignored'
  | 'other';

type BankSmsDecisionTrailLogInput = {
  module: string;
  targetId: number;
  action: OperationLogAction;
  operatorId: number;
  detail: string;
  detailJson: Record<string, unknown>;
};

type BankSmsCollectionBridgeException = BadRequestException & {
  bankSmsCollectionBridgeResult?: BankSmsCollectionOrderBridgeResult;
};

const COLLECTION_BRIDGE_STATUS_TO_BLOCK_REASON: Record<
  string,
  BankSmsConfirmApplyBlockedReasonCode
> = {
  blocked_no_collection_order: 'no_collection_order',
  blocked_multiple_collection_orders: 'multiple_collection_orders',
  blocked_amount_mismatch: 'amount_mismatch',
  blocked_target_mismatch: 'target_mismatch',
  blocked_unreviewed_or_incomplete: 'unreviewed_or_incomplete',
};

const SORT_COLUMNS: Record<
  NonNullable<QueryBankSmsTransactionsDto['sortBy']>,
  string
> = {
  smsReceivedAt: 'tx.smsReceivedAt',
  bankBusinessDate: 'tx.bankBusinessDate',
  amount: 'tx.amount',
  reconcileStatus: 'tx.reconcileStatus',
  companyId: 'tx.companyId',
};

function normalizeMoney(value?: string | number | null) {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) {
    throw new BadRequestException('金额格式错误');
  }

  return numericValue.toFixed(2);
}

function compareMoney(left?: string | number | null, right?: string | number | null) {
  const leftValue = Number(left ?? 0);
  const rightValue = Number(right ?? 0);
  if (leftValue === rightValue) {
    return 0;
  }

  return leftValue > rightValue ? 1 : -1;
}

function subtractMoney(left?: string | number | null, right?: string | number | null) {
  return normalizeMoney(Number(left ?? 0) - Number(right ?? 0));
}

function normalizeMoneyNumber(value?: string | number | null) {
  return Number(normalizeMoney(value ?? 0));
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function endOfToday() {
  const value = startOfToday();
  value.setDate(value.getDate() + 1);
  return value;
}

interface ParsedBankTransaction {
  bankName: string;
  accountTail: string | null;
  accountAlias: string | null;
  bankBusinessDate: Date;
  smsReceivedAt: Date;
  direction: 'income' | 'expense';
  amount: string;
  balanceAfter: string;
  counterparty: string | null;
  parseConfidence: string;
  normalizedBody: string;
}

type BankSmsOverviewCards = {
  todayBankIncome: number;
  todayBankExpense: number;
  internalTransferNet: number;
  pendingCount: number;
  pendingBindingCount: number;
  currentBankBalance: number;
};

type BankSmsOverviewSummaryRow = {
  scopeKey: string;
  scopeLabel: string;
  companyId: number | null;
  bankName: string | null;
  sender: string | null;
  accountTail: string | null;
  accountCount: number;
  todayBankIncome: number;
  todayBankExpense: number;
  internalTransferNet: number;
  pendingCount: number;
  currentBankBalance: number;
  latestBalance?: number;
};

type PendingBankSmsLedgerParsed = {
  bankName: string | null;
  sender: string | null;
  direction: 'income' | 'expense' | null;
  amount: string | null;
  balanceAfter: string | null;
  accountTail: string | null;
  accountAlias: string | null;
  blockedReason: string | null;
  bodyHash: string | null;
  senderHash: string | null;
};

type PendingBankSmsLedgerItem = {
  eventId: number | null;
  rawSmsId: number;
  classificationId: number;
  transactionId: number | null;
  sender: string | null;
  bankName: string | null;
  direction: 'income' | 'expense' | null;
  amount: string | null;
  balanceAfter: string | null;
  accountTail: string | null;
  accountTailMasked: string | null;
  receivedAt: string | null;
  deviceId: string;
  classificationStatus: string;
  evidenceStatus: string;
  bindingStatus: string;
  ledgerStatus: PendingBankSmsLedgerStatus;
  riskFlags: string[];
  blockedReason: string | null;
  bodyHash: string | null;
  senderHash: string | null;
  bankAccountRegistryId: number | null;
  companyId: number | null;
  reconcileStatus: string | null;
  evidenceAssessment: 'complete_candidate' | 'blocked' | 'historical_excluded' | 'promoted';
  evidenceBlockers: string[];
  admissionOutcome: string | null;
  targetStatusPreview: 'pending' | 'pending_binding' | null;
  parserPolicyVersion: string | null;
  promotionPolicyVersion: string | null;
  evidenceFingerprintSummary: string | null;
  decisionFingerprintSummary: string | null;
  financialFieldsRedacted: boolean;
  rawBodyReturned: false;
  canConfirm: false;
  canAffectLedger: false;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SyncClassifiedBankSmsOptions = {
  manager?: EntityManager;
  mobileEvent: MobileSmsEvent | null;
  eventCreatedNow: boolean;
  rawCreatedNow: boolean;
  classificationCreatedNow: boolean;
  deduplicated: boolean;
  ingestSource: string;
  promotionWindow: BankSmsPromotionWindow;
};

@Injectable()
export class FinanceBankSmsService {
  constructor(
    @InjectRepository(SmsMessageRaw)
    private readonly smsMessageRawRepository: Repository<SmsMessageRaw>,
    @InjectRepository(SmsMessageClassification)
    private readonly smsMessageClassificationRepository: Repository<SmsMessageClassification>,
    @InjectRepository(BankSmsTransaction)
    private readonly bankSmsTransactionRepository: Repository<BankSmsTransaction>,
    @InjectRepository(BankAccountRegistry)
    private readonly bankAccountRegistryRepository: Repository<BankAccountRegistry>,
    @InjectRepository(FinanceReconciliationLink)
    private readonly financeReconciliationLinkRepository: Repository<FinanceReconciliationLink>,
    @InjectRepository(WorkOrder)
    private readonly workOrderRepository: Repository<WorkOrder>,
    @InjectRepository(ApprovalRequest)
    private readonly approvalRequestRepository: Repository<ApprovalRequest>,
    private readonly financeBankAccountService: FinanceBankAccountService,
    private readonly financeInternalFundFlowService: FinanceInternalFundFlowService,
    private readonly financeSafetyService: FinanceSafetyService,
    private readonly financeWechatService: FinanceWechatService,
    private readonly financeReconciliationService: FinanceReconciliationService,
    private readonly businessFoundationService: BusinessFoundationService,
    private readonly operationLogsService: OperationLogsService,
    private readonly dataSource: DataSource,
  ) {}

  async syncClassifiedBankSms(
    rawSms: SmsMessageRaw,
    classification: SmsMessageClassification,
    options: SyncClassifiedBankSmsOptions,
  ): Promise<BankSmsTransaction | null> {
    const transactionRepository = options.manager
      ? options.manager.getRepository(BankSmsTransaction)
      : this.bankSmsTransactionRepository;
    const existingTransaction = await transactionRepository.findOne({
      where: { rawSmsId: rawSms.id },
    });

    if (existingTransaction) {
      if (!existingTransaction.promotionAdmissionKey && !rawSms.promotionAdmissionKey) {
        return existingTransaction;
      }
      this.assertImmutablePromotionRetry(rawSms, classification, existingTransaction);
      return existingTransaction;
    }

    if (rawSms.promotionAdmissionKey) {
      this.assertImmutableBlockedPromotionRetry(rawSms, classification);
      return null;
    }

    if (
      classification.classifyType !== 'bank_transaction' ||
      options.deduplicated ||
      !options.eventCreatedNow ||
      !options.rawCreatedNow ||
      !options.classificationCreatedNow ||
      options.ingestSource !== 'live_broadcast' ||
      !options.promotionWindow.enabled ||
      !options.manager ||
      !options.mobileEvent
    ) {
      return null;
    }

    this.financeSafetyService.assertBankSmsPromotionEnabled(
      'sms_message_classification_to_bank_sms_transaction',
    );

    const durableAdmission = readBankSmsDurableAdmissionMetadata(
      options.mobileEvent.rawPayloadJson,
    );
    const promotionAdmissionKey = buildBankSmsPromotionAdmissionKey({
      window: options.promotionWindow,
      deviceId: rawSms.deviceId,
      stableSmsIdentity: rawSms.deviceSmsId ?? rawSms.dedupeFingerprint,
      eventGeneration: durableAdmission.generation,
    });
    if (!promotionAdmissionKey) {
      return null;
    }

    const parsedJson = (classification.parsedJson ?? {}) as Record<string, unknown>;
    const accountTail = this.readJsonString(parsedJson.accountTail);
    const accountAlias = this.readJsonString(parsedJson.accountAlias);
    const bankName = this.readJsonString(parsedJson.bankName);
    const registries = bankName
      ? await this.financeBankAccountService.findPromotionBindingCandidates(
          {
            bankName,
            sender: rawSms.sender,
            accountTail,
            accountAlias,
          },
          options.manager,
        )
      : [];
    const evidence = assessBankSmsEvidence({
      eventId: options.mobileEvent.id,
      rawSmsId: rawSms.id,
      classificationId: classification.id,
      classifyType: classification.classifyType,
      parseStatus: this.readJsonString(parsedJson.parseStatus),
      parserPolicyVersion: classification.parserPolicyVersion,
      bankName,
      sender: rawSms.sender,
      accountTail,
      accountAlias,
      bankBusinessDate: this.readJsonDate(parsedJson.bankBusinessDate),
      smsReceivedAt: this.readJsonDate(parsedJson.smsReceivedAt),
      direction: this.readJsonString(parsedJson.direction),
      amount: this.readJsonString(parsedJson.amount),
      balanceAfter: this.readJsonString(parsedJson.balanceAfter),
      counterparty: this.readJsonString(parsedJson.counterparty),
      normalizedBody: this.readJsonString(parsedJson.normalizedBody),
      registries,
    });

    if (
      classification.evidenceFingerprint &&
      classification.evidenceFingerprint !== evidence.evidenceFingerprint
    ) {
      throw this.promotionEvidenceConflict();
    }
    classification.evidenceFingerprint = evidence.evidenceFingerprint;
    await options.manager.getRepository(SmsMessageClassification).save(classification);

    const admissionEvaluatedAt = new Date();
    const admissionInput = {
      window: options.promotionWindow,
      evidence,
      admissionKey: promotionAdmissionKey,
      eventId: options.mobileEvent.id,
      rawSmsId: rawSms.id,
      classificationId: classification.id,
      transactionId: null,
      eventCreatedNow: options.eventCreatedNow,
      rawCreatedNow: options.rawCreatedNow,
      classificationCreatedNow: options.classificationCreatedNow,
      deduplicated: options.deduplicated,
      ingestSource: options.ingestSource,
      rawMobileSmsEventId: rawSms.mobileSmsEventId,
      eventReceivedAt: options.mobileEvent.receivedAtDevice,
      eventCreatedAt: options.mobileEvent.createdAt,
      rawReceivedAt: rawSms.receivedAt,
      rawCreatedAt: rawSms.createdAt,
      classificationCreatedAt: classification.createdAt,
      evaluatedAt: admissionEvaluatedAt,
      durableAdmission,
    };
    let decision = decideBankSmsPromotionAdmission(admissionInput);

    rawSms.promotionAdmissionKey = promotionAdmissionKey;
    rawSms.promotionPolicyVersion = decision.promotionPolicyVersion;
    rawSms.promotionEvidenceFingerprint = evidence.evidenceFingerprint;
    rawSms.promotionDecisionFingerprint = decision.decisionFingerprint;
    rawSms.promotionBlockerCodes = decision.admissionBlockerCodes;
    rawSms.promotionEvidenceBlockerCodes = evidence.evidenceBlockerCodes;
    rawSms.promotionTargetStatusPreview = evidence.targetStatusPreview;
    rawSms.promotionAdmissionOutcome = decision.eligibleToCreateNow
      ? evidence.targetStatusPreview === 'pending'
        ? 'created_pending'
        : 'created_pending_binding'
      : 'blocked';
    await options.manager.getRepository(SmsMessageRaw).save(rawSms);

    if (!decision.eligibleToCreateNow) {
      return null;
    }

    const parsed = this.parseBankTransactionClassification(classification);
    if (!parsed || !evidence.resolvedAccountTail || !evidence.targetStatusPreview) {
      throw this.promotionEvidenceConflict();
    }

    let transaction = transactionRepository.create({
      rawSmsId: rawSms.id,
      bankName: parsed.bankName,
      sender: rawSms.sender,
      accountTail: evidence.resolvedAccountTail,
      companyId:
        evidence.targetStatusPreview === 'pending' ? evidence.resolvedCompanyId : null,
      bankBusinessDate: parsed.bankBusinessDate,
      smsReceivedAt: parsed.smsReceivedAt,
      direction: parsed.direction,
      amount: parsed.amount,
      balanceAfter: parsed.balanceAfter,
      counterparty: parsed.counterparty,
      fingerprint: buildBankSmsFingerprint({
        sender: rawSms.sender,
        normalizedBody: parsed.normalizedBody,
        receivedAt: rawSms.receivedAt,
        deviceId: rawSms.deviceId,
      }),
      parseConfidence: parsed.parseConfidence,
      parserPolicyVersion: classification.parserPolicyVersion,
      promotionPolicyVersion: decision.promotionPolicyVersion,
      promotionAdmissionKey,
      promotionEvidenceFingerprint: evidence.evidenceFingerprint,
      promotionDecisionFingerprint: null,
      reconcileStatus: evidence.targetStatusPreview,
    });
    transaction = await transactionRepository.save(transaction);

    decision = decideBankSmsPromotionAdmission({
      ...admissionInput,
      transactionId: transaction.id,
    });
    if (!decision.eligibleToCreateNow) {
      throw this.promotionEvidenceConflict();
    }
    transaction.promotionDecisionFingerprint = decision.decisionFingerprint;
    transaction = await transactionRepository.save(transaction);
    rawSms.promotionDecisionFingerprint = decision.decisionFingerprint;
    await options.manager.getRepository(SmsMessageRaw).save(rawSms);

    await this.operationLogsService.create(
      {
        module: 'finance_bank_sms',
        targetId: transaction.id,
        action: OperationLogAction.INGEST_BANK_SMS,
        actorType: 'system',
        actorRef: 'bank_sms_promotion_policy',
        detail: '银行短信提升策略创建待处理交易',
        detailJson: {
          promotionPolicyVersion: decision.promotionPolicyVersion,
          enabledAt: options.promotionWindow.enabledAt?.toISOString() ?? null,
          minRawSmsIdExclusive: options.promotionWindow.minRawSmsIdExclusive,
          generationSummary: durableAdmission.generation
            ? fingerprintSummary(hashText(durableAdmission.generation))
            : null,
          eventId: options.mobileEvent.id,
          rawSmsId: rawSms.id,
          classificationId: classification.id,
          transactionId: transaction.id,
          registryId: evidence.resolvedRegistryId,
          registryAuthorityId: evidence.resolvedRegistryAuthorityId,
          registryContentVersion: evidence.resolvedRegistryContentVersion,
          registryAuthorityHashSummary: fingerprintSummary(
            evidence.resolvedRegistryAuthorityHash,
          ),
          registrySnapshotHashSummary: fingerprintSummary(
            evidence.resolvedRegistrySnapshotHash,
          ),
          targetStatus: evidence.targetStatusPreview,
          decisionFingerprintSummary: fingerprintSummary(decision.decisionFingerprint),
        },
      },
      options.manager,
    );

    return transaction;
  }

  async getOverview(currentUser: CurrentUser) {
    this.assertReadable(currentUser);

    const [snapshot, boundTransactions, pendingBindingCount, activeRegistries] = await Promise.all([
      this.financeReconciliationService.getBalanceSnapshot(),
      this.bankSmsTransactionRepository
        .createQueryBuilder('tx')
        .where('tx.company_id IS NOT NULL')
        .orderBy('tx.sms_received_at', 'DESC')
        .addOrderBy('tx.id', 'DESC')
        .getMany(),
      this.bankSmsTransactionRepository.count({
        where: {
          companyId: IsNull(),
        } as any,
      }),
      this.dataSource.getRepository(BankAccountRegistry).find({
        where: {
          status: 'active',
        },
        relations: {
          formalReviewAuthority: true,
        },
        order: {
          id: 'DESC',
        },
      }),
    ]);

    const todayStart = startOfToday().getTime();
    const todayEnd = endOfToday().getTime();
    const internalPartyCompanyIds = this.buildInternalPartyCompanyIdsMap(activeRegistries);
    const accountGroups = new Map<string, BankSmsOverviewSummaryRow>();
    const companyGroups = new Map<number, BankSmsOverviewSummaryRow>();
    const groupSummaryAccumulator: BankSmsOverviewSummaryRow = {
      scopeKey: 'group',
      scopeLabel: '集团合并',
      companyId: null,
      bankName: null,
      sender: null,
      accountTail: null,
      accountCount: 0,
      todayBankIncome: 0,
      todayBankExpense: 0,
      internalTransferNet: 0,
      pendingCount: 0,
      currentBankBalance: 0,
    };

    for (const transaction of boundTransactions) {
      const key = [
        transaction.companyId ?? 'null',
        transaction.bankName,
        transaction.sender,
        transaction.accountTail,
      ].join('|');
      const current =
        accountGroups.get(key) ??
        {
          scopeKey: key,
          scopeLabel: `${transaction.bankName} / ${transaction.accountTail}`,
          companyId: transaction.companyId,
          bankName: transaction.bankName,
          sender: transaction.sender,
          accountTail: transaction.accountTail,
          accountCount: 1,
          todayBankIncome: 0,
          todayBankExpense: 0,
          internalTransferNet: 0,
          pendingCount: 0,
          currentBankBalance: normalizeMoneyNumber(transaction.balanceAfter),
          latestBalance: normalizeMoneyNumber(transaction.balanceAfter),
        };
      const companyId = transaction.companyId;
      const companySummary =
        companyId === null
          ? null
          : companyGroups.get(companyId) ??
            {
              scopeKey: `company-${companyId}`,
              scopeLabel: `公司 ${companyId}`,
              companyId,
              bankName: null,
              sender: null,
              accountTail: null,
              accountCount: 0,
              todayBankIncome: 0,
              todayBankExpense: 0,
              internalTransferNet: 0,
              pendingCount: 0,
              currentBankBalance: 0,
            };
      const isPending = PENDING_RECONCILE_STATUSES.includes(transaction.reconcileStatus);
      const isToday =
        transaction.bankBusinessDate.getTime() >= todayStart &&
        transaction.bankBusinessDate.getTime() < todayEnd;
      const amount = normalizeMoneyNumber(transaction.amount);
      const signedAmount = transaction.direction === 'income' ? amount : -amount;
      const isInternalTransfer = this.isInternalTransferEvidence(transaction, internalPartyCompanyIds);

      if (isPending) {
        current.pendingCount += 1;
        if (companySummary) {
          companySummary.pendingCount += 1;
        }
        groupSummaryAccumulator.pendingCount += 1;
      }

      if (isToday) {
        if (transaction.direction === 'income') {
          current.todayBankIncome += amount;
        } else {
          current.todayBankExpense += amount;
        }
        if (isInternalTransfer) {
          current.internalTransferNet += signedAmount;
        }
        if (companySummary) {
          if (isInternalTransfer) {
            companySummary.internalTransferNet += signedAmount;
          } else if (transaction.direction === 'income') {
            companySummary.todayBankIncome += amount;
          } else {
            companySummary.todayBankExpense += amount;
          }
        }
        if (isInternalTransfer) {
          groupSummaryAccumulator.internalTransferNet += signedAmount;
        } else if (transaction.direction === 'income') {
          groupSummaryAccumulator.todayBankIncome += amount;
        } else {
          groupSummaryAccumulator.todayBankExpense += amount;
        }
      }

      accountGroups.set(key, current);
      if (companySummary && companyId !== null) {
        companyGroups.set(companyId, companySummary);
      }
    }

    const accountSummaries = Array.from(accountGroups.values())
      .map((item) => ({
        scopeKey: item.scopeKey,
        scopeLabel: item.scopeLabel,
        companyId: item.companyId,
        bankName: item.bankName,
        sender: item.sender,
        accountTail: item.accountTail,
        accountCount: 1,
        todayBankIncome: normalizeMoneyNumber(item.todayBankIncome),
        todayBankExpense: normalizeMoneyNumber(item.todayBankExpense),
        internalTransferNet: normalizeMoneyNumber(item.internalTransferNet),
        pendingCount: item.pendingCount,
        currentBankBalance: normalizeMoneyNumber(item.currentBankBalance),
        latestBalance: normalizeMoneyNumber(item.latestBalance),
        todayIncome: normalizeMoneyNumber(item.todayBankIncome),
        todayExpense: normalizeMoneyNumber(item.todayBankExpense),
      }))
      .sort((left, right) => {
        if (right.pendingCount !== left.pendingCount) {
          return right.pendingCount - left.pendingCount;
        }

        if ((left.companyId ?? Number.MAX_SAFE_INTEGER) !== (right.companyId ?? Number.MAX_SAFE_INTEGER)) {
          return (left.companyId ?? Number.MAX_SAFE_INTEGER) - (right.companyId ?? Number.MAX_SAFE_INTEGER);
        }

        const bankNameCompare = (left.bankName ?? '').localeCompare(right.bankName ?? '', 'zh-CN');
        if (bankNameCompare !== 0) {
          return bankNameCompare;
        }

        return (left.accountTail ?? '').localeCompare(right.accountTail ?? '', 'zh-CN');
      });
    const companySummaries = Array.from(companyGroups.values())
      .map((item) => ({
        ...item,
        currentBankBalance: 0,
      }))
      .sort((left, right) => {
        if (right.pendingCount !== left.pendingCount) {
          return right.pendingCount - left.pendingCount;
        }
        return (left.companyId ?? Number.MAX_SAFE_INTEGER) - (right.companyId ?? Number.MAX_SAFE_INTEGER);
      });

    const companySummaryByCompanyId = new Map(
      companySummaries.map((item) => [item.companyId as number, item]),
    );
    for (const item of accountSummaries) {
      if (item.companyId !== null) {
        const companySummary = companySummaryByCompanyId.get(item.companyId);
        if (companySummary) {
          companySummary.accountCount += 1;
          companySummary.currentBankBalance = normalizeMoneyNumber(
            companySummary.currentBankBalance + item.currentBankBalance,
          );
        }
      }
      groupSummaryAccumulator.accountCount += 1;
      groupSummaryAccumulator.currentBankBalance = normalizeMoneyNumber(
        groupSummaryAccumulator.currentBankBalance + item.currentBankBalance,
      );
    }
    const normalizedCompanySummaries = companySummaries.map((item) => ({
      ...item,
      todayBankIncome: normalizeMoneyNumber(item.todayBankIncome),
      todayBankExpense: normalizeMoneyNumber(item.todayBankExpense),
      internalTransferNet: normalizeMoneyNumber(item.internalTransferNet),
      currentBankBalance: normalizeMoneyNumber(item.currentBankBalance),
    }));
    const groupSummary = {
      ...groupSummaryAccumulator,
      todayBankIncome: normalizeMoneyNumber(groupSummaryAccumulator.todayBankIncome),
      todayBankExpense: normalizeMoneyNumber(groupSummaryAccumulator.todayBankExpense),
      internalTransferNet: normalizeMoneyNumber(groupSummaryAccumulator.internalTransferNet),
      currentBankBalance: normalizeMoneyNumber(groupSummaryAccumulator.currentBankBalance),
    };
    const views = {
      account: {
        key: 'account',
        label: '账户视角',
        description:
          '按绑定账户查看真实银行收付，对账证据层保留账户层的内部划拨痕迹，不直接冒充经营收入/支出。',
        cards: this.buildOverviewCards(accountSummaries, pendingBindingCount),
        summaries: accountSummaries,
      },
      company: {
        key: 'company',
        label: '公司视角',
        description:
          '按公司汇总对账证据，命中集团内正式账户的内部划拨从入账/出账剥离，只单列到内部划拨净额。',
        cards: this.buildOverviewCards(normalizedCompanySummaries, pendingBindingCount),
        summaries: normalizedCompanySummaries,
      },
      group: {
        key: 'group',
        label: '集团合并视角',
        description:
          '集团合并对账口径下，内部公司转账不计入今日银行入账/出账，只作为内部划拨净额展示。',
        cards: this.buildOverviewCards([groupSummary], pendingBindingCount),
        summaries: [groupSummary],
      },
    } as const;
    const groupCards = views.group.cards;

    return {
      aggregationBasis: 'reconciliation_evidence',
      aggregationNotice:
        '当前顶部数字属于银行短信对账证据层，只表达银行侧发生额与对账状态，不直接等于经营收入/支出或利润口径。',
      defaultScope: 'group',
      deferredMetrics: ['已开票未回款', '借入', '还款', '虚拟余额差额'],
      views,
      accountSummaries,
      companySummaries: normalizedCompanySummaries,
      groupSummary,
      todayIncome: groupCards.todayBankIncome,
      todayExpense: groupCards.todayBankExpense,
      bankBalance: groupCards.currentBankBalance,
      virtualBalance: Number(snapshot.virtualBalance ?? 0),
      balanceDiff: Number(snapshot.balanceDiff ?? 0),
      pendingCount: groupCards.pendingCount,
      pendingBindingCount,
    };
  }

  async findPendingLedger(query: QueryPendingBankSmsLedgerDto, currentUser: CurrentUser) {
    this.assertReadable(currentUser);
    const promotionWindow = this.financeSafetyService.getBankSmsPromotionWindow();

    const [classifications, activeRegistries] = await Promise.all([
      this.loadPendingLedgerClassifications(query),
      this.bankAccountRegistryRepository.find({
        where: {
          status: 'active',
        },
        relations: {
          formalReviewAuthority: true,
        },
        order: {
          id: 'DESC',
        },
      }),
    ]);
    const rawSmsIds = classifications.map((item) => item.rawSmsId);
    const transactions = rawSmsIds.length
      ? await this.bankSmsTransactionRepository.find({
          where: {
            rawSmsId: In(rawSmsIds),
          },
        })
      : [];
    const confirmedLinks = transactions.length
      ? await this.financeReconciliationLinkRepository.find({
          where: {
            bankSmsTransactionId: In(transactions.map((item) => item.id)),
            status: 'confirmed',
          },
        })
      : [];
    const transactionByRawSmsId = new Map(transactions.map((item) => [item.rawSmsId, item]));
    const confirmedLinkTransactionIds = new Set(
      confirmedLinks.map((item) => item.bankSmsTransactionId),
    );
    const registryByKey = this.buildRegistryByBankSmsKey(activeRegistries);
    const items = classifications
      .map((classification) => {
        const transaction = transactionByRawSmsId.get(classification.rawSmsId) ?? null;
        if (
          transaction &&
          (transaction.reconcileStatus === 'confirmed' ||
            confirmedLinkTransactionIds.has(transaction.id))
        ) {
          return null;
        }

        return this.buildPendingLedgerItem(
          classification,
          transaction,
          registryByKey,
          activeRegistries,
          promotionWindow,
          currentUser,
        );
      })
      .filter((item): item is PendingBankSmsLedgerItem => item !== null)
      .filter((item) => this.matchesPendingLedgerQuery(item, query))
      .sort((left, right) => this.sortPendingLedgerItems(left, right, query));
    const { skip, take } = getPagination(query);

    return {
      ...buildPaginationResult(query, items.slice(skip, skip + take), items.length),
      safetyFlags: PENDING_BANK_SMS_LEDGER_SAFETY_FLAGS,
    };
  }

  async findAll(query: QueryBankSmsTransactionsDto, currentUser: CurrentUser) {
    this.assertReadable(currentUser);

    const { skip, take } = getPagination(query);
    const qb = this.bankSmsTransactionRepository
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.rawSms', 'rawSms');

    if (query.companyId) {
      qb.andWhere('tx.company_id = :companyId', { companyId: query.companyId });
    }
    if (query.bankName?.trim()) {
      qb.andWhere('tx.bank_name LIKE :bankName', { bankName: `%${query.bankName.trim()}%` });
    }
    if (query.accountTail?.trim()) {
      qb.andWhere('tx.account_tail = :accountTail', { accountTail: query.accountTail.trim() });
    }
    if (query.direction) {
      qb.andWhere('tx.direction = :direction', { direction: query.direction });
    }
    if (query.reconcileStatus) {
      qb.andWhere('tx.reconcile_status = :reconcileStatus', { reconcileStatus: query.reconcileStatus });
    }
    if (query.counterparty?.trim()) {
      qb.andWhere('COALESCE(tx.counterparty, \'\') LIKE :counterparty', {
        counterparty: `%${query.counterparty.trim()}%`,
      });
    }
    if (query.rawSmsId) {
      qb.andWhere('tx.raw_sms_id = :rawSmsId', { rawSmsId: query.rawSmsId });
    }
    if (query.minAmount) {
      qb.andWhere('tx.amount >= :minAmount', { minAmount: query.minAmount });
    }
    if (query.maxAmount) {
      qb.andWhere('tx.amount <= :maxAmount', { maxAmount: query.maxAmount });
    }
    if (query.dateFrom) {
      qb.andWhere('tx.sms_received_at >= :dateFrom', { dateFrom: new Date(query.dateFrom) });
    }
    if (query.dateTo) {
      qb.andWhere('tx.sms_received_at <= :dateTo', { dateTo: new Date(query.dateTo) });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        SORT_COLUMNS[query.sortBy ?? 'smsReceivedAt'],
        query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
      )
      .addOrderBy('tx.id', 'DESC')
      .skip(skip)
      .take(take)
      .getMany();
    const linksByTransactionId = await this.loadLinksByTransactionIds(list.map((item) => item.id));

    return buildPaginationResult(
      query,
      list.map((item) =>
        this.buildTransactionListView(item, linksByTransactionId.get(item.id) ?? [], currentUser),
      ),
      total,
    );
  }

  async findOne(id: number, currentUser: CurrentUser) {
    this.assertReadable(currentUser);

    const transaction = await this.bankSmsTransactionRepository.findOne({
      where: { id },
      relations: {
        rawSms: true,
        reconciliationLinks: {
          confirmedByUser: true,
        },
      },
      order: {
        reconciliationLinks: {
          id: 'DESC',
        },
      },
    });
    if (!transaction) {
      throw new NotFoundException('银行短信流水不存在');
    }

    const [classification, candidateMatches, auditLogs, binding] = await Promise.all([
      this.smsMessageClassificationRepository.findOne({
        where: {
          rawSmsId: transaction.rawSmsId,
        },
      }),
      transaction.companyId ? this.buildCandidateMatches(transaction) : Promise.resolve([]),
      this.operationLogsService.findAuditLogs({
        module: ['finance_bank_sms', 'finance_reconciliation', 'finance_bank_account'],
        targetId: transaction.id,
      }),
      this.financeBankAccountService.resolveBinding({
        bankName: transaction.bankName,
        sender: transaction.sender,
        accountTail: transaction.accountTail,
        deviceId: transaction.rawSms?.deviceId ?? null,
        simSlot: transaction.rawSms?.simSlot ?? null,
      }),
    ]);

    return this.buildTransactionDetailView(
      transaction,
      classification,
      candidateMatches,
      auditLogs,
      binding,
      currentUser,
    );
  }

  async reconcile(
    id: number,
    dto: ReconcileBankSmsTransactionDto,
    currentUser: CurrentUser,
  ) {
    this.assertWritable(currentUser);
    this.financeSafetyService.assertAutoReconciliationEnabled(
      'bank_sms_reconciliation_suggest_link',
    );
    const transaction = await this.loadTransactionOrThrow(id);
    this.assertTransactionBound(transaction);
    this.assertTransactionActionable(transaction);

    const candidateMatches = await this.buildCandidateMatches(transaction);
    if (candidateMatches.length === 0) {
      await this.recordNoCandidateDiagnostic(transaction, currentUser);
    }

    const selectedCandidate =
      (dto.linkType
        ? candidateMatches.find(
            (item) =>
              item.linkType === dto.linkType &&
              Number(item.linkId ?? 0) === Number(dto.linkId ?? 0),
          )
        : candidateMatches[0]) ?? null;

    if (!selectedCandidate) {
      throw new BadRequestException('当前短信没有可用的建议匹配对象');
    }

    if (selectedCandidate.linkType === 'wechat_settlement_batch' && selectedCandidate.linkId) {
      const precheckBatch = await this.financeWechatService.getSettlementBatchForBankMatch(
        selectedCandidate.linkId,
      );
      this.assertWechatBatchCompany(precheckBatch, transaction);
      await this.businessFoundationService.assertCompanyAccess(
        currentUser,
        transaction.companyId!,
        'finance.bank_sms.reconcile',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      await this.assertBankSmsActorCurrent(currentUser, manager);
      const linkRepository = manager.getRepository(FinanceReconciliationLink);
      const transactionRepository = manager.getRepository(BankSmsTransaction);
      // WeChat settlement batch targets are current-locked BEFORE the bank/link
      // write locks, matching confirmApply's batch -> bank -> links order. A
      // missing target fails closed before any bank/link lock or write.
      if (selectedCandidate.linkType === 'wechat_settlement_batch' && selectedCandidate.linkId) {
        await this.businessFoundationService.assertCompanyAccess(
          currentUser,
          transaction.companyId!,
          'finance.bank_sms.reconcile',
          manager,
          { lockAuthorityRows: true },
        );
        const lockedBatch = await this.financeWechatService.getSettlementBatchForBankMatch(
          selectedCandidate.linkId,
          manager,
        );
        this.assertWechatBatchCompany(lockedBatch, transaction);
      }
      const lockedTransaction = await transactionRepository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedTransaction) {
        throw new NotFoundException('银行短信流水不存在');
      }
      this.assertTransactionBound(lockedTransaction);
      this.assertTransactionActionable(lockedTransaction);
      if (
        lockedTransaction.fingerprint !== transaction.fingerprint ||
        lockedTransaction.companyId !== transaction.companyId ||
        lockedTransaction.direction !== transaction.direction ||
        normalizeMoney(lockedTransaction.amount) !== normalizeMoney(transaction.amount)
      ) {
        throw new ConflictException(
          '[bank_sms_reconcile_source_drift] 银行短信在建议生成期间发生变化，请刷新后重试',
        );
      }

      if (selectedCandidate.linkType === 'wechat_settlement_batch') {
        await this.assertBankSmsPromotionLineageCurrent(lockedTransaction, manager);
      }

      const existingLinks = await linkRepository.find({
        where: {
          bankSmsTransactionId: id,
        },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });

      const historicalWechatAnchors = await this.loadBankSmsWechatAnchors(
        lockedTransaction.id,
        manager,
      );
      this.assertBankSmsSuggestionTargetNotRebound(
        existingLinks,
        historicalWechatAnchors,
        selectedCandidate.linkType,
        selectedCandidate.linkId,
        lockedTransaction.reconcileStatus,
      );

      const exactSuggestedLinks = existingLinks.filter(
        (link) =>
          link.status === 'suggested' &&
          link.linkType === selectedCandidate.linkType &&
          link.linkId === selectedCandidate.linkId,
      );
      if (exactSuggestedLinks.length === 1 && existingLinks.length === 1) {
        if (selectedCandidate.linkType === 'wechat_settlement_batch' && selectedCandidate.linkId) {
          await this.financeWechatService.markSuggestedBankMatch(
            selectedCandidate.linkId,
            lockedTransaction,
            manager,
          );
        }
        return;
      }

      for (const link of existingLinks) {
        if (link.status === 'suggested') {
          link.status = 'rejected';
        }
      }

      const suggestionLink = linkRepository.create({
        bankSmsTransactionId: id,
        linkType: selectedCandidate.linkType,
        linkId: selectedCandidate.linkId,
        suggestedAmount: lockedTransaction.amount,
        confirmedAmount: null,
        status: 'suggested',
        confirmedBy: null,
        confirmedAt: null,
        verificationCodeRequired: selectedCandidate.verificationCodeRequired,
        note:
          dto.note?.trim() ||
          `建议匹配：${selectedCandidate.label}；依据：${selectedCandidate.rankingReasons.join('、')}`,
      });

      await linkRepository.save([...existingLinks, suggestionLink]);
      let suggestedBatch: WechatSettlementBatch | null = null;
      if (selectedCandidate.linkType === 'wechat_settlement_batch' && selectedCandidate.linkId) {
        suggestedBatch = await this.financeWechatService.markSuggestedBankMatch(
          selectedCandidate.linkId,
          lockedTransaction,
          manager,
        );
      }
      lockedTransaction.reconcileStatus = 'suggested';
      await transactionRepository.save(lockedTransaction);

      await this.operationLogsService.create(
        {
          module: 'finance_bank_sms',
          targetId: id,
          action: OperationLogAction.SUGGEST_BANK_SMS_RECONCILIATION,
          operatorId: currentUser.id,
          detail: `建议匹配 ${selectedCandidate.label}`,
          detailJson: {
            eventType: 'bank_sms_reconciliation_suggestion_created',
            bankSmsTransactionId: lockedTransaction.id,
            companyId: lockedTransaction.companyId,
            candidateCount: candidateMatches.length,
            reconciliationLinkId: suggestionLink.id ?? null,
            selectedLinkType: selectedCandidate.linkType,
            selectedLinkId: selectedCandidate.linkId,
            linkType: selectedCandidate.linkType,
            linkId: selectedCandidate.linkId,
            suggestedAmount: lockedTransaction.amount,
            rankingReasons: selectedCandidate.rankingReasons,
            reasons: selectedCandidate.rankingReasons,
            candidateScore: selectedCandidate.score,
            verificationCodeRequired: selectedCandidate.verificationCodeRequired,
            rawSmsBodyIncluded: false,
            ...(suggestedBatch
              ? {
                  suggestionVersion: suggestedBatch.bankMatchSuggestionVersion,
                  bankTxAnchorId: suggestedBatch.bankMatchSuggestionBankSmsTransactionId,
                  registryId: suggestedBatch.bankMatchSuggestionRegistryId,
                  registryUpdatedAt: suggestedBatch.bankMatchSuggestionRegistryUpdatedAt!.toISOString(),
                  snapshotHash: suggestedBatch.bankMatchSuggestionSnapshotHash,
                }
              : {}),
          },
        },
        manager,
      );
    });

    return this.findOne(id, currentUser);
  }

  async confirmApply(
    id: number,
    dto: ConfirmApplyBankSmsTransactionDto,
    currentUser: CurrentUser,
  ) {
    this.assertWritable(currentUser);
    this.financeSafetyService.assertAutoReconciliationEnabled('bank_sms_confirm_apply');
    this.financeSafetyService.assertVirtualAccountMutationEnabled(
      'bank_sms_confirm_apply_virtual_balance_projection',
    );

    const precheckTransaction = await this.loadTransactionOrThrow(id);
    this.assertTransactionBound(precheckTransaction);
    const precheckLinks = await this.financeReconciliationLinkRepository.find({
      where: { bankSmsTransactionId: id },
      order: { id: 'DESC' },
    });
    const precheckTargetLink = this.resolveConfirmApplyAttemptLink(
      precheckLinks,
      dto.reconciliationLinkId,
    );
    if (
      precheckTargetLink?.linkType === 'wechat_settlement_batch' &&
      precheckTargetLink.linkId
    ) {
      const precheckBatch = await this.financeWechatService.getSettlementBatchForBankMatch(
        precheckTargetLink.linkId,
      );
      this.assertWechatBatchCompany(precheckBatch, precheckTransaction);
      await this.businessFoundationService.assertCompanyAccess(
        currentUser,
        precheckTransaction.companyId!,
        'finance.bank_sms.confirm',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      await this.assertBankSmsActorCurrent(currentUser, manager);
      const transactionRepository = manager.getRepository(BankSmsTransaction);
      const linkRepository = manager.getRepository(FinanceReconciliationLink);
      const locatorTransaction = await transactionRepository.findOne({
        where: { id },
      });

      if (!locatorTransaction) {
        throw new NotFoundException('银行短信流水不存在');
      }
      this.assertTransactionBound(locatorTransaction);

      const locatorLinks = await linkRepository.find({
        where: {
          bankSmsTransactionId: id,
        },
        order: {
          id: 'DESC',
        },
      });
      const attemptTargetLink = this.resolveConfirmApplyAttemptLink(
        locatorLinks,
        dto.reconciliationLinkId,
      );
      await this.recordConfirmApplyAttemptDiagnostic(
        locatorTransaction,
        attemptTargetLink,
        dto,
        currentUser,
      );

      if (locatorTransaction.reconcileStatus === 'confirmed') {
        await this.recordConfirmApplyBlockedDiagnostic(
          locatorTransaction,
          attemptTargetLink,
          dto,
          currentUser,
          'already_confirmed',
        );
        throw new BadRequestException('当前短信已确认落账，不能重复处理');
      }
      if (locatorTransaction.reconcileStatus === 'ignored') {
        await this.recordConfirmApplyBlockedDiagnostic(
          locatorTransaction,
          attemptTargetLink,
          dto,
          currentUser,
          'ignored',
        );
        throw new BadRequestException('当前短信已被忽略，不能重复落账');
      }

      if (!attemptTargetLink || attemptTargetLink.status !== 'suggested') {
        await this.recordConfirmApplyBlockedDiagnostic(
          locatorTransaction,
          attemptTargetLink,
          dto,
          currentUser,
          'missing_suggested_link',
        );
        throw new BadRequestException('当前短信缺少待确认的建议匹配');
      }

      if (
        attemptTargetLink.linkType === 'wechat_settlement_batch' &&
        attemptTargetLink.linkId
      ) {
        await this.businessFoundationService.assertCompanyAccess(
          currentUser,
          locatorTransaction.companyId!,
          'finance.bank_sms.confirm',
          manager,
          { lockAuthorityRows: true },
        );
      }

      try {
        const collectionBoundaryLocked = COLLECTION_REQUIRED_CONFIRM_LINK_TYPES.has(
          String(attemptTargetLink.linkType),
        );
        if (collectionBoundaryLocked) {
          // The collection bridge owns the global profile -> work order -> bank
          // -> links -> collection lock order. Do not lock bank/link first.
          await this.assertConfirmApplyCollectionBoundary(
            attemptTargetLink,
            locatorTransaction,
            manager,
            currentUser,
          );
        } else {
          // Non-collection targets are current-locked BEFORE the bank/link write
          // locks so two bank SMS cannot both consume the same approval,
          // settlement batch or internal fund flow target.
          await this.lockNonCollectionConfirmationTarget(
            attemptTargetLink,
            locatorTransaction,
            manager,
          );
        }

        const transaction = await transactionRepository.findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        const lockedLinksAscending = await linkRepository.find({
          where: { bankSmsTransactionId: id },
          order: { id: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        });
        // Lock acquisition is ASC; business selection remains newest-first.
        const links = [...lockedLinksAscending].sort((left, right) => right.id - left.id);
        if (!transaction) {
          throw new NotFoundException('银行短信流水不存在');
        }
        this.assertTransactionBound(transaction);
        if (transaction.companyId !== locatorTransaction.companyId) {
          throw new ConflictException(
            '[bank_sms_confirm_company_drift] 银行短信公司作用域在等待锁期间发生变化，请刷新后重试',
          );
        }
        if (transaction.reconcileStatus === 'confirmed') {
          throw new BadRequestException('当前短信已确认落账，不能重复处理');
        }
        if (transaction.reconcileStatus === 'ignored') {
          throw new BadRequestException('当前短信已被忽略，不能重复落账');
        }
        const confirmedLink = links.find((item) => item.status === 'confirmed') ?? null;
        if (confirmedLink) {
          throw new BadRequestException('当前短信已存在已确认落账记录');
        }
        const targetLink =
          (dto.reconciliationLinkId
            ? links.find((item) => item.id === dto.reconciliationLinkId)
            : links.find((item) => item.status === 'suggested')) ?? null;
        if (!targetLink || targetLink.status !== 'suggested') {
          throw new BadRequestException('当前短信缺少待确认的建议匹配');
        }
        if (
          targetLink.id !== attemptTargetLink.id ||
          targetLink.bankSmsTransactionId !== attemptTargetLink.bankSmsTransactionId ||
          targetLink.linkType !== attemptTargetLink.linkType ||
          targetLink.linkId !== attemptTargetLink.linkId
        ) {
          throw new ConflictException(
            '[bank_sms_confirm_apply_target_drift] 建议匹配在等待锁期间发生变化，请刷新后重试',
          );
        }

        if (targetLink.linkType === 'wechat_settlement_batch') {
          await this.assertBankSmsPromotionLineageCurrent(transaction, manager);
        }

        const historicalWechatAnchors = await this.loadBankSmsWechatAnchors(
          transaction.id,
          manager,
        );
        this.assertBankSmsConfirmationTargetNotRebound(
          links,
          historicalWechatAnchors,
          targetLink,
          transaction.id,
        );

        await this.validateConfirmationTarget(
          targetLink,
          transaction,
          manager,
          dto,
          currentUser,
          collectionBoundaryLocked,
        );

        const lockedAmount = normalizeMoney(transaction.amount);
        if (dto.confirmedAmount != null && normalizeMoney(dto.confirmedAmount) !== lockedAmount) {
          throw new BadRequestException(
            '[bank_sms_confirm_amount_mismatch] 确认金额必须精确等于当前银行短信金额',
          );
        }
        const confirmedAmount = lockedAmount;
        for (const link of links) {
          if (link.id === targetLink.id) {
            link.status = 'confirmed';
            link.confirmedAmount = confirmedAmount;
            link.confirmedBy = currentUser.id;
            link.confirmedAt = new Date();
            link.note = dto.note?.trim() || link.note;
          } else if (link.status === 'suggested') {
            link.status = 'rejected';
          }
        }

        await linkRepository.save(links);
        let confirmedBatch: WechatSettlementBatch | null = null;
        if (targetLink.linkType === 'wechat_settlement_batch' && targetLink.linkId) {
          confirmedBatch = await this.financeWechatService.confirmBankMatch(
            targetLink.linkId,
            transaction,
            manager,
          );
        }
        if (targetLink.linkType === 'internal_fund_flow' && targetLink.linkId) {
          this.financeSafetyService.assertFinanceFundFlowWriteEnabled(
            'bank_sms_confirm_apply_internal_fund_flow',
          );
          await this.financeInternalFundFlowService.confirmBankMatch(
            targetLink.linkId,
            transaction,
            currentUser.id,
            manager,
          );
        }
        if (targetLink.linkType === 'receivable_tracking' && targetLink.linkId) {
          await this.financeReconciliationService.confirmReceivableTrackingBankMatch(
            targetLink.linkId,
            transaction,
            confirmedAmount,
            manager,
          );
        }
        transaction.reconcileStatus = 'confirmed';
        await transactionRepository.save(transaction);

        await this.operationLogsService.create(
          {
            module: 'finance_reconciliation',
            targetId: id,
            action: OperationLogAction.CONFIRM_BANK_SMS_APPLY,
            operatorId: currentUser.id,
            detail: `人工确认落账 ${targetLink.linkType}#${targetLink.linkId ?? 'manual'}`,
            detailJson: {
              eventType: 'bank_sms_confirm_apply_succeeded',
              bankSmsTransactionId: transaction.id,
              companyId: transaction.companyId,
              reconciliationLinkId: targetLink.id,
              linkType: targetLink.linkType,
              linkId: targetLink.linkId,
              confirmedAmount,
              verificationCodeProvided: Boolean(dto.verificationCode?.trim()),
              verificationCodeValueIncluded: false,
              rawSmsBodyIncluded: false,
              ...(confirmedBatch
                ? {
                    suggestionVersion: confirmedBatch.bankMatchSuggestionVersion,
                    bankTxAnchorId: confirmedBatch.bankMatchSuggestionBankSmsTransactionId,
                    registryId: confirmedBatch.bankMatchSuggestionRegistryId,
                    registryUpdatedAt: confirmedBatch.bankMatchSuggestionRegistryUpdatedAt!.toISOString(),
                    snapshotHash: confirmedBatch.bankMatchSuggestionSnapshotHash,
                  }
                : {}),
            },
          },
          manager,
        );
      } catch (error) {
        const bridgeResult = this.extractCollectionBridgeResult(error);
        await this.recordConfirmApplyBlockedDiagnostic(
          locatorTransaction,
          attemptTargetLink,
          dto,
          currentUser,
          this.resolveConfirmApplyBlockedReasonCode(error, bridgeResult),
          bridgeResult,
          this.readErrorMessage(error),
        );
        throw error;
      }
    });

    return this.findOne(id, currentUser);
  }

  async ignore(id: number, dto: IgnoreBankSmsTransactionDto, currentUser: CurrentUser) {
    this.assertWritable(currentUser);

    await this.dataSource.transaction(async (manager) => {
      await this.assertBankSmsActorCurrent(currentUser, manager);
      const transactionRepository = manager.getRepository(BankSmsTransaction);
      const linkRepository = manager.getRepository(FinanceReconciliationLink);
      const transaction = await transactionRepository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!transaction) {
        throw new NotFoundException('银行短信流水不存在');
      }
      if (transaction.reconcileStatus === 'confirmed') {
        throw new BadRequestException('当前短信已确认落账，不能忽略');
      }

      const links = await linkRepository.find({
        where: {
          bankSmsTransactionId: id,
        },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      for (const link of links) {
        if (link.status === 'suggested') {
          link.status = 'rejected';
        }
      }

      const ignoreLink = linkRepository.create({
        bankSmsTransactionId: id,
        linkType: 'ignore',
        linkId: null,
        suggestedAmount: transaction.amount,
        confirmedAmount: null,
        status: 'confirmed',
        confirmedBy: currentUser.id,
        confirmedAt: new Date(),
        verificationCodeRequired: false,
        note: dto.note?.trim() || '财务人工确认忽略当前短信',
      });

      await linkRepository.save([...links, ignoreLink]);
      transaction.reconcileStatus = 'ignored';
      await transactionRepository.save(transaction);

      await this.operationLogsService.create(
        {
          module: 'finance_bank_sms',
          targetId: id,
          action: OperationLogAction.IGNORE_BANK_SMS_RECONCILIATION,
          operatorId: currentUser.id,
          detail: '忽略当前银行短信',
        },
        manager,
      );
    });

    return this.findOne(id, currentUser);
  }

  private parseBankTransactionClassification(classification: SmsMessageClassification) {
    const parsed = (classification.parsedJson ?? {}) as Record<string, unknown>;
    const accountTail =
      typeof parsed.accountTail === 'string' && parsed.accountTail.trim().length
        ? parsed.accountTail.trim()
        : null;
    const accountAlias =
      typeof parsed.accountAlias === 'string' && parsed.accountAlias.trim().length
        ? parsed.accountAlias.trim()
        : null;

    if (!parsed.bankName || (!accountTail && !accountAlias) || !parsed.direction || !parsed.amount || !parsed.balanceAfter) {
      return null;
    }

    return {
      bankName: String(parsed.bankName),
      accountTail,
      accountAlias,
      bankBusinessDate: new Date(String(parsed.bankBusinessDate ?? parsed.smsReceivedAt)),
      smsReceivedAt: new Date(String(parsed.smsReceivedAt)),
      direction: String(parsed.direction) as 'income' | 'expense',
      amount: normalizeMoney(String(parsed.amount)),
      balanceAfter: normalizeMoney(String(parsed.balanceAfter)),
      counterparty: parsed.counterparty ? String(parsed.counterparty) : null,
      parseConfidence: classification.confidence,
      normalizedBody: String(parsed.normalizedBody ?? ''),
    } satisfies ParsedBankTransaction;
  }

  /**
   * Current-lock the raw SMS and its classification, then recheck the complete
   * immutable promotion lineage inside the same transaction before any formal
   * business write. This is used by the WeChat suggestion/confirm path so it
   * never trusts the BankSmsTransaction promotion columns alone.
   */
  private async assertBankSmsPromotionLineageCurrent(
    transaction: BankSmsTransaction,
    manager: EntityManager,
  ): Promise<void> {
    const raw = await manager.getRepository(SmsMessageRaw).findOne({
      where: { id: transaction.rawSmsId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!raw) {
      throw new ConflictException(
        '[bank_sms_promotion_lineage_raw_missing] 银行短信 promotion lineage 缺少原始短信',
      );
    }
    const classification = await manager.getRepository(SmsMessageClassification).findOne({
      where: { rawSmsId: raw.id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!classification) {
      throw new ConflictException(
        '[bank_sms_promotion_lineage_classification_missing] 银行短信 promotion lineage 缺少分类',
      );
    }
    const problems = collectBankSmsPromotionLineageProblems({
      transaction,
      raw,
      classification,
    });
    if (problems.length) {
      throw new ConflictException(
        `[bank_sms_promotion_lineage_drift] ${problems.join(',')}`,
      );
    }
  }

  private assertImmutablePromotionRetry(
    rawSms: SmsMessageRaw,
    classification: SmsMessageClassification,
    transaction: BankSmsTransaction,
  ) {
    const valid =
      transaction.rawSmsId === rawSms.id &&
      classification.rawSmsId === rawSms.id &&
      Boolean(rawSms.mobileSmsEventId) &&
      Boolean(rawSms.promotionAdmissionKey) &&
      rawSms.promotionAdmissionKey === transaction.promotionAdmissionKey &&
      Boolean(rawSms.promotionEvidenceFingerprint) &&
      rawSms.promotionEvidenceFingerprint === classification.evidenceFingerprint &&
      rawSms.promotionEvidenceFingerprint === transaction.promotionEvidenceFingerprint &&
      Boolean(rawSms.promotionDecisionFingerprint) &&
      rawSms.promotionDecisionFingerprint === transaction.promotionDecisionFingerprint &&
      classification.parserPolicyVersion === transaction.parserPolicyVersion &&
      rawSms.promotionPolicyVersion === transaction.promotionPolicyVersion &&
      (rawSms.promotionAdmissionOutcome === 'created_pending' ||
        rawSms.promotionAdmissionOutcome === 'created_pending_binding') &&
      (rawSms.promotionBlockerCodes?.length ?? 0) === 0 &&
      Array.isArray(rawSms.promotionEvidenceBlockerCodes) &&
      rawSms.promotionEvidenceBlockerCodes.length === 0 &&
      ((rawSms.promotionAdmissionOutcome === 'created_pending' &&
        rawSms.promotionTargetStatusPreview === 'pending') ||
        (rawSms.promotionAdmissionOutcome === 'created_pending_binding' &&
          rawSms.promotionTargetStatusPreview === 'pending_binding'));

    if (!valid) {
      throw this.promotionEvidenceConflict();
    }
  }

  private assertImmutableBlockedPromotionRetry(
    rawSms: SmsMessageRaw,
    classification: SmsMessageClassification,
  ) {
    const valid =
      classification.rawSmsId === rawSms.id &&
      Boolean(rawSms.mobileSmsEventId) &&
      rawSms.promotionAdmissionOutcome === 'blocked' &&
      Boolean(rawSms.promotionEvidenceFingerprint) &&
      rawSms.promotionEvidenceFingerprint === classification.evidenceFingerprint &&
      Boolean(rawSms.promotionDecisionFingerprint) &&
      Boolean(rawSms.promotionPolicyVersion) &&
      Array.isArray(rawSms.promotionEvidenceBlockerCodes) &&
      (rawSms.promotionTargetStatusPreview === null ||
        rawSms.promotionTargetStatusPreview === 'pending' ||
        rawSms.promotionTargetStatusPreview === 'pending_binding') &&
      (rawSms.promotionBlockerCodes?.length ?? 0) > 0;

    if (!valid) {
      throw this.promotionEvidenceConflict();
    }
  }

  private promotionEvidenceConflict() {
    return new ConflictException({
      code: 'promotion_evidence_conflict',
      message: 'Stored bank SMS promotion evidence is inconsistent; no fields were changed.',
    });
  }

  private async loadLinksByTransactionIds(transactionIds: number[]) {
    if (!transactionIds.length) {
      return new Map<number, FinanceReconciliationLink[]>();
    }

    const links = await this.financeReconciliationLinkRepository.find({
      where: {
        bankSmsTransactionId: In(transactionIds),
      },
      relations: {
        confirmedByUser: true,
      },
      order: {
        id: 'DESC',
      },
    });

    const linksByTransactionId = new Map<number, FinanceReconciliationLink[]>();
    for (const link of links) {
      const currentList = linksByTransactionId.get(link.bankSmsTransactionId) ?? [];
      currentList.push(link);
      linksByTransactionId.set(link.bankSmsTransactionId, currentList);
    }

    return linksByTransactionId;
  }

  private buildTransactionListView(
    transaction: BankSmsTransaction,
    links: FinanceReconciliationLink[],
    currentUser: CurrentUser,
  ) {
    const activeLink = this.resolveActiveLink(links);
    const canViewFinancialFields = this.hasFullFinancialFieldAccess(currentUser);

    return {
      id: transaction.id,
      rawSmsId: transaction.rawSmsId,
      companyId: transaction.companyId,
      bankName: transaction.bankName,
      sender: canViewFinancialFields ? transaction.sender : this.maskSender(transaction.sender),
      accountTail: canViewFinancialFields
        ? transaction.accountTail
        : this.maskAccountTail(transaction.accountTail),
      accountTailMasked: this.maskAccountTail(transaction.accountTail),
      bankBusinessDate: transaction.bankBusinessDate.toISOString(),
      smsReceivedAt: transaction.smsReceivedAt.toISOString(),
      direction: transaction.direction,
      amount: canViewFinancialFields ? transaction.amount : null,
      balanceAfter: canViewFinancialFields ? transaction.balanceAfter : null,
      financialFieldsRedacted: !canViewFinancialFields,
      counterparty: canViewFinancialFields
        ? transaction.counterparty
        : this.maskCounterparty(transaction.counterparty),
      parseConfidence: transaction.parseConfidence,
      reconcileStatus: transaction.reconcileStatus,
      isBound: transaction.companyId !== null,
      latestLink:
        activeLink === null
          ? null
          : {
              id: activeLink.id,
              linkType: activeLink.linkType,
              linkId: activeLink.linkId,
              status: activeLink.status,
              confirmedAmount: activeLink.confirmedAmount,
              verificationCodeRequired: activeLink.verificationCodeRequired,
              note: activeLink.note,
            },
      canOperate: this.canWrite(currentUser) && transaction.companyId !== null,
    };
  }

  private buildTransactionDetailView(
    transaction: BankSmsTransaction,
    classification: SmsMessageClassification | null,
    candidateMatches: any[],
    auditLogs: any[],
    binding: { id: number; companyId: number; accountAlias: string; virtualLedgerId: number | null } | null,
    currentUser: CurrentUser,
  ) {
    const canViewFinancialFields = this.hasFullFinancialFieldAccess(currentUser);

    return {
      id: transaction.id,
      rawSmsId: transaction.rawSmsId,
      companyId: transaction.companyId,
      bankName: transaction.bankName,
      sender: canViewFinancialFields ? transaction.sender : this.maskSender(transaction.sender),
      accountTail: canViewFinancialFields
        ? transaction.accountTail
        : this.maskAccountTail(transaction.accountTail),
      accountTailMasked: this.maskAccountTail(transaction.accountTail),
      bankBusinessDate: transaction.bankBusinessDate.toISOString(),
      smsReceivedAt: transaction.smsReceivedAt.toISOString(),
      direction: transaction.direction,
      amount: canViewFinancialFields ? transaction.amount : null,
      balanceAfter: canViewFinancialFields ? transaction.balanceAfter : null,
      financialFieldsRedacted: !canViewFinancialFields,
      counterparty: canViewFinancialFields
        ? transaction.counterparty
        : this.maskCounterparty(transaction.counterparty),
      parseConfidence: transaction.parseConfidence,
      reconcileStatus: transaction.reconcileStatus,
      binding:
        binding === null
          ? null
          : {
              id: binding.id,
              companyId: binding.companyId,
              accountAlias: binding.accountAlias,
              virtualLedgerId: binding.virtualLedgerId,
            },
      rawSms: {
        id: transaction.rawSms.id,
        deviceId: transaction.rawSms.deviceId,
        simSlot: transaction.rawSms.simSlot,
        sender: canViewFinancialFields
          ? transaction.rawSms.sender
          : this.maskSender(transaction.rawSms.sender),
        body: null,
        bodyRedacted: Boolean(transaction.rawSms.body),
        rawBodyReturned: false,
        receivedAt: transaction.rawSms.receivedAt.toISOString(),
        ingestSource: transaction.rawSms.ingestSource,
        uploadStatus: transaction.rawSms.uploadStatus,
        classifyStatus: transaction.rawSms.classifyStatus,
      },
      classification: this.buildSafeClassificationView(classification, currentUser),
      reconciliationLinks: transaction.reconciliationLinks.map((item) => ({
        id: item.id,
        linkType: item.linkType,
        linkId: item.linkId,
        suggestedAmount: item.suggestedAmount,
        confirmedAmount: item.confirmedAmount,
        status: item.status,
        confirmedBy:
          item.confirmedByUser?.realName ??
          item.confirmedByUser?.username ??
          item.confirmedBy,
        confirmedAt: item.confirmedAt?.toISOString() ?? null,
        verificationCodeRequired: item.verificationCodeRequired,
        note: item.note,
      })),
      candidateMatches,
      auditLogs,
      availableActions: {
        canSuggest:
          this.canWrite(currentUser) &&
          transaction.reconcileStatus !== 'confirmed' &&
          transaction.reconcileStatus !== 'ignored' &&
          transaction.companyId !== null,
        canConfirmApply:
          this.canWrite(currentUser) &&
          transaction.reconcileStatus !== 'confirmed' &&
          transaction.reconcileStatus !== 'ignored' &&
          transaction.companyId !== null,
        canIgnore: this.canWrite(currentUser) && transaction.reconcileStatus !== 'confirmed',
        canOperateUnbound: transaction.companyId !== null,
      },
    };
  }

  private buildSafeClassificationView(
    classification: SmsMessageClassification | null,
    currentUser: CurrentUser,
  ) {
    if (!classification) {
      return null;
    }

    const canViewFinancialFields = this.hasFullFinancialFieldAccess(currentUser);
    const parsedJson = this.asRecord(classification.parsedJson);
    const safeParsedJson = { ...parsedJson };
    const accountTail = this.readJsonString(safeParsedJson.accountTail);

    for (const unsafeBodyKey of ['normalizedBody', 'body', 'rawBody', 'messageBody']) {
      if (unsafeBodyKey in safeParsedJson) {
        delete safeParsedJson[unsafeBodyKey];
      }
    }

    if (!canViewFinancialFields) {
      if ('amount' in safeParsedJson) {
        safeParsedJson.amount = null;
      }
      if ('balanceAfter' in safeParsedJson) {
        safeParsedJson.balanceAfter = null;
      }
      if ('accountTail' in safeParsedJson) {
        safeParsedJson.accountTail = null;
      }
      safeParsedJson.financialFieldsRedacted = true;
    }

    safeParsedJson.accountTailMasked = this.maskAccountTail(accountTail);
    safeParsedJson.rawBodyReturned = false;

    return safeParsedJson;
  }

  private async buildCandidateMatches(transaction: BankSmsTransaction) {
    const hints = extractBankSmsBusinessHint(transaction.rawSms?.body ?? '');
    const rawBody = transaction.rawSms?.body ?? '';
    const settlementKeywordHit = /财付通|微信支付|微信结算|tenpay|wechat/i.test(rawBody);

    if (transaction.direction === 'income') {
      const receivableTrackingCandidates =
        transaction.companyId === null
          ? []
          : await this.financeReconciliationService.findReceivableTrackingCandidates({
              companyId: transaction.companyId,
              amount: transaction.amount,
              bankBusinessDate: transaction.bankBusinessDate,
              counterpartyName: transaction.counterparty,
            });
      const receivableTrackingMatches = rankBankSmsCandidates(
        {
          direction: transaction.direction,
          amount: transaction.amount,
          counterparty: transaction.counterparty,
          bankBusinessDate: transaction.bankBusinessDate,
          rawBody: `${rawBody} ${hints.workOrderNo ?? ''}`,
        },
        receivableTrackingCandidates.map((item) => ({
          linkType: 'receivable_tracking' as const,
          linkId: item.id,
          amount: transaction.amount,
          counterparty: item.counterpartyName,
          referenceNo: item.invoiceNo ?? item.sourceRefNo,
          label: `${item.invoiceNo ?? item.sourceRefNo ?? `应收#${item.id}`} / ${item.counterpartyName}`,
          searchableText: [
            item.invoiceNo ?? '',
            item.sourceRefNo ?? '',
            item.counterpartyName,
            item.evidenceNote ?? '',
            `未收余额 ${item.outstandingAmount}`,
          ]
            .filter(Boolean)
            .join(' '),
          happenedAt: item.invoiceIssuedAt ?? item.updatedAt ?? item.createdAt,
          verificationCodeRequired: false,
          alreadyConsumed: Number(item.outstandingAmount) <= 0,
        })),
      )
        .filter((item) => item.score > 0)
        .slice(0, 5);

      const workOrders = await this.workOrderRepository.find({
        order: {
          updatedAt: 'DESC',
          id: 'DESC',
        },
        take: 80,
      });
      const confirmedLinks = workOrders.length
        ? await this.financeReconciliationLinkRepository.find({
            where: {
              linkType: 'receipt_item',
              status: 'confirmed',
              linkId: In(workOrders.map((item) => item.id)),
            },
          })
        : [];
      const confirmedWorkOrderIds = new Set(
        confirmedLinks.map((item) => Number(item.linkId)).filter((item) => Number.isInteger(item)),
      );

      const candidates: CandidateMatchInput[] = workOrders
        .filter((item) => !isWorkOrderUnquoted(item))
        .map((item) => {
          const outstandingAmount = subtractMoney(item.amountDue, item.amountReceived);
          return {
            linkType: 'receipt_item' as const,
            linkId: item.id,
            amount: outstandingAmount,
            counterparty: item.customerName,
            referenceNo: item.workOrderNo,
            label: `${item.workOrderNo} / ${item.customerName}`,
            searchableText: [item.workOrderNo, item.title, item.customerName, item.remark ?? '']
              .filter(Boolean)
              .join(' '),
            happenedAt: item.updatedAt ?? item.createdAt,
            verificationCodeRequired: false,
            alreadyConsumed:
              compareMoney(item.amountReceived, item.amountDue) >= 0 || confirmedWorkOrderIds.has(item.id),
          };
        })
        .filter((item) => compareMoney(item.amount, '0.00') > 0);

      const workOrderMatches = rankBankSmsCandidates(
        {
          direction: transaction.direction,
          amount: transaction.amount,
          counterparty: transaction.counterparty,
          bankBusinessDate: transaction.bankBusinessDate,
          rawBody: `${rawBody} ${hints.workOrderNo ?? ''}`,
        },
        candidates,
      )
        .filter((item) => item.score > 0)
        .slice(0, 5);

      const wechatSettlementCandidates =
        transaction.companyId === null
          ? []
          : await this.financeWechatService.findBankMatchCandidates({
              companyId: transaction.companyId,
              bankName: transaction.bankName,
              accountTail: transaction.accountTail,
              amount: transaction.amount,
            });
      const wechatSettlementMatches = rankBankSmsCandidates(
        {
          direction: transaction.direction,
          amount: transaction.amount,
          counterparty: transaction.counterparty,
          bankBusinessDate: transaction.bankBusinessDate,
          rawBody: `${rawBody} ${hints.workOrderNo ?? ''}`,
        },
        wechatSettlementCandidates.map((item) => ({
          linkType: 'wechat_settlement_batch' as const,
          linkId: item.id,
          amount: item.netAmount,
          counterparty: item.merchantName ?? '财付通结算',
          referenceNo: item.batchNo ?? item.merchantId,
          label: `${item.batchNo ?? `Batch#${item.id}`} / ${item.merchantName ?? item.merchantId}`,
          searchableText: [
            item.batchNo ?? '',
            item.merchantId,
            item.merchantName ?? '',
            '财付通 微信支付 微信结算 Tenpay WeChat',
          ]
            .filter(Boolean)
            .join(' '),
          happenedAt: item.settlementDate ? new Date(`${item.settlementDate}T00:00:00`) : null,
          verificationCodeRequired: false,
          alreadyConsumed: item.alreadyMatched,
        })),
      )
        .filter((item) => item.score > 0)
        .slice(0, 5);

      if (settlementKeywordHit && wechatSettlementMatches.length) {
        return wechatSettlementMatches;
      }

      return [...wechatSettlementMatches, ...receivableTrackingMatches, ...workOrderMatches]
        .sort((left, right) => right.score - left.score)
        .slice(0, 5);
    }

    const approvalRequests = await this.approvalRequestRepository.find({
      where: {
        currentStatus: ApprovalStatus.APPROVED,
      },
      relations: {
        payoutRecords: true,
        relatedWorkOrder: true,
      },
      order: {
        updatedAt: 'DESC',
        id: 'DESC',
      },
      take: 80,
    });
    const classification = await this.smsMessageClassificationRepository.findOne({
      where: {
        rawSmsId: transaction.rawSmsId,
      },
    });
    const businessCandidateType =
      classification &&
      typeof classification.parsedJson?.businessCandidateType === 'string'
        ? classification.parsedJson.businessCandidateType
        : null;
    if (
      (businessCandidateType === 'loan_interest_candidate' ||
        businessCandidateType === 'loan_repayment_interest_candidate') &&
      transaction.companyId !== null
    ) {
      const internalFundFlowCandidates =
        await this.financeInternalFundFlowService.findApprovedBankMatchCandidates({
          companyId: transaction.companyId,
          accountTail: transaction.accountTail,
          direction: transaction.direction,
          amount: transaction.amount,
          bankBusinessDate: transaction.bankBusinessDate,
          counterpartyName: transaction.counterparty,
          businessCandidateType,
        });

      if (!internalFundFlowCandidates.length) {
        return [];
      }

      return rankBankSmsCandidates(
        {
          direction: transaction.direction,
          amount: transaction.amount,
          counterparty: transaction.counterparty,
          bankBusinessDate: transaction.bankBusinessDate,
          rawBody,
        },
        internalFundFlowCandidates.map((item) => ({
          linkType: 'internal_fund_flow' as const,
          linkId: item.id,
          amount: item.amount,
          counterparty: item.counterpartyName,
          referenceNo: `IFF${item.id}`,
          label: `${this.formatInternalFundFlowType(item.flowType)} / ${item.counterpartyName ?? item.bankAccountRegistry.accountAlias}`,
          searchableText: [
            this.formatInternalFundFlowType(item.flowType),
            item.flowType,
            item.counterpartyName ?? '',
            item.bankAccountRegistry.accountAlias,
            item.bankAccountRegistry.accountHolder ?? '',
            item.evidenceNote ?? '',
            'loan interest internal fund flow',
          ]
            .filter(Boolean)
            .join(' '),
          happenedAt: new Date(`${item.businessDate}T00:00:00`),
          verificationCodeRequired: false,
          alreadyConsumed: item.linkedBankSmsTransactionId !== null,
        })),
      )
        .filter((item) => item.score > 0)
        .slice(0, 5);
    }
    const confirmedLinks = approvalRequests.length
      ? await this.financeReconciliationLinkRepository.find({
          where: {
            linkType: 'approval_order',
            status: 'confirmed',
            linkId: In(approvalRequests.map((item) => item.id)),
          },
        })
      : [];
    const confirmedApprovalIds = new Set(
      confirmedLinks.map((item) => Number(item.linkId)).filter((item) => Number.isInteger(item)),
    );

    const approvalCandidates: CandidateMatchInput[] = approvalRequests.map((item) => ({
      linkType: 'approval_order' as const,
      linkId: item.id,
      amount: normalizeMoney(item.amount),
      counterparty: item.reason,
      referenceNo: item.approvalNo,
      label: `${item.approvalNo} / ${item.reason}`,
      searchableText: [
        item.approvalNo,
        item.reason,
        item.relatedWorkOrder?.title ?? '',
        item.relatedWorkOrder?.customerName ?? '',
      ]
        .filter(Boolean)
        .join(' '),
      happenedAt: item.updatedAt ?? item.createdAt,
      verificationCodeRequired: Boolean(item.verificationCode?.trim()),
      alreadyConsumed:
        confirmedApprovalIds.has(item.id) || Boolean(item.payoutRecords?.length),
    }));

    const manualFeeCandidate = buildManualFeeCandidate({
      direction: transaction.direction,
      amount: transaction.amount,
      counterparty: transaction.counterparty,
      bankBusinessDate: transaction.bankBusinessDate,
    });

    return rankBankSmsCandidates(
      {
        direction: transaction.direction,
        amount: transaction.amount,
        counterparty: transaction.counterparty,
        bankBusinessDate: transaction.bankBusinessDate,
        rawBody: `${rawBody} ${hints.approvalNo ?? ''}`,
      },
      manualFeeCandidate ? [...approvalCandidates, manualFeeCandidate] : approvalCandidates,
    )
      .filter((item) => item.score > 0)
      .slice(0, 5);
  }

  private async tryCreateBankSmsDecisionTrailLog(
    input: BankSmsDecisionTrailLogInput,
    manager?: EntityManager,
  ) {
    try {
      await this.operationLogsService.create(input, manager);
    } catch {
      return;
    }
  }

  private buildNoCandidateSourcesChecked(transaction: BankSmsTransaction) {
    if (transaction.direction === 'income') {
      return [
        'finance_receivable_tracking',
        'work_orders_receipt_item',
        'wechat_settlement_batch',
      ];
    }

    return [
      'approval_order',
      'manual_fee',
      'internal_fund_flow_when_loan_interest_candidate',
    ];
  }

  private buildNoCandidateMissingEvidenceHints(transaction: BankSmsTransaction) {
    const hints = [
      'check_business_object_exists',
      'check_counterparty_mapping',
      'check_amount_match',
    ];

    if (transaction.direction === 'income') {
      hints.push('check_receivable_or_collection_order');
      hints.push('check_work_order_or_receipt_item');
    }

    return hints;
  }

  private buildNoCandidateSafeNextStepHints(transaction: BankSmsTransaction) {
    return [
      'no_candidate_match',
      ...this.buildNoCandidateMissingEvidenceHints(transaction),
      'manual_review_required',
    ];
  }

  private async recordNoCandidateDiagnostic(
    transaction: BankSmsTransaction,
    currentUser: CurrentUser,
  ) {
    await this.dataSource.transaction(async (manager) => {
      await this.assertBankSmsActorCurrent(currentUser, manager);
      this.assertTransactionBound(transaction);
      await this.businessFoundationService.assertCompanyAccess(
        currentUser,
        transaction.companyId!,
        'finance.bank_sms.reconcile',
        manager,
        { lockAuthorityRows: true },
      );

      const lockedTransaction = await manager.getRepository(BankSmsTransaction).findOne({
        where: { id: transaction.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedTransaction) {
        throw new NotFoundException('银行短信流水不存在');
      }
      this.assertTransactionBound(lockedTransaction);
      if (
        lockedTransaction.fingerprint !== transaction.fingerprint ||
        lockedTransaction.companyId !== transaction.companyId ||
        lockedTransaction.direction !== transaction.direction ||
        normalizeMoney(lockedTransaction.amount) !== normalizeMoney(transaction.amount) ||
        lockedTransaction.bankName !== transaction.bankName ||
        lockedTransaction.sender !== transaction.sender ||
        lockedTransaction.accountTail !== transaction.accountTail
      ) {
        throw new ConflictException(
          '[bank_sms_no_candidate_source_drift] 银行短信在诊断写入前发生变化，请刷新后重试',
        );
      }

      await this.operationLogsService.create({
        module: 'finance_bank_sms',
        targetId: lockedTransaction.id,
        action: OperationLogAction.SUGGEST_BANK_SMS_RECONCILIATION,
        operatorId: currentUser.id,
        detail: 'Bank SMS reconciliation no candidate match',
        detailJson: {
          eventType: 'bank_sms_reconciliation_no_candidate',
          diagnosticVersion: 1,
          candidateSourcesChecked: this.buildNoCandidateSourcesChecked(lockedTransaction),
          missingEvidenceHints:
            this.buildNoCandidateMissingEvidenceHints(lockedTransaction),
          safeNextStepHints:
            this.buildNoCandidateSafeNextStepHints(lockedTransaction),
          bankSmsTransactionId: lockedTransaction.id,
          companyId: lockedTransaction.companyId,
          direction: lockedTransaction.direction,
          amount: lockedTransaction.amount,
          bankName: lockedTransaction.bankName,
          accountTail: lockedTransaction.accountTail,
          counterpartyPresent: Boolean(lockedTransaction.counterparty?.trim()),
          companyBound: lockedTransaction.companyId !== null,
          candidateCount: 0,
          reasonCode: 'no_candidate_match',
          rawSmsBodyIncluded: false,
        },
      }, manager);
    });
  }

  private resolveConfirmApplyAttemptLink(
    links: FinanceReconciliationLink[],
    reconciliationLinkId?: number,
  ) {
    if (reconciliationLinkId) {
      return links.find((item) => item.id === reconciliationLinkId) ?? null;
    }

    return (
      links.find((item) => item.status === 'suggested') ??
      links.find((item) => item.status === 'confirmed') ??
      null
    );
  }

  private async recordConfirmApplyAttemptDiagnostic(
    transaction: BankSmsTransaction,
    link: FinanceReconciliationLink | null,
    dto: ConfirmApplyBankSmsTransactionDto,
    currentUser: CurrentUser,
  ) {
    await this.tryCreateBankSmsDecisionTrailLog({
      module: 'finance_reconciliation',
      targetId: transaction.id,
      action: OperationLogAction.CONFIRM_BANK_SMS_APPLY,
      operatorId: currentUser.id,
      detail: 'Bank SMS confirm-apply attempted',
      detailJson: {
        eventType: 'bank_sms_confirm_apply_attempted',
        bankSmsTransactionId: transaction.id,
        companyId: transaction.companyId,
        reconciliationLinkId: link?.id ?? dto.reconciliationLinkId ?? null,
        linkType: link?.linkType ?? null,
        linkId: link?.linkId ?? null,
        requestedConfirmedAmount: dto.confirmedAmount ?? null,
        operatorId: currentUser.id,
        verificationCodeValueIncluded: false,
        rawSmsBodyIncluded: false,
      },
    });
  }

  private async recordConfirmApplyBlockedDiagnostic(
    transaction: BankSmsTransaction,
    link: FinanceReconciliationLink | null,
    dto: ConfirmApplyBankSmsTransactionDto,
    currentUser: CurrentUser,
    reasonCode: BankSmsConfirmApplyBlockedReasonCode,
    bridgeResult: BankSmsCollectionOrderBridgeResult | null = null,
    backendMessage: string | null = null,
  ) {
    await this.tryCreateBankSmsDecisionTrailLog({
      module: 'finance_reconciliation',
      targetId: transaction.id,
      action: OperationLogAction.CONFIRM_BANK_SMS_APPLY,
      operatorId: currentUser.id,
      detail: `Bank SMS confirm-apply blocked: ${reasonCode}`,
      detailJson: {
        eventType: 'bank_sms_confirm_apply_blocked',
        bankSmsTransactionId: transaction.id,
        companyId: transaction.companyId,
        reconciliationLinkId: link?.id ?? dto.reconciliationLinkId ?? null,
        linkType: link?.linkType ?? null,
        linkId: link?.linkId ?? null,
        requestedConfirmedAmount: dto.confirmedAmount ?? null,
        operatorId: currentUser.id,
        reasonCode,
        backendMessage,
        bridgeHelperStatus: bridgeResult?.status ?? null,
        collectionOrderId: bridgeResult?.collectionOrderId ?? null,
        candidateCollectionOrderIds: bridgeResult?.candidateCollectionOrderIds ?? null,
        verificationCodeValueIncluded: false,
        rawSmsBodyIncluded: false,
      },
    });
  }

  private async recordCollectionBridgeResultDiagnostic(
    transaction: BankSmsTransaction,
    link: FinanceReconciliationLink,
    result: BankSmsCollectionOrderBridgeResult,
    currentUser: CurrentUser,
  ) {
    await this.tryCreateBankSmsDecisionTrailLog({
      module: 'finance_reconciliation',
      targetId: transaction.id,
      action: OperationLogAction.CONFIRM_BANK_SMS_APPLY,
      operatorId: currentUser.id,
      detail: `Bank SMS collection bridge helper result: ${result.status}`,
      detailJson: {
        eventType: 'bank_sms_collection_bridge_helper_result',
        bankSmsTransactionId: transaction.id,
        companyId: transaction.companyId,
        reconciliationLinkId: link.id,
        linkType: link.linkType,
        linkId: link.linkId,
        result: {
          status: result.status,
          attached: result.attached,
          ready: result.ready,
          collectionOrderId: result.collectionOrderId,
          candidateCollectionOrderIds: result.candidateCollectionOrderIds,
          reason: result.reason,
        },
        bridgeHelperStatus: result.status,
        attached: result.attached,
        ready: result.ready,
        collectionOrderId: result.collectionOrderId,
        candidateCollectionOrderIds: result.candidateCollectionOrderIds,
        rawSmsBodyIncluded: false,
      },
    });
  }

  private extractCollectionBridgeResult(error: unknown) {
    return (error as BankSmsCollectionBridgeException | null)
      ?.bankSmsCollectionBridgeResult ?? null;
  }

  private resolveConfirmApplyBlockedReasonCode(
    error: unknown,
    bridgeResult: BankSmsCollectionOrderBridgeResult | null,
  ): BankSmsConfirmApplyBlockedReasonCode {
    if (bridgeResult) {
      return COLLECTION_BRIDGE_STATUS_TO_BLOCK_REASON[bridgeResult.status] ?? 'other';
    }

    const message = this.readErrorMessage(error);
    if (
      /Unknown bank SMS confirm-apply link type/i.test(message) ||
      /建议类型.*不支持|不支持.*确认/.test(message)
    ) {
      return 'unknown_link_type';
    }

    return 'other';
  }

  private readErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private async validateConfirmationTarget(
    link: FinanceReconciliationLink,
    transaction: BankSmsTransaction,
    manager: EntityManager,
    dto: ConfirmApplyBankSmsTransactionDto,
    currentUser: CurrentUser,
    collectionBoundaryAlreadyLocked = false,
  ) {
    const linkRepository = manager.getRepository(FinanceReconciliationLink);
    if (!collectionBoundaryAlreadyLocked) {
      await this.assertConfirmApplyCollectionBoundary(link, transaction, manager, currentUser);
    }

    if (link.linkType === 'approval_order') {
      if (!link.linkId) {
        throw new BadRequestException('审批单建议缺少目标对象');
      }

      const approvalRequest = await manager.getRepository(ApprovalRequest).findOne({
        where: { id: link.linkId },
        relations: {
          payoutRecords: true,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!approvalRequest) {
        throw new NotFoundException('关联审批单不存在');
      }
      if (approvalRequest.currentStatus !== ApprovalStatus.APPROVED) {
        throw new BadRequestException('当前审批单不是已审批待付款状态');
      }
      if (approvalRequest.payoutRecords.length > 0) {
        throw new BadRequestException('当前审批单已登记付款，不能再次被短信重复提取支付');
      }

      const duplicateApprovalLink = await linkRepository.findOne({
        where: {
          linkType: 'approval_order',
          linkId: approvalRequest.id,
          status: 'confirmed',
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (duplicateApprovalLink && duplicateApprovalLink.id !== link.id) {
        throw new BadRequestException('当前审批单已被其他短信确认入账，不能重复消费');
      }

      if (link.verificationCodeRequired) {
        const inputCode = dto.verificationCode?.trim();
        const actualCode = approvalRequest.verificationCode?.trim();
        if (!inputCode || !actualCode || inputCode !== actualCode) {
          throw new BadRequestException('验证码校验失败，当前审批单不能确认入账');
        }
      }

      return;
    }

    if (link.linkType === 'receipt_item') {
      if (!link.linkId) {
        throw new BadRequestException('收款项建议缺少目标对象');
      }

      const workOrder = await manager.getRepository(WorkOrder).findOne({
        where: { id: link.linkId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!workOrder) {
        throw new NotFoundException('关联收款项不存在');
      }
      assertWorkOrderNotUnquoted(workOrder);

      if (compareMoney(workOrder.amountReceived, workOrder.amountDue) >= 0) {
        throw new BadRequestException('当前收款项已被消费，不能重复确认');
      }

      const duplicateReceiptLink = await linkRepository.findOne({
        where: {
          linkType: 'receipt_item',
          linkId: workOrder.id,
          status: 'confirmed',
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (duplicateReceiptLink && duplicateReceiptLink.id !== link.id) {
        throw new BadRequestException('当前收款项已被其他短信确认，不能重复消费');
      }

      return;
    }

    if (link.linkType === 'receivable_tracking') {
      if (!link.linkId) {
        throw new BadRequestException('应收追踪建议缺少目标对象');
      }

      await this.financeReconciliationService.validateReceivableTrackingConfirmationTarget(
        link.linkId,
        transaction,
        manager,
      );

      return;
    }

    if (link.linkType === 'wechat_settlement_batch') {
      if (!link.linkId) {
        throw new BadRequestException('The WeChat settlement batch target is missing.');
      }

      await this.financeWechatService.validateSuggestedBankMatch(link.linkId, transaction, manager);

      return;
    }

    if (link.linkType === 'manual_fee') {
      if (transaction.direction !== 'expense') {
        throw new BadRequestException('只有支出短信才能确认银行手续费');
      }
      if (transaction.counterparty?.trim()) {
        throw new BadRequestException('存在对方户名的短信不能直接按手续费确认');
      }
      if (Number(transaction.amount) > SMALL_MANUAL_FEE_THRESHOLD) {
        throw new BadRequestException('大额支出不能直接按银行手续费处理');
      }

      return;
    }

    if (link.linkType === 'internal_fund_flow') {
      if (!link.linkId) {
        throw new BadRequestException('内部资金流建议缺少目标对象');
      }

      await this.financeInternalFundFlowService.validateConfirmationTarget(
        link.linkId,
        transaction,
        manager,
      );

      return;
    }

    throw new BadRequestException('当前建议类型不支持确认入账');
  }

  /**
   * Current-lock a non-collection confirmation target BEFORE the bank/link write
   * locks. This serializes two bank SMS attempting to consume the same approval,
   * WeChat settlement batch or internal fund flow target, closing the REPEATABLE
   * READ stale-snapshot double-confirm race. `manual_fee` has no business target.
   */
  private async lockNonCollectionConfirmationTarget(
    link: FinanceReconciliationLink,
    transaction: BankSmsTransaction,
    manager: EntityManager,
  ) {
    const linkType = String(link.linkType);
    if (linkType === 'approval_order') {
      // ApprovalRequest and generic WorkOrder carry no typed company/scope
      // authority. This Gate must not guess company/scope, so approval-order
      // formal confirmation fails closed before any bank/link lock or write.
      throw new ConflictException(
        '[approval_bank_scope_authority_unavailable] 审批单正式收款确认需要独立的公司/scope 权威，本 Gate 尚未接入，禁止确认入账',
      );
    }
    if (linkType === 'wechat_settlement_batch') {
      if (!link.linkId) {
        throw new BadRequestException('The WeChat settlement batch target is missing.');
      }
      const batch = await this.financeWechatService.getSettlementBatchForBankMatch(
        link.linkId,
        manager,
      );
      this.assertWechatBatchCompany(batch, transaction);
      return;
    }
    if (linkType === 'internal_fund_flow') {
      if (!link.linkId) {
        throw new BadRequestException('内部资金流建议缺少目标对象');
      }
      await this.financeInternalFundFlowService.validateConfirmationTarget(
        link.linkId,
        transaction,
        manager,
      );
    }
    // manual_fee and any unknown type take no business target lock.
  }

  private async assertConfirmApplyCollectionBoundary(
    link: FinanceReconciliationLink,
    transaction: BankSmsTransaction,
    manager: EntityManager,
    currentUser: CurrentUser,
  ) {
    const linkType = String(link.linkType);
    if (COLLECTION_REQUIRED_CONFIRM_LINK_TYPES.has(linkType)) {
      const bridgeResult =
        await this.financeReconciliationService.findAndAttachExistingBankSmsCollectionOrderBridge(
          {
            reconciliationLink: link,
            transaction,
          },
          currentUser,
          manager,
        );
      await this.recordCollectionBridgeResultDiagnostic(
        transaction,
        link,
        bridgeResult,
        currentUser,
      );
      if (bridgeResult.ready) {
        return;
      }

      throw this.buildCollectionBridgeBlockedException(bridgeResult);
    }

    if (NON_COLLECTION_CONFIRM_EXCEPTION_LINK_TYPES.has(linkType)) {
      return;
    }

    throw new BadRequestException(
      'Unknown bank SMS confirm-apply link type requires manual review before final confirmation.',
    );
  }

  private buildCollectionBridgeBlockedException(
    result: BankSmsCollectionOrderBridgeResult,
  ): BankSmsCollectionBridgeException {
    const error = new BadRequestException(
      this.formatCollectionOrderBridgeBlockedMessage(result),
    ) as BankSmsCollectionBridgeException;
    error.bankSmsCollectionBridgeResult = result;
    return error;
  }

  private formatCollectionOrderBridgeBlockedMessage(
    result: BankSmsCollectionOrderBridgeResult,
  ) {
    const suffix = ` Bridge helper status: ${result.status}.`;
    if (result.status === 'blocked_no_collection_order') {
      return (
        'Collection-required bank SMS confirm-apply is blocked because no compatible finance_collection_order bridge exists.' +
        suffix
      );
    }
    if (result.status === 'blocked_multiple_collection_orders') {
      return (
        'Collection-required bank SMS confirm-apply is blocked because multiple compatible finance_collection_order bridges require manual review.' +
        suffix
      );
    }
    if (result.status === 'blocked_amount_mismatch') {
      return (
        'Collection-required bank SMS confirm-apply is blocked because the compatible finance_collection_order amount does not match the bank SMS amount.' +
        suffix
      );
    }
    if (result.status === 'blocked_target_mismatch') {
      return (
        'Collection-required bank SMS confirm-apply is blocked because existing finance_collection_order candidates do not match the reconciliation target.' +
        suffix
      );
    }

    return (
      'Collection-required bank SMS confirm-apply requires a reviewed, matched finance_collection_order bridge before final confirmation.' +
      suffix
    );
  }

  private async loadTransactionOrThrow(id: number) {
    const transaction = await this.bankSmsTransactionRepository.findOne({
      where: { id },
      relations: {
        rawSms: true,
      },
    });
    if (!transaction) {
      throw new NotFoundException('银行短信流水不存在');
    }

    return transaction;
  }

  /**
   * Transactional actor-current recheck for bank-SMS write paths. Runs BEFORE any
   * business target / BankSmsTransaction / FinanceReconciliationLink pessimistic
   * lock, in a fixed global order User -> UserRole(id ASC) -> Role(id ASC), and
   * re-derives write permission from current DB roles rather than request roles.
   */
  private async assertBankSmsActorCurrent(currentUser: CurrentUser, manager: EntityManager) {
    if (currentUser.identitySource !== 'trusted_proxy') {
      throw new ForbiddenException(
        '[bank_sms_confirm_formal_actor_required] 正式银行短信写入需要可信代理正式身份',
      );
    }
    const user = await manager.getRepository(User).findOne({
      where: { id: currentUser.id },
      lock: { mode: 'pessimistic_read' },
    });
    if (!user || user.status !== 1 || user.username !== currentUser.username) {
      throw new ForbiddenException('[bank_sms_actor_revoked] 当前操作人员已禁用或身份已变更');
    }
    const userRoles = await manager.getRepository(UserRole).find({
      where: { userId: user.id },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_read' },
    });
    const boundRoleIds = userRoles.map((item) => item.roleId);
    const roleIds = [...new Set(boundRoleIds)].sort((a, b) => a - b);
    if (roleIds.length !== boundRoleIds.length) {
      throw new ForbiddenException('[bank_sms_role_binding_duplicate] 角色绑定存在重复，需先治理');
    }
    const roles: Role[] = [];
    for (const id of roleIds) {
      const role = await manager.getRepository(Role).findOne({
        where: { id },
        lock: { mode: 'pessimistic_read' },
      });
      if (!role) {
        throw new ForbiddenException('[bank_sms_role_revoked] 角色绑定已失效');
      }
      roles.push(role);
    }
    if (!roles.some((role) => WRITE_ROLES.includes(role.code as (typeof WRITE_ROLES)[number]))) {
      throw new ForbiddenException('[bank_sms_role_denied] 当前数据库角色无权执行银行短信写入');
    }
  }

  private resolveActiveLink(links: FinanceReconciliationLink[]) {
    return links.find((item) => item.status === 'confirmed') ?? links.find((item) => item.status === 'suggested') ?? null;
  }

  private assertTransactionActionable(transaction: BankSmsTransaction) {
    if (transaction.reconcileStatus === 'confirmed') {
      throw new BadRequestException('当前短信已确认落账，不能重复处理');
    }
    if (transaction.reconcileStatus === 'ignored') {
      throw new BadRequestException('当前短信已被忽略，不能再次建议匹配');
    }
  }

  private assertTransactionBound(transaction: BankSmsTransaction) {
    if (transaction.companyId === null) {
      throw new BadRequestException('当前银行短信尚未完成账户绑定，不能进入正式财务匹配');
    }
  }

  private assertWechatBatchCompany(
    batch: Pick<WechatSettlementBatch, 'companyId'>,
    transaction: Pick<BankSmsTransaction, 'companyId'>,
  ) {
    if (
      transaction.companyId === null ||
      !Number.isInteger(batch.companyId) ||
      batch.companyId !== transaction.companyId
    ) {
      throw new ForbiddenException(
        '[bank_sms_wechat_company_scope_mismatch] 企业微信结算批次与银行短信公司作用域不一致',
      );
    }
  }

  private async loadBankSmsWechatAnchors(
    bankSmsTransactionId: number,
    manager: EntityManager,
  ) {
    return manager.getRepository(WechatSettlementBatch).find({
      where: [
        { bankMatchSuggestionBankSmsTransactionId: bankSmsTransactionId },
        { bankSmsTransactionId },
      ],
      order: { id: 'ASC' },
    });
  }

  private assertBankSmsSuggestionTargetNotRebound(
    links: FinanceReconciliationLink[],
    wechatAnchors: WechatSettlementBatch[],
    linkType: string,
    linkId: number | null | undefined,
    reconcileStatus: string,
  ) {
    if (
      links.some((link) => link.linkType !== linkType || link.linkId !== linkId) ||
      links.length > 1
    ) {
      throw new ConflictException(
        '[bank_sms_source_rebind_forbidden] 银行短信已有其他历史匹配目标，缺少正式替代权威，禁止改绑',
      );
    }
    if (links.some((link) => link.status !== 'suggested')) {
      throw new ConflictException(
        '[bank_sms_source_rebind_forbidden] 历史匹配状态不可直接恢复或覆盖',
      );
    }
    if (linkType === 'wechat_settlement_batch') {
      if (links.length === 0 && wechatAnchors.length !== 0) {
        throw new ConflictException(
          '[bank_sms_source_rebind_forbidden] 企业微信历史锚点缺少一致匹配链接，需先治理',
        );
      }
      if (
        wechatAnchors.some(
          (batch) =>
            batch.id !== linkId ||
            batch.bankMatchSuggestionBankSmsTransactionId == null,
        ) ||
        wechatAnchors.length > 1 ||
        (links.length === 1 && wechatAnchors.length !== 1)
      ) {
        throw new ConflictException(
          '[bank_sms_source_rebind_forbidden] 银行短信已有不同企业微信批次锚点，禁止改绑',
        );
      }
    } else if (wechatAnchors.length > 0) {
      throw new ConflictException(
        '[bank_sms_source_rebind_forbidden] 银行短信已有企业微信历史锚点，禁止切换匹配类型',
      );
    }
    if (links.length === 1 && reconcileStatus !== 'suggested') {
      throw new ConflictException(
        '[bank_sms_source_rebind_forbidden] 银行短信状态与历史建议链接不一致，需先治理',
      );
    }
  }

  private assertBankSmsConfirmationTargetNotRebound(
    links: FinanceReconciliationLink[],
    wechatAnchors: WechatSettlementBatch[],
    targetLink: FinanceReconciliationLink,
    bankSmsTransactionId: number,
  ) {
    if (
      links.length !== 1 ||
      links[0].id !== targetLink.id ||
      links[0].linkType !== targetLink.linkType ||
      links[0].linkId !== targetLink.linkId
    ) {
      throw new ConflictException(
        '[bank_sms_source_rebind_forbidden] 银行短信存在多个或不同历史匹配目标，禁止正式确认',
      );
    }
    if (targetLink.linkType === 'wechat_settlement_batch') {
      if (
        targetLink.linkId == null ||
        wechatAnchors.length !== 1 ||
        wechatAnchors[0].id !== targetLink.linkId ||
        wechatAnchors[0].bankMatchSuggestionBankSmsTransactionId !== bankSmsTransactionId
      ) {
        throw new ConflictException(
          '[bank_sms_source_rebind_forbidden] 企业微信批次历史锚点与当前确认目标不一致',
        );
      }
    } else if (wechatAnchors.length > 0) {
      throw new ConflictException(
        '[bank_sms_source_rebind_forbidden] 银行短信已有企业微信历史锚点，禁止按其他类型确认',
      );
    }
  }

  private formatInternalFundFlowType(flowType: string) {
    return INTERNAL_FUND_FLOW_TYPE_LABELS[flowType] ?? flowType;
  }

  private buildInternalPartyCompanyIdsMap(registries: BankAccountRegistry[]) {
    const companyIdsByPartyName = new Map<string, Set<number>>();

    for (const registry of registries) {
      const names = [registry.accountAlias, registry.accountHolder];
      for (const name of names) {
        const normalizedName = normalizeBankSmsPartyName(name);
        if (!normalizedName) {
          continue;
        }

        const current = companyIdsByPartyName.get(normalizedName) ?? new Set<number>();
        current.add(registry.companyId);
        companyIdsByPartyName.set(normalizedName, current);
      }
    }

    return companyIdsByPartyName;
  }

  private isInternalTransferEvidence(
    transaction: BankSmsTransaction,
    companyIdsByPartyName: Map<string, Set<number>>,
  ) {
    const normalizedCounterparty = normalizeBankSmsPartyName(transaction.counterparty);
    if (!normalizedCounterparty) {
      return false;
    }

    return (companyIdsByPartyName.get(normalizedCounterparty)?.size ?? 0) > 0;
  }

  private loadPendingLedgerClassifications(query: QueryPendingBankSmsLedgerDto) {
    const qb = this.smsMessageClassificationRepository
      .createQueryBuilder('classification')
      .leftJoinAndSelect('classification.rawSms', 'rawSms')
      .leftJoin(BankSmsTransaction, 'tx', 'tx.raw_sms_id = classification.raw_sms_id')
      .leftJoin(
        FinanceReconciliationLink,
        'confirmedLink',
        'confirmedLink.bank_sms_transaction_id = tx.id AND confirmedLink.status = :confirmedLinkStatus',
        { confirmedLinkStatus: 'confirmed' },
      )
      .where(
        '(classification.classify_type = :bankType OR rawSms.classify_status = :blockedStatus)',
        {
          bankType: 'bank_transaction',
          blockedStatus: 'blocked_security_credential',
        },
      )
      .andWhere('(tx.id IS NULL OR tx.reconcile_status <> :confirmedTxStatus)', {
        confirmedTxStatus: 'confirmed',
      })
      .andWhere('confirmedLink.id IS NULL');

    if (query.rawSmsId) {
      qb.andWhere('classification.raw_sms_id = :rawSmsId', { rawSmsId: query.rawSmsId });
    }
    if (query.classificationId) {
      qb.andWhere('classification.id = :classificationId', {
        classificationId: query.classificationId,
      });
    }
    if (query.deviceId?.trim()) {
      qb.andWhere('rawSms.device_id = :deviceId', { deviceId: query.deviceId.trim() });
    }
    if (query.sender?.trim()) {
      qb.andWhere('rawSms.sender LIKE :sender', { sender: `%${query.sender.trim()}%` });
    }
    if (query.dateFrom) {
      qb.andWhere('rawSms.received_at >= :dateFrom', { dateFrom: new Date(query.dateFrom) });
    }
    if (query.dateTo) {
      qb.andWhere('rawSms.received_at <= :dateTo', { dateTo: new Date(query.dateTo) });
    }

    return qb
      .orderBy('rawSms.receivedAt', 'DESC')
      .addOrderBy('classification.id', 'DESC')
      .take(PENDING_LEDGER_LOAD_LIMIT)
      .getMany();
  }

  private buildPendingLedgerItem(
    classification: SmsMessageClassification,
    transaction: BankSmsTransaction | null,
    registryByKey: Map<string, BankAccountRegistry>,
    activeRegistries: BankAccountRegistry[],
    promotionWindow: BankSmsPromotionWindow,
    currentUser: CurrentUser,
  ): PendingBankSmsLedgerItem | null {
    const rawSms = classification.rawSms;
    if (!rawSms) {
      return null;
    }

    const parsed = this.readPendingLedgerParsed(classification);
    const securityCredentialBlocked = this.isPendingLedgerSecurityCredentialBlocked(
      classification,
      rawSms,
      parsed,
    );
    const registry = securityCredentialBlocked
      ? null
      : this.resolvePendingLedgerRegistry(parsed, rawSms, registryByKey);
    const canViewFinancialFields =
      this.hasFullFinancialFieldAccess(currentUser) && !securityCredentialBlocked;
    const ledgerStatus = this.resolvePendingLedgerStatus({
      parsed,
      transaction,
      registry,
      securityCredentialBlocked,
    });
    const amount = canViewFinancialFields ? parsed.amount : null;
    const balanceAfter = canViewFinancialFields ? parsed.balanceAfter : null;
    const accountTail = canViewFinancialFields ? parsed.accountTail : null;
    const promotionView = this.buildPendingLedgerPromotionView(
      classification,
      rawSms,
      transaction,
      activeRegistries,
      promotionWindow,
      securityCredentialBlocked,
    );

    return {
      eventId: rawSms.mobileSmsEventId,
      rawSmsId: classification.rawSmsId,
      classificationId: classification.id,
      transactionId: transaction?.id ?? null,
      sender: this.maskSender(parsed.sender ?? rawSms.sender),
      bankName: securityCredentialBlocked ? null : parsed.bankName,
      direction: securityCredentialBlocked ? null : parsed.direction,
      amount,
      balanceAfter,
      accountTail,
      accountTailMasked: this.maskAccountTail(parsed.accountTail),
      receivedAt: this.toIsoString(rawSms.receivedAt),
      deviceId: rawSms.deviceId,
      classificationStatus: rawSms.classifyStatus,
      evidenceStatus: this.resolvePendingLedgerEvidenceStatus({
        transaction,
        securityCredentialBlocked,
      }),
      bindingStatus: this.resolvePendingLedgerBindingStatus({
        parsed,
        transaction,
        registry,
        securityCredentialBlocked,
      }),
      ledgerStatus,
      riskFlags: this.buildPendingLedgerRiskFlags({
        parsed,
        transaction,
        registry,
        securityCredentialBlocked,
      }),
      blockedReason: securityCredentialBlocked
        ? parsed.blockedReason ?? 'otp_or_verification_code_blocked'
        : null,
      bodyHash: parsed.bodyHash,
      senderHash: parsed.senderHash,
      bankAccountRegistryId: registry?.id ?? null,
      companyId: registry?.companyId ?? transaction?.companyId ?? null,
      reconcileStatus: transaction?.reconcileStatus ?? null,
      ...promotionView,
      financialFieldsRedacted:
        !canViewFinancialFields &&
        Boolean(parsed.amount || parsed.balanceAfter || parsed.accountTail),
      rawBodyReturned: false,
      canConfirm: false,
      canAffectLedger: false,
      createdAt: this.toIsoString(classification.createdAt),
      updatedAt: null,
    };
  }

  private buildPendingLedgerPromotionView(
    classification: SmsMessageClassification,
    rawSms: SmsMessageRaw,
    transaction: BankSmsTransaction | null,
    activeRegistries: BankAccountRegistry[],
    promotionWindow: BankSmsPromotionWindow,
    securityCredentialBlocked: boolean,
  ): Pick<
    PendingBankSmsLedgerItem,
    | 'evidenceAssessment'
    | 'evidenceBlockers'
    | 'admissionOutcome'
    | 'targetStatusPreview'
    | 'parserPolicyVersion'
    | 'promotionPolicyVersion'
    | 'evidenceFingerprintSummary'
    | 'decisionFingerprintSummary'
  > {
    const common = {
      admissionOutcome: rawSms.promotionAdmissionOutcome,
      parserPolicyVersion: classification.parserPolicyVersion,
      promotionPolicyVersion:
        rawSms.promotionPolicyVersion ?? transaction?.promotionPolicyVersion ?? null,
      evidenceFingerprintSummary: fingerprintSummary(
        classification.evidenceFingerprint ??
          rawSms.promotionEvidenceFingerprint ??
          transaction?.promotionEvidenceFingerprint,
      ),
      decisionFingerprintSummary: fingerprintSummary(
        rawSms.promotionDecisionFingerprint ??
          transaction?.promotionDecisionFingerprint,
      ),
    };

    if (securityCredentialBlocked) {
      return {
        ...common,
        evidenceAssessment: 'blocked',
        evidenceBlockers: ['security_credential_blocked'],
        targetStatusPreview: null,
      };
    }

    if (rawSms.promotionAdmissionKey) {
      const evidenceSnapshotPresent = Array.isArray(
        rawSms.promotionEvidenceBlockerCodes,
      );
      const persistedEvidenceBlockers = evidenceSnapshotPresent
        ? rawSms.promotionEvidenceBlockerCodes ?? []
        : ['promotion_evidence_snapshot_missing'];
      const historicalExcluded = rawSms.promotionBlockerCodes?.includes(
        'historical_raw_cutoff_excluded',
      );
      return {
        ...common,
        evidenceAssessment: transaction?.promotionAdmissionKey && evidenceSnapshotPresent
          ? 'promoted'
          : historicalExcluded
            ? 'historical_excluded'
            : persistedEvidenceBlockers.length === 0
              ? 'complete_candidate'
              : 'blocked',
        evidenceBlockers: persistedEvidenceBlockers,
        targetStatusPreview: evidenceSnapshotPresent
          ? rawSms.promotionTargetStatusPreview
          : null,
      };
    }

    const effectiveHistoricalCutoff = resolveBankSmsHistoricalCutoff(promotionWindow);

    const historicalBlockers = [
      ...(rawSms.id <= effectiveHistoricalCutoff
        ? ['historical_raw_cutoff_excluded']
        : []),
      ...(!classification.parserPolicyVersion
        ? ['parser_policy_version_missing']
        : []),
    ];
    if (historicalBlockers.length) {
      return {
        ...common,
        evidenceAssessment: 'historical_excluded',
        evidenceBlockers: historicalBlockers,
        targetStatusPreview: null,
      };
    }

    const parsedJson = this.asRecord(classification.parsedJson);
    const evidence = assessBankSmsEvidence({
      eventId: rawSms.mobileSmsEventId,
      rawSmsId: rawSms.id,
      classificationId: classification.id,
      classifyType: classification.classifyType,
      parseStatus: this.readJsonString(parsedJson.parseStatus),
      parserPolicyVersion: classification.parserPolicyVersion,
      bankName: this.readJsonString(parsedJson.bankName),
      sender: rawSms.sender,
      accountTail: this.readJsonString(parsedJson.accountTail),
      accountAlias: this.readJsonString(parsedJson.accountAlias),
      bankBusinessDate: this.readJsonDate(parsedJson.bankBusinessDate),
      smsReceivedAt: this.readJsonDate(parsedJson.smsReceivedAt),
      direction: this.readJsonString(parsedJson.direction),
      amount: this.readJsonString(parsedJson.amount),
      balanceAfter: this.readJsonString(parsedJson.balanceAfter),
      counterparty: this.readJsonString(parsedJson.counterparty),
      normalizedBody: this.readJsonString(parsedJson.normalizedBody),
      registries: activeRegistries,
    });

    return {
      ...common,
      evidenceAssessment: transaction?.promotionAdmissionKey
        ? 'promoted'
        : evidence.evidenceComplete
          ? 'complete_candidate'
          : 'blocked',
      evidenceBlockers: evidence.evidenceBlockerCodes,
      targetStatusPreview: evidence.targetStatusPreview,
    };
  }

  private readPendingLedgerParsed(
    classification: SmsMessageClassification,
  ): PendingBankSmsLedgerParsed {
    const parsedJson = this.asRecord(classification.parsedJson);
    return {
      bankName: this.readJsonString(parsedJson.bankName),
      sender: this.readJsonString(parsedJson.sender),
      direction: this.readJsonDirection(parsedJson.direction),
      amount: this.readJsonString(parsedJson.amount),
      balanceAfter: this.readJsonString(parsedJson.balanceAfter),
      accountTail: this.readJsonString(parsedJson.accountTail),
      accountAlias: this.readJsonString(parsedJson.accountAlias),
      blockedReason: this.readJsonString(parsedJson.reason),
      bodyHash: this.readJsonString(parsedJson.bodyHash),
      senderHash: this.readJsonString(parsedJson.senderHash),
    };
  }

  private isPendingLedgerSecurityCredentialBlocked(
    classification: SmsMessageClassification,
    rawSms: SmsMessageRaw,
    parsed: PendingBankSmsLedgerParsed,
  ) {
    return (
      rawSms.classifyStatus === 'blocked_security_credential' ||
      parsed.blockedReason === 'otp_or_verification_code_blocked' ||
      (classification.classifyType === 'verification_code' &&
        rawSms.uploadStatus === 'blocked')
    );
  }

  private resolvePendingLedgerRegistry(
    parsed: PendingBankSmsLedgerParsed,
    rawSms: SmsMessageRaw,
    registryByKey: Map<string, BankAccountRegistry>,
  ) {
    if (!parsed.bankName || !parsed.accountTail) {
      return null;
    }

    return (
      registryByKey.get(
        this.pendingLedgerRegistryKey(
          parsed.bankName,
          parsed.sender ?? rawSms.sender,
          parsed.accountTail,
        ),
      ) ?? null
    );
  }

  private resolvePendingLedgerStatus(input: {
    parsed: PendingBankSmsLedgerParsed;
    transaction: BankSmsTransaction | null;
    registry: BankAccountRegistry | null;
    securityCredentialBlocked: boolean;
  }): PendingBankSmsLedgerStatus {
    if (input.securityCredentialBlocked) {
      return 'blocked_security_credential';
    }
    if (input.transaction?.reconcileStatus === 'ignored') {
      return 'rejected';
    }
    if (!input.parsed.accountTail || !input.registry) {
      return 'pending_account_binding';
    }
    if (
      input.transaction &&
      (input.transaction.companyId === null ||
        input.transaction.reconcileStatus === 'pending_binding')
    ) {
      return 'pending_company_binding';
    }
    if (
      input.transaction &&
      ['pending', 'pending_evidence', 'suggested'].includes(input.transaction.reconcileStatus)
    ) {
      return 'pending_reconciliation';
    }
    if (!input.transaction) {
      return 'ready_for_manual_review';
    }
    return 'classified_bank_transaction';
  }

  private resolvePendingLedgerEvidenceStatus(input: {
    transaction: BankSmsTransaction | null;
    securityCredentialBlocked: boolean;
  }) {
    if (input.securityCredentialBlocked) {
      return 'security_credential_metadata_only';
    }
    if (!input.transaction) {
      return 'classification_only';
    }
    if (input.transaction.reconcileStatus === 'pending_evidence') {
      return 'pending_evidence';
    }
    if (input.transaction.reconcileStatus === 'pending_binding') {
      return 'pending_binding';
    }
    return 'candidate_transaction_pending';
  }

  private resolvePendingLedgerBindingStatus(input: {
    parsed: PendingBankSmsLedgerParsed;
    transaction: BankSmsTransaction | null;
    registry: BankAccountRegistry | null;
    securityCredentialBlocked: boolean;
  }) {
    if (input.securityCredentialBlocked) {
      return 'not_applicable_security_credential_blocked';
    }
    if (!input.parsed.accountTail) {
      return 'missing_account_tail';
    }
    if (!input.registry) {
      return 'unregistered_account_tail';
    }
    if (
      input.transaction &&
      (input.transaction.companyId === null ||
        input.transaction.reconcileStatus === 'pending_binding')
    ) {
      return 'company_binding_pending';
    }
    return 'registry_active';
  }

  private buildPendingLedgerRiskFlags(input: {
    parsed: PendingBankSmsLedgerParsed;
    transaction: BankSmsTransaction | null;
    registry: BankAccountRegistry | null;
    securityCredentialBlocked: boolean;
  }) {
    const flags = ['read_only_no_ledger_mutation'];
    if (input.securityCredentialBlocked) {
      flags.push('security_credential_blocked', 'raw_body_not_returned');
      return flags;
    }
    if (!input.parsed.accountTail) {
      flags.push('account_tail_missing');
    }
    if (input.parsed.accountTail && !input.registry) {
      flags.push('active_bank_account_registry_missing');
    }
    if (!input.transaction) {
      flags.push('no_bank_sms_transaction', 'promotion_disabled_candidate_only');
    }
    if (input.transaction) {
      flags.push('existing_candidate_transaction');
    }
    if (input.parsed.balanceAfter) {
      flags.push('balance_data_present_pending_only');
    }
    return Array.from(new Set(flags));
  }

  private matchesPendingLedgerQuery(
    item: PendingBankSmsLedgerItem,
    query: QueryPendingBankSmsLedgerDto,
  ) {
    if (query.status && item.ledgerStatus !== query.status) {
      return false;
    }
    if (query.direction && item.direction !== query.direction) {
      return false;
    }
    if (query.bankName?.trim() && !(item.bankName ?? '').includes(query.bankName.trim())) {
      return false;
    }
    if (query.sender?.trim() && !(item.sender ?? '').includes(query.sender.trim())) {
      return false;
    }
    if (query.accountTail?.trim() && item.accountTail !== query.accountTail.trim()) {
      return false;
    }
    if (query.rawSmsId && item.rawSmsId !== query.rawSmsId) {
      return false;
    }
    if (query.classificationId && item.classificationId !== query.classificationId) {
      return false;
    }
    if (query.minAmount && Number(item.amount ?? Number.NaN) < Number(query.minAmount)) {
      return false;
    }
    if (query.maxAmount && Number(item.amount ?? Number.NaN) > Number(query.maxAmount)) {
      return false;
    }
    return true;
  }

  private sortPendingLedgerItems(
    left: PendingBankSmsLedgerItem,
    right: PendingBankSmsLedgerItem,
    query: QueryPendingBankSmsLedgerDto,
  ) {
    const direction = String(query.sortOrder ?? 'desc').toLowerCase() === 'asc' ? 1 : -1;
    const sortBy = query.sortBy ?? 'receivedAt';
    if (sortBy === 'amount') {
      return direction * (Number(left.amount ?? 0) - Number(right.amount ?? 0));
    }
    if (sortBy === 'bankName') {
      return direction * String(left.bankName ?? '').localeCompare(String(right.bankName ?? ''), 'zh-CN');
    }
    if (sortBy === 'status') {
      return direction * left.ledgerStatus.localeCompare(right.ledgerStatus);
    }
    if (sortBy === 'createdAt') {
      return direction * (this.timeOfIso(left.createdAt) - this.timeOfIso(right.createdAt));
    }
    return direction * (this.timeOfIso(left.receivedAt) - this.timeOfIso(right.receivedAt));
  }

  private buildRegistryByBankSmsKey(registries: BankAccountRegistry[]) {
    const result = new Map<string, BankAccountRegistry>();
    for (const registry of registries) {
      result.set(
        this.pendingLedgerRegistryKey(registry.bankName, registry.smsSender, registry.accountTail),
        registry,
      );
    }
    return result;
  }

  private pendingLedgerRegistryKey(
    bankName?: string | null,
    sender?: string | null,
    accountTail?: string | null,
  ) {
    return [
      this.toNullableTrimmed(bankName)?.toLowerCase() ?? '',
      this.toNullableTrimmed(sender)?.toLowerCase() ?? '',
      this.toNullableTrimmed(accountTail) ?? '',
    ].join('|');
  }

  private buildOverviewCards(
    rows: Array<Pick<BankSmsOverviewSummaryRow, 'todayBankIncome' | 'todayBankExpense' | 'internalTransferNet' | 'pendingCount' | 'currentBankBalance'>>,
    pendingBindingCount: number,
  ): BankSmsOverviewCards {
    return {
      todayBankIncome: normalizeMoneyNumber(
        rows.reduce((sum, item) => sum + Number(item.todayBankIncome ?? 0), 0),
      ),
      todayBankExpense: normalizeMoneyNumber(
        rows.reduce((sum, item) => sum + Number(item.todayBankExpense ?? 0), 0),
      ),
      internalTransferNet: normalizeMoneyNumber(
        rows.reduce((sum, item) => sum + Number(item.internalTransferNet ?? 0), 0),
      ),
      pendingCount: rows.reduce((sum, item) => sum + Number(item.pendingCount ?? 0), 0),
      pendingBindingCount,
      currentBankBalance: normalizeMoneyNumber(
        rows.reduce((sum, item) => sum + Number(item.currentBankBalance ?? 0), 0),
      ),
    };
  }

  private assertReadable(currentUser: CurrentUser) {
    if (
      currentUser.roleCodes.some((roleCode) =>
        READ_ROLES.includes(roleCode as (typeof READ_ROLES)[number]),
      )
    ) {
      return;
    }

    throw new ForbiddenException('当前角色无权查看银行短信对账');
  }

  private assertWritable(currentUser: CurrentUser) {
    if (this.canWrite(currentUser)) {
      return;
    }

    throw new ForbiddenException('当前角色无权确认银行短信入账');
  }

  private canWrite(currentUser: CurrentUser) {
    return currentUser.roleCodes.some((roleCode) =>
      WRITE_ROLES.includes(roleCode as (typeof WRITE_ROLES)[number]),
    );
  }

  private isAuditorOnly(currentUser: CurrentUser) {
    return currentUser.roleCodes.includes('auditor') && !this.canWrite(currentUser);
  }

  private hasFullFinancialFieldAccess(currentUser: CurrentUser) {
    return currentUser.roleCodes.some((roleCode) =>
      FULL_FINANCIAL_FIELD_ROLES.includes(
        roleCode as (typeof FULL_FINANCIAL_FIELD_ROLES)[number],
      ),
    );
  }

  private maskSender(value?: string | null) {
    const normalized = this.toNullableTrimmed(value);
    if (!normalized) {
      return null;
    }

    const digitCount = normalized.replace(/\D/g, '').length;
    if (digitCount <= 6 && normalized.length <= 12) {
      return normalized;
    }
    if (normalized.length <= 4) {
      return `${normalized.slice(0, 1)}*`;
    }
    return `${normalized.slice(0, 3)}***${normalized.slice(-2)}`;
  }

  private maskAccountTail(value?: string | null) {
    const normalized = this.toNullableTrimmed(value);
    if (!normalized) {
      return null;
    }
    if (normalized.length <= 2) {
      return '**';
    }
    return `${'*'.repeat(Math.max(2, normalized.length - 2))}${normalized.slice(-2)}`;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return {};
      }
    }
    return {};
  }

  private readJsonString(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return this.toNullableTrimmed(typeof value === 'string' ? value : null);
  }

  private readJsonDate(value: unknown) {
    const normalized = this.readJsonString(value);
    if (!normalized) {
      return null;
    }
    const parsed = new Date(normalized);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  private readJsonDirection(value: unknown): 'income' | 'expense' | null {
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

  private timeOfIso(value?: string | null) {
    if (!value) {
      return 0;
    }
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  private maskCounterparty(value?: string | null) {
    if (!value) {
      return null;
    }

    if (value.length <= 2) {
      return `${value[0]}*`;
    }

    return `${value.slice(0, 1)}***${value.slice(-1)}`;
  }

  private maskSmsBody(value: string) {
    if (!value) {
      return '';
    }

    if (value.length <= 20) {
      return `${value.slice(0, 4)}******`;
    }

    return `${value.slice(0, 10)}******${value.slice(-8)}`;
  }
}
