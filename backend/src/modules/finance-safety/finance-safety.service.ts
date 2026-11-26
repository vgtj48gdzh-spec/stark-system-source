import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BankSmsPromotionWindow } from '../finance-bank-sms/utils/bank-sms-promotion-policy.util';

export type FinanceSafetyFlag =
  | 'BANK_SMS_PROMOTION_ENABLED'
  | 'FINANCE_FUND_FLOW_WRITE_ENABLED'
  | 'VIRTUAL_ACCOUNT_MUTATION_ENABLED'
  | 'AUTO_RECONCILIATION_ENABLED'
  | 'FINANCE_COLLECTION_CONFIRMATION_ENABLED';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'enabled']);

const DEFAULT_ACTION_BY_FLAG: Record<FinanceSafetyFlag, string> = {
  BANK_SMS_PROMOTION_ENABLED: 'bank_sms_promotion',
  FINANCE_FUND_FLOW_WRITE_ENABLED: 'finance_internal_fund_flow_write',
  VIRTUAL_ACCOUNT_MUTATION_ENABLED: 'virtual_account_mutation',
  AUTO_RECONCILIATION_ENABLED: 'auto_reconciliation_or_formal_reconciliation_write',
  FINANCE_COLLECTION_CONFIRMATION_ENABLED: 'finance_collection_confirmation',
};

@Injectable()
export class FinanceSafetyService {
  constructor(private readonly configService: ConfigService) {}

  isEnabled(flag: FinanceSafetyFlag) {
    const value = this.configService.get<string>(flag);
    return TRUE_VALUES.has(String(value ?? '').trim().toLowerCase());
  }

  assertEnabled(flag: FinanceSafetyFlag, action = DEFAULT_ACTION_BY_FLAG[flag]) {
    if (this.isEnabled(flag)) {
      return;
    }

    throw new ForbiddenException({
      code: 'FINANCE_SAFETY_FLAG_DISABLED',
      flag,
      action,
      message: `Finance safety flag ${flag} is disabled for ${action}.`,
    });
  }

  assertBankSmsPromotionEnabled(action = DEFAULT_ACTION_BY_FLAG.BANK_SMS_PROMOTION_ENABLED) {
    this.assertEnabled('BANK_SMS_PROMOTION_ENABLED', action);
  }

  getBankSmsPromotionWindow(): BankSmsPromotionWindow {
    const enabledAtValue = this.configService
      .get<string>('BANK_SMS_PROMOTION_ENABLED_AT')
      ?.trim();
    const enabledAt = enabledAtValue ? new Date(enabledAtValue) : null;
    const cutoffValue = this.configService
      .get<string>('BANK_SMS_PROMOTION_MIN_RAW_SMS_ID_EXCLUSIVE')
      ?.trim();
    const parsedCutoff = cutoffValue ? Number(cutoffValue) : Number.NaN;

    return {
      enabled: this.isEnabled('BANK_SMS_PROMOTION_ENABLED'),
      policyVersion:
        this.configService.get<string>('BANK_SMS_PROMOTION_POLICY_VERSION')?.trim() || null,
      enabledAt: enabledAt && Number.isFinite(enabledAt.getTime()) ? enabledAt : null,
      minRawSmsIdExclusive: Number.isInteger(parsedCutoff) ? parsedCutoff : null,
      allowedGeneration:
        this.configService.get<string>('BANK_SMS_PROMOTION_ALLOWED_GENERATION')?.trim() ||
        null,
    };
  }

  assertFinanceFundFlowWriteEnabled(
    action = DEFAULT_ACTION_BY_FLAG.FINANCE_FUND_FLOW_WRITE_ENABLED,
  ) {
    this.assertEnabled('FINANCE_FUND_FLOW_WRITE_ENABLED', action);
  }

  assertVirtualAccountMutationEnabled(
    action = DEFAULT_ACTION_BY_FLAG.VIRTUAL_ACCOUNT_MUTATION_ENABLED,
  ) {
    this.assertEnabled('VIRTUAL_ACCOUNT_MUTATION_ENABLED', action);
  }

  assertAutoReconciliationEnabled(
    action = DEFAULT_ACTION_BY_FLAG.AUTO_RECONCILIATION_ENABLED,
  ) {
    this.assertEnabled('AUTO_RECONCILIATION_ENABLED', action);
  }

  assertFinanceCollectionConfirmationEnabled(
    action = DEFAULT_ACTION_BY_FLAG.FINANCE_COLLECTION_CONFIRMATION_ENABLED,
  ) {
    this.assertEnabled('FINANCE_COLLECTION_CONFIRMATION_ENABLED', action);
  }
}
