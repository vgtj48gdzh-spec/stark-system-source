import { createHash } from 'node:crypto';
import { assertPositiveCents } from '../../common/utils/decimal.util';
import {
  bankAccountRegistryIdentityMatches,
  bankAccountRegistrySourceSnapshot,
  isBankAccountRegistryFormallyEligible,
  type BankAccountRegistryFormalSnapshot,
  type BankAccountRegistryIdentity,
} from '../finance-bank-account/bank-account-registry-authority.contract';
import { isBankSmsTransactionFormallyPromoted } from '../finance-bank-sms/utils/bank-sms-promotion-policy.util';

export const WECHAT_BANK_MATCH_SUGGESTION_MODE = 'wechat_bank_match_suggestion_v1';

const HEX64 = /^[0-9a-f]{64}$/;

/**
 * WeChat settlement-batch bank-match suggestion authority facts. The builder
 * below is the single source of truth for the immutable canonical snapshot that
 * later anchors a suggested (pre-confirm) bank match to the exact settlement
 * batch, bank-SMS transaction and the authoritative bank_account_registry.
 */
export interface WechatBankMatchSuggestionFacts {
  batch: {
    id: number;
    companyId: number;
    merchantId: string;
    settlementDate: string;
    batchNo: string | null;
    netAmount: string;
    bankAccountRegistryId: number;
  };
  bank: {
    id: number;
    companyId: number;
    bankName: string;
    sender: string;
    accountTail: string;
    amount: string;
    fingerprint: string;
    parserPolicyVersion: string | null;
    promotionPolicyVersion: string | null;
    promotionAdmissionKey: string | null;
    promotionEvidenceFingerprint: string | null;
    promotionDecisionFingerprint: string | null;
  };
  registry: BankAccountRegistryFormalSnapshot;
  suggestionVersion: number;
}

/**
 * Canonical, stable, deterministic snapshot for a WeChat bank-match suggestion.
 * It deliberately excludes `suggestedAt` (a lifecycle timestamp) and includes
 * `suggestionVersion` so an identical suggestion recomputes byte-for-byte, while
 * any identity / amount / registry / version drift changes the hash.
 */
export function buildWechatBankMatchSuggestionSnapshot(
  facts: WechatBankMatchSuggestionFacts,
): Record<string, unknown> {
  if (
    !Number.isSafeInteger(facts.suggestionVersion) ||
    facts.suggestionVersion < 1 ||
    facts.suggestionVersion > 4294967295
  ) {
    throw new Error('wechat_bank_match_suggestion_version_invalid');
  }
  if (!Number.isInteger(facts.batch.id) || facts.batch.id <= 0) {
    throw new Error('wechat_bank_match_batch_id_invalid');
  }
  if (!Number.isInteger(facts.bank.id) || facts.bank.id <= 0) {
    throw new Error('wechat_bank_match_bank_id_invalid');
  }

  // Exact integer-cent amounts, never JS floating point.
  const batchNetCents = assertPositiveCents(facts.batch.netAmount, 'batch.netAmount');
  const bankAmountCents = assertPositiveCents(facts.bank.amount, 'bank.amount');
  if (batchNetCents !== bankAmountCents) {
    throw new Error('wechat_bank_match_amount_mismatch');
  }

  // Exact company chain: batch.companyId === bank.companyId === registry.companyId.
  if (facts.batch.companyId !== facts.bank.companyId) {
    throw new Error('wechat_bank_match_batch_bank_company_mismatch');
  }

  // Exact registry identity and ID binding (reuses the shared identity rule).
  const identity: BankAccountRegistryIdentity = {
    companyId: facts.bank.companyId,
    bankName: facts.bank.bankName,
    smsSender: facts.bank.sender,
    accountTail: facts.bank.accountTail,
  };
  if (!bankAccountRegistryIdentityMatches(facts.registry, identity)) {
    throw new Error('wechat_bank_match_registry_identity_mismatch');
  }
  if (facts.batch.bankAccountRegistryId !== facts.registry.id) {
    throw new Error('wechat_bank_match_registry_id_mismatch');
  }
  if (!isBankAccountRegistryFormallyEligible(facts.registry)) {
    throw new Error('wechat_bank_match_registry_not_eligible');
  }

  if (!HEX64.test(facts.bank.fingerprint)) {
    throw new Error('wechat_bank_match_bank_fingerprint_invalid');
  }
  if (!isBankSmsTransactionFormallyPromoted(facts.bank)) {
    throw new Error('wechat_bank_match_promotion_ineligible');
  }

  return {
    object: 'wechat_bank_match_suggestion_authority',
    source_mode: WECHAT_BANK_MATCH_SUGGESTION_MODE,
    suggestionVersion: facts.suggestionVersion,
    batch: {
      id: facts.batch.id,
      companyId: facts.batch.companyId,
      merchantId: facts.batch.merchantId,
      settlementDate: facts.batch.settlementDate,
      batchNo: facts.batch.batchNo ?? null,
      netAmountCents: batchNetCents.toString(),
      bankAccountRegistryId: facts.batch.bankAccountRegistryId,
    },
    bank: {
      id: facts.bank.id,
      companyId: facts.bank.companyId,
      bankName: facts.bank.bankName,
      sender: facts.bank.sender,
      accountTail: facts.bank.accountTail,
      amountCents: bankAmountCents.toString(),
      fingerprint: facts.bank.fingerprint,
      parserPolicyVersion: facts.bank.parserPolicyVersion ?? null,
      promotionPolicyVersion: facts.bank.promotionPolicyVersion ?? null,
      promotionAdmissionKey: facts.bank.promotionAdmissionKey ?? null,
      promotionEvidenceFingerprint: facts.bank.promotionEvidenceFingerprint ?? null,
      promotionDecisionFingerprint: facts.bank.promotionDecisionFingerprint ?? null,
    },
    registry: bankAccountRegistrySourceSnapshot(facts.registry),
  };
}

export function hashWechatBankMatchSuggestion(facts: WechatBankMatchSuggestionFacts): string {
  return createHash('sha256')
    .update(stableStringify(buildWechatBankMatchSuggestionSnapshot(facts)))
    .digest('hex');
}

/**
 * The persisted suggestion anchor carried on the WeChat settlement batch row.
 */
export interface WechatBankMatchSuggestionAnchor {
  bankMatchSuggestionVersion: number;
  bankMatchSuggestionBankSmsTransactionId: number | null;
  bankMatchSuggestionRegistryId: number | null;
  bankMatchSuggestionRegistryUpdatedAt: Date | null;
  bankMatchSuggestionSnapshotHash: string | null;
}

/**
 * Validate an already-persisted suggestion anchor. Used on replay / preview to
 * fail closed when the anchor is structurally incomplete or malformed.
 */
export function collectWechatBankMatchSuggestionAnchorProblems(
  anchor: WechatBankMatchSuggestionAnchor,
): string[] {
  const problems: string[] = [];
  if (
    !Number.isSafeInteger(anchor.bankMatchSuggestionVersion) ||
    anchor.bankMatchSuggestionVersion < 1 ||
    anchor.bankMatchSuggestionVersion > 4294967295
  ) {
    problems.push('wechat_bank_match_suggestion_version_invalid');
  }
  if (
    !Number.isInteger(anchor.bankMatchSuggestionBankSmsTransactionId) ||
    Number(anchor.bankMatchSuggestionBankSmsTransactionId) <= 0
  ) {
    problems.push('wechat_bank_match_suggestion_bank_sms_transaction_id_invalid');
  }
  if (
    !Number.isInteger(anchor.bankMatchSuggestionRegistryId) ||
    Number(anchor.bankMatchSuggestionRegistryId) <= 0
  ) {
    problems.push('wechat_bank_match_suggestion_registry_id_invalid');
  }
  if (
    !(anchor.bankMatchSuggestionRegistryUpdatedAt instanceof Date) ||
    Number.isNaN(anchor.bankMatchSuggestionRegistryUpdatedAt.getTime())
  ) {
    problems.push('wechat_bank_match_suggestion_registry_updated_at_invalid');
  }
  if (!HEX64.test(anchor.bankMatchSuggestionSnapshotHash ?? '')) {
    problems.push('wechat_bank_match_suggestion_snapshot_hash_invalid');
  }
  return problems;
}

export function isWechatBankMatchSuggestionAnchorComplete(
  anchor: WechatBankMatchSuggestionAnchor,
): boolean {
  return collectWechatBankMatchSuggestionAnchorProblems(anchor).length === 0;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
