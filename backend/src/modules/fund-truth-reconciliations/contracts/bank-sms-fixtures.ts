import { createHash } from 'node:crypto';

import { BankTruthReviewRole, BANK_TRUTH_INPUT_CONTRACT } from './bank-truth-input-contract';
import {
  BankTruthAdaptationTarget,
  BankTruthProjectionKind,
  BankTruthStagingStatus,
  BANK_TRUTH_STAGING_BLUEPRINT,
} from './bank-truth-staging-blueprint';

export type BankSmsParseStatus = 'parsed' | 'partial';
export type BankSmsChannelHint = 'tenpay' | 'transfer' | 'unknown';
export type BankSmsBusinessAnchorKind =
  | 'payment_no'
  | 'payout_no'
  | 'approval_no'
  | 'work_order_no'
  | 'abc_sync_source_object_key';

export interface BankSmsBusinessAnchorCandidate {
  kind: BankSmsBusinessAnchorKind;
  value: string;
  source: string;
}

export interface BankSmsFixtureInput {
  fixtureId: string;
  label: string;
  sourcePhone: string;
  receivedAt: string;
  rawText: string;
  deviceMessageId: string;
  bankHint: string;
  parseStatus: BankSmsParseStatus;
  sourceMessageKey?: string;
  accountAlias?: string;
  accountNoMasked?: string;
}

export interface BankSmsVendorPayload {
  sourcePhone?: string | null;
  receivedAt?: string | null;
  rawText?: string | null;
  deviceMessageId?: string | null;
  bankHint?: string | null;
  parseStatus?: BankSmsParseStatus | null;
  sourceMessageKey?: string | null;
  accountAlias?: string | null;
  accountNoMasked?: string | null;
  importBatchId?: string | null;
  directionHint?: 'in' | 'out' | null;
  amountHint?: string | null;
  occurredAtHint?: string | null;
  bankTransactionReference?: string | null;
  bankReceiptReference?: string | null;
  statementLineId?: string | null;
  counterpartyNameHint?: string | null;
  balanceAfterHint?: string | null;
  businessAnchorHints?: BankSmsBusinessAnchorCandidate[] | null;
}

export interface BankSmsVendorFieldPolicy {
  field: string;
  requirement: 'required' | 'optional' | 'gating';
  note: string;
  missingEffect:
    | 'cannot_run'
    | 'can_run_with_fallback'
    | 'forces_weak_match_manual_review'
    | 'forces_unmatched';
}

export interface BankSmsNormalizedRecord {
  ingestionEventId: string;
  sourceChannel: string;
  sourceMessageKey: string;
  accountAlias: string;
  accountNoMasked: string;
  direction: 'in' | 'out';
  amount: string;
  occurredAt: string;
  bankTransactionReference: string;
  bankReceiptReference: string;
  statementLineId: string;
  counterpartyName: string;
  businessAnchorCandidate: BankSmsBusinessAnchorCandidate | null;
  rawSourceKind: 'sms';
  rawSourceDigest: string;
  importBatchId: string;
  parseConfidence: number;
  channelHint: BankSmsChannelHint;
  balanceAfter: string;
}

export interface BankSmsStagingCandidate {
  stagingStatus: BankTruthStagingStatus;
  matchedTargetType: BankTruthAdaptationTarget | null;
  reviewQueueOwner: BankTruthReviewRole | null;
  projectionStatus: 'not_projected' | 'eligible_read_only' | 'rejected_read_only';
  projectionKinds: BankTruthProjectionKind[];
  missingAnchorSummary: string[];
  comparisonSummary: string;
}

export interface BankSmsDryRunResult {
  fixtureId: string;
  label: string;
  parseStatus: BankSmsParseStatus;
  input: BankSmsFixtureInput;
  normalizedRecord: BankSmsNormalizedRecord;
  stagingCandidate: BankSmsStagingCandidate;
}

export interface BankSmsDryRunBatch {
  entrypoint: string;
  normalizationVersion: string;
  contractCode: string;
  stagingBlueprintCode: string;
  importBatchId: string;
  requiredInputFields: string[];
  fixtures: BankSmsDryRunResult[];
  vendorFieldPolicies: BankSmsVendorFieldPolicy[];
  summary: {
    total: number;
    byStagingStatus: Record<string, number>;
    byChannelHint: Record<string, number>;
  };
}

type BankSmsOccurredAtSource = 'sms_text' | 'vendor_hint' | 'received_at_fallback';

const DEFAULT_IMPORT_BATCH_ID = 'BANK-SMS-DRY-RUN-20260416';

export const BANK_SMS_DRY_RUN_ENTRYPOINT = 'normalizeBankSmsVendorPayload';
export const BANK_SMS_NORMALIZATION_VERSION = '2026-04-16.f7.5-bank-sms-dry-run';

export const BANK_SMS_VENDOR_FIELD_POLICIES: BankSmsVendorFieldPolicy[] = [
  {
    field: 'sourcePhone',
    requirement: 'required',
    note: '需要保留设备侧来源手机号，才能确认是 95566 等银行短信通道。',
    missingEffect: 'cannot_run',
  },
  {
    field: 'receivedAt',
    requirement: 'required',
    note: '用于形成最小时间追踪；当短信正文缺时间时，dry-run 只能回退到 receivedAt。',
    missingEffect: 'cannot_run',
  },
  {
    field: 'rawText',
    requirement: 'required',
    note: '没有短信正文就无法归一化 amount / direction / anchor candidate。',
    missingEffect: 'cannot_run',
  },
  {
    field: 'deviceMessageId',
    requirement: 'required',
    note: '作为设备侧唯一追踪键，便于生成 ingestionEventId 与回溯定位。',
    missingEffect: 'cannot_run',
  },
  {
    field: 'bankHint',
    requirement: 'optional',
    note: '可辅助快速锁定 bank_sms_boc；缺失时可回退到 sourcePhone 识别。',
    missingEffect: 'can_run_with_fallback',
  },
  {
    field: 'sourceMessageKey',
    requirement: 'optional',
    note: '若厂家接口能提供稳定消息键，可补到 F6 sourceMessageKey；缺失时允许留空。',
    missingEffect: 'can_run_with_fallback',
  },
  {
    field: 'accountAlias / accountNoMasked',
    requirement: 'optional',
    note: '短信通常只有尾号；缺失时仍可 dry-run，但 receipt / statement 行级归并能力会下降。',
    missingEffect: 'can_run_with_fallback',
  },
  {
    field: 'directionHint / amountHint / occurredAtHint',
    requirement: 'gating',
    note: '厂家接口若能直接给出这些解析结果，可显著提高稳定性；缺失时改由正文规则提取。',
    missingEffect: 'can_run_with_fallback',
  },
  {
    field: 'bankTransactionReference / bankReceiptReference / statementLineId',
    requirement: 'gating',
    note: '这是银行强锚点；缺失时不能进入 exact/high-confidence 自动候选，只能停在人工确认入口。',
    missingEffect: 'forces_weak_match_manual_review',
  },
  {
    field: 'businessAnchorHints',
    requirement: 'gating',
    note: '若厂家接口或上游显式给出 paymentNo / payoutNo / approvalNo / workOrderNo，会减少 unmatched。',
    missingEffect: 'forces_unmatched',
  },
];

export const BANK_SMS_DRY_RUN_FIXTURES: BankSmsFixtureInput[] = [
  {
    fixtureId: 'boc_tenpay_income_aggregate',
    label: '中国银行 95566 收入 - 财付通汇总',
    sourcePhone: '95566',
    receivedAt: '2026-04-16 09:31:18',
    rawText:
      '【中国银行】您尾号1234账户04月16日09:31收入(财付通汇总)人民币1288.00元，付款方财付通支付科技有限公司，附言财付通汇总入账，余额9876.54元。',
    deviceMessageId: 'SMS-BOC-20260416-001',
    bankHint: 'boc',
    parseStatus: 'parsed',
  },
  {
    fixtureId: 'boc_transfer_income_work_order',
    label: '中国银行 95566 收入 - 普通转账',
    sourcePhone: '95566',
    receivedAt: '2026-04-16 10:08:05',
    rawText:
      '【中国银行】您尾号1234账户04月16日10:08收入(普通转账)人民币368.00元，付款方张三，附言WO20260416008 洗车卡到款，余额10244.54元。',
    deviceMessageId: 'SMS-BOC-20260416-002',
    bankHint: 'boc',
    parseStatus: 'parsed',
  },
  {
    fixtureId: 'boc_transfer_out_approval',
    label: '中国银行 95566 支出 - 对外付款',
    sourcePhone: '95566',
    receivedAt: '2026-04-16 11:26:42',
    rawText:
      '【中国银行】您尾号1234账户04月16日11:26支出(对外付款)人民币520.00元，收款方上海配件供应商有限公司，附言APR20260416003 供应商打款，余额9724.54元。',
    deviceMessageId: 'SMS-BOC-20260416-003',
    bankHint: 'boc',
    parseStatus: 'parsed',
  },
  {
    fixtureId: 'boc_partial_income_only',
    label: '解析不完整 - 只能提取部分字段',
    sourcePhone: '95566',
    receivedAt: '2026-04-16 12:00:05',
    rawText: '【中国银行】您尾号1234账户收入人民币200.00元，附言设备短信残缺，余额9924.54元。',
    deviceMessageId: 'SMS-BOC-20260416-004',
    bankHint: 'boc',
    parseStatus: 'partial',
  },
];

export function normalizeBankSmsVendorPayload(
  payload: BankSmsVendorPayload,
  options?: {
    fixtureId?: string;
    label?: string;
    importBatchId?: string;
  },
): BankSmsDryRunResult {
  const input = buildFixtureInput(payload, options);
  const sourceChannel = resolveSourceChannel(input.sourcePhone, input.bankHint);
  const channelHint = resolveChannelHint(input.rawText);
  const direction = resolveDirection(input.rawText, payload.directionHint);
  const amount = resolveAmount(input.rawText, payload.amountHint);
  const occurredAtResolution = resolveOccurredAt(
    input.rawText,
    input.receivedAt,
    payload.occurredAtHint,
  );
  const occurredAt = occurredAtResolution.occurredAt;
  const accountNoMasked = input.accountNoMasked || resolveAccountNoMasked(input.rawText);
  const accountAlias = input.accountAlias ?? '';
  const counterpartyName = resolveCounterpartyName(
    input.rawText,
    direction,
    payload.counterpartyNameHint,
  );
  const bankTransactionReference = normalizeField(payload.bankTransactionReference);
  const bankReceiptReference = normalizeField(payload.bankReceiptReference);
  const statementLineId = normalizeField(payload.statementLineId);
  const balanceAfter = resolveBalanceAfter(input.rawText, payload.balanceAfterHint);
  const businessAnchorCandidates = resolveBusinessAnchorCandidates(
    input.rawText,
    payload.businessAnchorHints ?? null,
  );
  const bestBusinessAnchor = chooseBestBusinessAnchorCandidate(businessAnchorCandidates, direction);
  const parseConfidence = calculateParseConfidence({
    parseStatus: input.parseStatus,
    direction,
    amount,
    occurredAt,
    occurredAtFromRaw: occurredAtResolution.source === 'sms_text',
    accountNoMasked,
    counterpartyName,
    balanceAfter,
    hasStrongBankAnchor: hasStrongBankAnchor({
      accountAlias,
      accountNoMasked,
      bankTransactionReference,
      bankReceiptReference,
      statementLineId,
    }),
    businessAnchorCandidate: bestBusinessAnchor,
  });
  const normalizedRecord: BankSmsNormalizedRecord = {
    ingestionEventId: buildIngestionEventId(sourceChannel, input.deviceMessageId),
    sourceChannel,
    sourceMessageKey: normalizeField(input.sourceMessageKey),
    accountAlias,
    accountNoMasked,
    direction,
    amount,
    occurredAt,
    bankTransactionReference,
    bankReceiptReference,
    statementLineId,
    counterpartyName,
    businessAnchorCandidate: bestBusinessAnchor,
    rawSourceKind: 'sms',
    rawSourceDigest: buildRawSourceDigest(input),
    importBatchId:
      normalizeField(options?.importBatchId) ||
      normalizeField(payload.importBatchId) ||
      DEFAULT_IMPORT_BATCH_ID,
    parseConfidence,
    channelHint,
    balanceAfter,
  };
  const stagingCandidate = buildStagingCandidate(
    normalizedRecord,
    input.parseStatus,
    occurredAtResolution.source,
  );

  return {
    fixtureId: input.fixtureId,
    label: input.label,
    parseStatus: input.parseStatus,
    input,
    normalizedRecord,
    stagingCandidate,
  };
}

export function runBankSmsDryRunFixtures(
  fixtures: BankSmsFixtureInput[] = BANK_SMS_DRY_RUN_FIXTURES,
  options?: { importBatchId?: string },
): BankSmsDryRunBatch {
  const results = fixtures.map((fixture) =>
    normalizeBankSmsVendorPayload(fixture, {
      fixtureId: fixture.fixtureId,
      label: fixture.label,
      importBatchId: options?.importBatchId,
    }),
  );

  return {
    entrypoint: BANK_SMS_DRY_RUN_ENTRYPOINT,
    normalizationVersion: BANK_SMS_NORMALIZATION_VERSION,
    contractCode: BANK_TRUTH_INPUT_CONTRACT.contractCode,
    stagingBlueprintCode: BANK_TRUTH_STAGING_BLUEPRINT.blueprintCode,
    importBatchId: normalizeField(options?.importBatchId) || DEFAULT_IMPORT_BATCH_ID,
    requiredInputFields: BANK_TRUTH_INPUT_CONTRACT.inputFields
      .filter((item) => item.requirement === 'required')
      .map((item) => item.field),
    fixtures: results,
    vendorFieldPolicies: BANK_SMS_VENDOR_FIELD_POLICIES,
    summary: {
      total: results.length,
      byStagingStatus: summarizeBy(results, (item) => item.stagingCandidate.stagingStatus),
      byChannelHint: summarizeBy(results, (item) => item.normalizedRecord.channelHint),
    },
  };
}

function buildFixtureInput(
  payload: BankSmsVendorPayload,
  options?: {
    fixtureId?: string;
    label?: string;
  },
): BankSmsFixtureInput {
  return {
    fixtureId: normalizeField(options?.fixtureId) || normalizeField(payload.deviceMessageId) || 'bank_sms',
    label: normalizeField(options?.label) || '银行短信 dry-run 样本',
    sourcePhone: requireField(payload.sourcePhone, 'sourcePhone'),
    receivedAt: requireField(payload.receivedAt, 'receivedAt'),
    rawText: requireField(payload.rawText, 'rawText'),
    deviceMessageId: requireField(payload.deviceMessageId, 'deviceMessageId'),
    bankHint: normalizeField(payload.bankHint) || 'unknown',
    parseStatus: payload.parseStatus ?? 'parsed',
    sourceMessageKey: normalizeField(payload.sourceMessageKey),
    accountAlias: normalizeField(payload.accountAlias),
    accountNoMasked: normalizeField(payload.accountNoMasked),
  };
}

function buildIngestionEventId(sourceChannel: string, deviceMessageId: string) {
  return `${sourceChannel}:${deviceMessageId}`;
}

function buildRawSourceDigest(input: BankSmsFixtureInput) {
  return createHash('sha256')
    .update(
      [
        input.sourcePhone,
        input.receivedAt,
        input.deviceMessageId,
        normalizeWhitespace(input.rawText),
      ].join('|'),
      'utf8',
    )
    .digest('hex');
}

function resolveSourceChannel(sourcePhone: string, bankHint: string) {
  const normalizedHint = normalizeField(bankHint).toLowerCase();
  if (sourcePhone === '95566' || normalizedHint === 'boc' || normalizedHint.includes('bank_of_china')) {
    return 'bank_sms_boc';
  }
  return 'bank_sms_unknown';
}

function resolveChannelHint(rawText: string): BankSmsChannelHint {
  if (rawText.includes('财付通')) {
    return 'tenpay';
  }
  if (/(转账|汇款|汇入|付款)/.test(rawText)) {
    return 'transfer';
  }
  return 'unknown';
}

function resolveDirection(rawText: string, hint?: 'in' | 'out' | null): 'in' | 'out' {
  if (hint) {
    return hint;
  }
  if (rawText.includes('收入') || rawText.includes('入账')) {
    return 'in';
  }
  return 'out';
}

function resolveAmount(rawText: string, hint?: string | null) {
  const hinted = normalizeDecimal(hint);
  if (hinted) {
    return hinted;
  }
  const matched = rawText.match(/人民币([0-9,]+\.\d{2})元/);
  return normalizeDecimal(matched?.[1]) || '0.00';
}

function resolveOccurredAt(
  rawText: string,
  receivedAt: string,
  hint?: string | null,
): { occurredAt: string; source: BankSmsOccurredAtSource } {
  const hinted = normalizeField(hint);
  if (hinted) {
    return {
      occurredAt: hinted,
      source: 'vendor_hint',
    };
  }

  const matched = rawText.match(/(\d{2})月(\d{2})日(\d{2}):(\d{2})/);
  if (!matched) {
    return {
      occurredAt: receivedAt,
      source: 'received_at_fallback',
    };
  }

  const year = receivedAt.slice(0, 4) || '2026';
  const month = matched[1];
  const day = matched[2];
  const hour = matched[3];
  const minute = matched[4];
  return {
    occurredAt: `${year}-${month}-${day} ${hour}:${minute}:00`,
    source: 'sms_text',
  };
}

function hasSmsOccurredAt(rawText: string) {
  return /(\d{2})月(\d{2})日(\d{2}):(\d{2})/.test(rawText);
}

function resolveAccountNoMasked(rawText: string) {
  const matched = rawText.match(/尾号(\d{4})账户/);
  if (!matched) {
    return '';
  }
  return `****${matched[1]}`;
}

function resolveCounterpartyName(
  rawText: string,
  direction: 'in' | 'out',
  hint?: string | null,
) {
  const hinted = normalizeField(hint);
  if (hinted) {
    return hinted;
  }
  const labels =
    direction === 'in'
      ? ['付款方', '付款人', '汇款人', '对方户名']
      : ['收款方', '收款人', '对方户名'];
  for (const label of labels) {
    const matched = rawText.match(new RegExp(`${label}([^，。；]+)`));
    if (matched) {
      return normalizeField(matched[1]);
    }
  }
  return '';
}

function resolveBalanceAfter(rawText: string, hint?: string | null) {
  const hinted = normalizeDecimal(hint);
  if (hinted) {
    return hinted;
  }
  const matched = rawText.match(/余额([0-9,]+\.\d{2})元/);
  return normalizeDecimal(matched?.[1]) || '';
}

function resolveBusinessAnchorCandidates(
  rawText: string,
  hints: BankSmsBusinessAnchorCandidate[] | null,
) {
  const fromHints = (hints ?? []).filter((item) => normalizeField(item.value));
  const detected: BankSmsBusinessAnchorCandidate[] = [];

  pushAnchorMatches(detected, rawText, /\b(PAY[A-Z0-9-]{6,})\b/g, 'payment_no');
  pushAnchorMatches(detected, rawText, /\b(PYO[A-Z0-9-]{6,})\b/g, 'payout_no');
  pushAnchorMatches(detected, rawText, /\b(APR[A-Z0-9-]{6,})\b/g, 'approval_no');
  pushAnchorMatches(detected, rawText, /\b(WO[A-Z0-9-]{6,})\b/g, 'work_order_no');
  pushAnchorMatches(
    detected,
    rawText,
    /\b(ABCFUND[A-Z0-9:_-]{6,})\b/g,
    'abc_sync_source_object_key',
  );

  return dedupeAnchors([...fromHints, ...detected]);
}

function pushAnchorMatches(
  bucket: BankSmsBusinessAnchorCandidate[],
  rawText: string,
  regex: RegExp,
  kind: BankSmsBusinessAnchorKind,
) {
  const matches = rawText.matchAll(regex);
  for (const match of matches) {
    const value = normalizeField(match[1]);
    if (!value) {
      continue;
    }
    bucket.push({
      kind,
      value,
      source: 'sms_text',
    });
  }
}

function dedupeAnchors(items: BankSmsBusinessAnchorCandidate[]) {
  const unique = new Map<string, BankSmsBusinessAnchorCandidate>();
  for (const item of items) {
    const key = `${item.kind}:${item.value}`;
    if (!unique.has(key)) {
      unique.set(key, item);
    }
  }
  return [...unique.values()];
}

function chooseBestBusinessAnchorCandidate(
  items: BankSmsBusinessAnchorCandidate[],
  direction: 'in' | 'out',
) {
  if (!items.length) {
    return null;
  }

  const priority =
    direction === 'in'
      ? ['payment_no', 'work_order_no', 'approval_no', 'abc_sync_source_object_key', 'payout_no']
      : ['payout_no', 'approval_no', 'work_order_no', 'abc_sync_source_object_key', 'payment_no'];
  const sorted = [...items].sort(
    (left, right) => priority.indexOf(left.kind) - priority.indexOf(right.kind),
  );
  return sorted[0] ?? null;
}

function hasStrongBankAnchor(input: {
  accountAlias: string;
  accountNoMasked: string;
  bankTransactionReference: string;
  bankReceiptReference: string;
  statementLineId: string;
}) {
  if (input.bankTransactionReference) {
    return true;
  }
  if (
    (input.bankReceiptReference || input.statementLineId) &&
    hasAccountScope(input.accountAlias, input.accountNoMasked)
  ) {
    return true;
  }
  return false;
}

function hasAccountScope(accountAlias: string, accountNoMasked: string) {
  return Boolean(accountAlias || accountNoMasked);
}

function calculateParseConfidence(input: {
  parseStatus: BankSmsParseStatus;
  direction: 'in' | 'out';
  amount: string;
  occurredAt: string;
  occurredAtFromRaw: boolean;
  accountNoMasked: string;
  counterpartyName: string;
  balanceAfter: string;
  hasStrongBankAnchor: boolean;
  businessAnchorCandidate: BankSmsBusinessAnchorCandidate | null;
}) {
  let score = 0.35;

  if (input.direction) {
    score += 0.12;
  }
  if (input.amount !== '0.00') {
    score += 0.15;
  }
  if (input.occurredAtFromRaw) {
    score += 0.12;
  } else if (input.occurredAt) {
    score += 0.05;
  }
  if (input.accountNoMasked) {
    score += 0.08;
  }
  if (input.counterpartyName) {
    score += 0.07;
  }
  if (input.balanceAfter) {
    score += 0.06;
  }
  if (input.hasStrongBankAnchor) {
    score += 0.15;
  }
  if (input.businessAnchorCandidate) {
    score += input.businessAnchorCandidate.kind === 'work_order_no' ? 0.05 : 0.08;
  }
  if (input.parseStatus === 'partial') {
    score -= 0.18;
  }

  const normalized = Math.round(Math.min(Math.max(score, 0.25), 0.98) * 100) / 100;
  return normalized;
}

function buildStagingCandidate(
  record: BankSmsNormalizedRecord,
  parseStatus: BankSmsParseStatus,
  occurredAtSource: BankSmsOccurredAtSource,
): BankSmsStagingCandidate {
  const missingAnchorSummary: string[] = [];
  let stagingStatus: BankTruthStagingStatus = 'unmatched';
  let matchedTargetType: BankTruthAdaptationTarget | null = null;
  let reviewQueueOwner: BankTruthReviewRole | null = null;

  if (!record.businessAnchorCandidate) {
    stagingStatus = 'unmatched';
    reviewQueueOwner = 'data_governance';
    missingAnchorSummary.push('缺显式业务锚点，无法从短信直接挂回 payment/payout/approval/work_order。');
  } else {
    matchedTargetType = mapAnchorKindToTarget(record.businessAnchorCandidate.kind);

    if (record.businessAnchorCandidate.kind === 'work_order_no') {
      stagingStatus = 'weak_match_manual_review';
      reviewQueueOwner = 'finance_data_review';
      missingAnchorSummary.push('仅命中 workOrderNo，只能回到业务上下文，不能自动确认到账。');
    } else if (record.direction === 'out' && matchedTargetType === 'approval_requests') {
      stagingStatus = 'weak_match_manual_review';
      reviewQueueOwner = 'finance_audit';
      missingAnchorSummary.push('出款短信只命中 approvalNo，仍需 payoutNo 或银行强锚点，不得绕过审批边界。');
    } else if (
      hasStrongBankAnchor({
        accountAlias: record.accountAlias,
        accountNoMasked: record.accountNoMasked,
        bankTransactionReference: record.bankTransactionReference,
        bankReceiptReference: record.bankReceiptReference,
        statementLineId: record.statementLineId,
      })
    ) {
      stagingStatus = 'weak_match_manual_review';
      reviewQueueOwner = record.direction === 'out' ? 'finance_audit' : 'finance_data_review';
      missingAnchorSummary.push(
        '当前样本虽然带有银行强锚点，但 F7.5 dry-run 仍只允许停在人工复核入口，不能自动抬升为 exact/high_confidence/approved。',
      );
    } else {
      stagingStatus = 'weak_match_manual_review';
      reviewQueueOwner = record.direction === 'out' ? 'finance_audit' : 'finance_data_review';
      missingAnchorSummary.push('缺 bankTransactionReference / bankReceiptReference / statementLineId 强锚点。');
    }
  }

  if (record.channelHint === 'tenpay') {
    stagingStatus = 'unmatched';
    matchedTargetType = null;
    reviewQueueOwner = 'finance_data_review';
    missingAnchorSummary.push('财付通汇总短信只能作为银行侧补充输入，不能拆成业务逐单真相。');
  }

  if (parseStatus === 'partial') {
    if (!missingAnchorSummary.includes('短信解析不完整，仍需人工补证据或回看原文。')) {
      missingAnchorSummary.push('短信解析不完整，仍需人工补证据或回看原文。');
    }
    if (!reviewQueueOwner) {
      reviewQueueOwner = 'finance_data_review';
    }
  }

  if (!hasAccountScope(record.accountAlias, record.accountNoMasked)) {
    missingAnchorSummary.push(
      '\u540c\u4e00\u94f6\u884c\u53f7\u7801\u4e0d\u80fd\u76f4\u63a5\u7b49\u4e8e\u540c\u4e00\u516c\u53f8\uff1b\u5f53\u524d\u7f3a\u5c11 accountAlias/accountNoMasked\uff0c\u53ea\u80fd\u505c\u5728\u4eba\u5de5\u590d\u6838\u5f52\u5c5e\u3002',
    );
  }

  if (occurredAtSource === 'received_at_fallback') {
    missingAnchorSummary.push(
      '短信正文未提取到发生时间，occurredAt 已回退到 receivedAt，仅作为降级时间线索，不视为精确银行发生时间。',
    );
  }

  if (
    !hasStrongBankAnchor({
      accountAlias: record.accountAlias,
      accountNoMasked: record.accountNoMasked,
      bankTransactionReference: record.bankTransactionReference,
      bankReceiptReference: record.bankReceiptReference,
      statementLineId: record.statementLineId,
    })
  ) {
    missingAnchorSummary.push('当前样本没有稳定银行强锚点，只能停留在 staging 入口候选。');
  }

  const statusDefinition = BANK_TRUTH_STAGING_BLUEPRINT.statusDefinitions.find(
    (item) => item.status === stagingStatus,
  );
  const projectionKinds = statusDefinition?.allowedProjectionKinds ?? ['staging_overview'];
  const projectionStatus = 'not_projected' as const;

  return {
    stagingStatus,
    matchedTargetType,
    reviewQueueOwner,
    projectionStatus,
    projectionKinds,
    missingAnchorSummary: dedupeStrings(missingAnchorSummary),
    comparisonSummary: buildComparisonSummary(record, stagingStatus, matchedTargetType),
  };
}

function mapAnchorKindToTarget(
  kind: BankSmsBusinessAnchorKind,
): BankTruthAdaptationTarget | null {
  switch (kind) {
    case 'payment_no':
      return 'payment_records';
    case 'payout_no':
      return 'payout_records';
    case 'approval_no':
      return 'approval_requests';
    case 'work_order_no':
      return 'work_orders';
    case 'abc_sync_source_object_key':
      return 'abc_sync_funds';
    default:
      return null;
  }
}

function buildComparisonSummary(
  record: BankSmsNormalizedRecord,
  stagingStatus: BankTruthStagingStatus,
  matchedTargetType: BankTruthAdaptationTarget | null,
) {
  const anchorPart = record.businessAnchorCandidate
    ? `${record.businessAnchorCandidate.kind}:${record.businessAnchorCandidate.value}`
    : '未命中业务锚点';
  const targetPart = matchedTargetType ?? 'no_target';
  return [
    `channel=${record.sourceChannel}`,
    `hint=${record.channelHint}`,
    `status=${stagingStatus}`,
    `target=${targetPart}`,
    `anchor=${anchorPart}`,
  ].join(' | ');
}

function summarizeBy(
  items: BankSmsDryRunResult[],
  selector: (item: BankSmsDryRunResult) => string,
) {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    const key = selector(item);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
}

function dedupeStrings(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function requireField(value: string | null | undefined, field: string) {
  const normalized = normalizeField(value);
  if (!normalized) {
    throw new Error(`bank sms dry-run missing required field: ${field}`);
  }
  return normalized;
}

function normalizeField(value: string | null | undefined) {
  return normalizeWhitespace(value ?? '');
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeDecimal(value: string | null | undefined) {
  const normalized = normalizeField(value).replace(/,/g, '');
  if (!normalized) {
    return '';
  }
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) {
    return '';
  }
  return numeric.toFixed(2);
}
