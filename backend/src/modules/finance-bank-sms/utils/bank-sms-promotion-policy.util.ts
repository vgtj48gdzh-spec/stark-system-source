import { createHash } from 'node:crypto';
import {
  bankAccountRegistrySourceSnapshot,
  hashBankAccountRegistrySnapshot,
  isBankAccountRegistryFormallyEligible,
  type BankAccountRegistryFormalSnapshot,
} from '../../finance-bank-account/bank-account-registry-authority.contract';
import {
  BANK_SMS_DURABLE_ADMISSION_POLICY_VERSION,
  BANK_SMS_PARSER_POLICY_VERSION,
  BANK_SMS_PROMOTION_FINGERPRINT_VERSION,
  BANK_SMS_PROMOTION_MIN_HISTORICAL_CUTOFF,
  BANK_SMS_PROMOTION_POLICY_VERSION,
  BANK_SMS_PROMOTION_SUPPORTED_BANK_NAME,
  BANK_SMS_PROMOTION_SUPPORTED_SENDER,
} from './bank-sms-promotion-policy.constants';

export type BankSmsPromotionTargetStatus = 'pending' | 'pending_binding';
export type BankSmsPromotionAdmissionOutcome =
  | 'created_pending'
  | 'created_pending_binding'
  | 'blocked';

export type BankSmsPromotionWindow = {
  enabled: boolean;
  policyVersion: string | null;
  enabledAt: Date | null;
  minRawSmsIdExclusive: number | null;
  allowedGeneration: string | null;
};

export type BankSmsPromotionRegistrySnapshot = BankAccountRegistryFormalSnapshot;

export type BankSmsEvidenceAssessmentInput = {
  eventId: number | null;
  rawSmsId: number;
  classificationId: number;
  classifyType: string;
  parseStatus: string | null;
  parserPolicyVersion: string | null;
  bankName: string | null;
  sender: string;
  accountTail: string | null;
  accountAlias: string | null;
  bankBusinessDate: Date | null;
  smsReceivedAt: Date | null;
  direction: string | null;
  amount: string | null;
  balanceAfter: string | null;
  counterparty: string | null;
  normalizedBody: string | null;
  registries: BankSmsPromotionRegistrySnapshot[];
};

export type BankSmsEvidenceAssessment = {
  evidenceComplete: boolean;
  targetStatusPreview: BankSmsPromotionTargetStatus | null;
  evidenceBlockerCodes: string[];
  parserPolicyVersion: string;
  evidenceFingerprint: string;
  resolvedRegistryId: number | null;
  resolvedRegistryAuthorityId: number | null;
  resolvedRegistryAuthorityHash: string | null;
  resolvedRegistryContentVersion: number | null;
  resolvedRegistrySnapshotHash: string | null;
  resolvedCompanyId: number | null;
  resolvedAccountTail: string | null;
  registryResolution: 'reviewed_unique' | 'pending_binding' | 'unresolved';
};

export type BankSmsPromotionAdmissionInput = {
  window: BankSmsPromotionWindow;
  evidence: BankSmsEvidenceAssessment;
  admissionKey: string | null;
  eventId: number | null;
  rawSmsId: number;
  classificationId: number;
  transactionId?: number | null;
  eventCreatedNow: boolean;
  rawCreatedNow: boolean;
  classificationCreatedNow: boolean;
  deduplicated: boolean;
  ingestSource: string;
  rawMobileSmsEventId: number | null;
  eventReceivedAt: Date;
  eventCreatedAt: Date;
  rawReceivedAt: Date;
  rawCreatedAt: Date;
  classificationCreatedAt: Date;
  evaluatedAt: Date;
  durableAdmission: {
    policyVersion: string | null;
    accepted: boolean;
    generation: string | null;
    enabledAt: Date | null;
    supportedSenderMatched: boolean;
    liveBroadcastMatched: boolean;
    generationMatched: boolean;
    receivedAtWatermarkMatched: boolean;
  };
};

export type BankSmsPromotionAdmissionDecision = {
  eligibleToCreateNow: boolean;
  admissionBlockerCodes: string[];
  promotionPolicyVersion: string;
  decisionFingerprint: string;
  evidence: BankSmsEvidenceAssessment;
};

export type BankSmsPromotionRawEvidence = {
  mobileSmsEventId: number | null;
  simSlot: number | null;
  sender: string;
  body: string;
  receivedAt: Date;
  deviceSmsId: string | null;
  dedupeFingerprint: string | null;
};

const MAX_BANK_BUSINESS_DATE_DISTANCE_MS = 72 * 60 * 60 * 1000;
const NORMALIZED_AMOUNT_PATTERN = /^\d{1,10}\.\d{2}$/;
const NORMALIZED_BALANCE_PATTERN = /^-?\d{1,12}\.\d{2}$/;
const ACCOUNT_TAIL_PATTERN = /^\d{4}$/;
const MAX_COUNTERPARTY_LENGTH = 200;
const MAX_DEVICE_SERVER_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_SERVER_FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_EVENT_RAW_RECEIVED_AT_DRIFT_MS = 1000;
const PROMOTION_HEX64 = /^[0-9a-f]{64}$/;

export interface BankSmsFormalPromotionFields {
  parserPolicyVersion: string | null;
  promotionPolicyVersion: string | null;
  promotionAdmissionKey: string | null;
  promotionEvidenceFingerprint: string | null;
  promotionDecisionFingerprint: string | null;
}

/**
 * Shared formal durable-promotion eligibility predicate. A bank SMS can only be
 * formally promoted (and then used for formal confirmation / WeChat suggestion
 * authority) when its parser policy and promotion policy versions equal the
 * current constants, its admission key and both promotion fingerprints are
 * exactly 64 hex chars. Legacy rows with null fields never satisfy this.
 */
export function isBankSmsTransactionFormallyPromoted(
  tx: BankSmsFormalPromotionFields,
): boolean {
  return (
    tx.parserPolicyVersion === BANK_SMS_PARSER_POLICY_VERSION &&
    tx.promotionPolicyVersion === BANK_SMS_PROMOTION_POLICY_VERSION &&
    PROMOTION_HEX64.test(tx.promotionAdmissionKey ?? '') &&
    PROMOTION_HEX64.test(tx.promotionEvidenceFingerprint ?? '') &&
    PROMOTION_HEX64.test(tx.promotionDecisionFingerprint ?? '')
  );
}

export interface BankSmsPromotionLineageInput {
  transaction: {
    rawSmsId: number;
    parserPolicyVersion: string | null;
    promotionPolicyVersion: string | null;
    promotionAdmissionKey: string | null;
    promotionEvidenceFingerprint: string | null;
    promotionDecisionFingerprint: string | null;
  };
  raw: {
    id: number;
    mobileSmsEventId: number | null;
    classifyStatus: string;
    promotionAdmissionKey: string | null;
    promotionPolicyVersion: string | null;
    promotionEvidenceFingerprint: string | null;
    promotionDecisionFingerprint: string | null;
    promotionAdmissionOutcome: string | null;
    promotionBlockerCodes: string[] | null;
    promotionEvidenceBlockerCodes: string[] | null;
    promotionTargetStatusPreview: string | null;
  };
  classification: {
    rawSmsId: number;
    classifyType: string;
    parserPolicyVersion: string | null;
    evidenceFingerprint: string | null;
  };
}

/**
 * Full immutable promotion lineage recheck used by the WeChat suggestion/confirm
 * path. It verifies the bank SMS transaction, its raw SMS and its classification
 * are mutually consistent AND pinned to the current promotion/parser policy
 * versions with a hex admission key and hex fingerprints. It never trusts the
 * BankSmsTransaction four promotion columns alone.
 */
export function collectBankSmsPromotionLineageProblems(
  lineage: BankSmsPromotionLineageInput,
): string[] {
  const problems: string[] = [];
  if (lineage.transaction.rawSmsId !== lineage.raw.id) {
    problems.push('tx_raw_sms_id_mismatch');
  }
  if (lineage.classification.rawSmsId !== lineage.raw.id) {
    problems.push('classification_raw_sms_id_mismatch');
  }
  if (
    !Number.isInteger(lineage.raw.mobileSmsEventId) ||
    Number(lineage.raw.mobileSmsEventId) <= 0
  ) {
    problems.push('mobile_sms_event_missing');
  }
  if (lineage.raw.classifyStatus !== 'parsed') {
    problems.push('raw_classify_status_not_parsed');
  }
  if (lineage.classification.classifyType !== 'bank_transaction') {
    problems.push('classification_type_not_bank_transaction');
  }
  if (lineage.raw.promotionPolicyVersion !== BANK_SMS_PROMOTION_POLICY_VERSION) {
    problems.push('raw_promotion_policy_version_mismatch');
  }
  if (lineage.transaction.promotionPolicyVersion !== BANK_SMS_PROMOTION_POLICY_VERSION) {
    problems.push('tx_promotion_policy_version_mismatch');
  }
  if (lineage.raw.promotionPolicyVersion !== lineage.transaction.promotionPolicyVersion) {
    problems.push('raw_tx_promotion_policy_version_mismatch');
  }
  if (lineage.transaction.parserPolicyVersion !== BANK_SMS_PARSER_POLICY_VERSION) {
    problems.push('tx_parser_policy_version_mismatch');
  }
  if (lineage.classification.parserPolicyVersion !== BANK_SMS_PARSER_POLICY_VERSION) {
    problems.push('classification_parser_policy_version_mismatch');
  }
  if (lineage.classification.parserPolicyVersion !== lineage.transaction.parserPolicyVersion) {
    problems.push('classification_tx_parser_policy_version_mismatch');
  }
  if (!PROMOTION_HEX64.test(lineage.transaction.promotionAdmissionKey ?? '')) {
    problems.push('tx_admission_key_not_hex');
  }
  if (!PROMOTION_HEX64.test(lineage.raw.promotionAdmissionKey ?? '')) {
    problems.push('raw_admission_key_not_hex');
  }
  if (lineage.raw.promotionAdmissionKey !== lineage.transaction.promotionAdmissionKey) {
    problems.push('raw_tx_admission_key_mismatch');
  }
  if (
    !PROMOTION_HEX64.test(lineage.transaction.promotionEvidenceFingerprint ?? '') ||
    !PROMOTION_HEX64.test(lineage.raw.promotionEvidenceFingerprint ?? '')
  ) {
    problems.push('evidence_hash_not_hex');
  }
  if (lineage.raw.promotionEvidenceFingerprint !== lineage.transaction.promotionEvidenceFingerprint) {
    problems.push('raw_tx_evidence_hash_mismatch');
  }
  if (lineage.raw.promotionEvidenceFingerprint !== lineage.classification.evidenceFingerprint) {
    problems.push('raw_classification_evidence_hash_mismatch');
  }
  if (
    !PROMOTION_HEX64.test(lineage.transaction.promotionDecisionFingerprint ?? '') ||
    !PROMOTION_HEX64.test(lineage.raw.promotionDecisionFingerprint ?? '')
  ) {
    problems.push('decision_hash_not_hex');
  }
  if (lineage.raw.promotionDecisionFingerprint !== lineage.transaction.promotionDecisionFingerprint) {
    problems.push('raw_tx_decision_hash_mismatch');
  }
  if (
    lineage.raw.promotionAdmissionOutcome !== 'created_pending' &&
    lineage.raw.promotionAdmissionOutcome !== 'created_pending_binding'
  ) {
    problems.push('admission_outcome_invalid');
  }
  if ((lineage.raw.promotionBlockerCodes?.length ?? 0) !== 0) {
    problems.push('admission_blockers_nonempty');
  }
  if (
    !Array.isArray(lineage.raw.promotionEvidenceBlockerCodes) ||
    lineage.raw.promotionEvidenceBlockerCodes.length !== 0
  ) {
    problems.push('evidence_blockers_nonempty');
  }
  const outcome = lineage.raw.promotionAdmissionOutcome;
  const preview = lineage.raw.promotionTargetStatusPreview;
  if (
    !(
      (outcome === 'created_pending' && preview === 'pending') ||
      (outcome === 'created_pending_binding' && preview === 'pending_binding')
    )
  ) {
    problems.push('target_preview_outcome_mismatch');
  }
  return problems;
}

export function assessBankSmsEvidence(
  input: BankSmsEvidenceAssessmentInput,
): BankSmsEvidenceAssessment {
  const blockerCodes: string[] = [];
  const smsReceivedAt = validDate(input.smsReceivedAt);
  const bankBusinessDate = validDate(input.bankBusinessDate);
  const normalizedTail = normalizeOptionalString(input.accountTail);
  const normalizedAlias = normalizeOptionalString(input.accountAlias);
  const normalizedCounterparty = normalizeOptionalString(input.counterparty);

  pushUnless(blockerCodes, input.classifyType === 'bank_transaction', 'classification_not_bank_transaction');
  pushUnless(blockerCodes, input.parseStatus === 'parsed', 'parse_status_not_parsed');
  pushUnless(
    blockerCodes,
    input.parserPolicyVersion === BANK_SMS_PARSER_POLICY_VERSION,
    'parser_policy_version_mismatch',
  );
  pushUnless(
    blockerCodes,
    input.bankName === BANK_SMS_PROMOTION_SUPPORTED_BANK_NAME &&
      input.sender.trim() === BANK_SMS_PROMOTION_SUPPORTED_SENDER,
    'unsupported_bank_sender_pair',
  );
  pushUnless(blockerCodes, Boolean(smsReceivedAt), 'invalid_sms_received_at');
  pushUnless(blockerCodes, Boolean(bankBusinessDate), 'invalid_bank_business_date');
  if (
    smsReceivedAt &&
    bankBusinessDate &&
    Math.abs(smsReceivedAt.getTime() - bankBusinessDate.getTime()) >
      MAX_BANK_BUSINESS_DATE_DISTANCE_MS
  ) {
    blockerCodes.push('bank_business_date_out_of_range');
  }
  pushUnless(
    blockerCodes,
    input.direction === 'income' || input.direction === 'expense',
    'invalid_direction',
  );
  pushUnless(
    blockerCodes,
    Boolean(input.amount && NORMALIZED_AMOUNT_PATTERN.test(input.amount) && Number(input.amount) > 0),
    'invalid_amount',
  );
  pushUnless(
    blockerCodes,
    Boolean(input.balanceAfter && NORMALIZED_BALANCE_PATTERN.test(input.balanceAfter)),
    'invalid_balance_after',
  );
  pushUnless(
    blockerCodes,
    !normalizedCounterparty ||
      normalizedCounterparty.length <= MAX_COUNTERPARTY_LENGTH,
    'counterparty_too_long',
  );
  pushUnless(
    blockerCodes,
    Boolean(normalizeOptionalString(input.normalizedBody)),
    'normalized_body_missing',
  );
  if (normalizedTail && !ACCOUNT_TAIL_PATTERN.test(normalizedTail)) {
    blockerCodes.push('invalid_account_tail');
  }
  if (!normalizedTail && !normalizedAlias) {
    blockerCodes.push('missing_account_identity');
  }

  const eligibleRegistries = input.registries
    .filter((registry) => registryMatchesIdentity(registry, input, normalizedTail, normalizedAlias))
    .filter(isReviewedRegistryEvidence);
  const resolvedRegistry = eligibleRegistries.length === 1 ? eligibleRegistries[0] : null;

  let targetStatusPreview: BankSmsPromotionTargetStatus | null = null;
  let registryResolution: BankSmsEvidenceAssessment['registryResolution'] = 'unresolved';
  let resolvedAccountTail = normalizedTail;
  if (normalizedTail && !blockerCodes.includes('invalid_account_tail')) {
    if (resolvedRegistry) {
      targetStatusPreview = 'pending';
      registryResolution = 'reviewed_unique';
      resolvedAccountTail = resolvedRegistry.accountTail;
    } else {
      targetStatusPreview = 'pending_binding';
      registryResolution = 'pending_binding';
    }
  } else if (normalizedAlias) {
    if (resolvedRegistry) {
      targetStatusPreview = 'pending';
      registryResolution = 'reviewed_unique';
      resolvedAccountTail = resolvedRegistry.accountTail;
    } else {
      blockerCodes.push(
        eligibleRegistries.length > 1
          ? 'ambiguous_reviewed_alias_registry'
          : 'reviewed_alias_registry_missing',
      );
    }
  }

  const uniqueBlockerCodes = uniqueSorted(blockerCodes);
  const evidenceComplete = uniqueBlockerCodes.length === 0 && targetStatusPreview !== null;
  const evidenceFingerprint = hashCanonical('evidence', {
    version: BANK_SMS_PROMOTION_FINGERPRINT_VERSION,
    eventId: input.eventId,
    rawSmsId: input.rawSmsId,
    classificationId: input.classificationId,
    parserPolicyVersion: input.parserPolicyVersion,
    bankName: input.bankName,
    sender: input.sender.trim(),
    accountTail: normalizedTail,
    accountAlias: normalizedAlias,
    bankBusinessDate: bankBusinessDate?.toISOString() ?? null,
    smsReceivedAt: smsReceivedAt?.toISOString() ?? null,
    direction: input.direction,
    amount: input.amount,
    balanceAfter: input.balanceAfter,
    counterparty: normalizedCounterparty,
    normalizedBodyHash: hashText(input.normalizedBody ?? ''),
    targetStatusPreview,
    blockerCodes: uniqueBlockerCodes,
    resolvedRegistry: resolvedRegistry
      ? bankAccountRegistrySourceSnapshot(resolvedRegistry)
      : null,
  });

  return {
    evidenceComplete,
    targetStatusPreview,
    evidenceBlockerCodes: uniqueBlockerCodes,
    parserPolicyVersion: input.parserPolicyVersion ?? 'missing',
    evidenceFingerprint,
    resolvedRegistryId: resolvedRegistry?.id ?? null,
    resolvedRegistryAuthorityId: resolvedRegistry?.formalReviewAuthority?.id ?? null,
    resolvedRegistryAuthorityHash: resolvedRegistry?.formalReviewAuthority?.authorityHash ?? null,
    resolvedRegistryContentVersion: resolvedRegistry?.contentVersion ?? null,
    resolvedRegistrySnapshotHash: resolvedRegistry
      ? hashBankAccountRegistrySnapshot(resolvedRegistry)
      : null,
    resolvedCompanyId: resolvedRegistry?.companyId ?? null,
    resolvedAccountTail,
    registryResolution,
  };
}

export function decideBankSmsPromotionAdmission(
  input: BankSmsPromotionAdmissionInput,
): BankSmsPromotionAdmissionDecision {
  const blockerCodes: string[] = [];
  const enabledAt = validDate(input.window.enabledAt);
  const durableEnabledAt = validDate(input.durableAdmission.enabledAt);
  const eventReceivedAt = validDate(input.eventReceivedAt);
  const eventCreatedAt = validDate(input.eventCreatedAt);
  const rawReceivedAt = validDate(input.rawReceivedAt);
  const rawCreatedAt = validDate(input.rawCreatedAt);
  const classificationCreatedAt = validDate(input.classificationCreatedAt);
  const evaluatedAt = validDate(input.evaluatedAt);

  pushUnless(blockerCodes, input.window.enabled, 'promotion_flag_disabled');
  pushUnless(
    blockerCodes,
    input.window.policyVersion === BANK_SMS_PROMOTION_POLICY_VERSION,
    'promotion_policy_version_mismatch',
  );
  pushUnless(blockerCodes, Boolean(enabledAt), 'promotion_enabled_at_invalid');
  pushUnless(
    blockerCodes,
    Number.isInteger(input.window.minRawSmsIdExclusive) &&
      Number(input.window.minRawSmsIdExclusive) >= BANK_SMS_PROMOTION_MIN_HISTORICAL_CUTOFF,
    'promotion_cutoff_invalid',
  );
  pushUnless(
    blockerCodes,
    Boolean(normalizeOptionalString(input.window.allowedGeneration)),
    'promotion_generation_missing',
  );
  pushUnless(blockerCodes, input.eventCreatedNow, 'mobile_event_not_created_now');
  pushUnless(blockerCodes, input.rawCreatedNow, 'raw_sms_not_created_now');
  pushUnless(blockerCodes, input.classificationCreatedNow, 'classification_not_created_now');
  pushUnless(blockerCodes, !input.deduplicated, 'deduplicated_ingest_rejected');
  pushUnless(blockerCodes, input.ingestSource === 'live_broadcast', 'live_broadcast_required');
  pushUnless(
    blockerCodes,
    input.eventId !== null && input.rawMobileSmsEventId === input.eventId,
    'event_raw_relation_mismatch',
  );
  pushUnless(blockerCodes, Boolean(input.admissionKey), 'promotion_admission_key_missing');
  if (
    Number.isInteger(input.window.minRawSmsIdExclusive) &&
    input.rawSmsId <= Number(input.window.minRawSmsIdExclusive)
  ) {
    blockerCodes.push('historical_raw_cutoff_excluded');
  }
  if (enabledAt) {
    for (const [code, value] of [
      ['event_received_before_promotion_enabled_at', input.eventReceivedAt],
      ['event_created_before_promotion_enabled_at', input.eventCreatedAt],
      ['raw_received_before_promotion_enabled_at', input.rawReceivedAt],
      ['raw_created_before_promotion_enabled_at', input.rawCreatedAt],
      ['classification_created_before_promotion_enabled_at', input.classificationCreatedAt],
    ] as const) {
      if (!validDate(value) || value.getTime() < enabledAt.getTime()) {
        blockerCodes.push(code);
      }
    }
  }
  pushUnless(blockerCodes, Boolean(evaluatedAt), 'promotion_evaluated_at_invalid');
  if (
    eventReceivedAt &&
    rawReceivedAt &&
    Math.abs(eventReceivedAt.getTime() - rawReceivedAt.getTime()) >
      MAX_EVENT_RAW_RECEIVED_AT_DRIFT_MS
  ) {
    blockerCodes.push('event_raw_received_at_mismatch');
  }
  if (
    eventReceivedAt &&
    eventCreatedAt &&
    Math.abs(eventReceivedAt.getTime() - eventCreatedAt.getTime()) >
      MAX_DEVICE_SERVER_CLOCK_SKEW_MS
  ) {
    blockerCodes.push('event_device_server_clock_skew_exceeded');
  }
  if (
    rawReceivedAt &&
    rawCreatedAt &&
    Math.abs(rawReceivedAt.getTime() - rawCreatedAt.getTime()) >
      MAX_DEVICE_SERVER_CLOCK_SKEW_MS
  ) {
    blockerCodes.push('raw_device_server_clock_skew_exceeded');
  }
  if (
    eventCreatedAt &&
    rawCreatedAt &&
    eventCreatedAt.getTime() > rawCreatedAt.getTime()
  ) {
    blockerCodes.push('event_created_after_raw_created');
  }
  if (
    rawCreatedAt &&
    classificationCreatedAt &&
    rawCreatedAt.getTime() > classificationCreatedAt.getTime()
  ) {
    blockerCodes.push('raw_created_after_classification_created');
  }
  if (evaluatedAt) {
    for (const [code, value] of [
      ['event_created_in_server_future', eventCreatedAt],
      ['raw_created_in_server_future', rawCreatedAt],
      ['classification_created_in_server_future', classificationCreatedAt],
    ] as const) {
      if (value && value.getTime() - evaluatedAt.getTime() > MAX_SERVER_FUTURE_SKEW_MS) {
        blockerCodes.push(code);
      }
    }
  }

  pushUnless(
    blockerCodes,
    input.durableAdmission.policyVersion === BANK_SMS_DURABLE_ADMISSION_POLICY_VERSION,
    'durable_policy_version_mismatch',
  );
  pushUnless(blockerCodes, input.durableAdmission.accepted, 'durable_admission_not_accepted');
  pushUnless(
    blockerCodes,
    input.durableAdmission.supportedSenderMatched,
    'durable_supported_sender_not_matched',
  );
  pushUnless(
    blockerCodes,
    input.durableAdmission.liveBroadcastMatched,
    'durable_live_broadcast_not_matched',
  );
  pushUnless(
    blockerCodes,
    input.durableAdmission.generationMatched,
    'durable_generation_not_matched',
  );
  pushUnless(
    blockerCodes,
    input.durableAdmission.receivedAtWatermarkMatched,
    'durable_watermark_not_matched',
  );
  pushUnless(
    blockerCodes,
    Boolean(
      input.durableAdmission.generation &&
        input.durableAdmission.generation === input.window.allowedGeneration,
    ),
    'event_generation_not_allowed',
  );
  pushUnless(blockerCodes, Boolean(durableEnabledAt), 'durable_enabled_at_invalid');
  if (enabledAt && durableEnabledAt && enabledAt.getTime() !== durableEnabledAt.getTime()) {
    blockerCodes.push('durable_enabled_at_server_mismatch');
  }
  if (
    durableEnabledAt &&
    (!validDate(input.eventReceivedAt) ||
      input.eventReceivedAt.getTime() < durableEnabledAt.getTime())
  ) {
    blockerCodes.push('event_received_before_durable_watermark');
  }
  if (!input.evidence.evidenceComplete) {
    blockerCodes.push('evidence_incomplete');
  }

  const uniqueBlockerCodes = uniqueSorted(blockerCodes);
  const decisionFingerprint = hashCanonical('decision', {
    version: BANK_SMS_PROMOTION_FINGERPRINT_VERSION,
    promotionPolicyVersion: input.window.policyVersion,
    promotionEnabledAt: validDate(input.window.enabledAt)?.toISOString() ?? null,
    minRawSmsIdExclusive: input.window.minRawSmsIdExclusive,
    allowedGeneration: input.window.allowedGeneration,
    parserPolicyVersion: input.evidence.parserPolicyVersion,
    admissionKey: input.admissionKey,
    eventId: input.eventId,
    rawSmsId: input.rawSmsId,
    classificationId: input.classificationId,
    transactionId: input.transactionId ?? null,
    evaluatedAt: evaluatedAt?.toISOString() ?? null,
    evidenceFingerprint: input.evidence.evidenceFingerprint,
    targetStatusPreview: input.evidence.targetStatusPreview,
    blockerCodes: uniqueBlockerCodes,
  });

  return {
    eligibleToCreateNow: uniqueBlockerCodes.length === 0,
    admissionBlockerCodes: uniqueBlockerCodes,
    promotionPolicyVersion: input.window.policyVersion ?? 'missing',
    decisionFingerprint,
    evidence: input.evidence,
  };
}

export function buildBankSmsPromotionAdmissionKey(input: {
  window: BankSmsPromotionWindow;
  deviceId: string;
  stableSmsIdentity: string | null;
  eventGeneration: string | null;
}) {
  const stableSmsIdentity = normalizeOptionalString(input.stableSmsIdentity);
  const deviceId = normalizeOptionalString(input.deviceId);
  if (
    !input.window.enabled ||
    input.window.policyVersion !== BANK_SMS_PROMOTION_POLICY_VERSION ||
    !validDate(input.window.enabledAt) ||
    !Number.isInteger(input.window.minRawSmsIdExclusive) ||
    Number(input.window.minRawSmsIdExclusive) < BANK_SMS_PROMOTION_MIN_HISTORICAL_CUTOFF ||
    !input.window.allowedGeneration ||
    input.eventGeneration !== input.window.allowedGeneration ||
    !stableSmsIdentity ||
    !deviceId
  ) {
    return null;
  }

  return hashCanonical('admission', {
    version: BANK_SMS_PROMOTION_FINGERPRINT_VERSION,
    policyVersion: input.window.policyVersion,
    generation: input.window.allowedGeneration,
    deviceId,
    stableSmsIdentity,
  });
}

export function resolveBankSmsHistoricalCutoff(window: BankSmsPromotionWindow) {
  return Number.isInteger(window.minRawSmsIdExclusive) &&
    Number(window.minRawSmsIdExclusive) >= BANK_SMS_PROMOTION_MIN_HISTORICAL_CUTOFF
    ? Number(window.minRawSmsIdExclusive)
    : BANK_SMS_PROMOTION_MIN_HISTORICAL_CUTOFF;
}

export function isSameBankSmsPromotionRawEvidence(
  stored: BankSmsPromotionRawEvidence,
  incoming: BankSmsPromotionRawEvidence,
) {
  const storedReceivedAt = validDate(stored.receivedAt);
  const incomingReceivedAt = validDate(incoming.receivedAt);
  if (!storedReceivedAt || !incomingReceivedAt) {
    return false;
  }
  const sameReceivedSecond =
    Math.trunc(storedReceivedAt.getTime() / 1000) ===
    Math.trunc(incomingReceivedAt.getTime() / 1000);

  return (
    stored.mobileSmsEventId === incoming.mobileSmsEventId &&
    stored.simSlot === incoming.simSlot &&
    stored.sender === incoming.sender &&
    stored.body === incoming.body &&
    sameReceivedSecond &&
    stored.deviceSmsId === incoming.deviceSmsId &&
    stored.dedupeFingerprint === incoming.dedupeFingerprint
  );
}

export function readBankSmsDurableAdmissionMetadata(
  payload: Record<string, unknown> | null,
) {
  return {
    policyVersion: readString(payload, 'bankSmsDurableAdmissionPolicyVersion'),
    accepted: readBoolean(payload, 'bankSmsDurableAdmissionAccepted'),
    generation: readString(payload, 'bankSmsAdmissionGeneration'),
    enabledAt: readDate(payload, 'bankSmsAdmissionEnabledAt'),
    supportedSenderMatched: readBoolean(payload, 'bankSmsAdmissionSupportedSenderMatched'),
    liveBroadcastMatched: readBoolean(payload, 'bankSmsAdmissionLiveBroadcastMatched'),
    generationMatched: readBoolean(payload, 'bankSmsAdmissionGenerationMatched'),
    receivedAtWatermarkMatched: readBoolean(
      payload,
      'bankSmsAdmissionReceivedAtWatermarkMatched',
    ),
  };
}

export function fingerprintSummary(value: string | null | undefined) {
  return value?.trim() ? value.trim().slice(0, 16) : null;
}

export function hashText(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function registryMatchesIdentity(
  registry: BankSmsPromotionRegistrySnapshot,
  input: BankSmsEvidenceAssessmentInput,
  normalizedTail: string | null,
  normalizedAlias: string | null,
) {
  if (
    registry.bankName !== input.bankName ||
    registry.smsSender !== input.sender.trim()
  ) {
    return false;
  }
  if (normalizedTail) {
    return registry.accountTail === normalizedTail;
  }
  if (!normalizedAlias) {
    return false;
  }
  return (
    registry.accountAlias.trim() === normalizedAlias ||
    registry.accountHolder?.trim() === normalizedAlias
  );
}

function isReviewedRegistryEvidence(registry: BankSmsPromotionRegistrySnapshot) {
  // Reuse the single formal eligibility gate (active + reviewed + positive
  // reviewer + complete evidence). The promotion path additionally requires a
  // positive companyId and a 4-digit account tail because it resolves ownership
  // from the SMS identity rather than from an already-bound transaction.
  return (
    isBankAccountRegistryFormallyEligible(registry) &&
    Number.isInteger(registry.companyId) &&
    registry.companyId > 0 &&
    ACCOUNT_TAIL_PATTERN.test(registry.accountTail)
  );
}

function hashCanonical(scope: string, value: unknown) {
  return createHash('sha256')
    .update(
      `${BANK_SMS_PROMOTION_FINGERPRINT_VERSION}|${scope}|${stableSerialize(value)}`,
      'utf8',
    )
    .digest('hex');
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(',')}}`;
}

function validDate(value: Date | null | undefined) {
  return value instanceof Date && Number.isFinite(value.getTime()) ? value : null;
}

function normalizeOptionalString(value: string | null | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readString(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readBoolean(payload: Record<string, unknown> | null, key: string) {
  return payload?.[key] === true;
}

function readDate(payload: Record<string, unknown> | null, key: string) {
  const value = readString(payload, key);
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function pushUnless(codes: string[], condition: boolean, code: string) {
  if (!condition) {
    codes.push(code);
  }
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort();
}
