import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, In, Repository } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { BIZ_SEQUENCE_CONFIG } from '../../shared/constants/biz-sequence.constant';
import { BankAccountRegistry } from '../finance-bank-account/entities/bank-account-registry.entity';
import {
  bankAccountRegistryEligibilityBlockerCodes,
  bankAccountRegistryIdentityMatches,
  buildRegistryConfirmationAnchor,
  capturedRegistryConfirmationAnchor,
  type RegistryConfirmationAnchor,
} from '../finance-bank-account/bank-account-registry-authority.contract';
import { BankSmsTransaction } from '../finance-bank-sms/entities/bank-sms-transaction.entity';
import { normalizeBankSmsPartyName } from '../finance-bank-sms/utils/boc-bank-sms.util';
import { collectBankSmsPromotionLineageProblems } from '../finance-bank-sms/utils/bank-sms-promotion-policy.util';
import { SmsMessageClassification } from '../message-hub/entities/sms-message-classification.entity';
import { SmsMessageRaw } from '../message-hub/entities/sms-message-raw.entity';
import { FinanceSafetyService } from '../finance-safety/finance-safety.service';
import { WechatPaymentReceipt } from '../finance-wechat/entities/wechat-payment-receipt.entity';
import { WechatSettlementBatch } from '../finance-wechat/entities/wechat-settlement-batch.entity';
import { SequenceService } from '../sequence/sequence.service';
import { CreateTemporaryServiceOrderDraftDto } from '../work-orders/dto/create-temporary-service-order-draft.dto';
import { TemporaryServiceOrder } from '../work-orders/entities/temporary-service-order.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { assertWorkOrderNotUnquoted } from '../work-orders/work-order-intake.policy';
import { AttachCollectionBankTransactionEvidenceDto } from './dto/attach-collection-bank-transaction-evidence.dto';
import { AttachCollectionPaymentReceiptEvidenceDto } from './dto/attach-collection-payment-receipt-evidence.dto';
import { CreateCollectionOrderDraftDto } from './dto/create-collection-order-draft.dto';
import { CreateReceivableTrackingEvidenceDto } from './dto/create-receivable-tracking-evidence.dto';
import { PaymentCallbackDryRunReceiverDto } from './dto/payment-callback-dry-run-receiver.dto';
import {
  FinanceCollectionOrder,
  type FinanceCollectionOrderEvidenceStatus,
  type FinanceCollectionOrderReconcileStatus,
  type FinanceCollectionOrderStatus,
} from './entities/finance-collection-order.entity';
import {
  FinancePaymentRequest,
  type FinancePaymentRequestChannel,
  type FinancePaymentRequestProvider,
  type FinancePaymentRequestStatus,
} from './entities/finance-payment-request.entity';
import {
  FinanceReceivableTracking,
  type FinanceReceivableTrackingEvidenceStatus,
  type FinanceReceivableTrackingSourceType,
} from './entities/finance-receivable-tracking.entity';
import { FinanceReconciliationLink } from './entities/finance-reconciliation-link.entity';
import {
  WechatPayCallbackEvidence,
  type WechatPayCallbackEvidenceStatus,
  type WechatPayEvidenceProvider,
} from './entities/wechat-pay-callback-evidence.entity';
import {
  WechatPayCryptoVerificationAudit,
  type WechatPayCryptoVerificationAuditStatus,
  type WechatPayVerificationResult,
} from './entities/wechat-pay-crypto-verification-audit.entity';
import {
  WechatPayManualReviewTask,
  type WechatPayManualReviewReason,
  type WechatPayManualReviewTaskStatus,
  type WechatPayManualReviewTaskType,
} from './entities/wechat-pay-manual-review-task.entity';
import {
  WechatPaySettlementEvidence,
  type WechatPaySettlementEvidenceSource,
  type WechatPaySettlementEvidenceStatus,
} from './entities/wechat-pay-settlement-evidence.entity';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { BusinessCompanyRef } from '../business-foundation/entities/business-foundation.entities';
import {
  BusinessFoundationService,
  BusinessResourceScope,
} from '../business-foundation/business-foundation.service';
import { RepairWorkOrderProfile } from '../repair-shop/entities/repair-shop.entities';
import {
  assertPositiveCents,
  decimalToCents,
} from '../../common/utils/decimal.util';
import {
  bankSourceSnapshot,
  collectAuthorityEnvelopeProblems,
  collectionOrderConfirmationBlockers,
  collectionOrderConfirmationFingerprint,
  isCollectionOrderStrictlyConfirmed,
  linkSourceSnapshot,
  SOURCE_MODE_BANK_TRANSFER_ONE_TO_ONE_V1,
  workOrderSourceSnapshot,
  type ConfirmationSourceFacts,
} from './collection-order-confirmation.contract';
import { FinanceCollectionConfirmationAuthority } from './entities/finance-collection-confirmation-authority.entity';
import { ConfirmCollectionOrderDto } from './dto/confirm-collection-order.dto';
import { EnterpriseWechatMockPaymentAdapter } from './payment-adapters/enterprise-wechat-mock-payment.adapter';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { Role } from '../roles/entities/role.entity';

function normalizeMoney(value?: string | number | null) {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) {
    throw new BadRequestException('金额格式错误');
  }

  return numericValue.toFixed(2);
}

function subtractMoney(left?: string | number | null, right?: string | number | null) {
  return normalizeMoney(Number(left ?? 0) - Number(right ?? 0));
}

function trimToNull(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries
      .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function sha256(value: unknown) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function ensureNoConfirmedStatus(status: string) {
  if (status === 'confirmed') {
    throw new BadRequestException('Evidence-only WeChat Pay helpers cannot create confirmed rows.');
  }
}

function mergeEvidencePayload(
  existing?: Record<string, unknown> | null,
  incoming?: Record<string, unknown>,
) {
  if (!incoming) {
    return existing ?? null;
  }

  return {
    ...(existing ?? {}),
    ...incoming,
  };
}

function calculateCandidateFee(
  receiptAmount?: string | number | null,
  bankReceivedAmount?: string | number | null,
) {
  if (receiptAmount === null || receiptAmount === undefined) {
    return null;
  }
  if (bankReceivedAmount === null || bankReceivedAmount === undefined) {
    return null;
  }

  const receiptValue = Number(receiptAmount);
  const bankValue = Number(bankReceivedAmount);
  if (!Number.isFinite(receiptValue) || !Number.isFinite(bankValue)) {
    return null;
  }
  if (receiptValue < bankValue) {
    return null;
  }

  return normalizeMoney(receiptValue - bankValue);
}

const BANK_SMS_COLLECTION_BRIDGE_READY_STATUSES = new Set<FinanceCollectionOrderStatus>([
  'bank_matched',
  'completed_candidate',
  'completed',
]);
const BANK_SMS_COLLECTION_BRIDGE_READY_EVIDENCE_STATUSES =
  new Set<FinanceCollectionOrderEvidenceStatus>(['matched_pending_confirmation', 'confirmed']);
const BANK_SMS_COLLECTION_BRIDGE_READY_RECONCILE_STATUSES =
  new Set<FinanceCollectionOrderReconcileStatus>(['matched', 'confirmed']);

export type BankSmsCollectionOrderBridgeResultStatus =
  | 'attached_ready'
  | 'already_ready'
  | 'blocked_no_collection_order'
  | 'blocked_multiple_collection_orders'
  | 'blocked_amount_mismatch'
  | 'blocked_target_mismatch'
  | 'blocked_unreviewed_or_incomplete';

export interface BankSmsCollectionOrderBridgeResult {
  status: BankSmsCollectionOrderBridgeResultStatus;
  collectionOrderId: number | null;
  candidateCollectionOrderIds: number[];
  attached: boolean;
  ready: boolean;
  reason: string;
}

interface FindAndAttachBankSmsCollectionOrderBridgeInput {
  transaction: BankSmsTransaction;
  reconciliationLink: FinanceReconciliationLink;
}

interface MockPaymentRequestEvidenceInput {
  paymentRequestNo?: string;
  provider?: 'enterprise_wechat_mock';
  paymentChannel?: 'enterprise_wechat';
  amount?: string;
  payerPhone?: string | null;
  qrUrl?: string;
  paymentUrl?: string;
  expireAt?: Date | string;
  requestStatus?: 'created';
  createdByEmployeeId?: number | null;
  createdAt?: Date | string;
  idempotencyKey?: string;
  remark?: string;
}

interface MockPaymentRequestEvidence {
  paymentRequestNo: string;
  provider: 'enterprise_wechat_mock';
  paymentChannel: 'enterprise_wechat';
  collectionOrderId: number;
  collectionNo: string;
  amount: string;
  payerPhone: string | null;
  qrUrl: string;
  paymentUrl: string;
  expireAt: string;
  requestStatus: 'created';
  createdByEmployeeId: number | null;
  createdAt: string;
  idempotencyKey: string;
  remark: string | null;
}

interface PrepareTemporaryServicePaymentInitiationDraftDto {
  temporaryService: CreateTemporaryServiceOrderDraftDto;
  collection?: Partial<CreateCollectionOrderDraftDto>;
  paymentRequest?: MockPaymentRequestEvidenceInput;
}

interface PrepareWorkOrderPaymentInitiationDraftDto {
  companyId: number;
  workOrderId: number;
  businessType?: CreateCollectionOrderDraftDto['businessType'];
  businessAmount?: string;
  paymentChannel?: CreateCollectionOrderDraftDto['paymentChannel'];
  customerId?: string;
  customerPhone?: string;
  customerName?: string;
  temporaryCustomerFlag?: boolean;
  responsibleEmployeeId?: number;
  sourceEmployeeId?: number;
  evidencePayload?: Record<string, unknown>;
  remark?: string;
  paymentRequest?: MockPaymentRequestEvidenceInput;
}

interface CreatePaymentRequestDraftDto {
  collectionOrderId: number;
  paymentRequestNo?: string;
  provider?: FinancePaymentRequestProvider;
  paymentChannel?: FinancePaymentRequestChannel;
  amount?: string;
  payerPhone?: string | null;
  payerCustomerId?: string | null;
  createdByEmployeeId?: number | null;
  requestStatus?: Extract<FinancePaymentRequestStatus, 'created' | 'waiting_payment'>;
  expireAt?: Date | string | null;
  idempotencyKey?: string;
  requestPayload?: Record<string, unknown>;
  remark?: string;
}

interface MarkPaymentRequestQrGeneratedMockDto {
  paymentRequestId?: number;
  paymentRequestNo?: string;
  qrUrl?: string;
  paymentUrl?: string;
  channelAppId?: string | null;
  channelMchId?: string | null;
  channelPrepayId?: string | null;
  responsePayload?: Record<string, unknown>;
  requestStatus?: Extract<FinancePaymentRequestStatus, 'qr_generated' | 'waiting_payment'>;
}

interface MockPaymentCallbackDto {
  paymentRequestId?: number;
  paymentRequestNo?: string;
  idempotencyKey?: string;
  channelTradeNo?: string;
  channelPrepayId?: string | null;
  amount: string;
  paidAt?: Date | string;
  payerPhone?: string | null;
  callbackPayload?: Record<string, unknown>;
}

interface CreatePaymentRequestViaAdapterMockDto {
  paymentRequestId?: number;
  paymentRequestNo?: string;
  providerRequestId?: string;
  requestPayload?: Record<string, unknown>;
  requestStatus?: Extract<FinancePaymentRequestStatus, 'qr_generated' | 'waiting_payment'>;
}

interface ParseAndHandleMockEnterpriseWeChatCallbackDto {
  callbackPayload: Record<string, unknown>;
  signature?: string | null;
  headers?: Record<string, string | undefined>;
}

interface RecordAdapterAuditTrailDto {
  paymentRequestId?: number;
  paymentRequestNo?: string;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  callbackPayload?: Record<string, unknown>;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
}

interface PaymentCallbackDryRunReceiverOptions {
  headers?: Record<string, string | string[] | undefined>;
}

interface PaymentCallbackDryRunConfig {
  dryRunEnabled: boolean;
  enterpriseWechatPaymentEnabled: boolean;
  enterpriseWechatCallbackEnabled: boolean;
  enterpriseWechatCallbackPublicEnabled: boolean;
  enterpriseWechatMockMode: boolean;
  internalCallbackTestToken: string | null;
  allowedProviders: Set<string>;
  rejectRealProvider: boolean;
}

interface CreateCallbackEvidenceDraftDto {
  source?: string;
  provider?: WechatPayEvidenceProvider;
  status?: WechatPayCallbackEvidenceStatus;
  eventType?: string | null;
  resourceType?: string | null;
  notificationIdHash?: string | null;
  transactionIdHash?: string | null;
  outTradeNoHash?: string | null;
  financePaymentRequestId?: number | null;
  financeCollectionOrderId?: number | null;
  amountTotalCents?: number | null;
  payerTotalCents?: number | null;
  currency?: string | null;
  tradeState?: string | null;
  successTime?: Date | string | null;
  sanitizedPayload?: Record<string, unknown> | null;
  payloadHash?: string;
  fingerprint?: string;
  redactionVersion?: string;
  receivedAt?: Date | string | null;
  errorCode?: string | null;
  errorReason?: string | null;
  notes?: string | null;
}

interface CreateCryptoVerificationAuditDraftDto {
  source?: string;
  provider?: WechatPayEvidenceProvider;
  status?: WechatPayCryptoVerificationAuditStatus;
  callbackEvidenceId?: number | null;
  signatureResult?: WechatPayVerificationResult;
  decryptResult?: WechatPayVerificationResult;
  certificateSerialHash?: string | null;
  timestampValue?: string | null;
  timestampWindowResult?: string | null;
  nonceHash?: string | null;
  replayFingerprintHash?: string | null;
  replayCheckResult?: string | null;
  sanitizedPayload?: Record<string, unknown> | null;
  payloadHash?: string;
  fingerprint?: string;
  redactionVersion?: string;
  auditedAt?: Date | string | null;
  errorCode?: string | null;
  errorReason?: string | null;
  notes?: string | null;
}

interface CreateManualReviewTaskCandidateDto {
  source?: string;
  provider?: WechatPayEvidenceProvider;
  status?: WechatPayManualReviewTaskStatus;
  taskType: WechatPayManualReviewTaskType;
  reviewReason: WechatPayManualReviewReason;
  callbackEvidenceId?: number | null;
  settlementEvidenceId?: number | null;
  financePaymentRequestId?: number | null;
  financeCollectionOrderId?: number | null;
  bankSmsTransactionId?: number | null;
  financeReconciliationLinkId?: number | null;
  priority?: string;
  evidenceFingerprint?: string;
  sanitizedPayload?: Record<string, unknown> | null;
  payloadHash?: string;
  fingerprint?: string;
  redactionVersion?: string;
  assignedToRole?: string | null;
  reviewSummaryRedacted?: string | null;
  reviewedAt?: Date | string | null;
  errorCode?: string | null;
  errorReason?: string | null;
  notes?: string | null;
}

interface CreateSettlementEvidenceCandidateDto {
  source?: string;
  provider?: WechatPayEvidenceProvider;
  status?: WechatPaySettlementEvidenceStatus;
  transactionIdHash?: string | null;
  outTradeNoHash?: string | null;
  financePaymentRequestId?: number | null;
  financeCollectionOrderId?: number | null;
  bankSmsTransactionId?: number | null;
  paidAmount?: string | number | null;
  settlementAmountCandidate?: string | number | null;
  feeAmountCandidate?: string | number | null;
  settlementCurrency?: string | null;
  transactionBillHash?: string | null;
  fundBillHash?: string | null;
  bankArrivalFingerprintHash?: string | null;
  evidenceSource: WechatPaySettlementEvidenceSource;
  sanitizedPayload?: Record<string, unknown> | null;
  payloadHash?: string;
  fingerprint?: string;
  redactionVersion?: string;
  receivedAt?: Date | string | null;
  errorCode?: string | null;
  errorReason?: string | null;
  notes?: string | null;
}

export interface PaymentCallbackDryRunReceiverResult {
  requestId: string;
  provider: string | null;
  dryRun: boolean;
  accepted: boolean;
  outcome: string;
  paymentRequestNo: string | null;
  collectionOrderId: number | null;
  beforeStatus: string | null;
  afterStatus: string | null;
  collectionOrderBeforeStatus: string | null;
  collectionOrderAfterStatus: string | null;
  idempotencyResult: string;
  warnings: string[];
  errors: string[];
  auditRef: string;
  noRevenueConfirmed: true;
  noWorkOrderChanged: true;
  noBankSmsChanged: true;
}

function isNormalizedCounterpartyMatch(left: string, right: string) {
  if (!left || !right) {
    return false;
  }

  return left === right || left.includes(right) || right.includes(left);
}

@Injectable()
export class FinanceReconciliationService {
  constructor(
    @InjectRepository(BankSmsTransaction)
    private readonly bankSmsTransactionRepository: Repository<BankSmsTransaction>,
    @InjectRepository(FinanceCollectionOrder)
    private readonly financeCollectionOrderRepository: Repository<FinanceCollectionOrder>,
    @InjectRepository(FinancePaymentRequest)
    private readonly financePaymentRequestRepository: Repository<FinancePaymentRequest>,
    @InjectRepository(FinanceReconciliationLink)
    private readonly financeReconciliationLinkRepository: Repository<FinanceReconciliationLink>,
    @InjectRepository(FinanceReceivableTracking)
    private readonly financeReceivableTrackingRepository: Repository<FinanceReceivableTracking>,
    @InjectRepository(WechatPayCallbackEvidence)
    private readonly wechatPayCallbackEvidenceRepository: Repository<WechatPayCallbackEvidence>,
    @InjectRepository(WechatPayCryptoVerificationAudit)
    private readonly wechatPayCryptoVerificationAuditRepository: Repository<WechatPayCryptoVerificationAudit>,
    @InjectRepository(WechatPayManualReviewTask)
    private readonly wechatPayManualReviewTaskRepository: Repository<WechatPayManualReviewTask>,
    @InjectRepository(WechatPaySettlementEvidence)
    private readonly wechatPaySettlementEvidenceRepository: Repository<WechatPaySettlementEvidence>,
    @InjectRepository(TemporaryServiceOrder)
    private readonly temporaryServiceOrderRepository: Repository<TemporaryServiceOrder>,
    @InjectRepository(WechatPaymentReceipt)
    private readonly wechatPaymentReceiptRepository: Repository<WechatPaymentReceipt>,
    @InjectRepository(WechatSettlementBatch)
    private readonly wechatSettlementBatchRepository: Repository<WechatSettlementBatch>,
    @InjectRepository(WorkOrder)
    private readonly workOrderRepository: Repository<WorkOrder>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly sequenceService: SequenceService,
    private readonly enterpriseWechatMockPaymentAdapter: EnterpriseWechatMockPaymentAdapter,
    private readonly financeSafetyService: FinanceSafetyService,
    private readonly businessFoundationService: BusinessFoundationService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async createCallbackEvidenceDraft(
    dto: CreateCallbackEvidenceDraftDto,
    manager?: EntityManager,
  ) {
    const run = async (executor: EntityManager) => {
      const repository = executor.getRepository(WechatPayCallbackEvidence);
      const source = trimToNull(dto.source) ?? 'internal_evidence_only';
      const provider = dto.provider ?? 'wechat_pay_v3_official_like_dummy';
      const status = dto.status ?? 'received';
      ensureNoConfirmedStatus(status);
      const sanitizedPayload = dto.sanitizedPayload ?? null;
      const payloadHash =
        trimToNull(dto.payloadHash) ??
        sha256({
          object: 'wechat_pay_callback_evidence',
          provider,
          status,
          sanitizedPayload,
        });
      const fingerprint =
        trimToNull(dto.fingerprint) ??
        sha256({
          object: 'wechat_pay_callback_evidence',
          provider,
          eventType: dto.eventType,
          transactionIdHash: dto.transactionIdHash,
          outTradeNoHash: dto.outTradeNoHash,
          payloadHash,
        });

      return repository.save(
        repository.create({
          source,
          provider,
          status,
          eventType: trimToNull(dto.eventType),
          resourceType: trimToNull(dto.resourceType),
          notificationIdHash: trimToNull(dto.notificationIdHash),
          transactionIdHash: trimToNull(dto.transactionIdHash),
          outTradeNoHash: trimToNull(dto.outTradeNoHash),
          financePaymentRequestId: dto.financePaymentRequestId ?? null,
          financeCollectionOrderId: dto.financeCollectionOrderId ?? null,
          amountTotalCents: dto.amountTotalCents ?? null,
          payerTotalCents: dto.payerTotalCents ?? null,
          currency: trimToNull(dto.currency),
          tradeState: trimToNull(dto.tradeState),
          successTime: dto.successTime ? new Date(dto.successTime) : null,
          payloadHash,
          fingerprint,
          sanitizedPayload,
          redactionVersion: trimToNull(dto.redactionVersion) ?? 'v1',
          receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : new Date(),
          errorCode: trimToNull(dto.errorCode),
          errorReason: trimToNull(dto.errorReason),
          notes: trimToNull(dto.notes),
        }),
      );
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  async createCryptoVerificationAuditDraft(
    dto: CreateCryptoVerificationAuditDraftDto,
    manager?: EntityManager,
  ) {
    const run = async (executor: EntityManager) => {
      const repository = executor.getRepository(WechatPayCryptoVerificationAudit);
      const source = trimToNull(dto.source) ?? 'internal_evidence_only';
      const provider = dto.provider ?? 'wechat_pay_v3_official_like_dummy';
      const status = dto.status ?? 'audit_candidate';
      ensureNoConfirmedStatus(status);
      const sanitizedPayload = dto.sanitizedPayload ?? null;
      const payloadHash =
        trimToNull(dto.payloadHash) ??
        sha256({
          object: 'wechat_pay_crypto_verification_audit',
          provider,
          status,
          sanitizedPayload,
        });
      const fingerprint =
        trimToNull(dto.fingerprint) ??
        sha256({
          object: 'wechat_pay_crypto_verification_audit',
          provider,
          callbackEvidenceId: dto.callbackEvidenceId,
          replayFingerprintHash: dto.replayFingerprintHash,
          payloadHash,
        });

      return repository.save(
        repository.create({
          source,
          provider,
          status,
          callbackEvidenceId: dto.callbackEvidenceId ?? null,
          signatureResult: dto.signatureResult ?? 'not_evaluated',
          decryptResult: dto.decryptResult ?? 'not_evaluated',
          certificateSerialHash: trimToNull(dto.certificateSerialHash),
          timestampValue: trimToNull(dto.timestampValue),
          timestampWindowResult: trimToNull(dto.timestampWindowResult),
          nonceHash: trimToNull(dto.nonceHash),
          replayFingerprintHash: trimToNull(dto.replayFingerprintHash),
          replayCheckResult: trimToNull(dto.replayCheckResult),
          payloadHash,
          fingerprint,
          sanitizedPayload,
          redactionVersion: trimToNull(dto.redactionVersion) ?? 'v1',
          auditedAt: dto.auditedAt ? new Date(dto.auditedAt) : new Date(),
          errorCode: trimToNull(dto.errorCode),
          errorReason: trimToNull(dto.errorReason),
          notes: trimToNull(dto.notes),
        }),
      );
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  async createManualReviewTaskCandidate(
    dto: CreateManualReviewTaskCandidateDto,
    manager?: EntityManager,
  ) {
    const run = async (executor: EntityManager) => {
      const repository = executor.getRepository(WechatPayManualReviewTask);
      const source = trimToNull(dto.source) ?? 'internal_evidence_only';
      const provider = dto.provider ?? 'wechat_pay_v3_official_like_dummy';
      const status = dto.status ?? 'pending_review';
      ensureNoConfirmedStatus(status);
      const sanitizedPayload = dto.sanitizedPayload ?? null;
      const payloadHash =
        trimToNull(dto.payloadHash) ??
        sha256({
          object: 'wechat_pay_manual_review_task',
          provider,
          status,
          taskType: dto.taskType,
          reviewReason: dto.reviewReason,
          sanitizedPayload,
        });
      const evidenceFingerprint =
        trimToNull(dto.evidenceFingerprint) ??
        sha256({
          callbackEvidenceId: dto.callbackEvidenceId,
          settlementEvidenceId: dto.settlementEvidenceId,
          taskType: dto.taskType,
          reviewReason: dto.reviewReason,
        });
      const fingerprint =
        trimToNull(dto.fingerprint) ??
        sha256({
          object: 'wechat_pay_manual_review_task',
          provider,
          evidenceFingerprint,
          payloadHash,
        });

      return repository.save(
        repository.create({
          source,
          provider,
          status,
          taskType: dto.taskType,
          reviewReason: dto.reviewReason,
          callbackEvidenceId: dto.callbackEvidenceId ?? null,
          settlementEvidenceId: dto.settlementEvidenceId ?? null,
          financePaymentRequestId: dto.financePaymentRequestId ?? null,
          financeCollectionOrderId: dto.financeCollectionOrderId ?? null,
          bankSmsTransactionId: dto.bankSmsTransactionId ?? null,
          financeReconciliationLinkId: dto.financeReconciliationLinkId ?? null,
          priority: trimToNull(dto.priority) ?? 'normal',
          evidenceFingerprint,
          payloadHash,
          fingerprint,
          sanitizedPayload,
          redactionVersion: trimToNull(dto.redactionVersion) ?? 'v1',
          assignedToRole: trimToNull(dto.assignedToRole),
          reviewSummaryRedacted: trimToNull(dto.reviewSummaryRedacted),
          reviewedAt: dto.reviewedAt ? new Date(dto.reviewedAt) : null,
          errorCode: trimToNull(dto.errorCode),
          errorReason: trimToNull(dto.errorReason),
          notes: trimToNull(dto.notes),
        }),
      );
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  async createSettlementEvidenceCandidate(
    dto: CreateSettlementEvidenceCandidateDto,
    manager?: EntityManager,
  ) {
    const run = async (executor: EntityManager) => {
      const repository = executor.getRepository(WechatPaySettlementEvidence);
      const source = trimToNull(dto.source) ?? 'internal_evidence_only';
      const provider = dto.provider ?? 'wechat_pay_v3_official_like_dummy';
      const status = dto.status ?? 'pending_bank_match';
      ensureNoConfirmedStatus(status);
      const sanitizedPayload = dto.sanitizedPayload ?? null;
      const payloadHash =
        trimToNull(dto.payloadHash) ??
        sha256({
          object: 'wechat_pay_settlement_evidence',
          provider,
          status,
          evidenceSource: dto.evidenceSource,
          sanitizedPayload,
        });
      const fingerprint =
        trimToNull(dto.fingerprint) ??
        sha256({
          object: 'wechat_pay_settlement_evidence',
          provider,
          transactionIdHash: dto.transactionIdHash,
          outTradeNoHash: dto.outTradeNoHash,
          paidAmount: dto.paidAmount,
          settlementAmountCandidate: dto.settlementAmountCandidate,
          feeAmountCandidate: dto.feeAmountCandidate,
          evidenceSource: dto.evidenceSource,
          payloadHash,
        });

      return repository.save(
        repository.create({
          source,
          provider,
          status,
          transactionIdHash: trimToNull(dto.transactionIdHash),
          outTradeNoHash: trimToNull(dto.outTradeNoHash),
          financePaymentRequestId: dto.financePaymentRequestId ?? null,
          financeCollectionOrderId: dto.financeCollectionOrderId ?? null,
          bankSmsTransactionId: dto.bankSmsTransactionId ?? null,
          paidAmount:
            dto.paidAmount === null || dto.paidAmount === undefined
              ? null
              : normalizeMoney(dto.paidAmount),
          settlementAmountCandidate:
            dto.settlementAmountCandidate === null ||
            dto.settlementAmountCandidate === undefined
              ? null
              : normalizeMoney(dto.settlementAmountCandidate),
          feeAmountCandidate:
            dto.feeAmountCandidate === null || dto.feeAmountCandidate === undefined
              ? null
              : normalizeMoney(dto.feeAmountCandidate),
          settlementCurrency: trimToNull(dto.settlementCurrency),
          transactionBillHash: trimToNull(dto.transactionBillHash),
          fundBillHash: trimToNull(dto.fundBillHash),
          bankArrivalFingerprintHash: trimToNull(dto.bankArrivalFingerprintHash),
          evidenceSource: dto.evidenceSource,
          payloadHash,
          fingerprint,
          sanitizedPayload,
          redactionVersion: trimToNull(dto.redactionVersion) ?? 'v1',
          receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : new Date(),
          errorCode: trimToNull(dto.errorCode),
          errorReason: trimToNull(dto.errorReason),
          notes: trimToNull(dto.notes),
        }),
      );
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  async createCollectionOrderDraft(
    dto: CreateCollectionOrderDraftDto,
    currentUser: CurrentUser,
    manager?: EntityManager,
  ) {
    const run = async (executor: EntityManager) => {
      const repository = executor.getRepository(FinanceCollectionOrder);
      const workOrderRepository = executor.getRepository(WorkOrder);
      const temporaryServiceOrderRepository = executor.getRepository(TemporaryServiceOrder);
      if (dto.paymentChannel === 'bank_transfer') {
        const workOrderId = dto.workOrderId;
        const positiveWorkOrderId = Number.isInteger(workOrderId) && Number(workOrderId) > 0;
        if (
          dto.sourceType !== 'work_order' ||
          dto.businessType !== 'maintenance' ||
          !positiveWorkOrderId ||
          trimToNull(dto.sourceId) !== String(workOrderId) ||
          dto.temporaryServiceOrderId
        ) {
          throw new BadRequestException(
            'bank_transfer 仅支持维修工单直接转账，且必须绑定正整数 workOrderId 且 sourceId 一致，不得绑定临时服务单',
          );
        }
      }
      if (dto.sourceType === 'work_order' && dto.workOrderId) {
        if (trimToNull(dto.sourceId) !== String(dto.workOrderId)) {
          throw new BadRequestException('work_order 收款单的 sourceId 必须等于 workOrderId');
        }
      }
      await this.lockWorkOrderMutex(executor, dto.workOrderId ?? null);
      const customerPhone = trimToNull(dto.customerPhone);
      const missingCustomerPhone = !customerPhone;
      const businessAmount = normalizeMoney(dto.businessAmount);

      if (Number(businessAmount) <= 0) {
        throw new BadRequestException('收款单业务金额必须大于 0');
      }
      if (dto.workOrderId) {
        const workOrder = await workOrderRepository.findOne({ where: { id: dto.workOrderId } });
        if (!workOrder) {
          throw new NotFoundException('关联工单不存在');
        }
        assertWorkOrderNotUnquoted(workOrder);
      }
      if (dto.temporaryServiceOrderId) {
        const temporaryServiceOrder = await temporaryServiceOrderRepository.findOne({
          where: { id: dto.temporaryServiceOrderId },
        });
        if (!temporaryServiceOrder) {
          throw new NotFoundException('关联临时服务单不存在');
        }
        if (temporaryServiceOrder.companyId !== dto.companyId) {
          throw new BadRequestException('临时服务单与收款单所属公司不一致');
        }
      }

      const collectionNo = await this.sequenceService.generateBizNo(
        BIZ_SEQUENCE_CONFIG.FINANCE_COLLECTION_ORDER.bizType,
        BIZ_SEQUENCE_CONFIG.FINANCE_COLLECTION_ORDER.prefix,
        executor,
      );
      const item = repository.create({
        collectionNo,
        companyId: dto.companyId,
        sourceType: dto.sourceType,
        sourceId: trimToNull(dto.sourceId),
        businessType: dto.businessType,
        businessAmount,
        receiptAmount: null,
        bankReceivedAmount: null,
        channelFeeAmount: null,
        paymentChannel: dto.paymentChannel ?? null,
        channelTradeNo: trimToNull(dto.channelTradeNo),
        paymentReceiptId: null,
        settlementBatchId: null,
        bankTransactionId: null,
        reconciliationLinkId: null,
        workOrderId: dto.workOrderId ?? null,
        temporaryServiceOrderId: dto.temporaryServiceOrderId ?? null,
        customerId: trimToNull(dto.customerId),
        customerPhone,
        customerName: trimToNull(dto.customerName),
        temporaryCustomerFlag: dto.temporaryCustomerFlag ?? missingCustomerPhone,
        missingCustomerPhoneFlag: missingCustomerPhone,
        responsibleEmployeeId: dto.responsibleEmployeeId ?? null,
        sourceEmployeeId: dto.sourceEmployeeId ?? null,
        evidenceStatus: missingCustomerPhone
          ? 'missing_customer_phone'
          : 'missing_payment_receipt',
        reconcileStatus: 'pending',
        status: 'payment_pending',
        createdBy: currentUser.id,
        confirmedBy: null,
        confirmedAt: null,
        evidencePayload: dto.evidencePayload ?? null,
        remark: trimToNull(dto.remark),
      });

      return repository.save(item);
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  async prepareTemporaryServicePaymentInitiationDraft(
    dto: PrepareTemporaryServicePaymentInitiationDraftDto,
    currentUser: CurrentUser,
    manager?: EntityManager,
  ) {
    const run = async (executor: EntityManager) => {
      const temporaryServiceOrder = await this.createTemporaryServiceOrderDraftInFinanceBoundary(
        dto.temporaryService,
        currentUser,
        executor,
      );
      const collectionDraft = dto.collection ?? {};
      const collectionOrder = await this.createCollectionOrderDraft(
        {
          companyId: collectionDraft.companyId ?? dto.temporaryService.companyId,
          sourceType: 'temporary_service',
          sourceId: String(temporaryServiceOrder.id),
          businessType:
            collectionDraft.businessType ??
            this.resolveBusinessTypeFromTemporaryService(dto.temporaryService.serviceType),
          businessAmount: collectionDraft.businessAmount ?? dto.temporaryService.serviceAmount,
          paymentChannel: collectionDraft.paymentChannel ?? 'enterprise_wechat',
          channelTradeNo: collectionDraft.channelTradeNo,
          temporaryServiceOrderId: temporaryServiceOrder.id,
          customerId: collectionDraft.customerId ?? dto.temporaryService.customerId,
          customerPhone: collectionDraft.customerPhone ?? dto.temporaryService.customerPhone,
          customerName: collectionDraft.customerName ?? dto.temporaryService.customerName,
          temporaryCustomerFlag:
            collectionDraft.temporaryCustomerFlag ?? dto.temporaryService.temporaryCustomerFlag,
          responsibleEmployeeId:
            collectionDraft.responsibleEmployeeId ?? dto.temporaryService.responsibleEmployeeId,
          sourceEmployeeId: collectionDraft.sourceEmployeeId,
          evidencePayload: mergeEvidencePayload(collectionDraft.evidencePayload, {
            paymentInitiationBoundary: {
              source: 'temporary_service',
              temporaryServiceOrderId: temporaryServiceOrder.id,
              mode: 'mock_payment_request',
            },
          }) ?? undefined,
          remark: collectionDraft.remark ?? dto.temporaryService.remark,
        },
        currentUser,
        executor,
      );
      const linkedCollectionOrder = await this.linkTemporaryServiceToCollectionOrder(
        collectionOrder.id,
        temporaryServiceOrder.id,
        currentUser,
        executor,
      );
      const collectionOrderWithPaymentRequest = await this.attachMockPaymentRequestEvidence(
        linkedCollectionOrder.id,
        {
          amount: linkedCollectionOrder.businessAmount,
          payerPhone: linkedCollectionOrder.customerPhone,
          createdByEmployeeId:
            linkedCollectionOrder.sourceEmployeeId ??
            linkedCollectionOrder.responsibleEmployeeId ??
            currentUser.id,
          ...dto.paymentRequest,
        },
        executor,
      );

      return {
        temporaryServiceOrder,
        collectionOrder: collectionOrderWithPaymentRequest.collectionOrder,
        paymentRequest: collectionOrderWithPaymentRequest.paymentRequest,
      };
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  async prepareWorkOrderPaymentInitiationDraft(
    dto: PrepareWorkOrderPaymentInitiationDraftDto,
    currentUser: CurrentUser,
    manager?: EntityManager,
  ) {
    const run = async (executor: EntityManager) => {
      const workOrderRepository = executor.getRepository(WorkOrder);
      const workOrder = await workOrderRepository.findOne({ where: { id: dto.workOrderId } });
      if (!workOrder) {
        throw new NotFoundException('Work order does not exist.');
      }

      const collectionOrder = await this.createCollectionOrderDraft(
        {
          companyId: dto.companyId,
          sourceType: 'work_order',
          sourceId: String(workOrder.id),
          businessType: dto.businessType ?? 'maintenance',
          businessAmount: dto.businessAmount ?? workOrder.amountDue,
          paymentChannel: dto.paymentChannel ?? 'enterprise_wechat',
          workOrderId: workOrder.id,
          customerId: dto.customerId,
          customerPhone: dto.customerPhone ?? workOrder.customerMobile ?? undefined,
          customerName: dto.customerName ?? workOrder.customerName,
          temporaryCustomerFlag: dto.temporaryCustomerFlag,
          responsibleEmployeeId: dto.responsibleEmployeeId ?? workOrder.responsibleUserId ?? undefined,
          sourceEmployeeId: dto.sourceEmployeeId,
          evidencePayload: mergeEvidencePayload(dto.evidencePayload, {
            paymentInitiationBoundary: {
              source: 'work_order',
              workOrderId: workOrder.id,
              mode: 'mock_payment_request',
            },
          }) ?? undefined,
          remark: dto.remark ?? workOrder.remark ?? undefined,
        },
        currentUser,
        executor,
      );
      const collectionOrderWithPaymentRequest = await this.attachMockPaymentRequestEvidence(
        collectionOrder.id,
        {
          amount: collectionOrder.businessAmount,
          payerPhone: collectionOrder.customerPhone,
          createdByEmployeeId:
            collectionOrder.sourceEmployeeId ??
            collectionOrder.responsibleEmployeeId ??
            currentUser.id,
          ...dto.paymentRequest,
        },
        executor,
      );

      return {
        workOrder,
        collectionOrder: collectionOrderWithPaymentRequest.collectionOrder,
        paymentRequest: collectionOrderWithPaymentRequest.paymentRequest,
      };
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  async createPaymentRequestDraft(
    dto: CreatePaymentRequestDraftDto,
    currentUser: CurrentUser,
    manager?: EntityManager,
  ) {
    const run = async (executor: EntityManager) => {
      const paymentRequestRepository = executor.getRepository(FinancePaymentRequest);
      const collectionRepository = executor.getRepository(FinanceCollectionOrder);
      const collectionOrder = await this.findCollectionOrderOrThrow(
        dto.collectionOrderId,
        collectionRepository,
      );
      const amount = normalizeMoney(dto.amount ?? collectionOrder.businessAmount);

      if (Number(amount) <= 0) {
        throw new BadRequestException('Payment request amount must be greater than 0.');
      }
      if (amount !== normalizeMoney(collectionOrder.businessAmount)) {
        throw new BadRequestException(
          'Payment request amount must match collection order business amount.',
        );
      }

      const paymentRequestNo =
        trimToNull(dto.paymentRequestNo) ??
        (await this.sequenceService.generateBizNo(
          BIZ_SEQUENCE_CONFIG.FINANCE_PAYMENT_REQUEST.bizType,
          BIZ_SEQUENCE_CONFIG.FINANCE_PAYMENT_REQUEST.prefix,
          executor,
        ));
      const idempotencyKey =
        trimToNull(dto.idempotencyKey) ??
        `${collectionOrder.collectionNo}:${paymentRequestNo}:${amount}`;
      const existing = await paymentRequestRepository.findOne({
        where: [{ paymentRequestNo }, { idempotencyKey }],
      });

      if (existing) {
        if (
          existing.collectionOrderId !== collectionOrder.id ||
          normalizeMoney(existing.amount) !== amount
        ) {
          throw new BadRequestException('Payment request idempotency conflict.');
        }

        return existing;
      }

      const item = paymentRequestRepository.create({
        paymentRequestNo,
        collectionOrderId: collectionOrder.id,
        companyId: collectionOrder.companyId,
        provider: dto.provider ?? 'enterprise_wechat_mock',
        paymentChannel:
          dto.paymentChannel ??
          (collectionOrder.paymentChannel as FinancePaymentRequestChannel | null) ??
          'enterprise_wechat',
        amount,
        payerPhone: trimToNull(dto.payerPhone) ?? collectionOrder.customerPhone ?? null,
        payerCustomerId: trimToNull(dto.payerCustomerId) ?? collectionOrder.customerId ?? null,
        createdByEmployeeId:
          dto.createdByEmployeeId ??
          collectionOrder.sourceEmployeeId ??
          collectionOrder.responsibleEmployeeId ??
          currentUser.id,
        requestStatus: dto.requestStatus ?? 'created',
        qrUrl: null,
        paymentUrl: null,
        channelAppId: null,
        channelMchId: null,
        channelTradeNo: null,
        channelPrepayId: null,
        expireAt: dto.expireAt ? new Date(dto.expireAt) : null,
        paidAt: null,
        failedAt: null,
        cancelledAt: null,
        refundedAt: null,
        idempotencyKey,
        requestPayload: dto.requestPayload ?? null,
        responsePayload: null,
        callbackPayload: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      });

      return paymentRequestRepository.save(item);
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  async markPaymentRequestQrGeneratedMock(
    dto: MarkPaymentRequestQrGeneratedMockDto,
    manager?: EntityManager,
  ) {
    const run = async (executor: EntityManager) => {
      const paymentRequestRepository = executor.getRepository(FinancePaymentRequest);
      const paymentRequest = await this.findPaymentRequestOrThrow(dto, paymentRequestRepository);
      const qrUrl =
        trimToNull(dto.qrUrl) ??
        `mock://enterprise-wechat/payment-requests/${paymentRequest.paymentRequestNo}/qr`;
      const paymentUrl =
        trimToNull(dto.paymentUrl) ??
        `mock://enterprise-wechat/payment-requests/${paymentRequest.paymentRequestNo}`;

      paymentRequest.qrUrl = qrUrl;
      paymentRequest.paymentUrl = paymentUrl;
      paymentRequest.channelAppId = trimToNull(dto.channelAppId) ?? paymentRequest.channelAppId;
      paymentRequest.channelMchId = trimToNull(dto.channelMchId) ?? paymentRequest.channelMchId;
      paymentRequest.channelPrepayId =
        trimToNull(dto.channelPrepayId) ?? paymentRequest.channelPrepayId;
      paymentRequest.requestStatus = dto.requestStatus ?? 'waiting_payment';
      paymentRequest.responsePayload = mergeEvidencePayload(paymentRequest.responsePayload, {
        mockQrGenerated: {
          qrUrl,
          paymentUrl,
          channelPrepayId: paymentRequest.channelPrepayId,
          generatedAt: new Date().toISOString(),
        },
        ...(dto.responsePayload ?? {}),
      });
      paymentRequest.lastErrorCode = null;
      paymentRequest.lastErrorMessage = null;

      return paymentRequestRepository.save(paymentRequest);
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  async createPaymentRequestViaAdapterMock(
    dto: CreatePaymentRequestViaAdapterMockDto,
    manager?: EntityManager,
  ) {
    const run = async (executor: EntityManager) => {
      const paymentRequestRepository = executor.getRepository(FinancePaymentRequest);
      const collectionRepository = executor.getRepository(FinanceCollectionOrder);
      const paymentRequest = await this.findPaymentRequestOrThrow(dto, paymentRequestRepository);
      const collectionOrder = await this.findCollectionOrderOrThrow(
        paymentRequest.collectionOrderId,
        collectionRepository,
      );
      const response = await this.enterpriseWechatMockPaymentAdapter.createPaymentRequest({
        paymentRequest,
        collectionOrder,
        providerRequestId: dto.providerRequestId,
        requestPayload: dto.requestPayload,
      });

      paymentRequest.qrUrl = response.qrUrl;
      paymentRequest.paymentUrl = response.paymentUrl;
      paymentRequest.channelPrepayId = response.channelPrepayId ?? paymentRequest.channelPrepayId;
      paymentRequest.requestStatus = dto.requestStatus ?? response.providerStatus;
      paymentRequest.responsePayload = mergeEvidencePayload(paymentRequest.responsePayload, {
        adapterCreatePaymentRequest: response.responsePayload,
      });
      paymentRequest.lastErrorCode = null;
      paymentRequest.lastErrorMessage = null;

      return paymentRequestRepository.save(paymentRequest);
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  async parseAndHandleMockEnterpriseWeChatCallback(
    dto: ParseAndHandleMockEnterpriseWeChatCallbackDto,
    currentUser: CurrentUser,
    manager?: EntityManager,
  ) {
    const run = async (executor: EntityManager) => {
      const paymentRequestRepository = executor.getRepository(FinancePaymentRequest);
      const parsedCallback = this.enterpriseWechatMockPaymentAdapter.parseCallback(
        dto.callbackPayload,
      );
      const callbackDto: MockPaymentCallbackDto = {
        paymentRequestNo: parsedCallback.paymentRequestNo ?? undefined,
        idempotencyKey: parsedCallback.idempotencyKey ?? undefined,
        channelTradeNo: parsedCallback.channelTradeNo ?? undefined,
        channelPrepayId: parsedCallback.channelPrepayId ?? undefined,
        amount: parsedCallback.amount,
        paidAt: parsedCallback.paidAt ?? undefined,
        payerPhone: parsedCallback.payerPhone ?? undefined,
        callbackPayload: parsedCallback.callbackPayload,
      };
      const paymentRequest = await this.findPaymentRequestForCallback(
        callbackDto,
        paymentRequestRepository,
      );
      const signatureValid = this.enterpriseWechatMockPaymentAdapter.verifyCallbackSignature({
        payload: dto.callbackPayload,
        signature: dto.signature,
        headers: dto.headers,
      });

      if (!signatureValid) {
        if (paymentRequest) {
          paymentRequest.requestStatus = 'failed';
          paymentRequest.failedAt = new Date();
          paymentRequest.lastErrorCode = 'invalid_signature';
          paymentRequest.lastErrorMessage = 'Mock Enterprise WeChat callback signature is invalid.';
          paymentRequest.callbackPayload = mergeEvidencePayload(paymentRequest.callbackPayload, {
            adapterCallback: parsedCallback.callbackPayload,
            outcome: 'rejected_invalid_signature',
          });
          await paymentRequestRepository.save(paymentRequest);
        }

        return {
          outcome: 'rejected_invalid_signature' as const,
          handled: false,
          signatureValid,
          paymentRequest: paymentRequest ?? null,
          parsedCallback,
        };
      }

      if (paymentRequest?.requestStatus === 'expired') {
        paymentRequest.lastErrorCode = 'paid_after_expired';
        paymentRequest.lastErrorMessage =
          'Mock Enterprise WeChat paid callback arrived after payment request expired.';
        paymentRequest.callbackPayload = mergeEvidencePayload(paymentRequest.callbackPayload, {
          adapterCallback: parsedCallback.callbackPayload,
          outcome: 'paid_after_expired',
        });
        const savedPaymentRequest = await paymentRequestRepository.save(paymentRequest);

        return {
          outcome: 'paid_after_expired' as const,
          handled: false,
          signatureValid,
          paymentRequest: savedPaymentRequest,
          parsedCallback,
        };
      }

      if (paymentRequest?.requestStatus === 'cancelled') {
        paymentRequest.lastErrorCode = 'paid_after_cancelled';
        paymentRequest.lastErrorMessage =
          'Mock Enterprise WeChat paid callback arrived after payment request was cancelled.';
        paymentRequest.callbackPayload = mergeEvidencePayload(paymentRequest.callbackPayload, {
          adapterCallback: parsedCallback.callbackPayload,
          outcome: 'paid_after_cancelled',
        });
        const savedPaymentRequest = await paymentRequestRepository.save(paymentRequest);

        return {
          outcome: 'paid_after_cancelled' as const,
          handled: false,
          signatureValid,
          paymentRequest: savedPaymentRequest,
          parsedCallback,
        };
      }

      const result = await this.handleMockPaymentCallbackIdempotently(
        callbackDto,
        currentUser,
        executor,
      );

      return {
        ...result,
        signatureValid,
        parsedCallback,
      };
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  async handlePaymentCallbackDryRunReceiver(
    dto: PaymentCallbackDryRunReceiverDto,
    currentUser: CurrentUser,
    options: PaymentCallbackDryRunReceiverOptions = {},
  ): Promise<PaymentCallbackDryRunReceiverResult> {
    const requestId = trimToNull(dto.requestId) ?? `dry_run_${Date.now()}`;
    const provider = trimToNull(dto.provider);
    const dryRun = dto.dryRun === true;
    const warnings: string[] = [];
    const config = this.readPaymentCallbackDryRunConfig();

    const result = (
      outcome: string,
      accepted: boolean,
      fields: Partial<PaymentCallbackDryRunReceiverResult> = {},
    ): PaymentCallbackDryRunReceiverResult => ({
      requestId,
      provider,
      dryRun,
      accepted,
      outcome,
      paymentRequestNo: fields.paymentRequestNo ?? null,
      collectionOrderId: fields.collectionOrderId ?? null,
      beforeStatus: fields.beforeStatus ?? null,
      afterStatus: fields.afterStatus ?? null,
      collectionOrderBeforeStatus: fields.collectionOrderBeforeStatus ?? null,
      collectionOrderAfterStatus: fields.collectionOrderAfterStatus ?? null,
      idempotencyResult: fields.idempotencyResult ?? 'not_processed',
      warnings: [...warnings, ...(fields.warnings ?? [])],
      errors: fields.errors ?? [],
      auditRef: fields.auditRef ?? 'dry_run_response_only',
      noRevenueConfirmed: true,
      noWorkOrderChanged: true,
      noBankSmsChanged: true,
    });

    if (!config.dryRunEnabled) {
      return result('feature_flag_disabled', false, {
        errors: ['PAYMENT_CALLBACK_DRY_RUN_ENABLED is not true.'],
      });
    }

    const headers = this.mergeCallbackHeaders(options.headers, dto.headers);
    const internalToken = this.extractInternalCallbackToken(headers);
    if (!config.internalCallbackTestToken) {
      return result('missing_internal_token_configuration', false, {
        errors: ['INTERNAL_CALLBACK_TEST_TOKEN is not configured.'],
      });
    }
    if (!internalToken) {
      return result('missing_internal_token', false, {
        errors: ['Internal callback token is required.'],
      });
    }
    if (internalToken !== config.internalCallbackTestToken) {
      return result('invalid_token', false, {
        errors: ['Internal callback token is invalid.'],
      });
    }

    if (!provider) {
      return result('unknown_provider', false, { errors: ['Provider is required.'] });
    }
    if (config.rejectRealProvider && provider !== 'enterprise_wechat_mock') {
      return result('real_provider_rejected', false, {
        errors: ['Real payment providers are rejected by dry-run receiver.'],
      });
    }
    if (!config.allowedProviders.has(provider)) {
      return result('unknown_provider', false, {
        errors: ['Provider is not in PAYMENT_CALLBACK_ALLOWED_PROVIDERS.'],
      });
    }
    if (!dryRun) {
      return result('dry_run_required', false, { errors: ['dryRun=true is required.'] });
    }
    if (!config.enterpriseWechatMockMode) {
      return result('mock_mode_disabled', false, {
        errors: ['ENTERPRISE_WECHAT_MOCK_MODE must be true for dry-run receiver.'],
      });
    }
    if (!this.isPlainObject(dto.payload)) {
      return result('malformed_payload', false, { errors: ['Callback payload is required.'] });
    }

    const preliminaryCallback = this.buildReceiverCallbackLookup(dto.payload);
    if (!preliminaryCallback.paymentRequestNo && !preliminaryCallback.channelTradeNo && !preliminaryCallback.idempotencyKey) {
      return result('malformed_payload', false, {
        errors: ['payload.paymentRequestNo, payload.channelTradeNo, or payload.idempotencyKey is required.'],
      });
    }
    if (!Number.isFinite(Number(preliminaryCallback.amount))) {
      return result('malformed_payload', false, {
        paymentRequestNo: preliminaryCallback.paymentRequestNo ?? null,
        errors: ['payload.amount must be a valid amount.'],
      });
    }

    const paymentRequestBefore = await this.findPaymentRequestForCallback(
      preliminaryCallback,
      this.financePaymentRequestRepository,
    );
    const collectionOrderBefore = paymentRequestBefore
      ? await this.financeCollectionOrderRepository.findOne({
          where: { id: paymentRequestBefore.collectionOrderId },
        })
      : null;

    const commonFields = {
      paymentRequestNo:
        preliminaryCallback.paymentRequestNo ?? paymentRequestBefore?.paymentRequestNo ?? null,
      collectionOrderId: collectionOrderBefore?.id ?? paymentRequestBefore?.collectionOrderId ?? null,
      beforeStatus: paymentRequestBefore?.requestStatus ?? null,
      collectionOrderBeforeStatus: collectionOrderBefore?.status ?? null,
    };

    const signatureValid = this.enterpriseWechatMockPaymentAdapter.verifyCallbackSignature({
      payload: dto.payload,
      signature: dto.signature,
      headers,
    });

    if (!signatureValid) {
      await this.parseAndHandleMockEnterpriseWeChatCallback(
        {
          callbackPayload: dto.payload,
          signature: dto.signature,
          headers,
        },
        currentUser,
      );
      const paymentRequestAfter = paymentRequestBefore
        ? await this.financePaymentRequestRepository.findOne({ where: { id: paymentRequestBefore.id } })
        : null;
      const collectionOrderAfter = collectionOrderBefore
        ? await this.financeCollectionOrderRepository.findOne({ where: { id: collectionOrderBefore.id } })
        : null;

      return result('rejected_invalid_signature', false, {
        ...commonFields,
        afterStatus: paymentRequestAfter?.requestStatus ?? null,
        collectionOrderAfterStatus: collectionOrderAfter?.status ?? null,
        idempotencyResult: 'rejected',
        errors: ['Callback signature is invalid.'],
        auditRef: paymentRequestAfter ? 'finance_payment_request.callback_payload' : 'dry_run_response_only',
        warnings: paymentRequestAfter ? [] : ['No payment request was found for invalid callback.'],
      });
    }

    let parsedCallback: ReturnType<EnterpriseWechatMockPaymentAdapter['parseCallback']>;
    try {
      parsedCallback = this.enterpriseWechatMockPaymentAdapter.parseCallback(dto.payload);
    } catch (error) {
      return result('malformed_payload', false, {
        ...commonFields,
        errors: [error instanceof Error ? error.message : 'Callback payload is malformed.'],
      });
    }

    const callbackDto: MockPaymentCallbackDto = {
      paymentRequestNo: parsedCallback.paymentRequestNo ?? undefined,
      idempotencyKey: parsedCallback.idempotencyKey ?? undefined,
      channelTradeNo: parsedCallback.channelTradeNo ?? undefined,
      channelPrepayId: parsedCallback.channelPrepayId ?? undefined,
      amount: parsedCallback.amount,
      paidAt: parsedCallback.paidAt ?? undefined,
      payerPhone: parsedCallback.payerPhone ?? undefined,
      callbackPayload: parsedCallback.callbackPayload,
    };
    const paymentRequest = await this.findPaymentRequestForCallback(
      callbackDto,
      this.financePaymentRequestRepository,
    );
    if (!paymentRequest) {
      return result('missing_payment_request', false, {
        paymentRequestNo: parsedCallback.paymentRequestNo ?? null,
        errors: ['Payment request was not found.'],
        auditRef: 'dry_run_response_only',
      });
    }

    const collectionOrder = await this.financeCollectionOrderRepository.findOne({
      where: { id: paymentRequest.collectionOrderId },
    });
    if (collectionOrder && this.isCollectionOrderConfirmed(collectionOrder)) {
      return result('collection_order_already_confirmed', false, {
        paymentRequestNo: paymentRequest.paymentRequestNo,
        collectionOrderId: collectionOrder.id,
        beforeStatus: paymentRequest.requestStatus,
        afterStatus: paymentRequest.requestStatus,
        collectionOrderBeforeStatus: collectionOrder.status,
        collectionOrderAfterStatus: collectionOrder.status,
        errors: ['Collection order is already confirmed/completed and cannot be changed by callback.'],
      });
    }

    const handled = await this.parseAndHandleMockEnterpriseWeChatCallback(
      {
        callbackPayload: dto.payload,
        signature: dto.signature,
        headers,
      },
      currentUser,
    );
    const paymentRequestAfter = await this.financePaymentRequestRepository.findOne({
      where: { id: paymentRequest.id },
    });
    const collectionOrderAfter = collectionOrder
      ? await this.financeCollectionOrderRepository.findOne({ where: { id: collectionOrder.id } })
      : null;
    const outcome = String(handled.outcome);
    const accepted = ['paid_by_channel', 'duplicate_paid_callback'].includes(outcome);

    return result(outcome, accepted, {
      paymentRequestNo: paymentRequest.paymentRequestNo,
      collectionOrderId: collectionOrder?.id ?? paymentRequest.collectionOrderId,
      beforeStatus: paymentRequest.requestStatus,
      afterStatus: paymentRequestAfter?.requestStatus ?? null,
      collectionOrderBeforeStatus: collectionOrder?.status ?? null,
      collectionOrderAfterStatus: collectionOrderAfter?.status ?? null,
      idempotencyResult: this.resolveDryRunIdempotencyResult(outcome),
      warnings: accepted ? [] : ['Callback was retained as an exception/anomaly candidate.'],
      errors: accepted ? [] : [outcome],
      auditRef: 'finance_payment_request.callback_payload',
    });
  }

  async recordAdapterAuditTrail(dto: RecordAdapterAuditTrailDto, manager?: EntityManager) {
    const run = async (executor: EntityManager) => {
      const paymentRequestRepository = executor.getRepository(FinancePaymentRequest);
      const paymentRequest = await this.findPaymentRequestOrThrow(dto, paymentRequestRepository);

      paymentRequest.requestPayload = mergeEvidencePayload(
        paymentRequest.requestPayload,
        dto.requestPayload,
      );
      paymentRequest.responsePayload = mergeEvidencePayload(
        paymentRequest.responsePayload,
        dto.responsePayload,
      );
      paymentRequest.callbackPayload = mergeEvidencePayload(
        paymentRequest.callbackPayload,
        dto.callbackPayload,
      );
      if (dto.lastErrorCode !== undefined) {
        paymentRequest.lastErrorCode = dto.lastErrorCode;
      }
      if (dto.lastErrorMessage !== undefined) {
        paymentRequest.lastErrorMessage = dto.lastErrorMessage;
      }

      return paymentRequestRepository.save(paymentRequest);
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  async handleMockPaymentCallbackIdempotently(
    dto: MockPaymentCallbackDto,
    currentUser: CurrentUser,
    manager?: EntityManager,
  ) {
    void currentUser;
    const run = async (executor: EntityManager) => {
      const paymentRequestRepository = executor.getRepository(FinancePaymentRequest);
      const collectionRepository = executor.getRepository(FinanceCollectionOrder);
      const paymentRequest = await this.findPaymentRequestForCallback(
        dto,
        paymentRequestRepository,
      );
      const callbackPayload = this.buildMockCallbackPayload(dto);

      if (!paymentRequest) {
        return {
          outcome: 'missing_payment_request' as const,
          handled: false,
          callbackPayload,
        };
      }

      const collectionOrder = await this.lockCollectionForMutation(
        executor,
        paymentRequest.collectionOrderId,
      );

      const callbackAmount = normalizeMoney(dto.amount);
      if (callbackAmount !== normalizeMoney(paymentRequest.amount)) {
        paymentRequest.requestStatus = 'failed';
        paymentRequest.failedAt = new Date();
        paymentRequest.lastErrorCode = 'amount_mismatch';
        paymentRequest.lastErrorMessage = `Callback amount ${callbackAmount} does not match payment request amount ${paymentRequest.amount}.`;
        paymentRequest.callbackPayload = mergeEvidencePayload(paymentRequest.callbackPayload, {
          lastMockCallback: callbackPayload,
          outcome: 'amount_mismatch',
        });
        await paymentRequestRepository.save(paymentRequest);

        return {
          outcome: 'amount_mismatch' as const,
          handled: false,
          paymentRequest,
          collectionOrder,
        };
      }

      const channelTradeNo = trimToNull(dto.channelTradeNo) ?? paymentRequest.channelTradeNo;
      const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
      const isDuplicatePaidCallback =
        paymentRequest.requestStatus === 'paid_by_channel' &&
        normalizeMoney(paymentRequest.amount) === callbackAmount &&
        (!channelTradeNo || paymentRequest.channelTradeNo === channelTradeNo);

      paymentRequest.callbackPayload = mergeEvidencePayload(paymentRequest.callbackPayload, {
        lastMockCallback: callbackPayload,
        duplicatePaidCallback: isDuplicatePaidCallback,
      });

      if (isDuplicatePaidCallback) {
        const savedPaymentRequest = await paymentRequestRepository.save(paymentRequest);
        return {
          outcome: 'duplicate_paid_callback' as const,
          handled: true,
          paymentRequest: savedPaymentRequest,
          collectionOrder,
        };
      }

      paymentRequest.requestStatus = 'paid_by_channel';
      paymentRequest.paidAt = paidAt;
      paymentRequest.channelTradeNo = channelTradeNo;
      paymentRequest.channelPrepayId =
        trimToNull(dto.channelPrepayId) ?? paymentRequest.channelPrepayId;
      paymentRequest.lastErrorCode = null;
      paymentRequest.lastErrorMessage = null;
      const savedPaymentRequest = await paymentRequestRepository.save(paymentRequest);

      collectionOrder.receiptAmount = callbackAmount;
      collectionOrder.paymentChannel = collectionOrder.paymentChannel ?? paymentRequest.paymentChannel;
      collectionOrder.channelTradeNo = channelTradeNo ?? collectionOrder.channelTradeNo;
      collectionOrder.status = collectionOrder.bankTransactionId
        ? 'bank_matched'
        : 'paid_by_channel';
      collectionOrder.reconcileStatus = collectionOrder.bankTransactionId
        ? 'matched'
        : 'partially_matched';
      collectionOrder.evidenceStatus = collectionOrder.bankTransactionId
        ? 'matched_pending_confirmation'
        : 'receipt_only';
      collectionOrder.evidencePayload = mergeEvidencePayload(collectionOrder.evidencePayload, {
        paymentRequestCallback: {
          paymentRequestId: savedPaymentRequest.id,
          paymentRequestNo: savedPaymentRequest.paymentRequestNo,
          provider: savedPaymentRequest.provider,
          channelTradeNo,
          amount: callbackAmount,
          paidAt: paidAt.toISOString(),
          mode: 'mock_callback_evidence_only',
        },
      });
      const savedCollectionOrder = await collectionRepository.save(collectionOrder);

      return {
        outcome: 'paid_by_channel' as const,
        handled: true,
        paymentRequest: savedPaymentRequest,
        collectionOrder: savedCollectionOrder,
      };
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  async handleMockPaymentCallbackMismatch(
    dto: MockPaymentCallbackDto,
    currentUser: CurrentUser,
    manager?: EntityManager,
  ) {
    return this.handleMockPaymentCallbackIdempotently(dto, currentUser, manager);
  }

  async linkTemporaryServiceToCollectionOrder(
    collectionOrderId: number,
    temporaryServiceOrderId: number,
    currentUser: CurrentUser,
    manager?: EntityManager,
  ) {
    void currentUser;
    const run = async (executor: EntityManager) => {
      const collectionRepository = executor.getRepository(FinanceCollectionOrder);
      const temporaryServiceOrderRepository = executor.getRepository(TemporaryServiceOrder);
      const collectionOrder = await this.lockCollectionForMutation(executor, collectionOrderId);
      const temporaryServiceOrder = await temporaryServiceOrderRepository.findOne({
        where: { id: temporaryServiceOrderId },
      });

      if (!temporaryServiceOrder) {
        throw new NotFoundException('临时服务单不存在');
      }
      if (collectionOrder.companyId !== temporaryServiceOrder.companyId) {
        throw new BadRequestException('统一收款单与临时服务单所属公司不一致');
      }
      if (
        collectionOrder.temporaryServiceOrderId &&
        collectionOrder.temporaryServiceOrderId !== temporaryServiceOrder.id
      ) {
        throw new BadRequestException('统一收款单已绑定其他临时服务单');
      }
      if (
        temporaryServiceOrder.collectionOrderId &&
        temporaryServiceOrder.collectionOrderId !== collectionOrder.id
      ) {
        throw new BadRequestException('临时服务单已绑定其他统一收款单');
      }

      collectionOrder.sourceType = 'temporary_service';
      collectionOrder.sourceId = String(temporaryServiceOrder.id);
      collectionOrder.temporaryServiceOrderId = temporaryServiceOrder.id;
      if (!collectionOrder.customerPhone && temporaryServiceOrder.customerPhone) {
        collectionOrder.customerPhone = temporaryServiceOrder.customerPhone;
        collectionOrder.missingCustomerPhoneFlag = false;
      }
      if (!collectionOrder.customerName && temporaryServiceOrder.customerName) {
        collectionOrder.customerName = temporaryServiceOrder.customerName;
      }
      if (!collectionOrder.customerId && temporaryServiceOrder.customerId) {
        collectionOrder.customerId = temporaryServiceOrder.customerId;
      }
      collectionOrder.evidenceStatus = this.resolveCollectionEvidenceStatus(collectionOrder);
      temporaryServiceOrder.collectionOrderId = collectionOrder.id;

      const [savedCollectionOrder] = await Promise.all([
        collectionRepository.save(collectionOrder),
        temporaryServiceOrderRepository.save(temporaryServiceOrder),
      ]);

      return savedCollectionOrder;
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  async attachPaymentReceiptEvidence(
    dto: AttachCollectionPaymentReceiptEvidenceDto,
    currentUser: CurrentUser,
    manager?: EntityManager,
  ) {
    void currentUser;
    const run = async (executor: EntityManager) => {
      const collectionRepository = executor.getRepository(FinanceCollectionOrder);
      const receiptRepository = executor.getRepository(WechatPaymentReceipt);
      const settlementBatchRepository = executor.getRepository(WechatSettlementBatch);
      const collectionOrder = await this.lockCollectionForMutation(executor, dto.collectionOrderId);
      const receipt = await receiptRepository.findOne({ where: { id: dto.paymentReceiptId } });

      if (!receipt) {
        throw new NotFoundException('支付回执不存在');
      }
      if (receipt.companyId !== collectionOrder.companyId) {
        throw new BadRequestException('支付回执与统一收款单所属公司不一致');
      }
      if (dto.settlementBatchId) {
        const settlementBatch = await settlementBatchRepository.findOne({
          where: { id: dto.settlementBatchId },
        });
        if (!settlementBatch) {
          throw new NotFoundException('微信结算批次不存在');
        }
        if (settlementBatch.companyId !== collectionOrder.companyId) {
          throw new BadRequestException('微信结算批次与统一收款单所属公司不一致');
        }
      }

      collectionOrder.paymentReceiptId = receipt.id;
      collectionOrder.settlementBatchId = dto.settlementBatchId ?? collectionOrder.settlementBatchId;
      collectionOrder.receiptAmount = normalizeMoney(dto.receiptAmount ?? receipt.amountPaid);
      collectionOrder.paymentChannel = dto.paymentChannel ?? collectionOrder.paymentChannel ?? 'wechat';
      collectionOrder.channelTradeNo =
        trimToNull(dto.channelTradeNo) ?? receipt.transactionId ?? collectionOrder.channelTradeNo;
      collectionOrder.status = collectionOrder.bankTransactionId ? 'bank_matched' : 'paid_by_channel';
      collectionOrder.reconcileStatus = collectionOrder.bankTransactionId
        ? 'matched'
        : 'partially_matched';
      collectionOrder.evidencePayload = mergeEvidencePayload(
        collectionOrder.evidencePayload,
        dto.evidencePayload,
      );
      collectionOrder.remark = trimToNull(dto.remark) ?? collectionOrder.remark;
      collectionOrder.evidenceStatus = this.resolveCollectionEvidenceStatus(collectionOrder);

      return collectionRepository.save(collectionOrder);
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  async attachBankTransactionEvidence(
    dto: AttachCollectionBankTransactionEvidenceDto,
    currentUser: CurrentUser,
    manager?: EntityManager,
  ) {
    void currentUser;
    const run = async (executor: EntityManager) => {
      const collectionRepository = executor.getRepository(FinanceCollectionOrder);
      const bankTransactionRepository = executor.getRepository(BankSmsTransaction);
      const reconciliationLinkRepository = executor.getRepository(FinanceReconciliationLink);
      const collectionOrder = await this.lockCollectionForMutation(
        executor,
        dto.collectionOrderId,
        dto.bankTransactionId,
        dto.reconciliationLinkId,
      );
      const transaction = await bankTransactionRepository.findOne({
        where: { id: dto.bankTransactionId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!transaction) {
        throw new NotFoundException('银行短信交易不存在');
      }
      if (transaction.companyId !== null && transaction.companyId !== collectionOrder.companyId) {
        throw new BadRequestException('银行短信交易与统一收款单所属公司不一致');
      }
      if (dto.reconciliationLinkId) {
        const reconciliationLink = await reconciliationLinkRepository.findOne({
          where: { id: dto.reconciliationLinkId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!reconciliationLink) {
          throw new NotFoundException('对账链接不存在');
        }
        if (reconciliationLink.bankSmsTransactionId !== transaction.id) {
          throw new BadRequestException('对账链接与银行短信交易不一致');
        }
      }

      const bankReceivedAmount = normalizeMoney(dto.bankReceivedAmount ?? transaction.amount);
      collectionOrder.bankTransactionId = transaction.id;
      collectionOrder.reconciliationLinkId =
        dto.reconciliationLinkId ?? collectionOrder.reconciliationLinkId;
      collectionOrder.bankReceivedAmount = bankReceivedAmount;
      collectionOrder.channelFeeAmount =
        dto.channelFeeAmount !== undefined
          ? normalizeMoney(dto.channelFeeAmount)
          : collectionOrder.channelFeeAmount ??
            calculateCandidateFee(collectionOrder.receiptAmount, bankReceivedAmount);
      collectionOrder.status = 'bank_matched';
      collectionOrder.reconcileStatus = collectionOrder.paymentReceiptId
        ? 'matched'
        : 'partially_matched';
      collectionOrder.evidencePayload = mergeEvidencePayload(
        collectionOrder.evidencePayload,
        dto.evidencePayload,
      );
      collectionOrder.remark = trimToNull(dto.remark) ?? collectionOrder.remark;
      collectionOrder.evidenceStatus = this.resolveCollectionEvidenceStatus(collectionOrder);

      return collectionRepository.save(collectionOrder);
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  async findAndAttachExistingBankSmsCollectionOrderBridge(
    input: FindAndAttachBankSmsCollectionOrderBridgeInput,
    currentUser: CurrentUser,
    manager?: EntityManager,
  ): Promise<BankSmsCollectionOrderBridgeResult> {
    const run = async (executor: EntityManager) => {
      const collectionRepository = executor.getRepository(FinanceCollectionOrder);
      const { transaction, reconciliationLink } = input;
      const candidates = await this.findBankSmsCollectionOrderBridgeCandidates(
        reconciliationLink,
        transaction,
        collectionRepository,
      );

      if (candidates.length === 0) {
        return this.buildBankSmsCollectionOrderBridgeResult(
          'blocked_no_collection_order',
          'No existing finance_collection_order candidate was found for the guarded link.',
          candidates,
        );
      }

      const relationCompatibleCandidates = candidates.filter((item) =>
        this.isBankSmsCollectionOrderBridgeRelationCompatible(item, reconciliationLink, transaction),
      );
      const targetCompatibleCandidates = relationCompatibleCandidates.filter((item) =>
        this.isBankSmsCollectionOrderBridgeTargetCompatible(item, reconciliationLink, transaction),
      );

      if (targetCompatibleCandidates.length === 0) {
        return this.buildBankSmsCollectionOrderBridgeResult(
          'blocked_target_mismatch',
          'Existing finance_collection_order candidates do not match the guarded reconciliation target.',
          candidates,
        );
      }

      if (targetCompatibleCandidates.length > 1) {
        return this.buildBankSmsCollectionOrderBridgeResult(
          'blocked_multiple_collection_orders',
          'More than one compatible finance_collection_order candidate exists; manual review is required.',
          targetCompatibleCandidates,
        );
      }

      const locatorCollectionOrder = targetCompatibleCandidates[0];
      const collectionOrder = await this.lockCollectionForMutation(
        executor,
        locatorCollectionOrder.id,
        transaction.id,
        reconciliationLink.id,
      );
      const lockedTransaction = await executor.getRepository(BankSmsTransaction).findOne({
        where: { id: transaction.id },
        lock: { mode: 'pessimistic_write' },
      });
      const lockedReconciliationLink = await executor
        .getRepository(FinanceReconciliationLink)
        .findOne({
          where: { id: reconciliationLink.id },
          lock: { mode: 'pessimistic_write' },
        });
      if (!lockedTransaction || !lockedReconciliationLink) {
        throw new ConflictException('[bank_sms_bridge_source_missing] 银行流水或对账链接已不存在');
      }
      if (
        lockedReconciliationLink.bankSmsTransactionId !== lockedTransaction.id ||
        lockedReconciliationLink.linkType !== reconciliationLink.linkType ||
        lockedReconciliationLink.linkId !== reconciliationLink.linkId
      ) {
        throw new ConflictException(
          '[bank_sms_bridge_source_drift] 对账链接在确认等待期间发生变化，请刷新后重试',
        );
      }

      // Re-run candidate selection as current locking reads after the target's
      // work-order/bank/link mutex is held. The locator snapshot above must not
      // hide a concurrent candidate insert or source reassignment.
      const lockedCandidates = await this.findBankSmsCollectionOrderBridgeCandidates(
        lockedReconciliationLink,
        lockedTransaction,
        collectionRepository,
        true,
      );
      const lockedCompatibleCandidates = lockedCandidates
        .filter((item) =>
          this.isBankSmsCollectionOrderBridgeRelationCompatible(
            item,
            lockedReconciliationLink,
            lockedTransaction,
          ),
        )
        .filter((item) =>
          this.isBankSmsCollectionOrderBridgeTargetCompatible(
            item,
            lockedReconciliationLink,
            lockedTransaction,
          ),
        );
      if (
        lockedCompatibleCandidates.length !== 1 ||
        lockedCompatibleCandidates[0].id !== collectionOrder.id
      ) {
        return this.buildBankSmsCollectionOrderBridgeResult(
          lockedCompatibleCandidates.length > 1
            ? 'blocked_multiple_collection_orders'
            : 'blocked_target_mismatch',
          'The current locked collection candidate set changed during confirm-apply; manual review is required.',
          lockedCompatibleCandidates,
        );
      }
      const lockedCollectionOrder = lockedCompatibleCandidates[0];
      if (
        !this.isBankSmsCollectionOrderBridgeAmountCompatible(
          lockedCollectionOrder,
          lockedTransaction,
        )
      ) {
        return this.buildBankSmsCollectionOrderBridgeResult(
          'blocked_amount_mismatch',
          'The compatible finance_collection_order amount does not match the guarded bank SMS amount.',
          lockedCompatibleCandidates,
          lockedCollectionOrder,
        );
      }

      if (
        this.isBankSmsCollectionOrderBridgeReadyForConfirmApply(
          lockedCollectionOrder,
          lockedTransaction,
        )
      ) {
        return this.buildBankSmsCollectionOrderBridgeResult(
          'already_ready',
          'The existing finance_collection_order bridge is already ready for guarded confirm-apply.',
          lockedCompatibleCandidates,
          lockedCollectionOrder,
          false,
          true,
        );
      }

      if (!this.isBankSmsCollectionOrderBridgeAttachable(lockedCollectionOrder)) {
        return this.buildBankSmsCollectionOrderBridgeResult(
          'blocked_unreviewed_or_incomplete',
          'The compatible finance_collection_order is cancelled, refunded, rejected, or otherwise not attachable.',
          lockedCompatibleCandidates,
          lockedCollectionOrder,
        );
      }

      const attachedCollectionOrder = await this.attachBankTransactionEvidence(
        {
          collectionOrderId: lockedCollectionOrder.id,
          bankTransactionId: lockedTransaction.id,
          reconciliationLinkId: lockedReconciliationLink.id,
          bankReceivedAmount: lockedTransaction.amount,
          evidencePayload: {
            source: 'bank_sms_confirm_apply_collection_bridge_helper',
            bankSmsTransactionId: lockedTransaction.id,
            reconciliationLinkId: lockedReconciliationLink.id,
            linkType: lockedReconciliationLink.linkType,
            linkId: lockedReconciliationLink.linkId,
          },
          remark: 'bank_sms_confirm_apply_collection_bridge_helper',
        },
        currentUser,
        executor,
      );
      const readyAfterAttach = this.isBankSmsCollectionOrderBridgeReadyForConfirmApply(
        attachedCollectionOrder,
        lockedTransaction,
      );

      if (readyAfterAttach) {
        return this.buildBankSmsCollectionOrderBridgeResult(
          'attached_ready',
          'The existing compatible finance_collection_order bridge was attached and is ready for guarded confirm-apply.',
          lockedCompatibleCandidates,
          attachedCollectionOrder,
          true,
          true,
        );
      }

      return this.buildBankSmsCollectionOrderBridgeResult(
        'blocked_unreviewed_or_incomplete',
        'The compatible finance_collection_order was attached to bank evidence but is not reviewed or complete enough for final confirmation.',
        lockedCompatibleCandidates,
        attachedCollectionOrder,
        true,
        false,
      );
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  async createReceivableTrackingEvidence(dto: CreateReceivableTrackingEvidenceDto) {
    const invoiceNo = trimToNull(dto.invoiceNo);
    const counterpartyName = dto.counterpartyName.trim();
    const normalizedCounterpartyName = normalizeBankSmsPartyName(counterpartyName);
    const sourceType = dto.sourceType as FinanceReceivableTrackingSourceType;
    const sourceId = trimToNull(dto.sourceId);
    const sourceRefNo = trimToNull(dto.sourceRefNo);
    const evidenceNote = trimToNull(dto.evidenceNote) ?? trimToNull(dto.remark);

    if (!normalizedCounterpartyName) {
      throw new BadRequestException('对方单位不能为空');
    }
    if (sourceType === 'manual_invoice' && !invoiceNo) {
      throw new BadRequestException('存在正式发票时必须填写发票号');
    }
    if (!invoiceNo && !dto.evidenceStatus) {
      throw new BadRequestException('未开票的应收证据必须明确 evidence_status');
    }

    const currentStatus = dto.currentStatus ?? (invoiceNo ? 'invoice_issued' : 'receivable_open');
    if (currentStatus === 'invoice_issued' && !invoiceNo) {
      throw new BadRequestException('invoice_issued 状态必须提供正式发票号');
    }

    const evidenceStatus = (invoiceNo ? dto.evidenceStatus ?? 'supported' : dto.evidenceStatus)!;
    const invoiceAmount = normalizeMoney(dto.invoiceAmount);
    if (Number(invoiceAmount) <= 0) {
      throw new BadRequestException('开票/应收金额必须大于 0');
    }

    const item = this.financeReceivableTrackingRepository.create({
      companyId: dto.companyId,
      sourceType,
      sourceId,
      sourceRefNo: sourceRefNo ?? invoiceNo,
      workOrderId: null,
      invoiceNo,
      counterpartyName,
      normalizedCounterpartyName,
      invoiceAmount,
      receivedAmount: '0.00',
      outstandingAmount: invoiceAmount,
      currentStatus,
      evidenceStatus,
      invoiceIssuedAt: dto.invoiceIssuedAt,
      dueDate: dto.dueDate ?? null,
      lastBankSmsTransactionId: null,
      lastReceiptAt: null,
      evidenceNote,
    });

    return this.serializeReceivableTracking(
      await this.financeReceivableTrackingRepository.save(item),
    );
  }

  async findReceivableTrackingCandidates(input: {
    companyId: number;
    amount: string | number;
    bankBusinessDate?: Date | null;
    counterpartyName?: string | null;
  }) {
    const normalizedAmount = normalizeMoney(input.amount);
    const normalizedCounterpartyName = normalizeBankSmsPartyName(input.counterpartyName);

    const candidates = await this.financeReceivableTrackingRepository.find({
      where: {
        companyId: input.companyId,
        currentStatus: In(['invoice_issued', 'receivable_open', 'partial_receipt']),
        evidenceStatus: In(['pending', 'supported'] as FinanceReceivableTrackingEvidenceStatus[]),
      },
      order: {
        invoiceIssuedAt: 'DESC',
        id: 'DESC',
      },
      take: 20,
    });

    return candidates.filter((item) => {
      const candidateCounterpartyName =
        item.normalizedCounterpartyName || normalizeBankSmsPartyName(item.counterpartyName);
      if (Number(item.outstandingAmount) + 0.0001 < Number(normalizedAmount)) {
        return false;
      }
      if (
        normalizedCounterpartyName &&
        !isNormalizedCounterpartyMatch(candidateCounterpartyName, normalizedCounterpartyName)
      ) {
        return false;
      }

      return true;
    });
  }

  async validateReceivableTrackingConfirmationTarget(
    receivableTrackingId: number,
    transaction: BankSmsTransaction,
    manager?: EntityManager,
  ) {
    const repository = manager
      ? manager.getRepository(FinanceReceivableTracking)
      : this.financeReceivableTrackingRepository;

    const item = await repository.findOne({
      where: { id: receivableTrackingId },
      relations: {
        workOrder: true,
      },
      ...(manager ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!item) {
      throw new NotFoundException('关联应收追踪对象不存在');
    }
    if (item.companyId !== transaction.companyId) {
      throw new BadRequestException('应收追踪对象与银行短信所属公司不一致');
    }
    if (!['invoice_issued', 'receivable_open', 'partial_receipt'].includes(item.currentStatus)) {
      throw new BadRequestException('当前应收追踪对象不处于待回款状态');
    }
    if (!['pending', 'supported'].includes(item.evidenceStatus)) {
      throw new BadRequestException('当前应收追踪对象仍缺少正式开票或应收证据');
    }
    if (Number(item.outstandingAmount) <= 0) {
      throw new BadRequestException('当前应收追踪对象已无待收金额');
    }

    return item;
  }

  async confirmReceivableTrackingBankMatch(
    receivableTrackingId: number,
    transaction: BankSmsTransaction,
    confirmedAmount: string | number,
    manager?: EntityManager,
  ) {
    this.financeSafetyService.assertAutoReconciliationEnabled(
      'receivable_tracking_bank_match_confirm',
    );
    this.financeSafetyService.assertVirtualAccountMutationEnabled(
      'receivable_tracking_bank_match_confirm_virtual_balance_projection',
    );
    const repository = manager
      ? manager.getRepository(FinanceReceivableTracking)
      : this.financeReceivableTrackingRepository;

    const item = await this.validateReceivableTrackingConfirmationTarget(
      receivableTrackingId,
      transaction,
      manager,
    );
    const normalizedConfirmedAmount = normalizeMoney(confirmedAmount);
    const outstandingBefore = Number(item.outstandingAmount);
    const confirmedAmountValue = Number(normalizedConfirmedAmount);

    if (!Number.isFinite(confirmedAmountValue) || confirmedAmountValue <= 0) {
      throw new BadRequestException('应收追踪确认金额无效');
    }
    if (confirmedAmountValue - outstandingBefore > 0.0001) {
      throw new BadRequestException('应收追踪确认金额超过当前待收金额');
    }

    const nextReceivedAmount = normalizeMoney(Number(item.receivedAmount) + confirmedAmountValue);
    const nextOutstandingAmount = normalizeMoney(Number(item.invoiceAmount) - Number(nextReceivedAmount));

    item.receivedAmount = nextReceivedAmount;
    item.outstandingAmount = nextOutstandingAmount;
    item.lastBankSmsTransactionId = transaction.id;
    item.lastReceiptAt = transaction.smsReceivedAt;
    item.currentStatus =
      Number(nextOutstandingAmount) <= 0 ? 'fully_received' : 'partial_receipt';

    return repository.save(item);
  }

  async getBalanceSnapshot(manager?: EntityManager) {
    const bankSmsTransactionRepository = manager
      ? manager.getRepository(BankSmsTransaction)
      : this.bankSmsTransactionRepository;
    const financeReconciliationLinkRepository = manager
      ? manager.getRepository(FinanceReconciliationLink)
      : this.financeReconciliationLinkRepository;

    const [latestBankTransaction, latestConfirmedLink, pendingCount] = await Promise.all([
      bankSmsTransactionRepository
        .createQueryBuilder('tx')
        .where('tx.company_id IS NOT NULL')
        .orderBy('tx.sms_received_at', 'DESC')
        .addOrderBy('tx.id', 'DESC')
        .getOne(),
      financeReconciliationLinkRepository.findOne({
        where: {
          status: 'confirmed',
        },
        relations: {
          bankSmsTransaction: true,
        },
        order: {
          confirmedAt: 'DESC',
          id: 'DESC',
        },
      }),
      bankSmsTransactionRepository
        .createQueryBuilder('tx')
        .where('tx.company_id IS NOT NULL')
        .andWhere('tx.reconcile_status IN (:...statuses)', {
          statuses: ['pending', 'suggested'],
        })
        .getCount(),
    ]);

    const latestConfirmedBoundLink =
      latestConfirmedLink?.bankSmsTransaction?.companyId !== null ? latestConfirmedLink : null;
    const bankBalance = latestBankTransaction?.balanceAfter ?? '0.00';
    const virtualBalance = latestConfirmedBoundLink?.bankSmsTransaction?.balanceAfter ?? '0.00';

    return {
      latestBankTransaction,
      latestConfirmedLink: latestConfirmedBoundLink,
      bankBalance,
      virtualBalance,
      balanceDiff: subtractMoney(bankBalance, virtualBalance),
      pendingCount,
    };
  }

  async getVirtualAmountCheck() {
    const snapshot = await this.getBalanceSnapshot();
    const confirmedLinkHeadsPromise = this.financeReconciliationLinkRepository.find({
      where: {
        status: 'confirmed',
      },
      order: {
        confirmedAt: 'DESC',
        id: 'DESC',
      },
      take: 200,
    });

    const [confirmedLinkHeads, unresolvedTransactions, thirdPartyClearingWechatReceipts] =
      await Promise.all([
        confirmedLinkHeadsPromise,
        this.bankSmsTransactionRepository
          .createQueryBuilder('tx')
          .where('tx.company_id IS NOT NULL')
          .andWhere('tx.reconcile_status IN (:...statuses)', {
            statuses: ['pending', 'suggested'],
          })
          .orderBy('tx.sms_received_at', 'DESC')
          .addOrderBy('tx.id', 'DESC')
          .take(50)
          .getMany(),
        this.wechatPaymentReceiptRepository.find({
          where: {
            paymentStatus: 'paid_confirmed',
            settlementStatus: In(['pending_settlement', 'batched']),
          },
        }),
      ]);

    const confirmedLinkIds = confirmedLinkHeads.map((item) => item.id);
    const confirmedLinksById = confirmedLinkIds.length
      ? new Map(
          (
            await this.financeReconciliationLinkRepository.find({
              where: {
                id: In(confirmedLinkIds),
              },
              relations: {
                bankSmsTransaction: true,
                confirmedByUser: true,
              },
            })
          ).map((item) => [item.id, item]),
        )
      : new Map<number, FinanceReconciliationLink>();
    const confirmedLinks = confirmedLinkIds
      .map((id) => confirmedLinksById.get(id))
      .filter(
        (item): item is FinanceReconciliationLink =>
          Boolean(item?.bankSmsTransaction && item.bankSmsTransaction.companyId !== null),
      )
      .slice(0, 50);

    const thirdPartyClearingWechat = normalizeMoney(
      thirdPartyClearingWechatReceipts.reduce(
        (sum, item) => sum + Number(item.amountPaid ?? 0),
        0,
      ),
    );

    return {
      bankBalance: snapshot.bankBalance,
      virtualBalance: snapshot.virtualBalance,
      balanceDiff: snapshot.balanceDiff,
      bankActual: snapshot.bankBalance,
      bankVirtual: snapshot.virtualBalance,
      thirdPartyClearingWechat,
      alipayClearing: '0.00',
      pendingCount: snapshot.pendingCount,
      latestBankTransaction: snapshot.latestBankTransaction
        ? {
            id: snapshot.latestBankTransaction.id,
            companyId: snapshot.latestBankTransaction.companyId,
            amount: snapshot.latestBankTransaction.amount,
            direction: snapshot.latestBankTransaction.direction,
            balanceAfter: snapshot.latestBankTransaction.balanceAfter,
            smsReceivedAt: snapshot.latestBankTransaction.smsReceivedAt.toISOString(),
          }
        : null,
      latestConfirmedLedger: snapshot.latestConfirmedLink
        ? {
            reconciliationLinkId: snapshot.latestConfirmedLink.id,
            confirmedAmount: snapshot.latestConfirmedLink.confirmedAmount,
            confirmedAt: snapshot.latestConfirmedLink.confirmedAt?.toISOString() ?? null,
            balanceAfter: snapshot.latestConfirmedLink.bankSmsTransaction.balanceAfter,
            bankSmsTransactionId: snapshot.latestConfirmedLink.bankSmsTransactionId,
            companyId: snapshot.latestConfirmedLink.bankSmsTransaction.companyId,
          }
        : null,
      ledgerEntries: confirmedLinks.map((item) => ({
        id: item.id,
        bankSmsTransactionId: item.bankSmsTransactionId,
        companyId: item.bankSmsTransaction.companyId,
        linkType: item.linkType,
        linkId: item.linkId,
        confirmedAmount: item.confirmedAmount,
        confirmedAt: item.confirmedAt?.toISOString() ?? null,
        confirmedBy:
          item.confirmedByUser?.realName ?? item.confirmedByUser?.username ?? item.confirmedBy,
        transactionDirection: item.bankSmsTransaction.direction,
        transactionAmount: item.bankSmsTransaction.amount,
        bankBalanceAfter: item.bankSmsTransaction.balanceAfter,
        smsReceivedAt: item.bankSmsTransaction.smsReceivedAt.toISOString(),
        counterparty: item.bankSmsTransaction.counterparty,
        note: item.note,
      })),
      unresolvedSources: unresolvedTransactions.map((item) => ({
        id: item.id,
        companyId: item.companyId,
        direction: item.direction,
        amount: item.amount,
        counterparty: item.counterparty,
        reconcileStatus: item.reconcileStatus,
        bankBusinessDate: item.bankBusinessDate.toISOString(),
        smsReceivedAt: item.smsReceivedAt.toISOString(),
        balanceAfter: item.balanceAfter,
      })),
    };
  }

  private readPaymentCallbackDryRunConfig(): PaymentCallbackDryRunConfig {
    const allowedProvidersRaw =
      this.readConfigString('PAYMENT_CALLBACK_ALLOWED_PROVIDERS') ?? 'enterprise_wechat_mock';
    const allowedProviders = new Set(
      allowedProvidersRaw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    );

    return {
      dryRunEnabled: this.readBooleanConfig('PAYMENT_CALLBACK_DRY_RUN_ENABLED', false),
      enterpriseWechatPaymentEnabled: this.readBooleanConfig(
        'ENTERPRISE_WECHAT_PAYMENT_ENABLED',
        false,
      ),
      enterpriseWechatCallbackEnabled: this.readBooleanConfig(
        'ENTERPRISE_WECHAT_CALLBACK_ENABLED',
        false,
      ),
      enterpriseWechatCallbackPublicEnabled: this.readBooleanConfig(
        'ENTERPRISE_WECHAT_CALLBACK_PUBLIC_ENABLED',
        false,
      ),
      enterpriseWechatMockMode: this.readBooleanConfig('ENTERPRISE_WECHAT_MOCK_MODE', true),
      internalCallbackTestToken: this.readConfigString('INTERNAL_CALLBACK_TEST_TOKEN'),
      allowedProviders,
      rejectRealProvider: this.readBooleanConfig('PAYMENT_CALLBACK_REJECT_REAL_PROVIDER', true),
    };
  }

  private readConfigString(key: string) {
    return trimToNull(this.configService.get<string>(key));
  }

  private readBooleanConfig(key: string, fallback: boolean) {
    const value = this.configService.get<string>(key);
    if (value === undefined || value === null || String(value).trim() === '') {
      return fallback;
    }

    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
      return false;
    }

    return fallback;
  }

  private mergeCallbackHeaders(
    requestHeaders?: Record<string, string | string[] | undefined>,
    bodyHeaders?: Record<string, string>,
  ) {
    const merged: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(requestHeaders ?? {})) {
      merged[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
    }
    for (const [key, value] of Object.entries(bodyHeaders ?? {})) {
      merged[key.toLowerCase()] = value;
    }

    return merged;
  }

  private extractInternalCallbackToken(headers: Record<string, string | undefined>) {
    const directToken =
      trimToNull(headers['x-internal-callback-token']) ??
      trimToNull(headers['x-payment-callback-token']);
    if (directToken) {
      return directToken;
    }

    const authorization = trimToNull(headers.authorization);
    if (!authorization) {
      return null;
    }

    const bearerPrefix = 'bearer ';
    return authorization.toLowerCase().startsWith(bearerPrefix)
      ? trimToNull(authorization.slice(bearerPrefix.length))
      : null;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private buildReceiverCallbackLookup(payload: Record<string, unknown>): MockPaymentCallbackDto {
    return {
      paymentRequestNo: trimToNull(String(payload.paymentRequestNo ?? '')) ?? undefined,
      idempotencyKey: trimToNull(String(payload.idempotencyKey ?? '')) ?? undefined,
      channelTradeNo: trimToNull(String(payload.channelTradeNo ?? '')) ?? undefined,
      channelPrepayId: trimToNull(String(payload.channelPrepayId ?? '')) ?? undefined,
      amount: trimToNull(String(payload.amount ?? '')) ?? '',
      paidAt: trimToNull(String(payload.paidAt ?? '')) ?? undefined,
      payerPhone: trimToNull(String(payload.payerPhone ?? '')) ?? undefined,
      callbackPayload: payload,
    };
  }

  private resolveDryRunIdempotencyResult(outcome: string) {
    if (outcome === 'duplicate_paid_callback') {
      return 'duplicate_noop';
    }
    if (outcome === 'paid_by_channel') {
      return 'processed';
    }
    if (outcome.startsWith('missing_') || outcome.includes('mismatch')) {
      return 'exception_candidate';
    }
    if (outcome.includes('expired') || outcome.includes('cancelled')) {
      return 'anomaly_candidate';
    }

    return 'not_processed';
  }

  private isCollectionOrderConfirmed(collectionOrder: FinanceCollectionOrder) {
    return isCollectionOrderStrictlyConfirmed(collectionOrder);
  }

  private async findBankSmsCollectionOrderBridgeCandidates(
    reconciliationLink: FinanceReconciliationLink,
    transaction: BankSmsTransaction,
    repository: Repository<FinanceCollectionOrder>,
    lockCurrent = false,
  ) {
    const where: FindOptionsWhere<FinanceCollectionOrder>[] = [
      { reconciliationLinkId: reconciliationLink.id },
      { bankTransactionId: transaction.id },
    ];

    if (reconciliationLink.linkType === 'receipt_item' && reconciliationLink.linkId) {
      where.push({ workOrderId: reconciliationLink.linkId });
      where.push({
        sourceType: 'work_order',
        sourceId: String(reconciliationLink.linkId),
      });
    }

    const candidates = await repository.find({
      where,
      order: {
        id: lockCurrent ? 'ASC' : 'DESC',
      },
      ...(lockCurrent ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    const uniqueCandidates = new Map<number, FinanceCollectionOrder>();
    for (const candidate of candidates) {
      uniqueCandidates.set(candidate.id, candidate);
    }

    return [...uniqueCandidates.values()];
  }

  private buildBankSmsCollectionOrderBridgeResult(
    status: BankSmsCollectionOrderBridgeResultStatus,
    reason: string,
    candidates: FinanceCollectionOrder[],
    collectionOrder?: FinanceCollectionOrder,
    attached = false,
    ready = false,
  ): BankSmsCollectionOrderBridgeResult {
    return {
      status,
      collectionOrderId: collectionOrder?.id ?? null,
      candidateCollectionOrderIds: candidates.map((item) => item.id),
      attached,
      ready,
      reason,
    };
  }

  private isBankSmsCollectionOrderBridgeRelationCompatible(
    collectionOrder: FinanceCollectionOrder,
    reconciliationLink: FinanceReconciliationLink,
    transaction: BankSmsTransaction,
  ) {
    if (transaction.companyId !== null && collectionOrder.companyId !== transaction.companyId) {
      return false;
    }
    if (
      collectionOrder.bankTransactionId !== null &&
      collectionOrder.bankTransactionId !== transaction.id
    ) {
      return false;
    }
    if (
      collectionOrder.reconciliationLinkId !== null &&
      collectionOrder.reconciliationLinkId !== reconciliationLink.id
    ) {
      return false;
    }

    return true;
  }

  private isBankSmsCollectionOrderBridgeTargetCompatible(
    collectionOrder: FinanceCollectionOrder,
    reconciliationLink: FinanceReconciliationLink,
    transaction: BankSmsTransaction,
  ) {
    if (!reconciliationLink.linkId) {
      return false;
    }

    if (reconciliationLink.linkType === 'receipt_item') {
      return (
        collectionOrder.workOrderId === reconciliationLink.linkId ||
        (collectionOrder.sourceType === 'work_order' &&
          collectionOrder.sourceId === String(reconciliationLink.linkId))
      );
    }

    if (reconciliationLink.linkType === 'receivable_tracking') {
      return (
        collectionOrder.reconciliationLinkId === reconciliationLink.id ||
        collectionOrder.bankTransactionId === transaction.id
      );
    }

    return false;
  }

  private isBankSmsCollectionOrderBridgeAmountCompatible(
    collectionOrder: FinanceCollectionOrder,
    transaction: BankSmsTransaction,
  ) {
    const expectedAmount =
      collectionOrder.bankReceivedAmount ?? collectionOrder.receiptAmount ?? collectionOrder.businessAmount;

    return normalizeMoney(expectedAmount) === normalizeMoney(transaction.amount);
  }

  private isBankSmsCollectionOrderBridgeAttachable(collectionOrder: FinanceCollectionOrder) {
    return (
      !['cancelled', 'refunded'].includes(collectionOrder.status) &&
      collectionOrder.reconcileStatus !== 'rejected'
    );
  }

  private isBankSmsCollectionOrderBridgeReadyForConfirmApply(
    collectionOrder: FinanceCollectionOrder,
    transaction: BankSmsTransaction,
  ) {
    return (
      collectionOrder.bankTransactionId === transaction.id &&
      collectionOrder.bankReceivedAmount !== null &&
      normalizeMoney(collectionOrder.bankReceivedAmount) === normalizeMoney(transaction.amount) &&
      BANK_SMS_COLLECTION_BRIDGE_READY_STATUSES.has(collectionOrder.status) &&
      BANK_SMS_COLLECTION_BRIDGE_READY_EVIDENCE_STATUSES.has(collectionOrder.evidenceStatus) &&
      BANK_SMS_COLLECTION_BRIDGE_READY_RECONCILE_STATUSES.has(collectionOrder.reconcileStatus)
    );
  }

  private async findCollectionOrderOrThrow(
    id: number,
    repository: Repository<FinanceCollectionOrder>,
  ) {
    const item = await repository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('统一收款单不存在');
    }

    return item;
  }

  private assertCollectionOrderNotFormallyConfirmed(order: FinanceCollectionOrder) {
    if (order.formalConfirmationAuthorityId != null || isCollectionOrderStrictlyConfirmed(order)) {
      throw new ConflictException(
        '[collection_order_formally_confirmed_frozen] 已正式确认的统一收款单不可再修改',
      );
    }
  }

  private async lockWorkOrderMutex(manager: EntityManager, workOrderId: number | null) {
    if (!workOrderId) return;
    await manager.getRepository(RepairWorkOrderProfile).findOne({
      where: { workOrderId },
      lock: { mode: 'pessimistic_write' },
    });
    await manager.getRepository(WorkOrder).findOne({
      where: { id: workOrderId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  /**
   * Unified collection-mutation lock. The first collection read is only a
   * locator snapshot. It is never treated as current authority: after the
   * work-order mutex we lock the locator/requested bank ids, then link ids,
   * then all competing collections and finally re-read the target FOR UPDATE.
   * Every source id is compared with that current locked target before any
   * caller may save it. This remains safe under MySQL REPEATABLE READ when the
   * locator snapshot became stale while waiting for the work-order mutex.
   */
  private async lockCollectionForMutation(
    manager: EntityManager,
    collectionOrderId: number,
    requestedBankId?: number | null,
    requestedLinkId?: number | null,
  ): Promise<FinanceCollectionOrder> {
    const pre = await manager.getRepository(FinanceCollectionOrder).findOne({
      where: { id: collectionOrderId },
    });
    if (!pre) {
      throw new NotFoundException('finance_collection_order 不存在');
    }

    await this.lockWorkOrderMutex(manager, pre.workOrderId ?? null);

    const bankIds = [
      ...new Set(
        [pre.bankTransactionId, requestedBankId ?? null].filter(
          (value): value is number => value != null,
        ),
      ),
    ].sort((a, b) => a - b);
    const linkIds = [
      ...new Set(
        [pre.reconciliationLinkId, requestedLinkId ?? null].filter(
          (value): value is number => value != null,
        ),
      ),
    ].sort((a, b) => a - b);
    for (const id of bankIds) {
      await manager.getRepository(BankSmsTransaction).findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
    }
    for (const id of linkIds) {
      await manager.getRepository(FinanceReconciliationLink).findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
    }

    // Source reuse fail-closed: while holding the bank/link locks, a bank or link
    // already consumed by a typed authority OR already bound to a different
    // collection must never be re-bound to this collection. The DB unique keys
    // remain the final backstop.
    await this.assertCollectionSourcesNotReused(manager, collectionOrderId, bankIds, linkIds);

    const order = await manager.getRepository(FinanceCollectionOrder).findOne({
      where: { id: collectionOrderId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!order) {
      throw new NotFoundException('finance_collection_order 不存在');
    }
    if (
      order.workOrderId !== pre.workOrderId ||
      order.bankTransactionId !== pre.bankTransactionId ||
      order.reconciliationLinkId !== pre.reconciliationLinkId
    ) {
      throw new ConflictException(
        '[collection_order_source_drift] 收款单工单或资金来源在变更过程中漂移',
      );
    }
    this.assertCollectionOrderNotFormallyConfirmed(order);
    return order;
  }

  private async assertCollectionSourcesNotReused(
    manager: EntityManager,
    collectionOrderId: number,
    bankIds: number[],
    linkIds: number[],
  ) {
    const sourceWhere: Array<Record<string, number>> = [];
    for (const id of bankIds) sourceWhere.push({ bankTransactionId: id });
    for (const id of linkIds) sourceWhere.push({ reconciliationLinkId: id });
    if (!sourceWhere.length) return;

    const otherCollections = await manager.getRepository(FinanceCollectionOrder).find({
      where: sourceWhere,
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    for (const item of otherCollections) {
      if (item.id === collectionOrderId) continue;
      if (item.bankTransactionId != null && bankIds.includes(item.bankTransactionId)) {
        throw new ConflictException('[collection_order_source_reused] 银行流水已被其他收款单占用');
      }
      if (item.reconciliationLinkId != null && linkIds.includes(item.reconciliationLinkId)) {
        throw new ConflictException('[collection_order_source_reused] 对账链接已被其他收款单占用');
      }
    }

    const authorities = await manager.getRepository(FinanceCollectionConfirmationAuthority).find({
      where: sourceWhere,
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    for (const authority of authorities) {
      if (authority.collectionOrderId === collectionOrderId) continue;
      throw new ConflictException('[collection_order_source_reused] 银行流水或对账链接已被其他收款单正式确认');
    }
  }

  private async findPaymentRequestOrThrow(
    dto: Pick<MarkPaymentRequestQrGeneratedMockDto, 'paymentRequestId' | 'paymentRequestNo'>,
    repository: Repository<FinancePaymentRequest>,
  ) {
    const paymentRequestId = dto.paymentRequestId;
    const paymentRequestNo = trimToNull(dto.paymentRequestNo);
    const item = paymentRequestId
      ? await repository.findOne({ where: { id: paymentRequestId } })
      : paymentRequestNo
        ? await repository.findOne({ where: { paymentRequestNo } })
        : null;

    if (!item) {
      throw new NotFoundException('Payment request does not exist.');
    }

    return item;
  }

  private async findPaymentRequestForCallback(
    dto: MockPaymentCallbackDto,
    repository: Repository<FinancePaymentRequest>,
  ) {
    if (dto.paymentRequestId) {
      const item = await repository.findOne({ where: { id: dto.paymentRequestId } });
      if (item) {
        return item;
      }
    }

    const channelTradeNo = trimToNull(dto.channelTradeNo);
    if (channelTradeNo) {
      const item = await repository.findOne({ where: { channelTradeNo } });
      if (item) {
        return item;
      }
    }

    const paymentRequestNo = trimToNull(dto.paymentRequestNo);
    if (paymentRequestNo) {
      const item = await repository.findOne({ where: { paymentRequestNo } });
      if (item) {
        return item;
      }
    }

    const idempotencyKey = trimToNull(dto.idempotencyKey);
    if (idempotencyKey) {
      return repository.findOne({ where: { idempotencyKey } });
    }

    return null;
  }

  private buildMockCallbackPayload(dto: MockPaymentCallbackDto) {
    return {
      paymentRequestNo: trimToNull(dto.paymentRequestNo),
      idempotencyKey: trimToNull(dto.idempotencyKey),
      channelTradeNo: trimToNull(dto.channelTradeNo),
      channelPrepayId: trimToNull(dto.channelPrepayId),
      amount: normalizeMoney(dto.amount),
      paidAt: dto.paidAt ? new Date(dto.paidAt).toISOString() : new Date().toISOString(),
      payerPhone: trimToNull(dto.payerPhone),
      receivedAt: new Date().toISOString(),
      source: 'mock_enterprise_wechat_callback',
      ...(dto.callbackPayload ?? {}),
    };
  }

  private async createTemporaryServiceOrderDraftInFinanceBoundary(
    dto: CreateTemporaryServiceOrderDraftDto,
    currentUser: CurrentUser,
    executor: EntityManager,
  ) {
    const workOrderRepository = executor.getRepository(WorkOrder);
    const temporaryServiceOrderRepository = executor.getRepository(TemporaryServiceOrder);

    if (dto.relatedWorkOrderId) {
      const workOrder = await workOrderRepository.findOne({ where: { id: dto.relatedWorkOrderId } });
      if (!workOrder) {
        throw new NotFoundException('Related work order does not exist.');
      }
      assertWorkOrderNotUnquoted(workOrder);
    }

    const serviceAmount = normalizeMoney(dto.serviceAmount);
    if (Number(serviceAmount) <= 0) {
      throw new BadRequestException('Temporary service amount must be greater than 0.');
    }

    const temporaryServiceNo = await this.sequenceService.generateBizNo(
      BIZ_SEQUENCE_CONFIG.TEMPORARY_SERVICE_ORDER.bizType,
      BIZ_SEQUENCE_CONFIG.TEMPORARY_SERVICE_ORDER.prefix,
      executor,
    );
    const customerPhone = trimToNull(dto.customerPhone);
    const missingCustomerPhone = !customerPhone;
    const temporaryServiceOrder = temporaryServiceOrderRepository.create({
      temporaryServiceNo,
      companyId: dto.companyId,
      serviceType: dto.serviceType,
      serviceTitle: dto.serviceTitle.trim(),
      serviceAmount,
      customerId: trimToNull(dto.customerId),
      customerPhone,
      customerName: trimToNull(dto.customerName),
      temporaryCustomerFlag: dto.temporaryCustomerFlag ?? missingCustomerPhone,
      missingCustomerPhoneFlag: missingCustomerPhone,
      vehiclePlate: trimToNull(dto.vehiclePlate),
      sourceChannel: dto.sourceChannel ?? null,
      responsibleEmployeeId: dto.responsibleEmployeeId ?? null,
      relatedWorkOrderId: dto.relatedWorkOrderId ?? null,
      collectionOrderId: dto.collectionOrderId ?? null,
      status: 'waiting_payment',
      paymentStatus: 'payment_pending',
      evidenceStatus: missingCustomerPhone
        ? 'missing_customer_phone'
        : 'missing_payment_receipt',
      createdBy: currentUser.id,
      completedAt: null,
      evidencePayload: dto.evidencePayload ?? null,
      remark: trimToNull(dto.remark),
    });

    return temporaryServiceOrderRepository.save(temporaryServiceOrder);
  }

  private async attachMockPaymentRequestEvidence(
    collectionOrderId: number,
    input: MockPaymentRequestEvidenceInput,
    executor: EntityManager,
  ) {
    const collectionRepository = executor.getRepository(FinanceCollectionOrder);
    const collectionOrder = await this.lockCollectionForMutation(executor, collectionOrderId);
    const paymentRequest = this.buildMockPaymentRequest(collectionOrder, input);
    collectionOrder.evidencePayload = mergeEvidencePayload(collectionOrder.evidencePayload, {
      paymentRequest,
    });
    collectionOrder.status = 'payment_pending';
    collectionOrder.reconcileStatus = 'pending';
    collectionOrder.evidenceStatus = this.resolveCollectionEvidenceStatus(collectionOrder);

    return {
      collectionOrder: await collectionRepository.save(collectionOrder),
      paymentRequest,
    };
  }

  private buildMockPaymentRequest(
    collectionOrder: FinanceCollectionOrder,
    input: MockPaymentRequestEvidenceInput,
  ): MockPaymentRequestEvidence {
    const createdAt = input.createdAt ? new Date(input.createdAt) : new Date();
    const expireAt = input.expireAt
      ? new Date(input.expireAt)
      : new Date(createdAt.getTime() + 30 * 60 * 1000);
    const paymentRequestNo =
      trimToNull(input.paymentRequestNo) ?? `PAYREQ_${collectionOrder.collectionNo}`;
    const amount = normalizeMoney(input.amount ?? collectionOrder.businessAmount);
    const payerPhone = trimToNull(input.payerPhone) ?? collectionOrder.customerPhone ?? null;
    const qrUrl =
      trimToNull(input.qrUrl) ?? `mock://enterprise-wechat/payment-requests/${paymentRequestNo}/qr`;
    const paymentUrl =
      trimToNull(input.paymentUrl) ?? `mock://enterprise-wechat/payment-requests/${paymentRequestNo}`;
    const idempotencyKey =
      trimToNull(input.idempotencyKey) ??
      `${collectionOrder.collectionNo}:${paymentRequestNo}:${amount}`;

    return {
      paymentRequestNo,
      provider: input.provider ?? 'enterprise_wechat_mock',
      paymentChannel: input.paymentChannel ?? 'enterprise_wechat',
      collectionOrderId: collectionOrder.id,
      collectionNo: collectionOrder.collectionNo,
      amount,
      payerPhone,
      qrUrl,
      paymentUrl,
      expireAt: expireAt.toISOString(),
      requestStatus: input.requestStatus ?? 'created',
      createdByEmployeeId:
        input.createdByEmployeeId ?? collectionOrder.sourceEmployeeId ?? collectionOrder.createdBy,
      createdAt: createdAt.toISOString(),
      idempotencyKey,
      remark: trimToNull(input.remark),
    };
  }

  private resolveBusinessTypeFromTemporaryService(
    serviceType: CreateTemporaryServiceOrderDraftDto['serviceType'],
  ): CreateCollectionOrderDraftDto['businessType'] {
    if (serviceType === 'wash_single') {
      return 'wash_single';
    }
    if (serviceType === 'simple_repair') {
      return 'maintenance';
    }

    return 'other';
  }

  private resolveCollectionEvidenceStatus(
    item: FinanceCollectionOrder,
  ): FinanceCollectionOrderEvidenceStatus {
    if (item.missingCustomerPhoneFlag) {
      return 'missing_customer_phone';
    }
    if (item.paymentReceiptId && item.bankTransactionId) {
      return 'matched_pending_confirmation';
    }
    if (item.paymentReceiptId) {
      return 'receipt_only';
    }
    if (item.bankTransactionId) {
      return 'bank_only';
    }

    return 'missing_payment_receipt';
  }

  async previewCollectionOrderConfirmation(collectionOrderId: number, currentUser: CurrentUser) {
    const order = await this.financeCollectionOrderRepository.findOne({
      where: { id: collectionOrderId },
    });
    if (!order) {
      throw new NotFoundException('finance_collection_order 不存在');
    }
    await this.assertFinanceConfirmationScope(currentUser, order, 'read');

    if (isCollectionOrderStrictlyConfirmed(order)) {
      const facts = await this.loadConfirmationSourceFacts(order);
      const authority = order.formalConfirmationAuthorityId
        ? await this.financeCollectionOrderRepository.manager
            .getRepository(FinanceCollectionConfirmationAuthority)
            .findOne({ where: { id: order.formalConfirmationAuthorityId } })
        : null;
      if (!authority) {
        throw new ConflictException('[collection_order_authority_drift] 已确认收款权威与当前来源漂移');
      }
      // Idempotent replay verifies the immutable captured registry anchor, not
      // the current registry row.
      const registryAnchor = capturedRegistryConfirmationAnchor(authority, {
        companyId: authority.companyId,
        bankName: facts.bank.bankName,
        smsSender: facts.bank.sender,
        accountTail: facts.bank.accountTail,
      });
      if (!registryAnchor) {
        throw new ConflictException('[collection_order_authority_drift] 已确认收款权威缺少银行账户权威锚点');
      }
      const fullFacts: ConfirmationSourceFacts = { ...facts, registry: registryAnchor };
      const fingerprint = collectionOrderConfirmationFingerprint(fullFacts, authority.profileScopeVersion);
      if (!this.verifyAuthorityMatchesFacts(authority, order, fullFacts, fingerprint)) {
        throw new ConflictException('[collection_order_authority_drift] 已确认收款权威与当前来源漂移');
      }
      return {
        collectionOrderId: order.id,
        collectionNo: order.collectionNo,
        companyId: order.companyId,
        strictlyConfirmed: true,
        idempotentReplay: true,
        blockers: [],
        expectedEvidenceFingerprint: fingerprint,
        sourceRefs: {
          bankTransactionId: order.bankTransactionId,
          reconciliationLinkId: order.reconciliationLinkId,
          workOrderId: order.workOrderId,
        },
      };
    }

    const blockers = collectionOrderConfirmationBlockers(order);
    let expectedEvidenceFingerprint: string | null = null;
    if (!blockers.length) {
      const facts = await this.loadConfirmationSourceFacts(order);
      const registry = await this.resolveFormalBankAccountRegistry(
        facts.bank,
        this.dataSource.manager,
        false,
      );
      const fullFacts: ConfirmationSourceFacts = {
        ...facts,
        registry: buildRegistryConfirmationAnchor(registry),
      };
      expectedEvidenceFingerprint = collectionOrderConfirmationFingerprint(fullFacts);
    }

    return {
      collectionOrderId: order.id,
      collectionNo: order.collectionNo,
      companyId: order.companyId,
      strictlyConfirmed: false,
      blockers,
      expectedEvidenceFingerprint,
      sourceRefs: {
        bankTransactionId: order.bankTransactionId,
        reconciliationLinkId: order.reconciliationLinkId,
        workOrderId: order.workOrderId,
      },
    };
  }

  async confirmCollectionOrder(
    collectionOrderId: number,
    dto: ConfirmCollectionOrderDto,
    currentUser: CurrentUser,
  ) {
    // Gate + actor + scope before any database lock.
    this.financeSafetyService.assertFinanceCollectionConfirmationEnabled();
    this.assertFormalFinanceActor(currentUser);

    const pre = await this.financeCollectionOrderRepository.findOne({
      where: { id: collectionOrderId },
    });
    if (!pre) {
      throw new NotFoundException('finance_collection_order 不存在');
    }
    await this.assertFinanceConfirmationScope(currentUser, pre, 'confirm');

    return this.dataSource.transaction(async (manager) => {
      await this.assertFormalFinanceActorCurrent(currentUser, manager);

      // Every read below is a current locking read. Safe collection mutators use
      // the same work-order mutex, so the source ids from the pre-read cannot be
      // changed after this mutex is acquired without being detected below.
      const lockedProfile = pre.workOrderId
        ? await manager.getRepository(RepairWorkOrderProfile).findOne({
            where: { workOrderId: pre.workOrderId },
            lock: { mode: 'pessimistic_write' },
          })
        : null;
      const lockedWorkOrder = pre.workOrderId
        ? await manager.getRepository(WorkOrder).findOne({
            where: { id: pre.workOrderId },
            lock: { mode: 'pessimistic_write' },
          })
        : null;
      const lockedBank = pre.bankTransactionId
        ? await manager.getRepository(BankSmsTransaction).findOne({
            where: { id: pre.bankTransactionId },
            lock: { mode: 'pessimistic_write' },
          })
        : null;
      if (lockedBank) {
        await this.assertBankSmsPromotionLineageCurrent(lockedBank, manager);
      }
      const lockedLink = pre.reconciliationLinkId
        ? await manager.getRepository(FinanceReconciliationLink).findOne({
            where: { id: pre.reconciliationLinkId },
            lock: { mode: 'pessimistic_write' },
          })
        : null;

      // Lock all collections sharing this work order / bank / link, id ASC.
      const shared = await manager.getRepository(FinanceCollectionOrder).find({
        where: [
          ...(pre.workOrderId ? [{ workOrderId: pre.workOrderId }] : []),
          ...(pre.bankTransactionId ? [{ bankTransactionId: pre.bankTransactionId }] : []),
          ...(pre.reconciliationLinkId
            ? [{ reconciliationLinkId: pre.reconciliationLinkId }]
            : []),
        ],
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });

      const order = shared.find((item) => item.id === collectionOrderId);
      if (!order) {
        throw new NotFoundException('finance_collection_order 不存在');
      }
      if (
        order.workOrderId !== pre.workOrderId ||
        order.bankTransactionId !== pre.bankTransactionId ||
        order.reconciliationLinkId !== pre.reconciliationLinkId
      ) {
        throw new ConflictException('[collection_order_source_drift] 收款单来源在确认过程中漂移');
      }

      // A formally-confirmable collection must never reach the authority lock
      // with a missing bank/link source, otherwise the OR where array collapses
      // to `where: []` and takes a full-table pessimistic lock.
      if (order.bankTransactionId == null || order.reconciliationLinkId == null) {
        throw new ConflictException('[finance_confirm_source_missing] 正式来源缺失');
      }

      const historicalWechatAnchors = await manager.getRepository(WechatSettlementBatch).find({
        where: [
          { bankMatchSuggestionBankSmsTransactionId: order.bankTransactionId },
          { bankSmsTransactionId: order.bankTransactionId },
        ],
        order: { id: 'ASC' },
      });
      if (historicalWechatAnchors.length > 0) {
        throw new ConflictException(
          '[collection_order_bank_source_rebind_forbidden] 银行短信已有企业微信历史锚点，禁止改按直接收款确认',
        );
      }

      // Lock any existing authority rows for the shared bank/link.
      const existingAuthorities = await manager
        .getRepository(FinanceCollectionConfirmationAuthority)
        .find({
          where: [
            { bankTransactionId: order.bankTransactionId },
            { reconciliationLinkId: order.reconciliationLinkId },
          ],
          order: { id: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        });

      // Re-check scope after locks. Employee/grant rows use current locking reads
      // so revocation serializes with this high-risk confirmation transaction.
      await this.assertFinanceConfirmationScope(
        currentUser,
        order,
        'confirm',
        manager,
        lockedProfile,
        true,
      );

      const strictlyConfirmed = isCollectionOrderStrictlyConfirmed(order);
      if (!strictlyConfirmed) {
        const blockers = collectionOrderConfirmationBlockers(order);
        if (blockers.length) {
          throw new ConflictException(
            `[collection_order_confirmation_blocked] ${blockers.map((item) => item.code).join(',')}`,
          );
        }
      }

      if (!lockedProfile || !lockedWorkOrder || !lockedBank || !lockedLink) {
        throw new ConflictException('[finance_confirm_source_missing] 正式来源缺失');
      }
      this.assertBankTransferSource(order, lockedBank, lockedLink, lockedWorkOrder);
      const existing = strictlyConfirmed
        ? order.formalConfirmationAuthorityId
          ? (existingAuthorities.find((a) => a.id === order.formalConfirmationAuthorityId) ??
            (await manager.getRepository(FinanceCollectionConfirmationAuthority).findOne({
              where: { id: order.formalConfirmationAuthorityId },
              lock: { mode: 'pessimistic_write' },
            })))
          : null
        : null;

      // The bank_account_registry authority must be resolved from the final
      // locked bank identity and current-locked before any formal mutation. A
      // replay verifies the immutable captured anchor instead of re-reading the
      // (possibly legitimately changed) current registry row.
      let registryAnchor: RegistryConfirmationAnchor | null = null;
      if (strictlyConfirmed && existing) {
        registryAnchor = capturedRegistryConfirmationAnchor(existing, {
          companyId: existing.companyId,
          bankName: lockedBank.bankName,
          smsSender: lockedBank.sender,
          accountTail: lockedBank.accountTail,
        });
      } else {
        const lockedRegistry = await this.resolveFormalBankAccountRegistry(
          lockedBank,
          manager,
          true,
        );
        registryAnchor = buildRegistryConfirmationAnchor(lockedRegistry);
      }
      if (!registryAnchor) {
        throw new ConflictException(
          '[collection_order_authority_drift] 已确认收款权威缺少银行账户权威锚点',
        );
      }

      const facts: ConfirmationSourceFacts = {
        order,
        profile: lockedProfile,
        workOrder: lockedWorkOrder,
        bank: lockedBank,
        link: lockedLink,
        registry: registryAnchor,
      };
      const fingerprint = collectionOrderConfirmationFingerprint(
        facts,
        existing?.profileScopeVersion ?? facts.profile.version,
      );
      if (fingerprint !== dto.expectedEvidenceFingerprint.trim().toLowerCase()) {
        throw new ConflictException(
          '[collection_order_fingerprint_mismatch] 正式收款确认指纹不匹配，请刷新预览后重试',
        );
      }

      // Idempotent replay: full-field typed authority verifier, not just hash.
      if (strictlyConfirmed) {
        if (existing && this.verifyAuthorityMatchesFacts(existing, order, facts, fingerprint)) {
          return { collectionOrderId: order.id, idempotent: true, fingerprint };
        }
        throw new ConflictException(
          '[collection_order_authority_drift] 已确认收款来源或权威已漂移，禁止覆盖原确认',
        );
      }

      // Concurrency: another collection already points at the same bank/link, even if
      // it is not yet confirmed. Two collections sharing a bank transaction or a
      // reconciliation link are ambiguous (the unique-key authority would let only one
      // ever confirm), so fail closed before any authority insert.
      const otherCollectionConflict = shared.some(
        (item) =>
          item.id !== order.id &&
          (item.bankTransactionId === order.bankTransactionId ||
            item.reconciliationLinkId === order.reconciliationLinkId),
      );
      const otherAuthorityConflict = existingAuthorities.some(
        (a) =>
          a.collectionOrderId !== order.id &&
          (a.bankTransactionId === order.bankTransactionId ||
            a.reconciliationLinkId === order.reconciliationLinkId),
      );
      if (otherCollectionConflict || otherAuthorityConflict) {
        throw new ConflictException(
          '[collection_order_source_conflict] 同一银行流水或对账链接已被其他收款单正式确认',
        );
      }

      const now = new Date();
      const authorityRepo = manager.getRepository(FinanceCollectionConfirmationAuthority);
      const authority = await authorityRepo.save(
        authorityRepo.create({
          collectionOrderId: order.id,
          sourceMode: SOURCE_MODE_BANK_TRANSFER_ONE_TO_ONE_V1,
          sourceVersion: 'v1',
          companyId: order.companyId,
          companyRef: facts.profile.companyRef,
          businessSectorRef: facts.profile.businessSectorRef,
          storeRef: facts.profile.storeRef,
          customerRef: facts.profile.customerRef,
          profileScopeSnapshotHash: sha256({
            companyRef: facts.profile.companyRef,
            businessSectorRef: facts.profile.businessSectorRef,
            storeRef: facts.profile.storeRef,
            customerRef: facts.profile.customerRef,
            scopeResolvedAt: facts.profile.scopeResolvedAt?.toISOString() ?? null,
            scopeSnapshotVersion: facts.profile.scopeSnapshotVersion ?? null,
          }),
          profileScopeVersion: facts.profile.version,
          workOrderId: order.workOrderId!,
          bankTransactionId: order.bankTransactionId!,
          reconciliationLinkId: order.reconciliationLinkId!,
          bankAccountRegistryId: facts.registry.id,
          bankAccountRegistryUpdatedAt: new Date(facts.registry.updatedAtIso),
          bankAccountRegistrySnapshotHash: facts.registry.snapshotHash,
          grossCents: assertPositiveCents(facts.bank.amount, 'bank.amount').toString(),
          netCents: assertPositiveCents(facts.bank.amount, 'bank.amount').toString(),
          feeCents: '0',
          currency: 'CNY',
          bankSnapshotHash: sha256(bankSourceSnapshot(facts.bank)),
          linkSnapshotHash: sha256(linkSourceSnapshot(facts.link)),
          workOrderSnapshotHash: sha256(workOrderSourceSnapshot(facts.workOrder)),
          canonicalSnapshotHash: fingerprint,
          sourceOccurredAt: facts.bank.bankBusinessDate,
          authorityConfirmedAt: now,
          confirmedBy: currentUser.id,
          reasonCode: dto.reasonCode,
        }),
      );

      order.status = 'completed';
      order.evidenceStatus = 'confirmed';
      order.reconcileStatus = 'confirmed';
      order.confirmedBy = currentUser.id;
      order.confirmedAt = now;
      order.formalConfirmationAuthorityId = authority.id;
      order.receiptAmount = facts.bank.amount;
      order.bankReceivedAmount = facts.bank.amount;
      order.channelFeeAmount = '0.00';
      await manager.getRepository(FinanceCollectionOrder).save(order);

      await this.operationLogsService.create(
        {
          module: 'finance_collection_confirmation',
          targetId: order.id,
          action: 'collection_order.confirm',
          actorType: 'human',
          operatorId: currentUser.id,
          detailJson: {
            reasonCode: dto.reasonCode,
            fingerprint,
            canonicalSnapshotHash: fingerprint,
            grossCents: authority.grossCents,
            netCents: authority.netCents,
            feeCents: authority.feeCents,
            bankTransactionId: authority.bankTransactionId,
            reconciliationLinkId: authority.reconciliationLinkId,
            workOrderId: authority.workOrderId,
            collectionOrderId: authority.collectionOrderId,
            bankAccountRegistryId: authority.bankAccountRegistryId,
            bankAccountRegistryUpdatedAt: authority.bankAccountRegistryUpdatedAt.toISOString(),
            bankAccountRegistrySnapshotHash: authority.bankAccountRegistrySnapshotHash,
          },
        },
        manager,
      );

      return { collectionOrderId: order.id, idempotent: false, fingerprint };
    });
  }

  private assertFormalFinanceActor(currentUser: CurrentUser) {
    if (currentUser.identitySource !== 'trusted_proxy') {
      throw new ForbiddenException('[finance_confirm_formal_actor_required] 正式收款确认需要可信代理正式身份');
    }
    this.assertFormalFinanceRoleCodes(currentUser.roleCodes);
  }

  /**
   * The request guard is only a pre-lock rejection layer. A formal finance
   * decision must derive the active actor and roles again from current locking
   * reads inside the same transaction that writes the authority row.
   *
   * Global lock order for this authority slice starts with:
   * User -> UserRole(id ASC) -> Role(id ASC).
   */
  private async assertFormalFinanceActorCurrent(
    currentUser: CurrentUser,
    manager: EntityManager,
  ) {
    if (currentUser.identitySource !== 'trusted_proxy') {
      throw new ForbiddenException('[finance_confirm_formal_actor_required] 正式收款确认需要可信代理正式身份');
    }

    const user = await manager.getRepository(User).findOne({
      where: { id: currentUser.id },
      lock: { mode: 'pessimistic_read' },
    });
    if (!user || user.status !== 1 || user.username !== currentUser.username) {
      throw new ForbiddenException(
        '[finance_confirm_actor_revoked] 正式收款确认人员已禁用或身份已变更',
      );
    }

    const userRoles = await manager.getRepository(UserRole).find({
      where: { userId: user.id },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_read' },
    });
    const boundRoleIds = userRoles.map((item) => item.roleId);
    const roleIds = [...new Set(boundRoleIds)].sort((a, b) => a - b);
    if (roleIds.length !== boundRoleIds.length) {
      throw new ForbiddenException(
        '[finance_confirm_role_binding_duplicate] 正式收款确认角色绑定存在重复，需先治理',
      );
    }
    const roles: Role[] = [];
    for (const id of roleIds) {
      const role = await manager.getRepository(Role).findOne({
        where: { id },
        lock: { mode: 'pessimistic_read' },
      });
      if (!role) {
        throw new ForbiddenException('[finance_confirm_role_revoked] 正式收款确认角色绑定已失效');
      }
      roles.push(role);
    }
    this.assertFormalFinanceRoleCodes(roles.map((role) => role.code));
  }

  private assertFormalFinanceRoleCodes(roleCodes: string[]) {
    const allowed = new Set([
      'admin',
      'finance',
      'super_admin',
      'owner',
      'finance_manager',
      'finance_operator',
    ]);
    if (!roleCodes.some((role) => allowed.has(role))) {
      throw new ForbiddenException('[finance_confirm_role_denied] 角色无权执行正式收款确认');
    }
  }

  private async assertFinanceConfirmationScope(
    currentUser: CurrentUser,
    order: FinanceCollectionOrder,
    permission: 'read' | 'confirm',
    manager: EntityManager = this.dataSource.manager,
    profileOverride: RepairWorkOrderProfile | null = null,
    lockAuthorityRows = false,
  ) {
    const profile = profileOverride ?? (order.workOrderId
      ? await manager.getRepository(RepairWorkOrderProfile).findOne({
          where: { workOrderId: order.workOrderId },
          ...(lockAuthorityRows
            ? { lock: { mode: 'pessimistic_read' as const } }
            : {}),
        })
      : null);
    if (!profile) {
      throw new ForbiddenException('[finance_scope_profile_missing] 未找到维修工单档案');
    }
    this.assertProfileLifecycleAllowsCollection(profile);

    const company = await manager.getRepository(BusinessCompanyRef).findOne({
      where: { companyRegistryId: order.companyId },
      ...(lockAuthorityRows
        ? { lock: { mode: 'pessimistic_read' as const } }
        : {}),
    });
    if (!company || company.companyRef !== profile.companyRef) {
      throw new ForbiddenException('[finance_scope_company_mismatch] 公司引用与维修工单档案不一致');
    }

    const scope: BusinessResourceScope = {
      companyRef: profile.companyRef,
      businessSectorRef: profile.businessSectorRef,
      storeRef: profile.storeRef,
      customerRef: profile.customerRef,
    };
    const access = await this.businessFoundationService.assertAccess(
      currentUser,
      scope,
      permission === 'read' ? 'finance.collection.read' : 'finance.collection.confirm',
      manager,
      { lockAuthorityRows },
    );
    if (
      access.resolved.companyRef !== profile.companyRef ||
      access.resolved.businessSectorRef !== profile.businessSectorRef ||
      access.resolved.storeRef !== profile.storeRef ||
      access.resolved.customerRef !== profile.customerRef
    ) {
      throw new ForbiddenException('[finance_scope_resolved_mismatch] 解析范围与工单档案不一致');
    }
    if (
      JSON.stringify(access.resolved.scopeSnapshotVersion ?? null) !==
      JSON.stringify(profile.scopeSnapshotVersion ?? null)
    ) {
      throw new ForbiddenException('[finance_scope_snapshot_drift] 范围快照版本漂移');
    }
  }

  private assertProfileLifecycleAllowsCollection(profile: RepairWorkOrderProfile) {
    const allowed = new Set([
      'authorized',
      'repair_scheduled',
      'repairing',
      'qc_pending',
      'rework_required',
      'ready_for_delivery',
      'delivered',
      'after_sales',
      'closed',
    ]);
    if (!allowed.has(profile.lifecycleStatus)) {
      throw new ForbiddenException('[finance_scope_lifecycle_not_ready] 维修工单尚未进入合理收款阶段');
    }
  }

  private verifyAuthorityMatchesFacts(
    authority: FinanceCollectionConfirmationAuthority,
    order: FinanceCollectionOrder,
    facts: ConfirmationSourceFacts,
    fingerprint: string,
  ): boolean {
    if (authority.canonicalSnapshotHash !== fingerprint) {
      return false;
    }
    if (
      authority.sourceOccurredAt.getTime() !== facts.bank.bankBusinessDate.getTime() ||
      order.confirmedAt == null ||
      order.confirmedAt.getTime() !== authority.authorityConfirmedAt.getTime()
    ) {
      return false;
    }
    return (
      collectAuthorityEnvelopeProblems({
        order,
        authority,
        profile: facts.profile,
        bank: facts.bank,
        link: facts.link,
        workOrder: facts.workOrder,
        registry: facts.registry,
      }).length === 0
    );
  }

  private async loadConfirmationSourceFacts(
    order: FinanceCollectionOrder,
    manager: EntityManager = this.dataSource.manager,
    lock = false,
  ): Promise<Omit<ConfirmationSourceFacts, 'registry'>> {
    const lockOption = lock ? { lock: { mode: 'pessimistic_write' as const } } : {};
    const workOrder = await manager.getRepository(WorkOrder).findOne({
      where: { id: order.workOrderId ?? undefined },
      ...lockOption,
    });
    const bank = await manager.getRepository(BankSmsTransaction).findOne({
      where: { id: order.bankTransactionId ?? undefined },
      ...lockOption,
    });
    const link = await manager.getRepository(FinanceReconciliationLink).findOne({
      where: { id: order.reconciliationLinkId ?? undefined },
      ...lockOption,
    });
    const profile = order.workOrderId
      ? await manager.getRepository(RepairWorkOrderProfile).findOne({
          where: { workOrderId: order.workOrderId },
          ...lockOption,
        })
      : null;
    if (!workOrder || !bank || !link || !profile) {
      throw new ConflictException('[finance_confirm_source_missing] 正式来源缺失');
    }
    this.assertBankTransferSource(order, bank, link, workOrder);
    return { order, bank, link, workOrder, profile };
  }

  /**
   * Deterministically resolve and (optionally current-lock) the authoritative
   * bank_account_registry from the final locked bank identity. Any missing,
   * ambiguous, inactive, unreviewed, reviewer-less or evidence-less registry
   * fails closed before any collection/link/order formal mutation.
   */
  private async resolveFormalBankAccountRegistry(
    bank: BankSmsTransaction,
    manager: EntityManager,
    lock: boolean,
  ): Promise<BankAccountRegistry> {
    if (bank.companyId == null) {
      throw new ConflictException('[finance_confirm_registry_company_missing] 银行流水缺少公司归属');
    }
    const registries = await manager.getRepository(BankAccountRegistry).find({
      where: {
        companyId: bank.companyId,
        bankName: bank.bankName,
        smsSender: bank.sender,
        accountTail: bank.accountTail,
      },
      relations: {
        formalReviewAuthority: true,
      },
      order: { id: 'ASC' },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (registries.length === 0) {
      throw new ConflictException('[finance_confirm_registry_missing] 未找到匹配的银行账户权威记录');
    }

    const identity = {
      companyId: bank.companyId,
      bankName: bank.bankName,
      smsSender: bank.sender,
      accountTail: bank.accountTail,
    } as const;
    const exactRows = registries.filter((registry) =>
      bankAccountRegistryIdentityMatches(registry, identity),
    );
    if (exactRows.length === 0 || exactRows.length !== registries.length) {
      throw new ConflictException('[finance_confirm_registry_identity_drift] 银行账户权威身份漂移');
    }
    const eligible = exactRows.filter(
      (registry) => bankAccountRegistryEligibilityBlockerCodes(registry).length === 0,
    );
    if (eligible.length === 1) {
      return eligible[0];
    }
    if (eligible.length > 1) {
      throw new ConflictException('[finance_confirm_registry_ambiguous] 银行账户权威记录存在歧义，禁止正式确认');
    }
    // eligible.length === 0: every exact-identity row fails formal eligibility.
    const blockers = Array.from(
      new Set(exactRows.flatMap((registry) => bankAccountRegistryEligibilityBlockerCodes(registry))),
    );
    const code = blockers.includes('registry_inactive')
      ? '[finance_confirm_registry_inactive]'
      : blockers.includes('registry_evidence_missing')
        ? '[finance_confirm_registry_evidence_missing]'
        : blockers.includes('registry_formal_authority_missing')
          ? '[finance_confirm_registry_unreviewed]'
          : '[finance_confirm_registry_authority_invalid]';
    throw new ConflictException(`${code} 银行账户权威不符合正式使用资格(${blockers.join(',')})`);
  }

  private assertBankTransferSource(
    order: FinanceCollectionOrder,
    bank: BankSmsTransaction,
    link: FinanceReconciliationLink,
    workOrder: WorkOrder,
  ) {
    const gross = assertPositiveCents(bank.amount, 'bank.amount');
    if (bank.direction !== 'income') {
      throw new ConflictException('[finance_confirm_bank_direction] 银行流水必须是收入');
    }
    if (bank.companyId === null || bank.companyId !== order.companyId) {
      throw new ConflictException('[finance_confirm_bank_company] 银行流水公司不一致');
    }
    if (bank.reconcileStatus !== 'confirmed') {
      throw new ConflictException('[finance_confirm_bank_reconcile] 银行流水未确认');
    }
    if (
      !bank.promotionPolicyVersion ||
      !bank.promotionAdmissionKey ||
      !bank.promotionEvidenceFingerprint ||
      !bank.promotionDecisionFingerprint
    ) {
      throw new ConflictException('[finance_confirm_bank_promotion] 银行流水缺正式 promotion 证据');
    }
    const hex64 = /^[0-9a-f]{64}$/;
    if (
      !hex64.test(bank.fingerprint) ||
      !hex64.test(bank.promotionEvidenceFingerprint ?? '') ||
      !hex64.test(bank.promotionDecisionFingerprint ?? '')
    ) {
      throw new ConflictException('[finance_confirm_bank_fingerprint_invalid] 银行指纹格式无效');
    }
    if (link.bankSmsTransactionId !== bank.id) {
      throw new ConflictException('[finance_confirm_link_bank] 对账链接与银行流水不一致');
    }
    if (link.linkType !== 'receipt_item' || link.linkId !== order.workOrderId) {
      throw new ConflictException('[finance_confirm_link_work_order] 对账链接非 receipt_item 或工单不一致');
    }
    if (link.status !== 'confirmed' || !link.confirmedBy || !link.confirmedAt) {
      throw new ConflictException('[finance_confirm_link_status] 对账链接未确认');
    }
    if (assertPositiveCents(link.confirmedAmount, 'link.confirmedAmount') !== gross) {
      throw new ConflictException('[finance_confirm_amount_mismatch] 银行金额与对账确认金额不一致');
    }
    if (workOrder.id !== order.workOrderId) {
      throw new ConflictException('[finance_confirm_work_order_mismatch] 工单不一致');
    }
    if (decimalToCents(order.businessAmount, 'businessAmount') !== gross) {
      throw new ConflictException('[finance_confirm_business_amount_mismatch] 业务金额与银行金额不一致');
    }
  }

  /**
   * A formal collection authority must be backed by the same immutable
   * promotion lineage that admitted the BankSmsTransaction. Re-read and lock
   * the raw SMS and its single classification in the authority transaction so
   * stale or hand-written promotion columns cannot be converted into a formal
   * collection confirmation.
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
        '[finance_confirm_bank_promotion_raw_missing] 银行流水缺少原始短信 promotion lineage',
      );
    }

    const classifications = await manager.getRepository(SmsMessageClassification).find({
      where: { rawSmsId: raw.id },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    if (classifications.length !== 1) {
      throw new ConflictException(
        classifications.length === 0
          ? '[finance_confirm_bank_promotion_classification_missing] 银行流水缺少分类 promotion lineage'
          : '[finance_confirm_bank_promotion_classification_ambiguous] 银行流水存在重复分类 promotion lineage',
      );
    }

    const problems = collectBankSmsPromotionLineageProblems({
      transaction,
      raw,
      classification: classifications[0],
    });
    if (problems.length) {
      throw new ConflictException(
        `[finance_confirm_bank_promotion_lineage_drift] ${problems.join(',')}`,
      );
    }
  }

  private serializeReceivableTracking(item: FinanceReceivableTracking) {
    return {
      id: item.id,
      companyId: item.companyId,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      sourceRefNo: item.sourceRefNo,
      invoiceNo: item.invoiceNo,
      counterpartyName: item.counterpartyName,
      normalizedCounterpartyName: item.normalizedCounterpartyName,
      invoiceAmount: item.invoiceAmount,
      receivedAmount: item.receivedAmount,
      outstandingAmount: item.outstandingAmount,
      currentStatus: item.currentStatus,
      evidenceStatus: item.evidenceStatus,
      invoiceIssuedAt: item.invoiceIssuedAt?.toISOString() ?? null,
      dueDate: item.dueDate,
      lastBankSmsTransactionId: item.lastBankSmsTransactionId,
      lastReceiptAt: item.lastReceiptAt?.toISOString() ?? null,
      evidenceNote: item.evidenceNote,
      remark: item.evidenceNote,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
