import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { FinanceBankSmsService } from '../finance-bank-sms/finance-bank-sms.service';

export const OWNER_COMMAND_CENTER_CONTRACT_VERSION =
  'owner_command_center_safe_summary_v1' as const;

const FINANCE_EVIDENCE_NOTICE =
  '当前数字属于集团银行短信对账证据层，只表达银行侧发生额、最新余额证据与待对账状态，不等同于经营收入、经营支出、利润、现金安全或正式账实差额。';

@Injectable()
export class OwnerCommandCenterSummaryService {
  constructor(private readonly financeBankSmsService: FinanceBankSmsService) {}

  async getSummary(currentUser: CurrentUser) {
    const overview = await this.financeBankSmsService.getOverview(currentUser);
    const cards = overview?.views?.group?.cards;

    if (!cards) {
      throw new ServiceUnavailableException(
        'owner_command_center_finance_evidence_unavailable',
      );
    }

    const generatedAt = new Date().toISOString();

    return {
      contractVersion: OWNER_COMMAND_CENTER_CONTRACT_VERSION,
      generatedAt,
      readOnly: true,
      safeSummaryOnly: true,
      noExecution: true,
      permissionScope: 'owner_or_system_admin_readonly',
      redactionReport: {
        rawSmsIncluded: false,
        verificationCodesIncluded: false,
        fullPhoneIncluded: false,
        fullBankAccountIncluded: false,
        accountTailsIncluded: false,
        namesIncluded: false,
        counterpartiesIncluded: false,
        companyIdsIncluded: false,
        rawRowsIncluded: false,
        secretsIncluded: false,
      },
      safetyCounters: {
        databaseWriteCounter: 0,
        businessWriteCounter: 0,
        businessExecutionCounter: 0,
        confirmApplyCounter: 0,
        statusMutationCounter: 0,
        bankSmsConfirmationCounter: 0,
        collectionOrPaymentCreationCounter: 0,
        workOrderMutationCounter: 0,
        inventoryMutationCounter: 0,
        approvalMutationCounter: 0,
        virtualLedgerMutationCounter: 0,
        dispatchCounter: 0,
        taskCreationCounter: 0,
        lifecycleMutationCounter: 0,
        payrollBenefitCustomerRightCounter: 0,
        realWechatPayCounter: 0,
      },
      sections: {
        financeEvidence: {
          status: 'available' as const,
          dataMode: 'live' as const,
          finality: 'reconciliation_evidence' as const,
          source: 'finance_bank_sms_group_overview' as const,
          scope: 'group' as const,
          asOf: generatedAt,
          notice: FINANCE_EVIDENCE_NOTICE,
          metrics: {
            todayBankIncome: this.requireFiniteNumber(
              cards.todayBankIncome,
              'todayBankIncome',
            ),
            todayBankExpense: this.requireFiniteNumber(
              cards.todayBankExpense,
              'todayBankExpense',
            ),
            internalTransferNet: this.requireFiniteNumber(
              cards.internalTransferNet,
              'internalTransferNet',
            ),
            pendingCount: this.requireNonNegativeInteger(
              cards.pendingCount,
              'pendingCount',
            ),
            pendingBindingCount: this.requireNonNegativeInteger(
              cards.pendingBindingCount,
              'pendingBindingCount',
            ),
            currentBankBalance: this.requireFiniteNumber(
              cards.currentBankBalance,
              'currentBankBalance',
            ),
          },
        },
        approvals: {
          status: 'unavailable' as const,
          reason: 'safe_aggregate_not_ready' as const,
        },
        workOrders: {
          status: 'unavailable' as const,
          reason: 'safe_aggregate_not_ready' as const,
        },
        inventory: {
          status: 'unavailable' as const,
          reason: 'safe_aggregate_not_ready' as const,
        },
      },
    };
  }

  private requireFiniteNumber(value: unknown, field: string) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
      throw new ServiceUnavailableException(
        `owner_command_center_invalid_metric:${field}`,
      );
    }
    return numberValue;
  }

  private requireNonNegativeInteger(value: unknown, field: string) {
    const numberValue = this.requireFiniteNumber(value, field);
    if (!Number.isInteger(numberValue) || numberValue < 0) {
      throw new ServiceUnavailableException(
        `owner_command_center_invalid_count:${field}`,
      );
    }
    return numberValue;
  }
}
