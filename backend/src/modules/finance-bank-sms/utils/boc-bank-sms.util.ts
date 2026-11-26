import { createHash } from 'node:crypto';

export type BankSmsDirection = 'income' | 'expense';
export type MobileSmsRawParseStatus =
  | 'parsed'
  | 'partial'
  | 'unsupported'
  | 'duplicate'
  | 'error';
export type FinanceLinkType =
  | 'receipt_item'
  | 'approval_order'
  | 'manual_fee'
  | 'wechat_settlement_batch'
  | 'internal_fund_flow'
  | 'receivable_tracking';
export type BankSmsBusinessCandidateType =
  | 'loan_interest_candidate'
  | 'loan_repayment_interest_candidate';

export interface ParsedBocBankSmsResult {
  parseStatus: MobileSmsRawParseStatus;
  bankName: string | null;
  sender: string;
  accountTail: string | null;
  accountAlias: string | null;
  bankBusinessDate: Date | null;
  smsReceivedAt: Date;
  direction: BankSmsDirection | null;
  amount: string | null;
  balanceAfter: string | null;
  counterparty: string | null;
  parseConfidence: string;
  normalizedBody: string;
  parseNote: string;
}

export interface CandidateMatchInput {
  linkType: FinanceLinkType;
  linkId: number | null;
  amount: string;
  counterparty: string | null;
  referenceNo: string | null;
  label: string;
  searchableText: string;
  happenedAt: Date | null;
  verificationCodeRequired: boolean;
  alreadyConsumed: boolean;
}

export interface RankedCandidateMatch extends CandidateMatchInput {
  score: number;
  rankingReasons: string[];
}

export interface BankSmsBusinessCandidateHint {
  candidateType: BankSmsBusinessCandidateType;
  normalizedOwnAccountName: string;
  normalizedCounterpartyName: string;
  sameCompanyCounterparty: true;
  fixedMonthlyRuleDay: number | null;
  nonRevenue: true;
  reason: string;
}

const BANK_NAME_BOC = '\u4e2d\u56fd\u94f6\u884c';
const COUNTERPARTY_TENPAY = '\u8d22\u4ed8\u901a\u7ed3\u7b97';
const MONEY_PATTERN = /(\d+\.\d{2})(?![\d.])/;
const WORK_ORDER_NO_PATTERN = /\bWO\d{6,}\b/i;
const APPROVAL_NO_PATTERN = /\bAPR\d{6,}\b/i;
const SMALL_MANUAL_FEE_THRESHOLD = 50;

function normalizeChinesePunctuation(value: string) {
  return value
    .replace(/[\u3010\u3011]/g, '')
    .replace(/\uff08/g, '(')
    .replace(/\uff09/g, ')')
    .replace(/\uff0c/g, ',')
    .replace(/\u3002/g, '.')
    .replace(/\uff1b/g, ';')
    .replace(/\uff1a/g, ':');
}

export function normalizeBankSmsBody(body: string) {
  return normalizeChinesePunctuation(body.normalize('NFKC'))
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeBankSmsPartyName(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  return normalizeChinesePunctuation(value.normalize('NFKC'))
    .replace(new RegExp(BANK_NAME_BOC, 'g'), '')
    .replace(/\s+/g, '')
    .trim();
}

export function buildBankSmsFingerprint(input: {
  sender: string;
  normalizedBody: string;
  receivedAt: Date;
  deviceId: string;
}) {
  return createHash('sha256')
    .update(
      [
        input.sender.trim(),
        input.normalizedBody.trim(),
        input.receivedAt.toISOString(),
        input.deviceId.trim(),
      ].join('|'),
      'utf8',
    )
    .digest('hex');
}

function normalizeMoney(value: string | null) {
  if (!value) {
    return null;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return numericValue.toFixed(2);
}

function buildLocalBusinessDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > 31 ||
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23 ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const candidate = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day ||
    candidate.getHours() !== hour ||
    candidate.getMinutes() !== minute
  ) {
    return null;
  }

  return candidate;
}

function resolveBusinessDate(
  month: number,
  day: number,
  hour: number,
  minute: number,
  smsReceivedAt: Date,
) {
  const receivedYear = smsReceivedAt.getFullYear();
  let candidate = buildLocalBusinessDate(receivedYear, month, day, hour, minute);
  if (!candidate) {
    return null;
  }

  if (candidate.getTime() - smsReceivedAt.getTime() > 36 * 60 * 60 * 1000) {
    candidate = buildLocalBusinessDate(receivedYear - 1, month, day, hour, minute);
  }

  return candidate;
}

function resolveAccountScope(normalizedBody: string) {
  const directAccountTailMatch =
    normalizedBody.match(/(?:尾号|账户(?:尾号)?|账号(?:尾号)?)(?:为|是)?\s*(\d{4})/) ?? null;
  if (directAccountTailMatch?.[1]) {
    return {
      accountTail: directAccountTailMatch[1],
      accountAlias: null,
    };
  }

  const accountScopeMatch =
    normalizedBody.match(/您(?:公司)?账户([^,.;():]+)/) ??
    normalizedBody.match(/(?:账户|账号)([^,.;():]+)/) ??
    null;
  const accountScope = accountScopeMatch?.[1]?.trim() ?? '';
  if (!accountScope) {
    return {
      accountTail: null,
      accountAlias: null,
    };
  }

  const tailFromScopeMatch =
    accountScope.match(/(?:尾号)?\s*(\d{4})$/) ??
    accountScope.match(/^(\d{4})$/) ??
    null;
  if (tailFromScopeMatch?.[1]) {
    return {
      accountTail: tailFromScopeMatch[1],
      accountAlias: null,
    };
  }

  return {
    accountTail: null,
    accountAlias: accountScope,
  };
}

export function parseBoc95566Sms(body: string, smsReceivedAt: Date): ParsedBocBankSmsResult {
  const normalizedBody = normalizeBankSmsBody(body);
  const sender = '95566';

  if (!normalizedBody || !normalizedBody.includes(BANK_NAME_BOC)) {
    return {
      parseStatus: 'unsupported',
      bankName: null,
      sender,
      accountTail: null,
      accountAlias: null,
      bankBusinessDate: null,
      smsReceivedAt,
      direction: null,
      amount: null,
      balanceAfter: null,
      counterparty: null,
      parseConfidence: '0.00',
      normalizedBody,
      parseNote: 'Only 95566 / Bank of China SMS templates are supported.',
    };
  }

  const accountScope = resolveAccountScope(normalizedBody);
  const bankBusinessDateMatch = normalizedBody.match(
    /(\d{1,2})\u6708(\d{1,2})\u65e5(\d{1,2}):(\d{2})/,
  );
  const incomeMatch = normalizedBody.match(
    /\u6536\u5165\u4eba\u6c11\u5e01(\d+\.\d{2})(?![\d.])/,
  );
  const expenseMatch =
    normalizedBody.match(/\u652f\u53d6\u4eba\u6c11\u5e01(\d+\.\d{2})(?![\d.])/) ??
    normalizedBody.match(/\u652f\u51fa\u4eba\u6c11\u5e01(\d+\.\d{2})(?![\d.])/);
  const balanceMatch = normalizedBody.match(
    /\u4f59\u989d(?:\u4eba\u6c11\u5e01)?(\d+\.\d{2})(?![\d.])/,
  );
  const counterpartyMatch =
    normalizedBody.match(/\u5bf9\u65b9\u4e3a([^,.;()]+)/) ??
    normalizedBody.match(/\u4ed8\u6b3e\u65b9([^,.;()]+)/) ??
    normalizedBody.match(/\u6536\u6b3e\u65b9([^,.;()]+)/);

  const direction: BankSmsDirection | null = incomeMatch
    ? 'income'
    : expenseMatch
      ? 'expense'
      : null;
  const amount = normalizeMoney(incomeMatch?.[1] ?? expenseMatch?.[1] ?? null);
  const balanceAfter = normalizeMoney(balanceMatch?.[1] ?? null);
  const accountTail = accountScope.accountTail;
  const accountAlias = accountScope.accountAlias;
  const bankBusinessDate = bankBusinessDateMatch
    ? resolveBusinessDate(
        Number(bankBusinessDateMatch[1]),
        Number(bankBusinessDateMatch[2]),
        Number(bankBusinessDateMatch[3]),
        Number(bankBusinessDateMatch[4]),
        smsReceivedAt,
      )
    : null;
  const counterparty = counterpartyMatch?.[1]?.trim() || null;

  const requiredFieldCount = [
    Boolean(accountTail || accountAlias),
    Boolean(bankBusinessDate),
    Boolean(direction),
    Boolean(amount),
    Boolean(balanceAfter),
  ].filter(Boolean).length;
  const optionalFieldCount = [Boolean(counterparty)].filter(Boolean).length;
  const parseConfidence = Math.min(1, requiredFieldCount / 5 + optionalFieldCount * 0.05).toFixed(2);

  if (requiredFieldCount < 5) {
    return {
      parseStatus: requiredFieldCount >= 3 ? 'partial' : 'unsupported',
      bankName: BANK_NAME_BOC,
      sender,
      accountTail,
      accountAlias,
      bankBusinessDate,
      smsReceivedAt,
      direction,
      amount,
      balanceAfter,
      counterparty,
      parseConfidence,
      normalizedBody,
      parseNote:
        requiredFieldCount >= 3
          ? accountAlias
            ? 'The SMS was partially parsed. The account alias was captured, but the masked account tail is still missing in the 95566 body.'
            : 'The SMS was partially parsed and still requires finance review.'
          : 'The SMS did not match the supported 95566 template.',
    };
  }

  return {
    parseStatus: 'parsed',
    bankName: BANK_NAME_BOC,
    sender,
    accountTail,
    accountAlias,
    bankBusinessDate,
    smsReceivedAt,
    direction,
    amount,
    balanceAfter,
    counterparty,
    parseConfidence,
    normalizedBody,
    parseNote: 'Parsed with deterministic 95566 / Bank of China rules.',
  };
}

function moneyDistance(left: string, right: string) {
  return Math.abs(Number(left) - Number(right));
}

function hoursDistance(left: Date | null, right: Date | null) {
  if (!left || !right) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(left.getTime() - right.getTime()) / (60 * 60 * 1000);
}

export function rankBankSmsCandidates(
  transaction: {
    direction: BankSmsDirection;
    amount: string;
    counterparty: string | null;
    bankBusinessDate: Date | null;
    rawBody?: string | null;
  },
  candidates: CandidateMatchInput[],
) {
  const normalizedCounterparty = transaction.counterparty?.trim().toLowerCase() || '';
  const approvalNoHint = transaction.rawBody?.match(APPROVAL_NO_PATTERN)?.[0]?.toLowerCase() ?? null;
  const workOrderNoHint = transaction.rawBody?.match(WORK_ORDER_NO_PATTERN)?.[0]?.toLowerCase() ?? null;

  const ranked = candidates
    .filter((candidate) => !candidate.alreadyConsumed)
    .map<RankedCandidateMatch>((candidate) => {
      let score = 0;
      const rankingReasons: string[] = [];

      if (candidate.amount === transaction.amount) {
        score += 100;
        rankingReasons.push('Amount matches exactly.');
      } else {
        const distance = moneyDistance(candidate.amount, transaction.amount);
        if (distance <= 5) {
          score += 60;
          rankingReasons.push('Amount is close.');
        } else if (distance <= 20) {
          score += 20;
          rankingReasons.push('Amount is roughly comparable.');
        }
      }

      if (normalizedCounterparty) {
        const candidateCounterparty = candidate.counterparty?.trim().toLowerCase() || '';
        if (candidateCounterparty && candidateCounterparty === normalizedCounterparty) {
          score += 40;
          rankingReasons.push('Counterparty matches.');
        } else if (
          candidate.searchableText.toLowerCase().includes(normalizedCounterparty) ||
          (candidateCounterparty && normalizedCounterparty.includes(candidateCounterparty))
        ) {
          score += 25;
          rankingReasons.push('Counterparty is similar.');
        }
      }

      if (approvalNoHint && candidate.referenceNo?.toLowerCase() === approvalNoHint) {
        score += 80;
        rankingReasons.push('Approval number matched from the SMS body.');
      }

      if (workOrderNoHint && candidate.referenceNo?.toLowerCase() === workOrderNoHint) {
        score += 80;
        rankingReasons.push('Receipt/work-order number matched from the SMS body.');
      }

      const hourGap = hoursDistance(transaction.bankBusinessDate, candidate.happenedAt);
      if (Number.isFinite(hourGap)) {
        if (hourGap <= 24) {
          score += 25;
          rankingReasons.push('Time is very close.');
        } else if (hourGap <= 72) {
          score += 10;
          rankingReasons.push('Time is acceptable.');
        }
      }

      if (
        candidate.linkType === 'manual_fee' &&
        transaction.direction === 'expense' &&
        !normalizedCounterparty &&
        Number(transaction.amount) <= SMALL_MANUAL_FEE_THRESHOLD
      ) {
        score += 55;
        rankingReasons.push('Small expense without counterparty can be a manual fee.');
      }

      if (
        candidate.linkType === 'wechat_settlement_batch' &&
        (normalizedCounterparty.includes('\u8d22\u4ed8\u901a') ||
          normalizedCounterparty.includes('tenpay') ||
          normalizedCounterparty.includes('\u5fae\u4fe1'))
      ) {
        score += 40;
        rankingReasons.push('Counterparty suggests a Tenpay or WeChat settlement.');
      }

      return {
        ...candidate,
        score,
        rankingReasons,
      };
    })
    .sort(
      (left, right) => right.score - left.score || Number(left.linkId ?? 0) - Number(right.linkId ?? 0),
    );

  return ranked;
}

export function resolveBestBankSmsCandidate(
  transaction: {
    direction: BankSmsDirection;
    amount: string;
    counterparty: string | null;
    bankBusinessDate: Date | null;
    rawBody?: string | null;
  },
  candidates: CandidateMatchInput[],
) {
  return rankBankSmsCandidates(transaction, candidates)[0] ?? null;
}

export function buildManualFeeCandidate(transaction: {
  direction: BankSmsDirection;
  amount: string;
  counterparty: string | null;
  bankBusinessDate: Date | null;
}) {
  if (
    transaction.direction !== 'expense' ||
    transaction.counterparty?.trim() ||
    Number(transaction.amount) > SMALL_MANUAL_FEE_THRESHOLD
  ) {
    return null;
  }

  return {
    linkType: 'manual_fee' as const,
    linkId: null,
    amount: transaction.amount,
    counterparty: null,
    referenceNo: null,
    label: '\u94f6\u884c\u624b\u7eed\u8d39',
    searchableText: '\u94f6\u884c\u624b\u7eed\u8d39 \u624b\u5de5\u8d39\u7528',
    happenedAt: transaction.bankBusinessDate,
    verificationCodeRequired: false,
    alreadyConsumed: false,
  };
}

export function inferBankSmsBusinessCandidate(input: {
  direction: BankSmsDirection;
  bankBusinessDate: Date | null;
  counterparty: string | null;
  accountAlias?: string | null;
  accountHolder?: string | null;
}) {
  const normalizedOwnAccountName = normalizeBankSmsPartyName(
    input.accountHolder ?? input.accountAlias ?? null,
  );
  const normalizedCounterpartyName = normalizeBankSmsPartyName(input.counterparty);
  const fixedMonthlyRuleDay = input.bankBusinessDate?.getDate() === 21 ? 21 : null;

  if (
    input.direction === 'expense' &&
    normalizedOwnAccountName &&
    normalizedOwnAccountName === normalizedCounterpartyName
  ) {
    return {
      candidateType: fixedMonthlyRuleDay
        ? 'loan_interest_candidate'
        : 'loan_repayment_interest_candidate',
      normalizedOwnAccountName,
      normalizedCounterpartyName,
      sameCompanyCounterparty: true,
      fixedMonthlyRuleDay,
      nonRevenue: true,
      reason: fixedMonthlyRuleDay
        ? 'The own-account alias/account holder and the counterparty resolve to the same company, and the debit happened on the fixed monthly rule day 21.'
        : 'The own-account alias/account holder and the counterparty resolve to the same company on an expense SMS.',
    } satisfies BankSmsBusinessCandidateHint;
  }

  return null;
}

export function extractBankSmsBusinessHint(body: string) {
  const normalizedBody = normalizeBankSmsBody(body);
  return {
    workOrderNo: normalizedBody.match(WORK_ORDER_NO_PATTERN)?.[0] ?? null,
    approvalNo: normalizedBody.match(APPROVAL_NO_PATTERN)?.[0] ?? null,
    amountHint: normalizedBody.match(MONEY_PATTERN)?.[1] ?? null,
    tenpaySettlement:
      normalizedBody.includes(COUNTERPARTY_TENPAY) ||
      /tenpay|wechat/i.test(normalizedBody),
  };
}
