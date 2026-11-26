import { Injectable } from '@nestjs/common';
import type { OperationLog } from '../../operation-logs/entities/operation-log.entity';

type SafePrimitive = string | number | boolean | null;
type SafeValue = SafePrimitive | SafePrimitive[];
type PlainRecord = Record<string, unknown>;

export type AiOperationLogRiskLevel =
  | 'info'
  | 'review_required'
  | 'approval_required'
  | 'finance_blocked'
  | 'forbidden_for_ai_action';

export type AiReadableOperationLogLike = Partial<
  Pick<
    OperationLog,
    | 'id'
    | 'module'
    | 'targetId'
    | 'action'
    | 'operatorId'
    | 'actorType'
    | 'detail'
    | 'detailJson'
    | 'createdAt'
  >
> &
  PlainRecord;

export type AiRawDataExcludedFlagKey =
  | 'rawSmsBodyIncluded'
  | 'verificationCodeValueIncluded'
  | 'fullPhoneIncluded'
  | 'fullBankAccountIncluded'
  | 'secretsIncluded'
  | 'envIncluded'
  | 'privateKeyIncluded'
  | 'certificateIncluded'
  | 'databaseFileIncluded'
  | 'runtimeLogIncluded'
  | 'rawCustomerPrivateDataIncluded';

export interface AiReadableOperationLogRelatedObject {
  type: string;
  id: string;
}

export interface AiReadableOperationLogActorSummary {
  actorType: 'human' | 'system' | 'unknown';
  operatorId: number | null;
  roleSummary: string;
}

export interface AiReadableOperationLogPermissionHints {
  readOnly: true;
  canExplain: true;
  canSuggestNextSteps: boolean;
  canDraftTask: boolean;
  requiresHumanApproval: boolean;
  actionPermissionMatrixRequired: true;
}

export interface AiReadableOperationLogContextBundle {
  bundleVersion: 1;
  sourceModule: string;
  sourceEntityType: string;
  sourceEntityId: string | null;
  sourceLogId: number | null;
  eventType: string;
  action: string;
  riskLevel: AiOperationLogRiskLevel;
  currentStatus: string | null;
  evidenceSummary: string[];
  safeFacts: Record<string, SafeValue>;
  missingEvidence: string[];
  suggestedNextSteps: string[];
  relatedObjects: AiReadableOperationLogRelatedObject[];
  actorSummary: AiReadableOperationLogActorSummary;
  timestamps: {
    loggedAt: string | null;
  };
  permissionHints: AiReadableOperationLogPermissionHints;
  forbiddenActions: string[];
  rawDataExcludedFlags: Record<AiRawDataExcludedFlagKey, false>;
}

export const AI_READABLE_OPERATION_LOG_SAFE_FACT_KEYS = [
  'reasonCode',
  'bridgeHelperStatus',
  'candidateCount',
  'selectedLinkType',
  'selectedLinkId',
  'linkType',
  'linkId',
  'collectionOrderId',
  'candidateCollectionOrderIds',
  'rankingReasons',
  'candidateScore',
  'requestedConfirmedAmount',
  'diagnosticVersion',
  'candidateSourcesChecked',
  'missingEvidenceHints',
  'safeNextStepHints',
  'bankSmsTransactionId',
  'companyId',
  'direction',
  'amount',
  'bankName',
  'accountTail',
  'counterpartyPresent',
  'companyBound',
  'rawSmsBodyIncluded',
  'verificationCodeValueIncluded',
  'reconciliationLinkId',
  'suggestedAmount',
  'confirmedAmount',
  'verificationCodeRequired',
  'verificationCodeProvided',
  'backendMessage',
  'attached',
  'ready',
  'workOrderId',
  'workOrderStatus',
  'amountDue',
  'statusAppliedToWorkOrder',
  'recordId',
  'recordNo',
  'method',
  'source',
  'taskCode',
  'taskId',
  'taskItemId',
  'executionTaskId',
  'executionTaskItemId',
  'executionResultId',
  'playbookId',
  'playbookCode',
  'status',
  'evidenceStatus',
  'ruleStrength',
  'resultStatus',
  'businessImpact',
  'convertedFlag',
  'repliedFlag',
  'nonConversionReason',
] as const;

export const AI_READABLE_OPERATION_LOG_RAW_DATA_EXCLUDED_FLAG_KEYS = [
  'rawSmsBodyIncluded',
  'verificationCodeValueIncluded',
  'fullPhoneIncluded',
  'fullBankAccountIncluded',
  'secretsIncluded',
  'envIncluded',
  'privateKeyIncluded',
  'certificateIncluded',
  'databaseFileIncluded',
  'runtimeLogIncluded',
  'rawCustomerPrivateDataIncluded',
] as const satisfies readonly AiRawDataExcludedFlagKey[];

const SAFE_FACT_KEY_SET = new Set<string>(AI_READABLE_OPERATION_LOG_SAFE_FACT_KEYS);

const DEFAULT_FORBIDDEN_ACTIONS = [
  'ai_confirm_bank_sms',
  'ai_confirm_collection_order',
  'ai_mutate_payment_records',
  'ai_mutate_work_order_amount_received',
  'ai_mutate_work_order_status',
  'ai_mutate_virtual_ledger',
  'ai_execute_real_payment',
  'ai_confirm_payroll',
  'ai_confirm_employee_benefits',
  'ai_confirm_customer_rights',
  'ai_bypass_approval_or_permission',
];

const BLOCKED_KEY_EXACT = new Set([
  'rawsmsbody',
  'rawsmscontent',
  'rawsmsmessage',
  'smsbody',
  'messagebody',
  'originalmessage',
  'verificationcode',
  'verificationcodevalue',
  'fullphone',
  'phonenumber',
  'customerphone',
  'customermobile',
  'mobile',
  'phone',
  'fullbankaccount',
  'bankaccount',
  'bankaccountno',
  'bankaccountnumber',
  'accountnumber',
  'accountno',
  'cardnumber',
  'bankcardno',
  'bankcardnumber',
  'secret',
  'secrets',
  'token',
  'accesstoken',
  'refreshtoken',
  'password',
  'env',
  'dotenv',
  'privatekey',
  'certificate',
  'cert',
  'databasefile',
  'dbfile',
  'runtimelog',
  'runtimeLogs',
  'rawcustomerdata',
  'rawcustomerprivatedata',
]);

const BLOCKED_KEY_FRAGMENTS = [
  'privatekey',
  'certificate',
  'rawcustomer',
  'databasefile',
  'runtime',
  'plaintext',
  'fullaccount',
  'fullcard',
];

const BLOCKED_VALUE_PATTERNS = [
  /<RAW_SMS_BODY_BLOCKED>/i,
  /<VERIFICATION_CODE_BLOCKED>/i,
  /<FULL_PHONE_BLOCKED>/i,
  /<FULL_BANK_ACCOUNT_BLOCKED>/i,
  /<SECRET_BLOCKED>/i,
  /<ENV_BLOCKED>/i,
  /<PRIVATE_KEY_BLOCKED>/i,
  /<CERT_BLOCKED>/i,
  /<DATABASE_BLOCKED>/i,
  /<RUNTIME_LOG_BLOCKED>/i,
  /\b1[3-9]\d{9}\b/,
  /\b\d{16,19}\b/,
];

const REVIEW_REQUIRED_EVENTS = new Set([
  'bank_sms_reconciliation_no_candidate',
  'bank_sms_reconciliation_suggestion_created',
  'bank_sms_confirm_apply_attempted',
  'bank_sms_collection_bridge_helper_result',
]);

const FINANCE_BLOCKED_EVENTS = new Set(['bank_sms_confirm_apply_blocked']);
const AI_FORBIDDEN_EVENTS = new Set(['bank_sms_confirm_apply_succeeded']);

const REVIEW_REQUIRED_ACTIONS = new Set([
  'create_execution_task',
  'create_execution_playbook',
]);

const APPROVAL_REQUIRED_ACTIONS = new Set([
  'create_payment_record',
  'create_work_order',
  'update_work_order',
  'confirm_execution_task',
  'close_execution_task',
  'confirm_execution_task_item',
  'skip_execution_task_item',
  'record_execution_result',
  'update_execution_playbook',
  'toggle_execution_playbook',
]);

const AI_FORBIDDEN_ACTIONS = new Set(['payment_success']);

@Injectable()
export class AiReadableOperationLogContextService {
  toContextBundle(log: AiReadableOperationLogLike): AiReadableOperationLogContextBundle {
    const detail = this.readDetail(log.detailJson);
    const safeFacts = this.collectSafeFacts(detail);
    const eventType = this.textValue(detail.eventType) ?? this.textValue(log.action) ?? 'unknown';
    const action = this.textValue(log.action) ?? eventType;
    const sourceModule = this.textValue(log.module) ?? 'unknown';
    const riskLevel = this.inferRiskLevel({
      eventType,
      action,
      sourceModule,
      safeFacts,
    });

    return {
      bundleVersion: 1,
      sourceModule,
      sourceEntityType: this.inferSourceEntityType(sourceModule, eventType, action, safeFacts),
      sourceEntityId: this.idValue(log.targetId),
      sourceLogId: typeof log.id === 'number' ? log.id : null,
      eventType,
      action,
      riskLevel,
      currentStatus: this.inferCurrentState(safeFacts),
      evidenceSummary: this.composeEvidenceSummary(safeFacts, eventType, action),
      safeFacts,
      missingEvidence: this.composeMissingEvidence(safeFacts),
      suggestedNextSteps: this.composeSuggestedNextSteps(safeFacts),
      relatedObjects: this.collectRelatedObjects(safeFacts),
      actorSummary: this.buildActorSummary(log),
      timestamps: {
        loggedAt: this.toIsoString(log.createdAt),
      },
      permissionHints: this.composePermissionHints(riskLevel),
      forbiddenActions: [...DEFAULT_FORBIDDEN_ACTIONS],
      rawDataExcludedFlags: this.composeRawDataExcludedFlags(),
    };
  }

  private buildActorSummary(
    log: AiReadableOperationLogLike,
  ): AiReadableOperationLogActorSummary {
    const operatorId = typeof log.operatorId === 'number' ? log.operatorId : null;
    const actorType =
      log.actorType === 'system'
        ? 'system'
        : log.actorType === 'human' || operatorId !== null
          ? 'human'
          : 'unknown';

    return {
      actorType,
      operatorId: actorType === 'system' ? null : operatorId,
      roleSummary:
        actorType === 'system'
          ? 'system_policy'
          : actorType === 'human'
            ? 'operator_id_only'
            : 'unknown_actor',
    };
  }

  toContextBundles(
    logs: readonly AiReadableOperationLogLike[],
  ): AiReadableOperationLogContextBundle[] {
    return logs.map((log) => this.toContextBundle(log));
  }

  private inferRiskLevel(input: {
    eventType: string;
    action: string;
    sourceModule: string;
    safeFacts: Record<string, SafeValue>;
  }): AiOperationLogRiskLevel {
    const eventType = input.eventType.toLowerCase();
    const action = input.action.toLowerCase();
    const sourceModule = input.sourceModule.toLowerCase();

    if (AI_FORBIDDEN_EVENTS.has(eventType) || AI_FORBIDDEN_ACTIONS.has(action)) {
      return 'forbidden_for_ai_action';
    }

    if (FINANCE_BLOCKED_EVENTS.has(eventType)) {
      return 'finance_blocked';
    }

    if (REVIEW_REQUIRED_EVENTS.has(eventType)) {
      return 'review_required';
    }

    if (sourceModule === 'engagement' && this.hasBusinessImpact(input.safeFacts)) {
      return 'approval_required';
    }

    if (APPROVAL_REQUIRED_ACTIONS.has(action)) {
      return 'approval_required';
    }

    if (REVIEW_REQUIRED_ACTIONS.has(action)) {
      return 'review_required';
    }

    return 'info';
  }

  private inferSourceEntityType(
    sourceModule: string,
    eventType: string,
    action: string,
    safeFacts: Record<string, SafeValue>,
  ): string {
    if (sourceModule === 'finance_bank_sms' || eventType.startsWith('bank_sms_')) {
      return 'bank_sms_transaction';
    }
    if (sourceModule === 'finance_reconciliation') {
      return 'finance_reconciliation_link';
    }
    if (sourceModule === 'payment_record') {
      return 'payment_record';
    }
    if (sourceModule === 'work_order') {
      return 'work_order';
    }
    if (sourceModule === 'engagement') {
      if (action.includes('result') || safeFacts.executionResultId !== undefined) {
        return 'execution_result';
      }
      if (safeFacts.executionTaskItemId !== undefined || safeFacts.taskItemId !== undefined) {
        return 'execution_task_item';
      }
      return 'execution_task';
    }
    return 'operation_log_target';
  }

  private inferCurrentState(safeFacts: Record<string, SafeValue>): string | null {
    const candidates = [
      safeFacts.status,
      safeFacts.resultStatus,
      safeFacts.bridgeHelperStatus,
      safeFacts.reasonCode,
      safeFacts.workOrderStatus,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }
    return null;
  }

  private composeEvidenceSummary(
    safeFacts: Record<string, SafeValue>,
    eventType: string,
    action: string,
  ): string[] {
    const summary = [`event:${eventType}`, `action:${action}`];
    const reasonCode = safeFacts.reasonCode;
    const candidateCount = safeFacts.candidateCount;
    const bridgeHelperStatus = safeFacts.bridgeHelperStatus;
    if (typeof reasonCode === 'string') {
      summary.push(`reason:${reasonCode}`);
    }
    if (typeof candidateCount === 'number') {
      summary.push(`candidate_count:${candidateCount}`);
    }
    if (typeof bridgeHelperStatus === 'string') {
      summary.push(`bridge_helper:${bridgeHelperStatus}`);
    }
    return summary;
  }

  private composeMissingEvidence(safeFacts: Record<string, SafeValue>): string[] {
    return this.stringArrayValue(safeFacts.missingEvidenceHints);
  }

  private composeSuggestedNextSteps(safeFacts: Record<string, SafeValue>): string[] {
    return this.stringArrayValue(safeFacts.safeNextStepHints);
  }

  private collectRelatedObjects(
    safeFacts: Record<string, SafeValue>,
  ): AiReadableOperationLogRelatedObject[] {
    const objects: AiReadableOperationLogRelatedObject[] = [];
    this.pushRelatedObject(objects, 'bank_sms_transaction', safeFacts.bankSmsTransactionId);
    this.pushRelatedObject(objects, 'finance_reconciliation_link', safeFacts.reconciliationLinkId);
    this.pushRelatedObject(objects, 'finance_collection_order', safeFacts.collectionOrderId);
    this.pushRelatedObject(objects, 'work_order', safeFacts.workOrderId);
    this.pushRelatedObject(objects, 'execution_task', safeFacts.executionTaskId ?? safeFacts.taskId);
    this.pushRelatedObject(
      objects,
      'execution_task_item',
      safeFacts.executionTaskItemId ?? safeFacts.taskItemId,
    );
    this.pushRelatedObject(objects, 'execution_result', safeFacts.executionResultId);
    this.pushRelatedObject(objects, 'execution_playbook', safeFacts.playbookId);

    const linkType = safeFacts.selectedLinkType ?? safeFacts.linkType;
    const linkId = safeFacts.selectedLinkId ?? safeFacts.linkId;
    if (typeof linkType === 'string' && (typeof linkId === 'number' || typeof linkId === 'string')) {
      this.pushRelatedObject(objects, linkType, linkId);
    }

    for (const id of this.idArrayValue(safeFacts.candidateCollectionOrderIds)) {
      this.pushRelatedObject(objects, 'finance_collection_order_candidate', id);
    }

    return objects;
  }

  private pushRelatedObject(
    objects: AiReadableOperationLogRelatedObject[],
    type: string,
    value: SafeValue | undefined,
  ): void {
    if (typeof value !== 'number' && typeof value !== 'string') {
      return;
    }
    const id = String(value).trim();
    if (!id) {
      return;
    }
    objects.push({ type, id });
  }

  private composePermissionHints(
    riskLevel: AiOperationLogRiskLevel,
  ): AiReadableOperationLogPermissionHints {
    return {
      readOnly: true,
      canExplain: true,
      canSuggestNextSteps: riskLevel !== 'forbidden_for_ai_action',
      canDraftTask:
        riskLevel === 'review_required' ||
        riskLevel === 'approval_required' ||
        riskLevel === 'finance_blocked',
      requiresHumanApproval:
        riskLevel === 'approval_required' ||
        riskLevel === 'finance_blocked' ||
        riskLevel === 'forbidden_for_ai_action',
      actionPermissionMatrixRequired: true,
    };
  }

  private collectSafeFacts(detail: PlainRecord): Record<string, SafeValue> {
    const safeFacts: Record<string, SafeValue> = {};
    for (const [key, value] of Object.entries(detail)) {
      if (!SAFE_FACT_KEY_SET.has(key)) {
        continue;
      }
      if (key === 'rawSmsBodyIncluded' || key === 'verificationCodeValueIncluded') {
        if (value === false) {
          safeFacts[key] = false;
        }
        continue;
      }
      const safeValue = this.safeValue(key, value);
      if (safeValue !== undefined) {
        safeFacts[key] = safeValue;
      }
    }
    return safeFacts;
  }

  private safeValue(key: string, value: unknown): SafeValue | undefined {
    if (this.isBlockedKey(key)) {
      return undefined;
    }
    if (value === null || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return this.isBlockedString(value) ? undefined : value;
    }
    if (Array.isArray(value)) {
      const safeItems = value
        .map((item) => this.safeArrayItem(key, item))
        .filter((item): item is SafePrimitive => item !== undefined);
      return safeItems.length ? safeItems : undefined;
    }
    return undefined;
  }

  private safeArrayItem(key: string, value: unknown): SafePrimitive | undefined {
    if (this.isBlockedKey(key)) {
      return undefined;
    }
    if (value === null || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return this.isBlockedString(value) ? undefined : value;
    }
    return undefined;
  }

  private readDetail(value: unknown): PlainRecord {
    if (this.isPlainRecord(value)) {
      return value;
    }
    if (typeof value !== 'string') {
      return {};
    }
    try {
      const parsed: unknown = JSON.parse(value);
      return this.isPlainRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  private isPlainRecord(value: unknown): value is PlainRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private textValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private idValue(value: unknown): string | null {
    if (typeof value === 'number' || typeof value === 'string') {
      const text = String(value).trim();
      return text || null;
    }
    return null;
  }

  private stringArrayValue(value: SafeValue | undefined): string[] {
    if (!Array.isArray(value)) {
      return typeof value === 'string' && value.trim() ? [value] : [];
    }
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private idArrayValue(value: SafeValue | undefined): Array<string | number> {
    const values = Array.isArray(value) ? value : [value];
    return values
      .map((item) => {
        if (typeof item === 'number') {
          return Number.isFinite(item) ? item : null;
        }
        if (typeof item !== 'string') {
          return null;
        }
        const trimmed = item.trim();
        if (!trimmed || this.isBlockedString(trimmed)) {
          return null;
        }
        return trimmed;
      })
      .filter((item): item is string | number => item !== null);
  }

  private hasBusinessImpact(safeFacts: Record<string, SafeValue>): boolean {
    const businessImpact = safeFacts.businessImpact;
    if (typeof businessImpact === 'boolean') {
      return businessImpact;
    }
    if (typeof businessImpact === 'string') {
      return ['true', 'yes', 'confirmed', 'converted', 'closed'].includes(
        businessImpact.toLowerCase(),
      );
    }
    return false;
  }

  private isBlockedKey(key: string): boolean {
    const normalized = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return (
      BLOCKED_KEY_EXACT.has(normalized) ||
      BLOCKED_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment))
    );
  }

  private isBlockedString(value: string): boolean {
    return BLOCKED_VALUE_PATTERNS.some((pattern) => pattern.test(value));
  }

  private toIsoString(value: unknown): string | null {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  private composeRawDataExcludedFlags(): Record<AiRawDataExcludedFlagKey, false> {
    return AI_READABLE_OPERATION_LOG_RAW_DATA_EXCLUDED_FLAG_KEYS.reduce(
      (flags, key) => {
        flags[key] = false;
        return flags;
      },
      {} as Record<AiRawDataExcludedFlagKey, false>,
    );
  }
}
