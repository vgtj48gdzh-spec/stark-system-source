import {
  BANK_SMS_DRY_RUN_ENTRYPOINT,
  type BankSmsBusinessAnchorCandidate,
  type BankSmsBusinessAnchorKind,
  type BankSmsDryRunResult,
  type BankSmsParseStatus,
  type BankSmsVendorPayload,
  normalizeBankSmsVendorPayload,
} from './bank-sms-fixtures';

export interface BankSmsVendorRealApiAnchorPayload {
  anchor_type?: string | null;
  anchor_value?: string | null;
  anchor_source?: string | null;
  kind?: string | null;
  value?: string | null;
  source?: string | null;
}

export interface BankSmsVendorRealApiPayload {
  request_id?: string | null;
  sms?:
    | {
        sender_phone?: string | null;
        source_phone?: string | null;
        received_at?: string | null;
        raw_text?: string | null;
        content?: string | null;
        device_message_id?: string | null;
        source_message_key?: string | null;
      }
    | null;
  message?:
    | {
        sender_phone?: string | null;
        source_phone?: string | null;
        received_at?: string | null;
        raw_text?: string | null;
        content?: string | null;
        device_message_id?: string | null;
        source_message_key?: string | null;
      }
    | null;
  bank_account?:
    | {
        bank_code?: string | null;
        account_alias?: string | null;
        account_no_masked?: string | null;
      }
    | null;
  account?:
    | {
        bank_code?: string | null;
        account_alias?: string | null;
        account_no_masked?: string | null;
      }
    | null;
  parser_result?:
    | {
        parse_status?: string | null;
        direction?: string | null;
        amount?: string | null;
        occurred_at?: string | null;
        bank_transaction_reference?: string | null;
        bank_receipt_reference?: string | null;
        statement_line_id?: string | null;
        counterparty_name?: string | null;
        balance_after?: string | null;
      }
    | null;
  parsed?:
    | {
        parse_status?: string | null;
        direction?: string | null;
        amount?: string | null;
        occurred_at?: string | null;
        bank_transaction_reference?: string | null;
        bank_receipt_reference?: string | null;
        statement_line_id?: string | null;
        counterparty_name?: string | null;
        balance_after?: string | null;
      }
    | null;
  business_context?:
    | {
        anchor_candidates?: BankSmsVendorRealApiAnchorPayload[] | null;
      }
    | null;
  business?:
    | {
        anchor_candidates?: BankSmsVendorRealApiAnchorPayload[] | null;
      }
    | null;
  import_context?:
    | {
        import_batch_id?: string | null;
      }
    | null;
  meta?:
    | {
        import_batch_id?: string | null;
      }
    | null;
}

export interface BankSmsVendorRealFixture {
  fixtureId: string;
  label: string;
  vendorPayload: BankSmsVendorRealApiPayload;
}

export interface BankSmsVendorRealFieldMapping {
  internalField: string;
  vendorFieldPath: string | null;
  requirement: 'required' | 'optional' | 'gating';
  valuePreview: string;
  mappingStatus: 'mapped' | 'missing';
  note: string;
}

export interface BankSmsVendorRealAdaptationResult {
  payload: BankSmsVendorPayload;
  fieldMappings: BankSmsVendorRealFieldMapping[];
}

export interface BankSmsVendorRealDryRunResult {
  fixtureId: string;
  label: string;
  vendorPayload: BankSmsVendorRealApiPayload;
  adaptedPayload: BankSmsVendorPayload;
  fieldMappings: BankSmsVendorRealFieldMapping[];
  normalizedResult: BankSmsDryRunResult;
}

export interface BankSmsVendorRealDryRunBatch {
  entrypoint: string;
  adapterName: string;
  adapterVersion: string;
  fixtures: BankSmsVendorRealDryRunResult[];
  summary: {
    total: number;
    byStagingStatus: Record<string, number>;
    byMatchedTargetType: Record<string, number>;
    byReviewQueueOwner: Record<string, number>;
  };
}

export const BANK_SMS_VENDOR_REAL_ADAPTER_NAME = 'adaptBankSmsVendorRealPayload';
export const BANK_SMS_VENDOR_REAL_ADAPTER_VERSION =
  '2026-04-16.f7.6-bank-sms-vendor-read-only-adapter';

export const BANK_SMS_VENDOR_REAL_PAYLOAD_FIXTURES: BankSmsVendorRealFixture[] = [];

export function adaptBankSmsVendorRealPayload(
  rawPayload: BankSmsVendorRealApiPayload,
): BankSmsVendorRealAdaptationResult {
  const fieldMappings: BankSmsVendorRealFieldMapping[] = [];

  const sourcePhone = readStringField(
    fieldMappings,
    'sourcePhone',
    'required',
    '厂家短信发送号码；用于锁定 95566 等银行短信来源。',
    [
      ['sms.sender_phone', rawPayload.sms?.sender_phone],
      ['sms.source_phone', rawPayload.sms?.source_phone],
      ['message.sender_phone', rawPayload.message?.sender_phone],
      ['message.source_phone', rawPayload.message?.source_phone],
    ],
  );
  const receivedAt = readStringField(
    fieldMappings,
    'receivedAt',
    'required',
    '厂家接收到短信的时间；正文缺发生时间时只能回退到这里。',
    [
      ['sms.received_at', rawPayload.sms?.received_at],
      ['message.received_at', rawPayload.message?.received_at],
    ],
  );
  const rawText = readStringField(
    fieldMappings,
    'rawText',
    'required',
    '短信正文原文；归一化规则仍以正文为主。',
    [
      ['sms.raw_text', rawPayload.sms?.raw_text],
      ['sms.content', rawPayload.sms?.content],
      ['message.raw_text', rawPayload.message?.raw_text],
      ['message.content', rawPayload.message?.content],
    ],
  );
  const deviceMessageId = readStringField(
    fieldMappings,
    'deviceMessageId',
    'required',
    '设备侧消息唯一键；用于形成 ingestionEventId。',
    [
      ['sms.device_message_id', rawPayload.sms?.device_message_id],
      ['message.device_message_id', rawPayload.message?.device_message_id],
    ],
  );
  const bankHint = readStringField(
    fieldMappings,
    'bankHint',
    'optional',
    '银行代码提示；缺失时仍可回退到 sourcePhone 识别。',
    [
      ['bank_account.bank_code', rawPayload.bank_account?.bank_code],
      ['account.bank_code', rawPayload.account?.bank_code],
    ],
  );
  const parseStatus = readParseStatusField(
    fieldMappings,
    'parseStatus',
    'optional',
    '厂家解析状态；partial 仍只允许停留在人工复核入口。',
    [
      ['parser_result.parse_status', rawPayload.parser_result?.parse_status],
      ['parsed.parse_status', rawPayload.parsed?.parse_status],
    ],
  );
  const sourceMessageKey = readStringField(
    fieldMappings,
    'sourceMessageKey',
    'optional',
    '厂家稳定消息键；可补到 F6 sourceMessageKey。',
    [
      ['sms.source_message_key', rawPayload.sms?.source_message_key],
      ['message.source_message_key', rawPayload.message?.source_message_key],
    ],
  );
  const accountAlias = readStringField(
    fieldMappings,
    'accountAlias',
    'optional',
    '账户别名；只承担账户作用域，不承担业务主绑定。',
    [
      ['bank_account.account_alias', rawPayload.bank_account?.account_alias],
      ['account.account_alias', rawPayload.account?.account_alias],
    ],
  );
  const accountNoMasked = readStringField(
    fieldMappings,
    'accountNoMasked',
    'optional',
    '脱敏账号；只承担账户作用域。',
    [
      ['bank_account.account_no_masked', rawPayload.bank_account?.account_no_masked],
      ['account.account_no_masked', rawPayload.account?.account_no_masked],
    ],
  );
  const importBatchId = readStringField(
    fieldMappings,
    'importBatchId',
    'optional',
    '厂家导入批次；只做追溯，不声明业务归属。',
    [
      ['import_context.import_batch_id', rawPayload.import_context?.import_batch_id],
      ['meta.import_batch_id', rawPayload.meta?.import_batch_id],
    ],
  );
  const directionHint = readDirectionField(
    fieldMappings,
    'direction',
    'gating',
    '厂家解析出的收支方向；缺失时改由正文规则提取。',
    [
      ['parser_result.direction', rawPayload.parser_result?.direction],
      ['parsed.direction', rawPayload.parsed?.direction],
    ],
  );
  const amountHint = readStringField(
    fieldMappings,
    'amount',
    'gating',
    '厂家解析出的金额；缺失时改由正文规则提取。',
    [
      ['parser_result.amount', rawPayload.parser_result?.amount],
      ['parsed.amount', rawPayload.parsed?.amount],
    ],
  );
  const occurredAtHint = readStringField(
    fieldMappings,
    'occurredAt',
    'gating',
    '厂家解析出的银行发生时间；缺失时改由正文提取或回退到 receivedAt。',
    [
      ['parser_result.occurred_at', rawPayload.parser_result?.occurred_at],
      ['parsed.occurred_at', rawPayload.parsed?.occurred_at],
    ],
  );
  const bankTransactionReference = readStringField(
    fieldMappings,
    'bankTransactionReference',
    'gating',
    '银行流水号；即使命中也只保留为人工复核线索。',
    [
      [
        'parser_result.bank_transaction_reference',
        rawPayload.parser_result?.bank_transaction_reference,
      ],
      ['parsed.bank_transaction_reference', rawPayload.parsed?.bank_transaction_reference],
    ],
  );
  const bankReceiptReference = readStringField(
    fieldMappings,
    'bankReceiptReference',
    'gating',
    '银行回单号；缺失时不能提升为 exact/high_confidence。',
    [
      ['parser_result.bank_receipt_reference', rawPayload.parser_result?.bank_receipt_reference],
      ['parsed.bank_receipt_reference', rawPayload.parsed?.bank_receipt_reference],
    ],
  );
  const statementLineId = readStringField(
    fieldMappings,
    'statementLineId',
    'gating',
    '账单行号；缺失时只能停留在 unmatched / weak_match_manual_review。',
    [
      ['parser_result.statement_line_id', rawPayload.parser_result?.statement_line_id],
      ['parsed.statement_line_id', rawPayload.parsed?.statement_line_id],
    ],
  );
  const counterpartyNameHint = readStringField(
    fieldMappings,
    'counterpartyName',
    'optional',
    '厂家解析出的对手方名称；缺失时可继续由正文规则提取。',
    [
      ['parser_result.counterparty_name', rawPayload.parser_result?.counterparty_name],
      ['parsed.counterparty_name', rawPayload.parsed?.counterparty_name],
    ],
  );
  const balanceAfterHint = readStringField(
    fieldMappings,
    'balanceAfter',
    'optional',
    '厂家解析出的余额；缺失时可由正文规则提取。',
    [
      ['parser_result.balance_after', rawPayload.parser_result?.balance_after],
      ['parsed.balance_after', rawPayload.parsed?.balance_after],
    ],
  );
  const businessAnchorHints = readBusinessAnchorField(
    fieldMappings,
    rawPayload.business_context?.anchor_candidates,
    rawPayload.business?.anchor_candidates,
  );

  return {
    payload: {
      sourcePhone,
      receivedAt,
      rawText,
      deviceMessageId,
      bankHint,
      parseStatus,
      sourceMessageKey,
      accountAlias,
      accountNoMasked,
      importBatchId,
      directionHint,
      amountHint,
      occurredAtHint,
      bankTransactionReference,
      bankReceiptReference,
      statementLineId,
      counterpartyNameHint,
      balanceAfterHint,
      businessAnchorHints,
    },
    fieldMappings,
  };
}

export function normalizeBankSmsVendorRealPayload(
  fixture: BankSmsVendorRealFixture,
): BankSmsVendorRealDryRunResult {
  const adaptation = adaptBankSmsVendorRealPayload(fixture.vendorPayload);
  const normalizedResult = normalizeBankSmsVendorPayload(adaptation.payload, {
    fixtureId: fixture.fixtureId,
    label: fixture.label,
    importBatchId: adaptation.payload.importBatchId ?? undefined,
  });

  return {
    fixtureId: fixture.fixtureId,
    label: fixture.label,
    vendorPayload: fixture.vendorPayload,
    adaptedPayload: adaptation.payload,
    fieldMappings: adaptation.fieldMappings,
    normalizedResult,
  };
}

export function runBankSmsVendorRealPayloadDryRunFixtures(
  fixtures: BankSmsVendorRealFixture[] = BANK_SMS_VENDOR_REAL_PAYLOAD_FIXTURES,
): BankSmsVendorRealDryRunBatch {
  const results = fixtures.map((fixture) => normalizeBankSmsVendorRealPayload(fixture));

  return {
    entrypoint: BANK_SMS_DRY_RUN_ENTRYPOINT,
    adapterName: BANK_SMS_VENDOR_REAL_ADAPTER_NAME,
    adapterVersion: BANK_SMS_VENDOR_REAL_ADAPTER_VERSION,
    fixtures: results,
    summary: {
      total: results.length,
      byStagingStatus: summarizeBy(
        results,
        (item) => item.normalizedResult.stagingCandidate.stagingStatus,
      ),
      byMatchedTargetType: summarizeBy(
        results,
        (item) => item.normalizedResult.stagingCandidate.matchedTargetType ?? 'null',
      ),
      byReviewQueueOwner: summarizeBy(
        results,
        (item) => item.normalizedResult.stagingCandidate.reviewQueueOwner ?? 'null',
      ),
    },
  };
}

function readStringField(
  bucket: BankSmsVendorRealFieldMapping[],
  internalField: string,
  requirement: 'required' | 'optional' | 'gating',
  note: string,
  candidates: Array<[string, unknown]>,
) {
  for (const [path, value] of candidates) {
    const normalized = normalizeString(value);
    if (!normalized) {
      continue;
    }
    bucket.push({
      internalField,
      vendorFieldPath: path,
      requirement,
      valuePreview: normalized,
      mappingStatus: 'mapped',
      note,
    });
    return normalized;
  }

  bucket.push({
    internalField,
    vendorFieldPath: null,
    requirement,
    valuePreview: '',
    mappingStatus: 'missing',
    note,
  });
  return '';
}

function readParseStatusField(
  bucket: BankSmsVendorRealFieldMapping[],
  internalField: string,
  requirement: 'required' | 'optional' | 'gating',
  note: string,
  candidates: Array<[string, unknown]>,
) {
  for (const [path, value] of candidates) {
    const normalized = normalizeParseStatus(value);
    if (!normalized) {
      continue;
    }
    bucket.push({
      internalField,
      vendorFieldPath: path,
      requirement,
      valuePreview: normalized,
      mappingStatus: 'mapped',
      note,
    });
    return normalized;
  }

  bucket.push({
    internalField,
    vendorFieldPath: null,
    requirement,
    valuePreview: '',
    mappingStatus: 'missing',
    note,
  });
  return undefined;
}

function readDirectionField(
  bucket: BankSmsVendorRealFieldMapping[],
  internalField: string,
  requirement: 'required' | 'optional' | 'gating',
  note: string,
  candidates: Array<[string, unknown]>,
) {
  for (const [path, value] of candidates) {
    const normalized = normalizeDirection(value);
    if (!normalized) {
      continue;
    }
    bucket.push({
      internalField,
      vendorFieldPath: path,
      requirement,
      valuePreview: normalized,
      mappingStatus: 'mapped',
      note,
    });
    return normalized;
  }

  bucket.push({
    internalField,
    vendorFieldPath: null,
    requirement,
    valuePreview: '',
    mappingStatus: 'missing',
    note,
  });
  return undefined;
}

function readBusinessAnchorField(
  bucket: BankSmsVendorRealFieldMapping[],
  primary?: BankSmsVendorRealApiAnchorPayload[] | null,
  fallback?: BankSmsVendorRealApiAnchorPayload[] | null,
) {
  const candidates: Array<[string, BankSmsVendorRealApiAnchorPayload[] | null | undefined]> = [
    ['business_context.anchor_candidates', primary],
    ['business.anchor_candidates', fallback],
  ];

  for (const [path, items] of candidates) {
    const normalized = normalizeBusinessAnchors(items);
    if (!normalized.length) {
      continue;
    }
    bucket.push({
      internalField: 'businessAnchorHints',
      vendorFieldPath: `${path}[].{anchor_type,anchor_value,anchor_source}`,
      requirement: 'gating',
      valuePreview: normalized.map((item) => `${item.kind}:${item.value}`).join(', '),
      mappingStatus: 'mapped',
      note: '厂家显式业务锚点；即使命中也只能进入人工复核入口。',
    });
    return normalized;
  }

  bucket.push({
    internalField: 'businessAnchorHints',
    vendorFieldPath: null,
    requirement: 'gating',
    valuePreview: '',
    mappingStatus: 'missing',
    note: '厂家显式业务锚点；缺失时更容易停留在 unmatched。',
  });
  return undefined;
}

function normalizeBusinessAnchors(
  items?: BankSmsVendorRealApiAnchorPayload[] | null,
): BankSmsBusinessAnchorCandidate[] {
  if (!items?.length) {
    return [];
  }

  const normalized: BankSmsBusinessAnchorCandidate[] = [];
  for (const item of items) {
    const kind = normalizeAnchorKind(item.anchor_type ?? item.kind);
    const value = normalizeString(item.anchor_value ?? item.value);
    if (!kind || !value) {
      continue;
    }
    normalized.push({
      kind,
      value,
      source: normalizeString(item.anchor_source ?? item.source) || 'vendor_payload',
    });
  }
  return normalized;
}

function normalizeParseStatus(value: unknown): BankSmsParseStatus | undefined {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === 'parsed') {
    return 'parsed';
  }
  if (normalized === 'partial') {
    return 'partial';
  }
  return undefined;
}

function normalizeDirection(value: unknown): 'in' | 'out' | undefined {
  const normalized = normalizeString(value).toLowerCase();
  if (['in', 'income', 'credit', 'received'].includes(normalized)) {
    return 'in';
  }
  if (['out', 'expense', 'debit', 'paid'].includes(normalized)) {
    return 'out';
  }
  return undefined;
}

function normalizeAnchorKind(value: unknown): BankSmsBusinessAnchorKind | undefined {
  const normalized = normalizeString(value)
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

  switch (normalized) {
    case 'payment_no':
      return 'payment_no';
    case 'payout_no':
      return 'payout_no';
    case 'approval_no':
      return 'approval_no';
    case 'work_order_no':
      return 'work_order_no';
    case 'abc_sync_source_object_key':
      return 'abc_sync_source_object_key';
    default:
      return undefined;
  }
}

function normalizeString(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return String(value).trim();
}

function summarizeBy<T>(items: T[], selector: (item: T) => string) {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    const key = selector(item);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
}
