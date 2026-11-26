import { Injectable } from '@nestjs/common';
import type {
  AiManualTaskBridgeCandidate,
  AiManualTaskBridgeRecommendedTaskType,
} from './ai-manual-task-bridge-candidate.service';
import type { AiTaskDraftReviewType } from './ai-task-draft-orchestration.service';

export type AiManualTaskBridgeDispatchReadinessStatus =
  | 'ready_for_dispatch_review'
  | 'blocked_from_dispatch_review';

export type AiManualTaskBridgeDispatchAuditChecklistStatus =
  | 'present'
  | 'missing'
  | 'future_required'
  | 'not_applicable';

export interface AiManualTaskBridgeDispatchSafetyCounters {
  mutationCounter: 0;
  databaseWriteCounter: 0;
  dispatchCounter: 0;
  taskCreationCounter: 0;
  lifecycleMutationCounter: 0;
  businessWriteCounter: 0;
}

export interface AiManualTaskBridgeDispatchAuditChecklistItem {
  code: string;
  label: string;
  status: AiManualTaskBridgeDispatchAuditChecklistStatus;
  requiredForReadiness: boolean;
  requiredForFutureDispatch: boolean;
  blocksDispatchReadiness: boolean;
  detail: string | null;
}

export interface AiManualTaskBridgeDispatchRoleHints {
  assigneeRoleCodes: string[];
  candidateAssigneeEmployeeIds: Array<string | number>;
  roleHintsAreAuthorization: false;
  assignmentIsCandidateOnly: true;
  finalAssigneeEmployeeId: null;
  finalAssigneeRole: null;
}

export interface AiManualTaskBridgeDispatchReadiness {
  manualTaskDraftId: string;
  sourceArtifactId: string;
  sourceAiInteractionId: string | number | null;
  draftType: AiTaskDraftReviewType;
  recommendedTaskType: AiManualTaskBridgeRecommendedTaskType;
  dispatchReadinessStatus: AiManualTaskBridgeDispatchReadinessStatus;
  readyForDispatchReview: boolean;
  blockedReasons: string[];
  missingAuditFields: string[];
  futureDispatchRequiredFields: string[];
  permissionBasisRequirements: string[];
  auditChecklist: AiManualTaskBridgeDispatchAuditChecklistItem[];
  roleHints: AiManualTaskBridgeDispatchRoleHints;
  sourceBundleIds: string[];
  forbiddenActionCodes: string[];
  forbiddenActionsAreAuditFactsOnly: true;
  boundaryExplanations: string[];
  auditLogRequired: boolean;
  approvalTraceRequired: boolean;
  beforeStatus: 'draft_only';
  afterStatus: null;
  dispatchedAt: null;
  executable: false;
  executionStatus: 'draft_only';
  taskLifecycleStatus: 'draft_only';
  willDispatch: false;
  taskCreated: false;
  lifecycleMutated: false;
  safetyCounters: AiManualTaskBridgeDispatchSafetyCounters;
}

export interface AiManualTaskBridgeDispatchReadinessBatch {
  readinessItems: AiManualTaskBridgeDispatchReadiness[];
  summary: AiManualTaskBridgeDispatchReadinessSummary;
}

export interface AiManualTaskBridgeDispatchReadinessSummary {
  candidateCount: number;
  readyForDispatchReviewCount: number;
  blockedFromDispatchReviewCount: number;
  dispatchReadinessStatuses: AiManualTaskBridgeDispatchReadinessStatus[];
  recommendedTaskTypes: AiManualTaskBridgeRecommendedTaskType[];
  draftTypes: AiTaskDraftReviewType[];
  taskLifecycleStatuses: Array<'draft_only'>;
  executableCandidateCount: number;
  forbiddenActionCodeCount: number;
  missingAuditFields: string[];
  blockedReasons: string[];
  futureDispatchRequiredFields: string[];
  roleHintCandidateCount: number;
  safetyCounters: AiManualTaskBridgeDispatchSafetyCounters;
}

interface NormalizedAiManualTaskBridgeDispatchReadinessCandidate {
  manualTaskDraftId: string;
  sourceArtifactId: string;
  sourceAiInteractionId: string | number | null;
  draftType: AiTaskDraftReviewType;
  recommendedTaskType: AiManualTaskBridgeRecommendedTaskType;
  roleHints: AiManualTaskBridgeDispatchRoleHints;
  sourceBundleIds: string[];
  forbiddenActionCodes: string[];
  boundaryExplanations: string[];
  auditLogRequired: boolean;
  approvalTraceRequired: boolean;
  sourceBundleIdsRequired: boolean;
  humanActorRequired: boolean;
  dispatchAuditRequired: boolean;
  requiresOwnerApproval: boolean;
  originalExecutable: unknown;
  originalExecutionStatus: unknown;
  originalTaskLifecycleStatus: unknown;
}

const FORBIDDEN_ACTION_CODES = [
  'confirm_bank_sms',
  'ignore_bank_sms',
  'reconcile_bank_sms',
  'confirm_bank_sms_apply',
  'create_collection_order',
  'create_confirmed_collection_order',
  'create_payment_record',
  'update_work_order_status',
  'update_work_order_amount_received',
  'execute_payment',
  'mutate_virtual_ledger',
  'confirm_payroll',
  'issue_employee_benefits',
  'confirm_customer_rights',
  'invoke_real_wechat_pay',
  'bypass_approval_or_permission',
] as const;

const SAFE_ROLE_HINT_CODES = new Set([
  'owner',
  'founder',
  'admin',
  'system_admin',
  'super_admin',
  'finance',
  'finance_manager',
  'finance_operator',
  'reviewer',
  'operator',
  'approver',
  'ai_operator',
  'store_manager',
  'customer_service',
]);

const SAFETY_COUNTERS: AiManualTaskBridgeDispatchSafetyCounters = {
  mutationCounter: 0,
  databaseWriteCounter: 0,
  dispatchCounter: 0,
  taskCreationCounter: 0,
  lifecycleMutationCounter: 0,
  businessWriteCounter: 0,
};

const BLOCKED_ACTION_MARKER = '[blocked_action]';
const REDACTED_SENSITIVE_MARKER = '[redacted_sensitive]';
const REDACTED_PHONE_MARKER = '[redacted_phone]';
const REDACTED_ACCOUNT_MARKER = '[redacted_account]';

@Injectable()
export class AiManualTaskBridgeDispatchReadinessService {
  toDispatchReadiness(
    candidate: AiManualTaskBridgeCandidate,
  ): AiManualTaskBridgeDispatchReadiness {
    const safeCandidate = this.normalizeCandidate(candidate);
    const auditChecklist = this.buildAuditChecklist(safeCandidate);
    const blockedReasons = this.resolveBlockedReasons(
      safeCandidate,
      auditChecklist,
    );
    const futureDispatchRequiredFields = this.uniqueStrings(
      auditChecklist
        .filter((item) => item.status === 'future_required')
        .map((item) => item.code),
    );
    const missingAuditFields = this.uniqueStrings(
      auditChecklist
        .filter((item) => item.status === 'missing')
        .map((item) => item.code),
    );
    const readyForDispatchReview = blockedReasons.length === 0;

    return {
      manualTaskDraftId: safeCandidate.manualTaskDraftId,
      sourceArtifactId: safeCandidate.sourceArtifactId,
      sourceAiInteractionId: safeCandidate.sourceAiInteractionId,
      draftType: safeCandidate.draftType,
      recommendedTaskType: safeCandidate.recommendedTaskType,
      dispatchReadinessStatus: readyForDispatchReview
        ? 'ready_for_dispatch_review'
        : 'blocked_from_dispatch_review',
      readyForDispatchReview,
      blockedReasons,
      missingAuditFields,
      futureDispatchRequiredFields,
      permissionBasisRequirements: this.permissionBasisRequirements(),
      auditChecklist,
      roleHints: safeCandidate.roleHints,
      sourceBundleIds: safeCandidate.sourceBundleIds,
      forbiddenActionCodes: safeCandidate.forbiddenActionCodes,
      forbiddenActionsAreAuditFactsOnly: true,
      boundaryExplanations: safeCandidate.boundaryExplanations,
      auditLogRequired: safeCandidate.auditLogRequired,
      approvalTraceRequired: safeCandidate.approvalTraceRequired,
      beforeStatus: 'draft_only',
      afterStatus: null,
      dispatchedAt: null,
      executable: false,
      executionStatus: 'draft_only',
      taskLifecycleStatus: 'draft_only',
      willDispatch: false,
      taskCreated: false,
      lifecycleMutated: false,
      safetyCounters: { ...SAFETY_COUNTERS },
    };
  }

  toDispatchReadinessBatch(
    candidates: readonly AiManualTaskBridgeCandidate[],
  ): AiManualTaskBridgeDispatchReadinessBatch {
    const readinessItems = candidates.map((candidate) =>
      this.toDispatchReadiness(candidate),
    );
    return {
      readinessItems,
      summary: this.buildSummary(readinessItems),
    };
  }

  buildSummary(
    readinessItems: readonly AiManualTaskBridgeDispatchReadiness[],
  ): AiManualTaskBridgeDispatchReadinessSummary {
    return {
      candidateCount: readinessItems.length,
      readyForDispatchReviewCount: readinessItems.filter(
        (item) => item.readyForDispatchReview,
      ).length,
      blockedFromDispatchReviewCount: readinessItems.filter(
        (item) => !item.readyForDispatchReview,
      ).length,
      dispatchReadinessStatuses: this.uniqueTyped(
        readinessItems.map((item) => item.dispatchReadinessStatus),
      ),
      recommendedTaskTypes: this.uniqueTyped(
        readinessItems.map((item) => item.recommendedTaskType),
      ),
      draftTypes: this.uniqueTyped(readinessItems.map((item) => item.draftType)),
      taskLifecycleStatuses: ['draft_only'],
      executableCandidateCount: 0,
      forbiddenActionCodeCount: readinessItems.reduce(
        (count, item) => count + item.forbiddenActionCodes.length,
        0,
      ),
      missingAuditFields: this.uniqueStrings(
        readinessItems.flatMap((item) => item.missingAuditFields),
      ),
      blockedReasons: this.uniqueStrings(
        readinessItems.flatMap((item) => item.blockedReasons),
      ),
      futureDispatchRequiredFields: this.uniqueStrings(
        readinessItems.flatMap((item) => item.futureDispatchRequiredFields),
      ),
      roleHintCandidateCount: readinessItems.filter(
        (item) =>
          item.roleHints.assigneeRoleCodes.length > 0 ||
          item.roleHints.candidateAssigneeEmployeeIds.length > 0,
      ).length,
      safetyCounters: { ...SAFETY_COUNTERS },
    };
  }

  private normalizeCandidate(
    candidate: AiManualTaskBridgeCandidate,
  ): NormalizedAiManualTaskBridgeDispatchReadinessCandidate {
    const sourceBundleIds = this.sanitizeReadTextArray(
      candidate.policyTraceSummary?.sourceBundleIds,
    );
    const assigneeRoleCodes = this.uniqueStrings(
      (candidate.assigneeRoleCodes ?? [])
        .map((role) => this.normalizeToken(role))
        .filter((role) => SAFE_ROLE_HINT_CODES.has(role)),
    );
    const candidateAssigneeEmployeeIds = this.uniqueTyped(
      (candidate.candidateAssigneeEmployeeIds ?? [])
        .map((id) => this.sanitizeEntityId(id))
        .filter((id): id is string | number => id !== null),
    );

    return {
      manualTaskDraftId:
        this.sanitizeReadText(candidate.manualTaskDraftId) ||
        'unknown_manual_task_draft',
      sourceArtifactId:
        this.sanitizeReadText(candidate.sourceArtifactId) ||
        'unknown_source_artifact',
      sourceAiInteractionId: this.sanitizeEntityId(
        candidate.sourceAiInteractionId,
      ),
      draftType: candidate.draftType,
      recommendedTaskType: candidate.recommendedTaskType,
      roleHints: {
        assigneeRoleCodes,
        candidateAssigneeEmployeeIds,
        roleHintsAreAuthorization: false,
        assignmentIsCandidateOnly: true,
        finalAssigneeEmployeeId: null,
        finalAssigneeRole: null,
      },
      sourceBundleIds,
      forbiddenActionCodes: this.resolveForbiddenActionCodes(candidate),
      boundaryExplanations: this.sanitizeReadTextArray(
        candidate.boundaryExplanations,
      ),
      auditLogRequired: candidate.auditRequirement?.auditLogRequired === true,
      approvalTraceRequired:
        candidate.requiresOwnerApproval === true ||
        candidate.auditRequirement?.approvalTraceRequired === true,
      sourceBundleIdsRequired:
        candidate.auditRequirement?.sourceBundleIdsRequired !== false,
      humanActorRequired:
        candidate.auditRequirement?.humanActorRequired === true,
      dispatchAuditRequired:
        candidate.auditRequirement?.dispatchAuditRequired === true,
      requiresOwnerApproval: candidate.requiresOwnerApproval === true,
      originalExecutable: candidate.executable,
      originalExecutionStatus: candidate.executionStatus,
      originalTaskLifecycleStatus: candidate.taskLifecycleStatus,
    };
  }

  private buildAuditChecklist(
    candidate: NormalizedAiManualTaskBridgeDispatchReadinessCandidate,
  ): AiManualTaskBridgeDispatchAuditChecklistItem[] {
    return [
      this.presentReadinessItem(
        'sourceArtifactId',
        'Source artifact ID is preserved',
        candidate.sourceArtifactId !== 'unknown_source_artifact',
        candidate.sourceArtifactId,
      ),
      this.presentReadinessItem(
        'sourceAiInteractionId',
        'Source AI interaction ID is preserved',
        candidate.sourceAiInteractionId !== null,
        candidate.sourceAiInteractionId,
      ),
      this.presentReadinessItem(
        'manualTaskDraftId',
        'Manual task draft ID is preserved',
        candidate.manualTaskDraftId !== 'unknown_manual_task_draft',
        candidate.manualTaskDraftId,
      ),
      this.presentReadinessItem(
        'auditLogRequired',
        'Audit log requirement is true',
        candidate.auditLogRequired,
        candidate.auditLogRequired ? 'true' : null,
      ),
      this.presentReadinessItem(
        'dispatchAuditRequired',
        'Dispatch audit requirement is true',
        candidate.dispatchAuditRequired,
        candidate.dispatchAuditRequired ? 'true' : null,
      ),
      this.presentReadinessItem(
        'humanActorRequired',
        'Human actor requirement is true',
        candidate.humanActorRequired,
        candidate.humanActorRequired ? 'true' : null,
      ),
      this.presentConditionalItem(
        'sourceBundleIds',
        'Safe source bundle IDs are available when required',
        candidate.sourceBundleIdsRequired,
        candidate.sourceBundleIds.length > 0,
        candidate.sourceBundleIds.join(',') || null,
      ),
      this.presentReadinessItem(
        'boundaryExplanations',
        'Boundary explanations remain visible',
        candidate.boundaryExplanations.length > 0,
        `${candidate.boundaryExplanations.length}`,
      ),
      this.optionalPresentItem(
        'forbiddenActionCodes',
        'Forbidden action codes remain audit facts only',
        candidate.forbiddenActionCodes.length > 0,
        `${candidate.forbiddenActionCodes.length}`,
      ),
      this.futureRequiredItem(
        'dispatcherUserId',
        'Future dispatcher user ID must be recorded before dispatch',
      ),
      this.futureRequiredItem(
        'dispatcherRole',
        'Future dispatcher role must be recorded before dispatch',
      ),
      this.futureRequiredItem(
        'finalAssigneeEmployeeId',
        'Future final assignee employee ID must be recorded before dispatch',
      ),
      this.futureRequiredItem(
        'finalAssigneeRole',
        'Future final assignee role must be recorded before dispatch',
      ),
      this.futureRequiredItem(
        'dispatchReason',
        'Future dispatch reason must be recorded before dispatch',
      ),
      this.futureRequiredItem(
        'permissionBasis',
        'Future backend permission basis must be proven before dispatch',
      ),
      this.futureRequiredItem(
        'afterStatus',
        'Future after-status must be recorded by an approved lifecycle service',
      ),
      this.futureRequiredItem(
        'dispatchedAt',
        'Future dispatch timestamp must be recorded by an approved lifecycle service',
      ),
    ];
  }

  private resolveBlockedReasons(
    candidate: NormalizedAiManualTaskBridgeDispatchReadinessCandidate,
    auditChecklist: readonly AiManualTaskBridgeDispatchAuditChecklistItem[],
  ): string[] {
    const reasons = auditChecklist
      .filter((item) => item.blocksDispatchReadiness)
      .map((item) => `missing_${item.code}`);
    if (candidate.originalExecutable !== false) {
      reasons.push('candidate_must_remain_non_executable');
    }
    if (candidate.originalExecutionStatus !== 'draft_only') {
      reasons.push('execution_status_must_remain_draft_only');
    }
    if (candidate.originalTaskLifecycleStatus !== 'draft_only') {
      reasons.push('task_lifecycle_status_must_remain_draft_only');
    }
    if (candidate.requiresOwnerApproval && !candidate.approvalTraceRequired) {
      reasons.push('owner_approval_requires_approval_trace');
    }
    return this.uniqueStrings(reasons);
  }

  private presentReadinessItem(
    code: string,
    label: string,
    present: boolean,
    detail: unknown,
  ): AiManualTaskBridgeDispatchAuditChecklistItem {
    return {
      code,
      label,
      status: present ? 'present' : 'missing',
      requiredForReadiness: true,
      requiredForFutureDispatch: true,
      blocksDispatchReadiness: !present,
      detail: this.sanitizeNullableReadText(detail),
    };
  }

  private presentConditionalItem(
    code: string,
    label: string,
    required: boolean,
    present: boolean,
    detail: unknown,
  ): AiManualTaskBridgeDispatchAuditChecklistItem {
    if (!required) {
      return {
        code,
        label,
        status: present ? 'present' : 'not_applicable',
        requiredForReadiness: false,
        requiredForFutureDispatch: false,
        blocksDispatchReadiness: false,
        detail: this.sanitizeNullableReadText(detail),
      };
    }
    return this.presentReadinessItem(code, label, present, detail);
  }

  private optionalPresentItem(
    code: string,
    label: string,
    present: boolean,
    detail: unknown,
  ): AiManualTaskBridgeDispatchAuditChecklistItem {
    return {
      code,
      label,
      status: present ? 'present' : 'missing',
      requiredForReadiness: false,
      requiredForFutureDispatch: true,
      blocksDispatchReadiness: false,
      detail: this.sanitizeNullableReadText(detail),
    };
  }

  private futureRequiredItem(
    code: string,
    label: string,
  ): AiManualTaskBridgeDispatchAuditChecklistItem {
    return {
      code,
      label,
      status: 'future_required',
      requiredForReadiness: false,
      requiredForFutureDispatch: true,
      blocksDispatchReadiness: false,
      detail: null,
    };
  }

  private permissionBasisRequirements(): string[] {
    return [
      'Backend must verify dispatcher read and dispatch permission.',
      'Backend must verify final assignee visibility and task-scope permission.',
      'Backend must preserve masking rules for phone, bank-account, SMS, customer, and connector data.',
      'Backend must route any future business action through the existing business service, approval, and audit path.',
      'Manual task lifecycle status must not mutate the underlying business object.',
    ];
  }

  private resolveForbiddenActionCodes(
    candidate: AiManualTaskBridgeCandidate,
  ): string[] {
    return this.uniqueStrings(
      (candidate.forbiddenActionCodes ?? [])
        .map((code) => this.normalizePlainToken(code))
        .filter((code) => code.length > 0),
    );
  }

  private sanitizeReadTextArray(
    values: readonly unknown[] | null | undefined,
  ): string[] {
    return this.uniqueStrings(
      (values ?? [])
        .map((value) => this.sanitizeReadText(value))
        .filter((value): value is string => value.length > 0),
    );
  }

  private sanitizeNullableReadText(value: unknown): string | null {
    return this.sanitizeReadText(value) || null;
  }

  private sanitizeEntityId(value: unknown): string | number | null {
    if (this.hasSensitiveMarker(value)) {
      return null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    const sanitized = this.sanitizeReadText(value);
    return sanitized || null;
  }

  private sanitizeReadText(value: unknown): string {
    if (value === undefined || value === null) {
      return '';
    }
    let text = String(value).trim();
    if (!text) {
      return '';
    }
    for (const code of FORBIDDEN_ACTION_CODES) {
      text = text.replace(
        new RegExp(this.escapeRegExp(code), 'gi'),
        BLOCKED_ACTION_MARKER,
      );
    }
    text = text
      .replace(/\b1[3-9]\d{9}\b/g, REDACTED_PHONE_MARKER)
      .replace(/\b\d{12,}\b/g, REDACTED_ACCOUNT_MARKER)
      .replace(/<RAW_SMS_BODY_BLOCKED>/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/<VERIFICATION_CODE_BLOCKED>/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/<FULL_PHONE_BLOCKED>/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/<FULL_BANK_ACCOUNT_BLOCKED>/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/<SECRET_BLOCKED>/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/raw[_\s-]?candidate[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/raw[_\s-]?sms[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(
        /verification[_\s-]?(code|marker|value)[_\s:a-z0-9-]*/gi,
        REDACTED_SENSITIVE_MARKER,
      )
      .replace(/full[_\s-]?phone[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(
        /full[_\s-]?(bank[_\s-]?)?account[_\s:a-z0-9-]*/gi,
        REDACTED_SENSITIVE_MARKER,
      )
      .replace(/secret[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/private[_\s-]?key[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/certificate[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/cert[_\s-]?marker[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/database[_\s-]?file[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/db[_\s-]?file[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/runtime[_\s-]?log[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/production[_\s-]?connector[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/\.env/gi, REDACTED_SENSITIVE_MARKER);
    return text.trim();
  }

  private hasSensitiveMarker(value: unknown): boolean {
    const text = String(value ?? '').toLowerCase();
    return (
      /raw[_\s-]?candidate/.test(text) ||
      /raw[_\s-]?sms/.test(text) ||
      /verification[_\s-]?(code|marker|value)/.test(text) ||
      /full[_\s-]?phone/.test(text) ||
      /full[_\s-]?(bank[_\s-]?)?account/.test(text) ||
      /secret/.test(text) ||
      /private[_\s-]?key/.test(text) ||
      /certificate/.test(text) ||
      /cert[_\s-]?marker/.test(text) ||
      /database[_\s-]?file/.test(text) ||
      /db[_\s-]?file/.test(text) ||
      /runtime[_\s-]?log/.test(text) ||
      /production[_\s-]?connector/.test(text) ||
      text.includes('.env') ||
      /\b1[3-9]\d{9}\b/.test(text) ||
      /\b\d{12,}\b/.test(text)
    );
  }

  private normalizeToken(value: unknown): string {
    return this.sanitizeReadText(value)
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/[^a-z0-9:]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private normalizePlainToken(value: unknown): string {
    return String(value ?? '')
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/[^a-z0-9:]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private uniqueStrings(items: readonly string[]): string[] {
    return [...new Set(items)];
  }

  private uniqueTyped<T extends string | number>(items: readonly T[]): T[] {
    return [...new Set(items)];
  }
}
