import { Injectable } from '@nestjs/common';
import type {
  AiManualTaskBridgeCandidate,
  AiManualTaskBridgeRecommendedTaskType,
} from './ai-manual-task-bridge-candidate.service';
import type {
  AiManualTaskBridgeDispatchAuditChecklistItem,
  AiManualTaskBridgeDispatchReadiness,
  AiManualTaskBridgeDispatchReadinessStatus,
  AiManualTaskBridgeDispatchRoleHints,
  AiManualTaskBridgeDispatchSafetyCounters,
} from './ai-manual-task-bridge-dispatch-readiness.service';
import type { AiTaskDraftReviewType } from './ai-task-draft-orchestration.service';

export type AiManualTaskBridgeEmployeeHandoffViewerRole =
  | 'owner'
  | 'admin'
  | 'finance'
  | 'reviewer'
  | 'operator'
  | 'customer_service';

export type AiManualTaskBridgeEmployeeHandoffPreviewVisibility =
  | 'visible_to_employee_ai'
  | 'visible_to_supervisor_review'
  | 'blocked_from_preview';

export type AiManualTaskBridgeEmployeeHandoffPreviewStatus =
  | 'ready_for_handoff_preview'
  | 'blocked_from_handoff_preview';

export interface AiManualTaskBridgeEmployeeHandoffAuditChecklistDisplayItem {
  code: string;
  label: string;
  status: string;
  detail: string | null;
  displayToEmployee: boolean;
  displayToSupervisor: boolean;
}

export interface AiManualTaskBridgeEmployeeHandoffPreview {
  manualTaskDraftId: string;
  sourceArtifactId: string;
  sourceAiInteractionId: string | number | null;
  draftType: AiTaskDraftReviewType;
  recommendedTaskType: AiManualTaskBridgeRecommendedTaskType;
  viewerRole: string;
  previewVisibility: AiManualTaskBridgeEmployeeHandoffPreviewVisibility;
  handoffPreviewStatus: AiManualTaskBridgeEmployeeHandoffPreviewStatus;
  title: string;
  summary: string;
  checklistItems: string[];
  evidenceRequirements: string[];
  sourceEntityType: string | null;
  sourceEntityId: string | number | null;
  targetEntityType: string | null;
  targetEntityId: string | number | null;
  dispatchReadinessStatus: AiManualTaskBridgeDispatchReadinessStatus;
  readyForDispatchReview: boolean;
  displayBlockedReasons: string[];
  missingAuditFields: string[];
  futureDispatchRequiredFields: string[];
  displayAuditChecklist: AiManualTaskBridgeEmployeeHandoffAuditChecklistDisplayItem[];
  permissionBasisRequirements: string[];
  boundaryExplanations: string[];
  sourceBundleIds: string[];
  auditLogRequired: boolean;
  approvalTraceRequired: boolean;
  roleHints: AiManualTaskBridgeDispatchRoleHints;
  forbiddenActionCodeCount: number;
  forbiddenActionsAreAuditFactsOnly: true;
  roleHintsAreAuthorization: false;
  assignmentIsCandidateOnly: true;
  beforeStatus: 'draft_only';
  afterStatus: null;
  dispatchedAt: null;
  executable: false;
  executionStatus: 'draft_only';
  taskLifecycleStatus: 'draft_only';
  willDispatch: false;
  taskCreated: false;
  lifecycleMutated: false;
  performanceBasis: false;
  safetyCounters: AiManualTaskBridgeDispatchSafetyCounters;
}

export interface AiManualTaskBridgeEmployeeHandoffPreviewInput {
  candidate: AiManualTaskBridgeCandidate;
  dispatchReadiness: AiManualTaskBridgeDispatchReadiness;
  viewerRole?: string | null;
}

export interface AiManualTaskBridgeEmployeeHandoffPreviewBatch {
  previews: AiManualTaskBridgeEmployeeHandoffPreview[];
  summary: AiManualTaskBridgeEmployeeHandoffPreviewSummary;
}

export interface AiManualTaskBridgeEmployeeHandoffPreviewSummary {
  previewCount: number;
  visibleToEmployeeAiCount: number;
  visibleToSupervisorReviewCount: number;
  blockedFromPreviewCount: number;
  readyForHandoffPreviewCount: number;
  blockedFromHandoffPreviewCount: number;
  viewerRoles: string[];
  draftTypes: AiTaskDraftReviewType[];
  recommendedTaskTypes: AiManualTaskBridgeRecommendedTaskType[];
  dispatchReadinessStatuses: AiManualTaskBridgeDispatchReadinessStatus[];
  forbiddenActionCodeCount: number;
  willDispatchCount: 0;
  taskCreatedCount: 0;
  lifecycleMutatedCount: 0;
  performanceBasisCount: 0;
  safetyCounters: AiManualTaskBridgeDispatchSafetyCounters;
}

interface ViewerRoleResolution {
  normalizedViewerRole: string;
  canonicalRole: AiManualTaskBridgeEmployeeHandoffViewerRole | null;
  roleBlockedReasons: string[];
  protectedRoleFailure: boolean;
  supervisorReviewRole: boolean;
}

const SUPERVISOR_REVIEW_ROLES = new Set<
  AiManualTaskBridgeEmployeeHandoffViewerRole
>(['owner', 'admin', 'finance', 'reviewer']);

const ROLE_ALIASES: Record<string, AiManualTaskBridgeEmployeeHandoffViewerRole> = {
  owner: 'owner',
  founder: 'owner',
  admin: 'admin',
  system_admin: 'admin',
  super_admin: 'admin',
  finance: 'finance',
  finance_manager: 'finance',
  finance_operator: 'finance',
  reviewer: 'reviewer',
  approver: 'reviewer',
  operator: 'operator',
  ai_operator: 'operator',
  store_manager: 'operator',
  customer_service: 'customer_service',
  customer_support: 'customer_service',
};

const ROLE_SCOPE_HINTS: Record<
  AiManualTaskBridgeEmployeeHandoffViewerRole,
  string[]
> = {
  owner: ['owner', 'founder'],
  admin: ['admin', 'system_admin', 'super_admin'],
  finance: ['finance', 'finance_manager', 'finance_operator'],
  reviewer: ['reviewer', 'approver'],
  operator: ['operator', 'ai_operator', 'store_manager'],
  customer_service: ['customer_service', 'customer_support'],
};

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

const SAFETY_COUNTERS: AiManualTaskBridgeDispatchSafetyCounters = {
  mutationCounter: 0,
  databaseWriteCounter: 0,
  dispatchCounter: 0,
  taskCreationCounter: 0,
  lifecycleMutationCounter: 0,
  businessWriteCounter: 0,
};

const EMPTY_ROLE_HINTS: AiManualTaskBridgeDispatchRoleHints = {
  assigneeRoleCodes: [],
  candidateAssigneeEmployeeIds: [],
  roleHintsAreAuthorization: false,
  assignmentIsCandidateOnly: true,
  finalAssigneeEmployeeId: null,
  finalAssigneeRole: null,
};

const BLOCKED_ACTION_MARKER = '[blocked_action]';
const REDACTED_SENSITIVE_MARKER = '[redacted_sensitive]';
const REDACTED_PHONE_MARKER = '[redacted_phone]';
const REDACTED_ACCOUNT_MARKER = '[redacted_account]';

@Injectable()
export class AiManualTaskBridgeEmployeeHandoffPreviewService {
  toEmployeeHandoffPreview(
    input: AiManualTaskBridgeEmployeeHandoffPreviewInput,
  ): AiManualTaskBridgeEmployeeHandoffPreview {
    const roleResolution = this.resolveViewerRole(
      input.viewerRole,
      input.dispatchReadiness.roleHints,
    );
    const dispatchBlockedReasons = this.resolveDispatchBlockedReasons(
      input.dispatchReadiness,
    );
    const displayBlockedReasons = this.uniqueStrings([
      ...roleResolution.roleBlockedReasons,
      ...dispatchBlockedReasons,
    ]);
    const handoffPreviewStatus =
      displayBlockedReasons.length === 0
        ? 'ready_for_handoff_preview'
        : 'blocked_from_handoff_preview';
    const protectedRoleFailure = roleResolution.protectedRoleFailure;
    const supervisorReviewRole = roleResolution.supervisorReviewRole;

    return {
      manualTaskDraftId: this.sanitizeReadText(
        input.dispatchReadiness.manualTaskDraftId,
      ),
      sourceArtifactId: this.sanitizeReadText(
        input.dispatchReadiness.sourceArtifactId,
      ),
      sourceAiInteractionId: this.sanitizeEntityId(
        input.dispatchReadiness.sourceAiInteractionId,
      ),
      draftType: input.dispatchReadiness.draftType,
      recommendedTaskType: input.dispatchReadiness.recommendedTaskType,
      viewerRole: roleResolution.normalizedViewerRole,
      previewVisibility: this.resolvePreviewVisibility(
        handoffPreviewStatus,
        supervisorReviewRole,
      ),
      handoffPreviewStatus,
      title: protectedRoleFailure
        ? 'Employee handoff preview blocked'
        : this.sanitizeReadText(input.candidate.title),
      summary: protectedRoleFailure
        ? 'Preview blocked because the viewer role is missing, unknown, or outside the safe role scope.'
        : this.sanitizeReadText(input.candidate.summary),
      checklistItems: protectedRoleFailure
        ? []
        : this.sanitizeReadTextArray(input.candidate.checklistItems),
      evidenceRequirements: protectedRoleFailure
        ? []
        : this.sanitizeReadTextArray(input.candidate.evidenceRequirements),
      sourceEntityType: protectedRoleFailure
        ? null
        : this.sanitizeNullableReadText(input.candidate.sourceEntityType),
      sourceEntityId: protectedRoleFailure
        ? null
        : this.sanitizeEntityId(input.candidate.sourceEntityId),
      targetEntityType: protectedRoleFailure
        ? null
        : this.sanitizeNullableReadText(input.candidate.targetEntityType),
      targetEntityId: protectedRoleFailure
        ? null
        : this.sanitizeEntityId(input.candidate.targetEntityId),
      dispatchReadinessStatus:
        input.dispatchReadiness.dispatchReadinessStatus,
      readyForDispatchReview: input.dispatchReadiness.readyForDispatchReview,
      displayBlockedReasons,
      missingAuditFields: protectedRoleFailure
        ? []
        : this.sanitizeReadTextArray(input.dispatchReadiness.missingAuditFields),
      futureDispatchRequiredFields: protectedRoleFailure
        ? []
        : this.sanitizeReadTextArray(
            input.dispatchReadiness.futureDispatchRequiredFields,
          ),
      displayAuditChecklist: protectedRoleFailure
        ? []
        : this.buildDisplayAuditChecklist(
            input.dispatchReadiness.auditChecklist,
            supervisorReviewRole,
            input.dispatchReadiness.forbiddenActionCodes.length,
          ),
      permissionBasisRequirements: protectedRoleFailure
        ? ['Backend role permission must be proven before preview.']
        : this.sanitizeReadTextArray(
            input.dispatchReadiness.permissionBasisRequirements,
          ),
      boundaryExplanations: protectedRoleFailure
        ? [
            'Role hints are not authorization.',
            'Assignment remains candidate-only.',
            'Preview is blocked and cannot dispatch or create a task.',
          ]
        : this.sanitizeReadTextArray(
            input.dispatchReadiness.boundaryExplanations,
          ),
      sourceBundleIds: protectedRoleFailure
        ? []
        : this.sanitizeReadTextArray(input.dispatchReadiness.sourceBundleIds),
      auditLogRequired: protectedRoleFailure
        ? false
        : input.dispatchReadiness.auditLogRequired,
      approvalTraceRequired: protectedRoleFailure
        ? false
        : input.dispatchReadiness.approvalTraceRequired,
      roleHints: protectedRoleFailure
        ? { ...EMPTY_ROLE_HINTS }
        : this.sanitizeRoleHints(input.dispatchReadiness.roleHints),
      forbiddenActionCodeCount:
        input.dispatchReadiness.forbiddenActionCodes.length,
      forbiddenActionsAreAuditFactsOnly: true,
      roleHintsAreAuthorization: false,
      assignmentIsCandidateOnly: true,
      beforeStatus: 'draft_only',
      afterStatus: null,
      dispatchedAt: null,
      executable: false,
      executionStatus: 'draft_only',
      taskLifecycleStatus: 'draft_only',
      willDispatch: false,
      taskCreated: false,
      lifecycleMutated: false,
      performanceBasis: false,
      safetyCounters: { ...SAFETY_COUNTERS },
    };
  }

  toEmployeeHandoffPreviewBatch(
    inputs: readonly AiManualTaskBridgeEmployeeHandoffPreviewInput[],
  ): AiManualTaskBridgeEmployeeHandoffPreviewBatch {
    const previews = inputs.map((input) => this.toEmployeeHandoffPreview(input));
    return {
      previews,
      summary: this.buildSummary(previews),
    };
  }

  buildSummary(
    previews: readonly AiManualTaskBridgeEmployeeHandoffPreview[],
  ): AiManualTaskBridgeEmployeeHandoffPreviewSummary {
    return {
      previewCount: previews.length,
      visibleToEmployeeAiCount: previews.filter(
        (preview) => preview.previewVisibility === 'visible_to_employee_ai',
      ).length,
      visibleToSupervisorReviewCount: previews.filter(
        (preview) =>
          preview.previewVisibility === 'visible_to_supervisor_review',
      ).length,
      blockedFromPreviewCount: previews.filter(
        (preview) => preview.previewVisibility === 'blocked_from_preview',
      ).length,
      readyForHandoffPreviewCount: previews.filter(
        (preview) =>
          preview.handoffPreviewStatus === 'ready_for_handoff_preview',
      ).length,
      blockedFromHandoffPreviewCount: previews.filter(
        (preview) =>
          preview.handoffPreviewStatus === 'blocked_from_handoff_preview',
      ).length,
      viewerRoles: this.uniqueStrings(previews.map((preview) => preview.viewerRole)),
      draftTypes: this.uniqueTyped(previews.map((preview) => preview.draftType)),
      recommendedTaskTypes: this.uniqueTyped(
        previews.map((preview) => preview.recommendedTaskType),
      ),
      dispatchReadinessStatuses: this.uniqueTyped(
        previews.map((preview) => preview.dispatchReadinessStatus),
      ),
      forbiddenActionCodeCount: previews.reduce(
        (count, preview) => count + preview.forbiddenActionCodeCount,
        0,
      ),
      willDispatchCount: 0,
      taskCreatedCount: 0,
      lifecycleMutatedCount: 0,
      performanceBasisCount: 0,
      safetyCounters: { ...SAFETY_COUNTERS },
    };
  }

  private resolveViewerRole(
    viewerRole: string | null | undefined,
    roleHints: AiManualTaskBridgeDispatchRoleHints,
  ): ViewerRoleResolution {
    const normalizedViewerRole = this.normalizeToken(viewerRole);
    if (!normalizedViewerRole) {
      return {
        normalizedViewerRole: 'missing',
        canonicalRole: null,
        roleBlockedReasons: ['viewer_role_missing'],
        protectedRoleFailure: true,
        supervisorReviewRole: false,
      };
    }
    const canonicalRole = ROLE_ALIASES[normalizedViewerRole] ?? null;
    if (!canonicalRole) {
      return {
        normalizedViewerRole,
        canonicalRole: null,
        roleBlockedReasons: ['viewer_role_unknown'],
        protectedRoleFailure: true,
        supervisorReviewRole: false,
      };
    }
    const roleBlockedReasons = this.isRoleInScope(canonicalRole, roleHints)
      ? []
      : ['viewer_role_out_of_scope'];
    return {
      normalizedViewerRole: canonicalRole,
      canonicalRole,
      roleBlockedReasons,
      protectedRoleFailure: roleBlockedReasons.length > 0,
      supervisorReviewRole: SUPERVISOR_REVIEW_ROLES.has(canonicalRole),
    };
  }

  private isRoleInScope(
    role: AiManualTaskBridgeEmployeeHandoffViewerRole,
    roleHints: AiManualTaskBridgeDispatchRoleHints,
  ): boolean {
    if (role === 'owner' || role === 'admin') {
      return true;
    }
    const hintedRoles = new Set(
      (roleHints.assigneeRoleCodes ?? []).map((hint) =>
        this.normalizeToken(hint),
      ),
    );
    return ROLE_SCOPE_HINTS[role].some((hint) => hintedRoles.has(hint));
  }

  private resolveDispatchBlockedReasons(
    dispatchReadiness: AiManualTaskBridgeDispatchReadiness,
  ): string[] {
    if (
      dispatchReadiness.readyForDispatchReview &&
      dispatchReadiness.dispatchReadinessStatus === 'ready_for_dispatch_review'
    ) {
      return [];
    }
    return this.uniqueStrings([
      'dispatch_readiness_blocked',
      ...this.sanitizeReadTextArray(dispatchReadiness.blockedReasons),
    ]);
  }

  private resolvePreviewVisibility(
    status: AiManualTaskBridgeEmployeeHandoffPreviewStatus,
    supervisorReviewRole: boolean,
  ): AiManualTaskBridgeEmployeeHandoffPreviewVisibility {
    if (status === 'blocked_from_handoff_preview') {
      return 'blocked_from_preview';
    }
    return supervisorReviewRole
      ? 'visible_to_supervisor_review'
      : 'visible_to_employee_ai';
  }

  private buildDisplayAuditChecklist(
    checklist: readonly AiManualTaskBridgeDispatchAuditChecklistItem[],
    supervisorReviewRole: boolean,
    forbiddenActionCodeCount: number,
  ): AiManualTaskBridgeEmployeeHandoffAuditChecklistDisplayItem[] {
    return checklist
      .filter(
        (item) =>
          supervisorReviewRole || this.shouldDisplayChecklistItemToEmployee(item),
      )
      .map((item) => ({
        code: this.sanitizeReadText(item.code),
        label: this.sanitizeReadText(item.label),
        status: this.sanitizeReadText(item.status),
        detail: this.auditChecklistDisplayDetail(
          item,
          forbiddenActionCodeCount,
        ),
        displayToEmployee:
          !supervisorReviewRole && this.shouldDisplayChecklistItemToEmployee(item),
        displayToSupervisor: supervisorReviewRole,
      }));
  }

  private shouldDisplayChecklistItemToEmployee(
    item: AiManualTaskBridgeDispatchAuditChecklistItem,
  ): boolean {
    return item.status !== 'future_required' && item.code !== 'forbiddenActionCodes';
  }

  private auditChecklistDisplayDetail(
    item: AiManualTaskBridgeDispatchAuditChecklistItem,
    forbiddenActionCodeCount: number,
  ): string | null {
    if (item.code === 'forbiddenActionCodes') {
      return `${forbiddenActionCodeCount} audit facts only`;
    }
    return this.sanitizeNullableReadText(item.detail);
  }

  private sanitizeRoleHints(
    roleHints: AiManualTaskBridgeDispatchRoleHints,
  ): AiManualTaskBridgeDispatchRoleHints {
    return {
      assigneeRoleCodes: this.sanitizeReadTextArray(roleHints.assigneeRoleCodes),
      candidateAssigneeEmployeeIds: this.uniqueTyped(
        (roleHints.candidateAssigneeEmployeeIds ?? [])
          .map((id) => this.sanitizeEntityId(id))
          .filter((id): id is string | number => id !== null),
      ),
      roleHintsAreAuthorization: false,
      assignmentIsCandidateOnly: true,
      finalAssigneeEmployeeId: null,
      finalAssigneeRole: null,
    };
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
