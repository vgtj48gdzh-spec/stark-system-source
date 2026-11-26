import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { BankAccountRegistry } from '../finance-bank-account/entities/bank-account-registry.entity';
import { BankSmsTransaction } from '../finance-bank-sms/entities/bank-sms-transaction.entity';
import { FinanceSafetyService } from '../finance-safety/finance-safety.service';
import { normalizeBankSmsPartyName } from '../finance-bank-sms/utils/boc-bank-sms.util';
import {
  FINANCE_INTERNAL_FUND_FLOW_TYPES,
  FinanceInternalFundFlow,
  type FinanceInternalFundFlowType,
} from './entities/finance-internal-fund-flow.entity';

type BankSmsDirection = 'income' | 'expense';

const FLOW_DIRECTION_BY_TYPE: Record<FinanceInternalFundFlowType, BankSmsDirection> = {
  loan_interest_expense: 'expense',
  internal_transfer_in: 'income',
  internal_transfer_out: 'expense',
  loan_in: 'income',
  loan_out: 'expense',
  repayment_in: 'income',
  repayment_out: 'expense',
};

function normalizeMoney(value?: string | number | null) {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) {
    throw new BadRequestException('Invalid amount format.');
  }

  return numericValue.toFixed(2);
}

function normalizeBusinessDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Invalid business date format.');
  }

  return date.toISOString().slice(0, 10);
}

function assertSupportedFlowType(value: FinanceInternalFundFlowType) {
  if (!FINANCE_INTERNAL_FUND_FLOW_TYPES.includes(value)) {
    throw new BadRequestException('Unsupported internal fund flow type.');
  }
}

function resolveCandidateFlowTypes(candidateType?: string | null): FinanceInternalFundFlowType[] {
  if (candidateType === 'loan_interest_candidate') {
    return ['loan_interest_expense'];
  }

  return [];
}

@Injectable()
export class FinanceInternalFundFlowService {
  constructor(
    @InjectRepository(FinanceInternalFundFlow)
    private readonly financeInternalFundFlowRepository: Repository<FinanceInternalFundFlow>,
    @InjectRepository(BankAccountRegistry)
    private readonly bankAccountRegistryRepository: Repository<BankAccountRegistry>,
    private readonly financeSafetyService: FinanceSafetyService,
  ) {}

  async createApprovedInternalFundFlow(
    input: {
      companyId: number;
      bankAccountRegistryId: number;
      flowType: FinanceInternalFundFlowType;
      amount: string | number;
      businessDate: Date | string;
      counterpartyName?: string | null;
      evidenceNote?: string | null;
      operatorId?: number | null;
    },
    manager?: EntityManager,
  ) {
    this.financeSafetyService.assertFinanceFundFlowWriteEnabled(
      'finance_internal_fund_flow_create_approved',
    );
    assertSupportedFlowType(input.flowType);
    const repository = manager
      ? manager.getRepository(FinanceInternalFundFlow)
      : this.financeInternalFundFlowRepository;

    const normalizedAmount = normalizeMoney(input.amount);
    const normalizedBusinessDate = normalizeBusinessDate(input.businessDate);
    const normalizedCounterpartyName = normalizeBankSmsPartyName(input.counterpartyName);

    const where: Record<string, unknown> = {
      companyId: input.companyId,
      bankAccountRegistryId: input.bankAccountRegistryId,
      flowType: input.flowType,
      amount: normalizedAmount,
      businessDate: normalizedBusinessDate,
      currentStatus: In(['approved', 'confirmed']),
    };
    if (normalizedCounterpartyName) {
      where.normalizedCounterpartyName = normalizedCounterpartyName;
    }

    const existing = await repository.findOne({
      where,
      order: {
        id: 'DESC',
      },
    });
    if (existing) {
      return existing;
    }

    const operatorId = input.operatorId ?? null;
    const flow = repository.create({
      companyId: input.companyId,
      bankAccountRegistryId: input.bankAccountRegistryId,
      flowType: input.flowType,
      currentStatus: 'approved',
      amount: normalizedAmount,
      businessDate: normalizedBusinessDate,
      counterpartyName: input.counterpartyName?.trim() || null,
      normalizedCounterpartyName: normalizedCounterpartyName || null,
      evidenceNote: input.evidenceNote?.trim() || null,
      linkedBankSmsTransactionId: null,
      createdBy: operatorId,
      approvedBy: operatorId,
      approvedAt: new Date(),
      confirmedBy: null,
      confirmedAt: null,
    });

    return repository.save(flow);
  }

  async createApprovedLoanInterestExpense(
    input: {
      companyId: number;
      bankAccountRegistryId: number;
      amount: string | number;
      businessDate: Date | string;
      counterpartyName?: string | null;
      evidenceNote?: string | null;
      operatorId?: number | null;
    },
    manager?: EntityManager,
  ) {
    return this.createApprovedInternalFundFlow(
      {
        ...input,
        flowType: 'loan_interest_expense',
      },
      manager,
    );
  }

  async findApprovedBankMatchCandidates(input: {
    companyId: number;
    accountTail: string;
    direction?: BankSmsDirection;
    amount: string | number;
    bankBusinessDate: Date | null;
    counterpartyName?: string | null;
    businessCandidateType?: string | null;
  }) {
    const flowTypes = resolveCandidateFlowTypes(input.businessCandidateType);
    if (!flowTypes.length) {
      return [];
    }

    const normalizedAmount = normalizeMoney(input.amount);
    const normalizedBusinessDate = input.bankBusinessDate
      ? normalizeBusinessDate(input.bankBusinessDate)
      : null;
    const normalizedCounterpartyName = normalizeBankSmsPartyName(input.counterpartyName);

    const candidates = await this.financeInternalFundFlowRepository.find({
      where: {
        companyId: input.companyId,
        flowType: In(flowTypes),
        currentStatus: 'approved',
      },
      relations: {
        bankAccountRegistry: true,
      },
      order: {
        approvedAt: 'DESC',
        id: 'DESC',
      },
      take: 20,
    });

    return candidates.filter((item) => {
      if (input.direction && FLOW_DIRECTION_BY_TYPE[item.flowType] !== input.direction) {
        return false;
      }
      if (item.bankAccountRegistry.accountTail !== input.accountTail) {
        return false;
      }
      if (item.amount !== normalizedAmount) {
        return false;
      }
      if (normalizedBusinessDate && item.businessDate !== normalizedBusinessDate) {
        return false;
      }
      if (normalizedCounterpartyName && item.normalizedCounterpartyName !== normalizedCounterpartyName) {
        return false;
      }
      if (item.linkedBankSmsTransactionId !== null) {
        return false;
      }

      return true;
    });
  }

  async findApprovedLoanInterestExpenseCandidates(input: {
    companyId: number;
    accountTail: string;
    amount: string | number;
    bankBusinessDate: Date | null;
    counterpartyName?: string | null;
    businessCandidateType?: string | null;
  }) {
    return this.findApprovedBankMatchCandidates({
      ...input,
      direction: 'expense',
    });
  }

  async validateConfirmationTarget(
    flowId: number,
    transaction: BankSmsTransaction,
    manager?: EntityManager,
  ) {
    this.financeSafetyService.assertFinanceFundFlowWriteEnabled(
      'finance_internal_fund_flow_confirm_bank_match',
    );
    const repository = manager
      ? manager.getRepository(FinanceInternalFundFlow)
      : this.financeInternalFundFlowRepository;

    const flow = await repository.findOne({
      where: { id: flowId },
      relations: {
        bankAccountRegistry: true,
      },
      ...(manager ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!flow) {
      throw new NotFoundException('Internal fund flow target does not exist.');
    }
    if (flow.currentStatus !== 'approved') {
      throw new BadRequestException('Internal fund flow target is not awaiting confirmation.');
    }
    if (FLOW_DIRECTION_BY_TYPE[flow.flowType] !== transaction.direction) {
      throw new BadRequestException('Internal fund flow direction does not match the bank SMS.');
    }
    if (flow.companyId !== transaction.companyId) {
      throw new BadRequestException('Internal fund flow target does not belong to the same company.');
    }
    if (flow.bankAccountRegistry.accountTail !== transaction.accountTail) {
      throw new BadRequestException('Internal fund flow target does not match the bank account.');
    }
    if (normalizeMoney(flow.amount) !== normalizeMoney(transaction.amount)) {
      throw new BadRequestException('Internal fund flow amount does not match the bank SMS.');
    }
    if (
      flow.linkedBankSmsTransactionId !== null &&
      flow.linkedBankSmsTransactionId !== transaction.id
    ) {
      throw new BadRequestException('Internal fund flow target has already been used by another bank SMS.');
    }

    return flow;
  }

  async validateLoanInterestExpenseConfirmationTarget(
    flowId: number,
    transaction: BankSmsTransaction,
    manager?: EntityManager,
  ) {
    const flow = await this.validateConfirmationTarget(flowId, transaction, manager);
    if (flow.flowType !== 'loan_interest_expense') {
      throw new BadRequestException('Internal fund flow target is not a loan interest expense.');
    }

    return flow;
  }

  async confirmBankMatch(
    flowId: number,
    transaction: BankSmsTransaction,
    operatorId: number,
    manager?: EntityManager,
  ) {
    this.financeSafetyService.assertFinanceFundFlowWriteEnabled(
      'finance_internal_fund_flow_confirm_bank_match',
    );
    const repository = manager
      ? manager.getRepository(FinanceInternalFundFlow)
      : this.financeInternalFundFlowRepository;

    const flow = await this.validateConfirmationTarget(flowId, transaction, manager);
    flow.currentStatus = 'confirmed';
    flow.linkedBankSmsTransactionId = transaction.id;
    flow.confirmedBy = operatorId;
    flow.confirmedAt = new Date();

    return repository.save(flow);
  }

  async confirmLoanInterestExpenseBankMatch(
    flowId: number,
    transaction: BankSmsTransaction,
    operatorId: number,
    manager?: EntityManager,
  ) {
    this.financeSafetyService.assertFinanceFundFlowWriteEnabled(
      'finance_internal_fund_flow_confirm_loan_interest_bank_match',
    );
    const flow = await this.validateLoanInterestExpenseConfirmationTarget(
      flowId,
      transaction,
      manager,
    );
    const repository = manager
      ? manager.getRepository(FinanceInternalFundFlow)
      : this.financeInternalFundFlowRepository;

    flow.currentStatus = 'confirmed';
    flow.linkedBankSmsTransactionId = transaction.id;
    flow.confirmedBy = operatorId;
    flow.confirmedAt = new Date();

    return repository.save(flow);
  }

  async findBankAccountRegistryOrThrow(id: number) {
    const registry = await this.bankAccountRegistryRepository.findOne({
      where: { id },
    });
    if (!registry) {
      throw new NotFoundException('Bank account registry does not exist.');
    }

    return registry;
  }
}
