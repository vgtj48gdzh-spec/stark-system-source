import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { buildPaginationResult, getPagination } from '../../common/utils/pagination.util';
import { OperationLogAction } from '../../shared/enums/operation-log-action.enum';
import { BankAccountRegistry } from '../finance-bank-account/entities/bank-account-registry.entity';
import { BankSmsTransaction } from '../finance-bank-sms/entities/bank-sms-transaction.entity';
import { FinanceSafetyService } from '../finance-safety/finance-safety.service';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { CreateWechatSettlementBatchDto } from './dto/create-wechat-settlement-batch.dto';
import { ImportWechatPaymentReceiptDto } from './dto/import-wechat-payment-receipt.dto';
import { QueryWechatMerchantRegistryDto } from './dto/query-wechat-merchant-registry.dto';
import { QueryWechatPaymentReceiptsDto } from './dto/query-wechat-payment-receipts.dto';
import { QueryWechatSettlementBatchesDto } from './dto/query-wechat-settlement-batches.dto';
import { SaveWechatMerchantRegistryDto } from './dto/save-wechat-merchant-registry.dto';
import { WechatMerchantRegistry } from './entities/wechat-merchant-registry.entity';
import { WechatPaymentReceipt } from './entities/wechat-payment-receipt.entity';
import { WechatSettlementBatch } from './entities/wechat-settlement-batch.entity';
import { WechatSettlementReceiptLink } from './entities/wechat-settlement-receipt-link.entity';
import {
  collectWechatBankMatchSuggestionAnchorProblems,
  hashWechatBankMatchSuggestion,
  type WechatBankMatchSuggestionFacts,
} from './wechat-bank-match-authority.contract';

const WRITE_ROLES = ['admin', 'finance', 'super_admin', 'owner', 'finance_manager', 'finance_operator'] as const;
const READ_ROLES = [...WRITE_ROLES, 'auditor'] as const;

function normalizeMoney(value?: string | number | null) {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) {
    throw new BadRequestException('Invalid money value.');
  }

  return numericValue.toFixed(2);
}

function normalizeDateOnly(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Invalid date value.');
  }

  return date.toISOString().slice(0, 10);
}

@Injectable()
export class FinanceWechatService {
  constructor(
    @InjectRepository(WechatMerchantRegistry)
    private readonly wechatMerchantRegistryRepository: Repository<WechatMerchantRegistry>,
    @InjectRepository(WechatPaymentReceipt)
    private readonly wechatPaymentReceiptRepository: Repository<WechatPaymentReceipt>,
    @InjectRepository(WechatSettlementBatch)
    private readonly wechatSettlementBatchRepository: Repository<WechatSettlementBatch>,
    @InjectRepository(WechatSettlementReceiptLink)
    private readonly wechatSettlementReceiptLinkRepository: Repository<WechatSettlementReceiptLink>,
    @InjectRepository(WorkOrder)
    private readonly workOrderRepository: Repository<WorkOrder>,
    @InjectRepository(BankAccountRegistry)
    private readonly bankAccountRegistryRepository: Repository<BankAccountRegistry>,
    @InjectRepository(BankSmsTransaction)
    private readonly bankSmsTransactionRepository: Repository<BankSmsTransaction>,
    private readonly operationLogsService: OperationLogsService,
    private readonly financeSafetyService: FinanceSafetyService,
  ) {}

  async findMerchants(query: QueryWechatMerchantRegistryDto, currentUser: CurrentUser) {
    this.assertReadable(currentUser);

    const { skip, take } = getPagination(query);
    const qb = this.wechatMerchantRegistryRepository.createQueryBuilder('merchant');

    if (query.companyId) {
      qb.andWhere('merchant.company_id = :companyId', { companyId: query.companyId });
    }
    if (query.merchantId?.trim()) {
      qb.andWhere('merchant.merchant_id LIKE :merchantId', {
        merchantId: `%${query.merchantId.trim()}%`,
      });
    }
    if (query.status) {
      qb.andWhere('merchant.status = :status', { status: query.status });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy('merchant.created_at', 'DESC')
      .addOrderBy('merchant.id', 'DESC')
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(
      query,
      await Promise.all(list.map((item) => this.buildMerchantView(item))),
      total,
    );
  }

  async createMerchant(dto: SaveWechatMerchantRegistryDto, currentUser: CurrentUser) {
    this.assertWritable(currentUser);

    if (dto.settlementBankAccountRegistryId) {
      await this.assertBankAccountExists(dto.settlementBankAccountRegistryId);
    }

    const duplicated = await this.wechatMerchantRegistryRepository.findOne({
      where: {
        companyId: dto.companyId,
        merchantId: dto.merchantId.trim(),
      },
    });
    if (duplicated) {
      throw new BadRequestException('The WeChat merchant registry already exists.');
    }

    const merchant = await this.wechatMerchantRegistryRepository.save(
      this.wechatMerchantRegistryRepository.create({
        companyId: dto.companyId,
        merchantId: dto.merchantId.trim(),
        appId: dto.appId?.trim() || null,
        merchantName: dto.merchantName.trim(),
        settlementBankAccountRegistryId: dto.settlementBankAccountRegistryId ?? null,
        status: dto.status ?? 'active',
      }),
    );

    await this.operationLogsService.create({
      module: 'finance_wechat',
      targetId: merchant.id,
      action: OperationLogAction.CREATE_WECHAT_MERCHANT_REGISTRY,
      operatorId: currentUser.id,
      detail: `Created WeChat merchant registry ${merchant.merchantId}`,
      detailJson: {
        companyId: merchant.companyId,
        settlementBankAccountRegistryId: merchant.settlementBankAccountRegistryId,
      },
    });

    return this.buildMerchantView(merchant);
  }

  async findPaymentReceipts(query: QueryWechatPaymentReceiptsDto, currentUser: CurrentUser) {
    this.assertReadable(currentUser);

    const { skip, take } = getPagination(query);
    const qb = this.wechatPaymentReceiptRepository.createQueryBuilder('receipt');

    if (query.companyId) {
      qb.andWhere('receipt.company_id = :companyId', { companyId: query.companyId });
    }
    if (query.merchantId?.trim()) {
      qb.andWhere('receipt.merchant_id LIKE :merchantId', { merchantId: `%${query.merchantId.trim()}%` });
    }
    if (query.workOrderId) {
      qb.andWhere('receipt.work_order_id = :workOrderId', { workOrderId: query.workOrderId });
    }
    if (query.paymentStatus) {
      qb.andWhere('receipt.payment_status = :paymentStatus', { paymentStatus: query.paymentStatus });
    }
    if (query.settlementStatus) {
      qb.andWhere('receipt.settlement_status = :settlementStatus', { settlementStatus: query.settlementStatus });
    }
    if (query.dateFrom) {
      qb.andWhere('receipt.paid_at >= :dateFrom', { dateFrom: new Date(query.dateFrom) });
    }
    if (query.dateTo) {
      qb.andWhere('receipt.paid_at <= :dateTo', { dateTo: new Date(query.dateTo) });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy('receipt.paid_at', 'DESC')
      .addOrderBy('receipt.id', 'DESC')
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(
      query,
      await Promise.all(list.map((item) => this.buildPaymentReceiptListView(item))),
      total,
    );
  }

  async findPaymentReceipt(id: number, currentUser: CurrentUser) {
    this.assertReadable(currentUser);

    const receipt = await this.wechatPaymentReceiptRepository.findOne({
      where: { id },
    });
    if (!receipt) {
      throw new NotFoundException('The WeChat payment receipt does not exist.');
    }

    const [merchant, workOrder, settlementLink] = await Promise.all([
      this.findMerchantByCompanyAndMerchantId(receipt.companyId, receipt.merchantId),
      receipt.workOrderId
        ? this.workOrderRepository.findOne({ where: { id: receipt.workOrderId } })
        : Promise.resolve(null),
      this.wechatSettlementReceiptLinkRepository.findOne({
        where: { paymentReceiptId: receipt.id },
      }),
    ]);

    return {
      ...this.buildPaymentReceiptBase(receipt, merchant, workOrder),
      settlementBatchId: settlementLink?.settlementBatchId ?? null,
      rawPayload: receipt.rawPayload,
    };
  }

  async importPaymentReceipt(dto: ImportWechatPaymentReceiptDto, currentUser: CurrentUser) {
    this.assertWritable(currentUser);

    if (dto.workOrderId) {
      const workOrder = await this.workOrderRepository.findOne({
        where: { id: dto.workOrderId },
      });
      if (!workOrder) {
        throw new NotFoundException('The linked work order does not exist.');
      }
    }

    const duplicate = await this.wechatPaymentReceiptRepository.findOne({
      where: [
        { transactionId: dto.transactionId.trim() },
        { outTradeNo: dto.outTradeNo.trim() },
      ],
    });
    if (duplicate) {
      throw new BadRequestException('The WeChat payment receipt already exists.');
    }

    const receipt = await this.wechatPaymentReceiptRepository.save(
      this.wechatPaymentReceiptRepository.create({
        companyId: dto.companyId,
        merchantId: dto.merchantId.trim(),
        workOrderId: dto.workOrderId ?? null,
        outTradeNo: dto.outTradeNo.trim(),
        transactionId: dto.transactionId.trim(),
        payerRef: dto.payerRef?.trim() || null,
        amountPaid: normalizeMoney(dto.amountPaid),
        paidAt: new Date(dto.paidAt),
        paymentStatus: dto.paymentStatus ?? 'paid_confirmed',
        settlementStatus: dto.settlementStatus ?? 'pending_settlement',
        sourceType: 'manual_import',
        rawPayload: dto.rawPayload ?? {
          importedAt: new Date().toISOString(),
          sourceType: 'manual_import',
        },
      }),
    );

    await this.operationLogsService.create({
      module: 'finance_wechat',
      targetId: receipt.id,
      action: OperationLogAction.IMPORT_WECHAT_PAYMENT_RECEIPT,
      operatorId: currentUser.id,
      detail: `Imported WeChat payment receipt ${receipt.outTradeNo}`,
      detailJson: {
        merchantId: receipt.merchantId,
        workOrderId: receipt.workOrderId,
        paymentStatus: receipt.paymentStatus,
        settlementStatus: receipt.settlementStatus,
      },
    });

    return this.findPaymentReceipt(receipt.id, currentUser);
  }

  async findSettlementBatches(query: QueryWechatSettlementBatchesDto, currentUser: CurrentUser) {
    this.assertReadable(currentUser);

    const { skip, take } = getPagination(query);
    const qb = this.wechatSettlementBatchRepository.createQueryBuilder('batch');

    if (query.companyId) {
      qb.andWhere('batch.company_id = :companyId', { companyId: query.companyId });
    }
    if (query.merchantId?.trim()) {
      qb.andWhere('batch.merchant_id LIKE :merchantId', { merchantId: `%${query.merchantId.trim()}%` });
    }
    if (query.matchStatus) {
      qb.andWhere('batch.match_status = :matchStatus', { matchStatus: query.matchStatus });
    }
    if (query.bankAccountRegistryId) {
      qb.andWhere('batch.bank_account_registry_id = :bankAccountRegistryId', {
        bankAccountRegistryId: query.bankAccountRegistryId,
      });
    }
    if (query.dateFrom) {
      qb.andWhere('batch.settlement_date >= :dateFrom', { dateFrom: normalizeDateOnly(query.dateFrom) });
    }
    if (query.dateTo) {
      qb.andWhere('batch.settlement_date <= :dateTo', { dateTo: normalizeDateOnly(query.dateTo) });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy('batch.settlement_date', 'DESC')
      .addOrderBy('batch.id', 'DESC')
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(
      query,
      await Promise.all(list.map((item) => this.buildSettlementBatchListView(item))),
      total,
    );
  }

  async findSettlementBatch(id: number, currentUser: CurrentUser) {
    this.assertReadable(currentUser);

    const batch = await this.wechatSettlementBatchRepository.findOne({
      where: { id },
    });
    if (!batch) {
      throw new NotFoundException('The WeChat settlement batch does not exist.');
    }

    const links = await this.wechatSettlementReceiptLinkRepository.find({
      where: { settlementBatchId: batch.id },
      order: { id: 'ASC' },
    });
    const receiptIds = links.map((item) => item.paymentReceiptId);
    const receipts = receiptIds.length
      ? await this.wechatPaymentReceiptRepository.find({
          where: { id: In(receiptIds) },
          order: { paidAt: 'DESC', id: 'DESC' },
        })
      : [];
    const receiptsById = new Map(receipts.map((item) => [item.id, item]));

    return {
      ...(await this.buildSettlementBatchListView(batch)),
      rawPayload: batch.rawPayload,
      receipts: await Promise.all(
        links.map(async (link) => {
          const receipt = receiptsById.get(link.paymentReceiptId);
          if (!receipt) {
            return {
              id: link.paymentReceiptId,
              amount: link.amount,
            };
          }

          return {
            ...(await this.buildPaymentReceiptListView(receipt)),
            amount: link.amount,
          };
        }),
      ),
    };
  }

  async getSettlementBatchForBankMatch(id: number, manager?: EntityManager) {
    const repository = manager
      ? manager.getRepository(WechatSettlementBatch)
      : this.wechatSettlementBatchRepository;
    const batch = await repository.findOne({
      where: { id },
      ...(manager ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!batch) {
      throw new NotFoundException('The WeChat settlement batch does not exist.');
    }

    return batch;
  }

  async createSettlementBatch(dto: CreateWechatSettlementBatchDto, currentUser: CurrentUser) {
    this.assertWritable(currentUser);

    const receiptIds = [...new Set(dto.paymentReceiptIds.map((item) => Number(item)).filter(Boolean))];
    if (!receiptIds.length) {
      throw new BadRequestException('At least one payment receipt is required.');
    }

    const receipts = await this.wechatPaymentReceiptRepository.find({
      where: { id: In(receiptIds) },
      order: { paidAt: 'DESC', id: 'DESC' },
    });
    if (receipts.length !== receiptIds.length) {
      throw new NotFoundException('Some WeChat payment receipts do not exist.');
    }

    for (const receipt of receipts) {
      if (receipt.companyId !== dto.companyId || receipt.merchantId !== dto.merchantId.trim()) {
        throw new BadRequestException('All receipts must belong to the same company and merchant.');
      }
      if (receipt.settlementStatus === 'settled') {
        throw new BadRequestException('A settled receipt cannot be added to a new settlement batch.');
      }
    }

    const existingLinks = await this.wechatSettlementReceiptLinkRepository.find({
      where: { paymentReceiptId: In(receiptIds) },
    });
    if (existingLinks.length) {
      throw new BadRequestException('Some receipts are already bound to another settlement batch.');
    }

    const merchant = await this.findMerchantByCompanyAndMerchantId(dto.companyId, dto.merchantId.trim());
    const bankAccountRegistryId =
      dto.bankAccountRegistryId ?? merchant?.settlementBankAccountRegistryId ?? null;

    if (bankAccountRegistryId) {
      await this.assertBankAccountExists(bankAccountRegistryId);
    }

    const grossAmount = normalizeMoney(
      receipts.reduce((sum, item) => sum + Number(item.amountPaid), 0),
    );
    const feeAmount = normalizeMoney(dto.feeAmount ?? '0');
    const netAmount = normalizeMoney(Number(grossAmount) - Number(feeAmount));

    const batch = await this.wechatSettlementBatchRepository.save(
      this.wechatSettlementBatchRepository.create({
        companyId: dto.companyId,
        merchantId: dto.merchantId.trim(),
        settlementDate: normalizeDateOnly(dto.settlementDate),
        batchNo: dto.batchNo?.trim() || null,
        grossAmount,
        feeAmount,
        netAmount,
        receiptCount: receipts.length,
        bankAccountRegistryId,
        bankSmsTransactionId: null,
        matchStatus: 'pending_bank_match',
        sourceType: 'manual_import',
        rawPayload: dto.rawPayload ?? null,
      }),
    );

    await this.wechatSettlementReceiptLinkRepository.save(
      receipts.map((receipt) =>
        this.wechatSettlementReceiptLinkRepository.create({
          settlementBatchId: batch.id,
          paymentReceiptId: receipt.id,
          amount: receipt.amountPaid,
        }),
      ),
    );

    for (const receipt of receipts) {
      receipt.settlementStatus = 'batched';
    }
    await this.wechatPaymentReceiptRepository.save(receipts);

    await this.operationLogsService.create({
      module: 'finance_wechat',
      targetId: batch.id,
      action: OperationLogAction.CREATE_WECHAT_SETTLEMENT_BATCH,
      operatorId: currentUser.id,
      detail: `Created WeChat settlement batch ${batch.batchNo ?? `#${batch.id}`}`,
      detailJson: {
        companyId: batch.companyId,
        merchantId: batch.merchantId,
        receiptCount: batch.receiptCount,
        netAmount: batch.netAmount,
      },
    });

    return this.findSettlementBatch(batch.id, currentUser);
  }

  async findBankMatchCandidates(input: {
    companyId: number;
    bankName: string;
    accountTail: string;
    amount: string;
  }) {
    const batches = await this.wechatSettlementBatchRepository.find({
      where: {
        companyId: input.companyId,
        matchStatus: In(['pending_bank_match', 'suggested']) as any,
      },
      order: {
        settlementDate: 'DESC',
        id: 'DESC',
      },
      take: 30,
    });

    const bankAccountIds = [...new Set(batches.map((item) => item.bankAccountRegistryId).filter(Boolean))] as number[];
    const bankAccounts = bankAccountIds.length
      ? await this.bankAccountRegistryRepository.find({
          where: { id: In(bankAccountIds) },
        })
      : [];
    const bankAccountsById = new Map(bankAccounts.map((item) => [item.id, item]));
    const merchants = await this.wechatMerchantRegistryRepository.find({
      where: {
        companyId: input.companyId,
        merchantId: In([...new Set(batches.map((item) => item.merchantId))]),
      },
    });
    const merchantsByKey = new Map(
      merchants.map((item) => [`${item.companyId}:${item.merchantId}`, item]),
    );

    return batches
      .filter((item) => Number(item.netAmount) === Number(normalizeMoney(input.amount)))
      .filter((item) => {
        if (!item.bankAccountRegistryId) {
          return true;
        }

        const registry = bankAccountsById.get(item.bankAccountRegistryId);
        return Boolean(
          registry &&
            registry.bankName === input.bankName &&
            registry.accountTail === input.accountTail,
        );
      })
      .map((item) => {
        const merchant = merchantsByKey.get(`${item.companyId}:${item.merchantId}`);
        return {
          id: item.id,
          merchantId: item.merchantId,
          merchantName: merchant?.merchantName ?? null,
          batchNo: item.batchNo,
          netAmount: item.netAmount,
          settlementDate: item.settlementDate,
          bankAccountRegistryId: item.bankAccountRegistryId,
          matchStatus: item.matchStatus,
          alreadyMatched:
            item.matchStatus === 'confirmed' &&
            item.bankSmsTransactionId !== null,
        };
      });
  }

  async markSuggestedBankMatch(
    batchId: number,
    lockedTransaction: BankSmsTransaction,
    manager: EntityManager,
  ): Promise<WechatSettlementBatch> {
    this.financeSafetyService.assertAutoReconciliationEnabled('wechat_settlement_bank_match_suggestion');
    if (!manager) {
      throw new BadRequestException(
        'markSuggestedBankMatch requires a transaction manager; no fallback repository is allowed.',
      );
    }
    const batchRepository = manager.getRepository(WechatSettlementBatch);
    const batch = await batchRepository.findOne({
      where: { id: batchId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!batch) {
      throw new NotFoundException('The WeChat settlement batch does not exist.');
    }
    if (batch.matchStatus === 'confirmed') {
      throw new BadRequestException(
        '[wechat_bank_match_suggestion_forbidden] 已确认的结算批次禁止降级或重建建议',
      );
    }
    if (batch.bankAccountRegistryId == null) {
      throw new BadRequestException('The WeChat settlement batch is missing its bank account registry.');
    }
    const registry = await manager.getRepository(BankAccountRegistry).findOne({
      where: { id: batch.bankAccountRegistryId },
      relations: { formalReviewAuthority: true },
      lock: { mode: 'pessimistic_read' },
    });
    if (!registry) {
      throw new BadRequestException('The WeChat settlement batch bank account registry does not exist.');
    }

    if (batch.matchStatus === 'pending_bank_match' || batch.matchStatus === 'exception') {
      const nextVersion = batch.bankMatchSuggestionVersion + 1;
      if (
        !Number.isSafeInteger(nextVersion) ||
        nextVersion < 1 ||
        nextVersion > 4294967295
      ) {
        throw new ConflictException('[wechat_bank_match_suggestion_version_invalid] 建议版本号无效');
      }
      const hash = this.computeWechatBankMatchSuggestionHash(
        this.buildWechatBankMatchSuggestionFacts(batch, lockedTransaction, registry, nextVersion),
      );
      batch.bankSmsTransactionId = lockedTransaction.id;
      batch.bankMatchSuggestionVersion = nextVersion;
      batch.bankMatchSuggestionBankSmsTransactionId = lockedTransaction.id;
      batch.bankMatchSuggestionRegistryId = registry.id;
      batch.bankMatchSuggestionRegistryUpdatedAt = registry.updatedAt;
      batch.bankMatchSuggestionSnapshotHash = hash;
      batch.bankMatchSuggestedAt = new Date();
      batch.matchStatus = 'suggested';
      return batchRepository.save(batch);
    }

    // Already suggested: exact idempotency or rebind-forbidden.
    const anchor = {
      bankMatchSuggestionVersion: batch.bankMatchSuggestionVersion,
      bankMatchSuggestionBankSmsTransactionId: batch.bankMatchSuggestionBankSmsTransactionId,
      bankMatchSuggestionRegistryId: batch.bankMatchSuggestionRegistryId,
      bankMatchSuggestionRegistryUpdatedAt: batch.bankMatchSuggestionRegistryUpdatedAt,
      bankMatchSuggestionSnapshotHash: batch.bankMatchSuggestionSnapshotHash,
    };
    const problems = collectWechatBankMatchSuggestionAnchorProblems(anchor);
    if (problems.length) {
      throw new ConflictException(`[wechat_bank_match_suggestion_anchor_drift] ${problems.join(',')}`);
    }
    if (!(batch.bankMatchSuggestedAt instanceof Date) || Number.isNaN(batch.bankMatchSuggestedAt.getTime())) {
      throw new ConflictException('[wechat_bank_match_suggestion_anchor_drift] 建议时间戳无效');
    }
    if (
      batch.bankSmsTransactionId !== lockedTransaction.id ||
      batch.bankMatchSuggestionBankSmsTransactionId !== lockedTransaction.id
    ) {
      throw new ConflictException(
        '[wechat_bank_match_suggestion_rebind_forbidden] 结算批次已绑定其它银行短信，禁止覆盖',
      );
    }
    if (batch.bankMatchSuggestionRegistryId !== registry.id) {
      throw new ConflictException(
        '[wechat_bank_match_suggestion_rebind_forbidden] 结算批次银行账户权威已变更，禁止覆盖',
      );
    }
    if (batch.bankMatchSuggestionRegistryUpdatedAt!.getTime() !== registry.updatedAt.getTime()) {
      throw new ConflictException(
        '[wechat_bank_match_suggestion_rebind_forbidden] 银行账户权威版本已变更，禁止覆盖',
      );
    }
    const recomputed = this.computeWechatBankMatchSuggestionHash(
      this.buildWechatBankMatchSuggestionFacts(
        batch,
        lockedTransaction,
        registry,
        batch.bankMatchSuggestionVersion,
      ),
    );
    if (recomputed !== batch.bankMatchSuggestionSnapshotHash) {
      throw new ConflictException(
        '[wechat_bank_match_suggestion_rebind_forbidden] 建议快照已漂移，禁止覆盖',
      );
    }
    return batch;
  }

  async validateSuggestedBankMatch(
    batchId: number,
    lockedTransaction: BankSmsTransaction,
    manager: EntityManager,
  ): Promise<{ batch: WechatSettlementBatch; registry: BankAccountRegistry }> {
    if (!manager) {
      throw new BadRequestException(
        'validateSuggestedBankMatch requires a transaction manager; no fallback repository is allowed.',
      );
    }
    const batchRepository = manager.getRepository(WechatSettlementBatch);
    const batch = await batchRepository.findOne({
      where: { id: batchId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!batch) {
      throw new NotFoundException('The WeChat settlement batch does not exist.');
    }
    if (batch.matchStatus !== 'suggested') {
      throw new BadRequestException('The WeChat settlement batch is not in suggested status.');
    }
    if (batch.bankAccountRegistryId == null) {
      throw new BadRequestException('The WeChat settlement batch is missing its bank account registry.');
    }
    const registry = await manager.getRepository(BankAccountRegistry).findOne({
      where: { id: batch.bankAccountRegistryId },
      relations: { formalReviewAuthority: true },
      lock: { mode: 'pessimistic_read' },
    });
    if (!registry) {
      throw new BadRequestException('The WeChat settlement batch bank account registry does not exist.');
    }
    if (batch.bankSmsTransactionId !== lockedTransaction.id) {
      throw new BadRequestException('The WeChat settlement batch is not bound to this bank SMS as suggested.');
    }
    const anchor = {
      bankMatchSuggestionVersion: batch.bankMatchSuggestionVersion,
      bankMatchSuggestionBankSmsTransactionId: batch.bankMatchSuggestionBankSmsTransactionId,
      bankMatchSuggestionRegistryId: batch.bankMatchSuggestionRegistryId,
      bankMatchSuggestionRegistryUpdatedAt: batch.bankMatchSuggestionRegistryUpdatedAt,
      bankMatchSuggestionSnapshotHash: batch.bankMatchSuggestionSnapshotHash,
    };
    const problems = collectWechatBankMatchSuggestionAnchorProblems(anchor);
    if (problems.length) {
      throw new ConflictException(`[wechat_bank_match_suggestion_anchor_drift] ${problems.join(',')}`);
    }
    if (batch.bankMatchSuggestionBankSmsTransactionId !== lockedTransaction.id) {
      throw new BadRequestException('The WeChat settlement batch suggestion anchor bank SMS drift.');
    }
    if (batch.bankMatchSuggestionRegistryId !== registry.id || batch.bankAccountRegistryId !== registry.id) {
      throw new BadRequestException('The WeChat settlement batch suggestion registry drift.');
    }
    if (batch.bankMatchSuggestionRegistryUpdatedAt!.getTime() !== registry.updatedAt.getTime()) {
      throw new BadRequestException('The WeChat settlement batch suggestion registry updatedAt drift.');
    }
    if (!(batch.bankMatchSuggestedAt instanceof Date) || Number.isNaN(batch.bankMatchSuggestedAt.getTime())) {
      throw new BadRequestException('The WeChat settlement batch suggestion suggestedAt invalid.');
    }
    const recomputed = this.computeWechatBankMatchSuggestionHash(
      this.buildWechatBankMatchSuggestionFacts(
        batch,
        lockedTransaction,
        registry,
        batch.bankMatchSuggestionVersion,
      ),
    );
    if (recomputed !== batch.bankMatchSuggestionSnapshotHash) {
      throw new BadRequestException('The WeChat settlement batch suggestion snapshot hash drift.');
    }
    return { batch, registry };
  }

  async confirmBankMatch(
    batchId: number,
    lockedTransaction: BankSmsTransaction,
    manager: EntityManager,
  ): Promise<WechatSettlementBatch> {
    this.financeSafetyService.assertAutoReconciliationEnabled('wechat_settlement_bank_match_confirm');
    this.financeSafetyService.assertVirtualAccountMutationEnabled(
      'wechat_settlement_bank_match_confirm_virtual_balance_projection',
    );
    if (!manager) {
      throw new BadRequestException(
        'confirmBankMatch requires a transaction manager; no fallback repository is allowed.',
      );
    }
    const { batch } = await this.validateSuggestedBankMatch(batchId, lockedTransaction, manager);
    batch.matchStatus = 'confirmed';
    await manager.getRepository(WechatSettlementBatch).save(batch);

    const linkRepository = manager.getRepository(WechatSettlementReceiptLink);
    const receiptRepository = manager.getRepository(WechatPaymentReceipt);
    const links = await linkRepository.find({
      where: { settlementBatchId: batch.id },
    });
    const receiptIds = links.map((item) => item.paymentReceiptId);
    if (receiptIds.length) {
      const receipts = await receiptRepository.find({
        where: { id: In(receiptIds) },
      });
      for (const receipt of receipts) {
        receipt.settlementStatus = 'settled';
      }
      await receiptRepository.save(receipts);
    }

    return batch;
  }

  private buildWechatBankMatchSuggestionFacts(
    batch: WechatSettlementBatch,
    lockedTransaction: BankSmsTransaction,
    registry: BankAccountRegistry,
    suggestionVersion: number,
  ): WechatBankMatchSuggestionFacts {
    if (lockedTransaction.companyId == null) {
      throw new BadRequestException('The bank SMS transaction is missing its company.');
    }
    if (batch.bankAccountRegistryId == null) {
      throw new BadRequestException('The WeChat settlement batch is missing its bank account registry.');
    }
    return {
      batch: {
        id: batch.id,
        companyId: batch.companyId,
        merchantId: batch.merchantId,
        settlementDate: batch.settlementDate,
        batchNo: batch.batchNo,
        netAmount: batch.netAmount,
        bankAccountRegistryId: batch.bankAccountRegistryId,
      },
      bank: {
        id: lockedTransaction.id,
        companyId: lockedTransaction.companyId,
        bankName: lockedTransaction.bankName,
        sender: lockedTransaction.sender,
        accountTail: lockedTransaction.accountTail,
        amount: lockedTransaction.amount,
        fingerprint: lockedTransaction.fingerprint,
        parserPolicyVersion: lockedTransaction.parserPolicyVersion,
        promotionPolicyVersion: lockedTransaction.promotionPolicyVersion,
        promotionAdmissionKey: lockedTransaction.promotionAdmissionKey,
        promotionEvidenceFingerprint: lockedTransaction.promotionEvidenceFingerprint,
        promotionDecisionFingerprint: lockedTransaction.promotionDecisionFingerprint,
      },
      registry,
      suggestionVersion,
    };
  }

  /**
   * Single wrapper converting the pure-contract plain Error into a 4xx
   * ConflictException so a source drift / ineligibility never surfaces as a 500.
   */
  private computeWechatBankMatchSuggestionHash(facts: WechatBankMatchSuggestionFacts): string {
    try {
      return hashWechatBankMatchSuggestion(facts);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ConflictException(`[wechat_bank_match_suggestion_source_invalid] ${message}`);
    }
  }

  private async buildMerchantView(item: WechatMerchantRegistry) {
    const settlementBankAccount = item.settlementBankAccountRegistryId
      ? await this.bankAccountRegistryRepository.findOne({
          where: { id: item.settlementBankAccountRegistryId },
        })
      : null;

    return {
      id: item.id,
      companyId: item.companyId,
      merchantId: item.merchantId,
      appId: item.appId,
      merchantName: item.merchantName,
      settlementBankAccountRegistryId: item.settlementBankAccountRegistryId,
      settlementBankAccount:
        settlementBankAccount === null
          ? null
          : {
              id: settlementBankAccount.id,
              bankName: settlementBankAccount.bankName,
              accountTail: settlementBankAccount.accountTail,
              accountAlias: settlementBankAccount.accountAlias,
            },
      status: item.status,
      createdAt: item.createdAt.toISOString(),
    };
  }

  private async buildPaymentReceiptListView(receipt: WechatPaymentReceipt) {
    const merchant = await this.findMerchantByCompanyAndMerchantId(receipt.companyId, receipt.merchantId);
    const workOrder = receipt.workOrderId
      ? await this.workOrderRepository.findOne({ where: { id: receipt.workOrderId } })
      : null;
    const settlementLink = await this.wechatSettlementReceiptLinkRepository.findOne({
      where: { paymentReceiptId: receipt.id },
    });

    return {
      ...this.buildPaymentReceiptBase(receipt, merchant, workOrder),
      settlementBatchId: settlementLink?.settlementBatchId ?? null,
    };
  }

  private buildPaymentReceiptBase(
    receipt: WechatPaymentReceipt,
    merchant: WechatMerchantRegistry | null,
    workOrder: WorkOrder | null,
  ) {
    return {
      id: receipt.id,
      companyId: receipt.companyId,
      merchantId: receipt.merchantId,
      merchantName: merchant?.merchantName ?? null,
      workOrderId: receipt.workOrderId,
      workOrderNo: workOrder?.workOrderNo ?? null,
      outTradeNo: receipt.outTradeNo,
      transactionId: receipt.transactionId,
      payerRef: receipt.payerRef,
      amountPaid: receipt.amountPaid,
      paidAt: receipt.paidAt.toISOString(),
      paymentStatus: receipt.paymentStatus,
      settlementStatus: receipt.settlementStatus,
      sourceType: receipt.sourceType,
      thirdPartyClearingStage:
        receipt.paymentStatus === 'paid_confirmed' ? 'third_party_clearing_wechat' : 'not_clearing',
      workOrderPaymentConfirmationStatus:
        receipt.workOrderId && receipt.paymentStatus === 'paid_confirmed'
          ? 'paid_confirmed'
          : null,
      createdAt: receipt.createdAt.toISOString(),
    };
  }

  private async buildSettlementBatchListView(batch: WechatSettlementBatch) {
    const merchant = await this.findMerchantByCompanyAndMerchantId(batch.companyId, batch.merchantId);
    const settlementBankAccount = batch.bankAccountRegistryId
      ? await this.bankAccountRegistryRepository.findOne({
          where: { id: batch.bankAccountRegistryId },
        })
      : null;
    const bankSmsTransaction = batch.bankSmsTransactionId
      ? await this.bankSmsTransactionRepository.findOne({
          where: { id: batch.bankSmsTransactionId },
        })
      : null;

    return {
      id: batch.id,
      companyId: batch.companyId,
      merchantId: batch.merchantId,
      merchantName: merchant?.merchantName ?? null,
      settlementDate: batch.settlementDate,
      batchNo: batch.batchNo,
      grossAmount: batch.grossAmount,
      feeAmount: batch.feeAmount,
      netAmount: batch.netAmount,
      receiptCount: batch.receiptCount,
      bankAccountRegistryId: batch.bankAccountRegistryId,
      settlementBankAccount:
        settlementBankAccount === null
          ? null
          : {
              id: settlementBankAccount.id,
              bankName: settlementBankAccount.bankName,
              accountTail: settlementBankAccount.accountTail,
              accountAlias: settlementBankAccount.accountAlias,
            },
      bankSmsTransactionId: batch.bankSmsTransactionId,
      linkedBankSms:
        bankSmsTransaction === null
          ? null
          : {
              id: bankSmsTransaction.id,
              amount: bankSmsTransaction.amount,
              balanceAfter: bankSmsTransaction.balanceAfter,
              smsReceivedAt: bankSmsTransaction.smsReceivedAt.toISOString(),
              reconcileStatus: bankSmsTransaction.reconcileStatus,
            },
      matchStatus: batch.matchStatus,
      sourceType: batch.sourceType,
      createdAt: batch.createdAt.toISOString(),
    };
  }

  private async findMerchantByCompanyAndMerchantId(companyId: number, merchantId: string) {
    return this.wechatMerchantRegistryRepository.findOne({
      where: {
        companyId,
        merchantId,
      },
    });
  }

  private async assertBankAccountExists(id: number) {
    const bankAccount = await this.bankAccountRegistryRepository.findOne({
      where: { id },
    });
    if (!bankAccount) {
      throw new NotFoundException('The settlement bank account binding does not exist.');
    }
  }

  private assertReadable(currentUser: CurrentUser) {
    if (
      currentUser.roleCodes.some((roleCode) =>
        READ_ROLES.includes(roleCode as (typeof READ_ROLES)[number]),
      )
    ) {
      return;
    }

    throw new ForbiddenException('The current role cannot view WeChat finance data.');
  }

  private assertWritable(currentUser: CurrentUser) {
    if (
      currentUser.roleCodes.some((roleCode) =>
        WRITE_ROLES.includes(roleCode as (typeof WRITE_ROLES)[number]),
      )
    ) {
      return;
    }

    throw new ForbiddenException('The current role cannot maintain WeChat finance data.');
  }
}
