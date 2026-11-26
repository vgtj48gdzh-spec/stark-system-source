import { Injectable } from '@nestjs/common';
import type {
  AiTaskDraftReviewArtifactAuditRequirement,
  AiTaskDraftReviewArtifactPolicyTraceSummary,
  AiTaskDraftReviewArtifactReadAuditView,
} from './ai-task-draft-review-artifact-read-audit.service';
import type { AiTaskDraftReviewType } from './ai-task-draft-orchestration.service';

export type AiManualTaskBridgeRecommendedTaskType =
  | 'manual_review'
  | 'evidence_collection'
  | 'investigation'
  | 'handoff'
  | 'approval_prefill_review'
  | 'confirmation_required_review';

export interface AiManualTaskBridgeAuditRequirement {
  auditLogRequired: boolean;
  approvalTraceRequired: boolean;
  sourceBundleIdsRequired: boolean;
  humanActorRequired: boolean;
  dispatchAuditRequired: boolean;
}

export interface AiManualTaskBridgeCandidate {
  manualTaskDraftId: string;
  sourceArtifactId: string;
  sourceAiInteractionId: string | number | null;
  draftType: AiTaskDraftReviewType;
  recommendedTaskType: AiManualTaskBridgeRecommendedTaskType;
  title: string;
  summary: string;
  assigneeRoleCodes: string[];
  candidateAssigneeEmployeeIds: Array<string | number>;
  sourceEntityType: string | null;
  sourceEntityId: string | number | null;
  targetEntityType: string | null;
  targetEntityId: string | number | null;
  checklistItems: string[];
  evidenceRequirements: string[];
  policyTraceSummary: AiTaskDraftReviewArtifactPolicyTraceSummary;
  forbiddenActionCodes: string[];
  boundaryExplanations: string[];
  requiresHumanConfirmation: boolean;
  requiresOwnerApproval: boolean;
  executable: false;
  executionStatus: 'draft_only';
  taskLifecycleStatus: 'draft_only';
  auditRequirement: AiManualTaskBridgeAuditRequirement;
}

export interface AiManualTaskBridgeSafeInteractionMetadata {
  id?: string | number | null;
  interactionId?: string | number | null;
  aiInteractionId?: string | number | null;
  sourceAiInteractionId?: string | number | null;
  createdByAiInteractionId?: string | number | null;
}

export interface AiManualTaskBridgeSafeAssignmentHints {
  assigneeRoleCodes?: readonly unknown[] | null;
  candidateAssigneeEmployeeIds?: readonly unknown[] | null;
}

export interface AiManualTaskBridgeCandidateInput {
  readAuditView: AiTaskDraftReviewArtifactReadAuditView;
  safeInteractionMetadata?: AiManualTaskBridgeSafeInteractionMetadata | null;
  safeAssignmentHints?: AiManualTaskBridgeSafeAssignmentHints | null;
}

const DRAFT_TYPE_TO_RECOMMENDED_TASK_TYPE: Record<
  AiTaskDraftReviewType,
  AiManualTaskBridgeRecommendedTaskType
> = {
  manual_review_task: 'manual_review',
  evidence_collection_checklist: 'evidence_collection',
  investigation_task: 'investigation',
  handoff_note: 'handoff',
  approval_prefill: 'approval_prefill_review',
  confirmation_required_draft: 'confirmation_required_review',
};

const ASSIGNABLE_ROLE_CODES = new Set([
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
]);

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

const FORBIDDEN_ACTION_CODE_SET = new Set<string>(FORBIDDEN_ACTION_CODES);
const BLOCKED_ACTION_MARKER = '[blocked_action]';
const REDACTED_SENSITIVE_MARKER = '[redacted_sensitive]';
const REDACTED_PHONE_MARKER = '[redacted_phone]';
const REDACTED_ACCOUNT_MARKER = '[redacted_account]';

@Injectable()
export class AiManualTaskBridgeCandidateService {
  toManualTaskBridgeCandidate(
    input: AiTaskDraftReviewArtifactReadAuditView | AiManualTaskBridgeCandidateInput,
  ): AiManualTaskBridgeCandidate {
    const normalized = this.normalizeInput(input);
    const view = normalized.readAuditView;
    const draftType = this.resolveDraftType(view.artifactType);
    const recommendedTaskType = DRAFT_TYPE_TO_RECOMMENDED_TASK_TYPE[draftType];
    const assigneeRoleCodes = this.resolveAssigneeRoleCodes(
      normalized.safeAssignmentHints,
    );
    const candidateAssigneeEmployeeIds = assigneeRoleCodes.length
      ? this.resolveCandidateAssigneeEmployeeIds(
          normalized.safeAssignmentHints,
        )
      : [];

    return {
      manualTaskDraftId: this.buildManualTaskDraftId(
        view.artifactId,
        recommendedTaskType,
      ),
      sourceArtifactId: this.sanitizeReadText(view.artifactId) || 'unknown_artifact',
      sourceAiInteractionId: this.resolveSourceAiInteractionId(normalized),
      draftType,
      recommendedTaskType,
      title: this.resolveTitle(view, recommendedTaskType),
      summary: this.resolveSummary(view, recommendedTaskType),
      assigneeRoleCodes,
      candidateAssigneeEmployeeIds,
      sourceEntityType: this.sanitizeNullableReadText(view.sourceEntityType),
      sourceEntityId: this.sanitizeEntityId(view.sourceEntityId),
      targetEntityType: this.sanitizeNullableReadText(view.targetEntityType),
      targetEntityId: this.sanitizeEntityId(view.targetEntityId),
      checklistItems: this.resolveChecklistItems(view, recommendedTaskType),
      evidenceRequirements: this.resolveEvidenceRequirements(
        view,
        recommendedTaskType,
      ),
      policyTraceSummary: this.resolvePolicyTraceSummary(view.policyTraceSummary),
      forbiddenActionCodes: this.resolveForbiddenActionCodes(view),
      boundaryExplanations: this.resolveBoundaryExplanations(
        view,
        assigneeRoleCodes,
      ),
      requiresHumanConfirmation: view.requiresHumanConfirmation === true,
      requiresOwnerApproval: view.requiresOwnerApproval === true,
      executable: false,
      executionStatus: 'draft_only',
      taskLifecycleStatus: 'draft_only',
      auditRequirement: this.resolveAuditRequirement(
        view.auditRequirement,
        view.requiresOwnerApproval === true,
      ),
    };
  }

  toManualTaskBridgeCandidates(
    inputs: readonly (
      | AiTaskDraftReviewArtifactReadAuditView
      | AiManualTaskBridgeCandidateInput
    )[],
  ): AiManualTaskBridgeCandidate[] {
    return inputs.map((input) => this.toManualTaskBridgeCandidate(input));
  }

  private normalizeInput(
    input: AiTaskDraftReviewArtifactReadAuditView | AiManualTaskBridgeCandidateInput,
  ): AiManualTaskBridgeCandidateInput {
    if (
      typeof input === 'object' &&
      input !== null &&
      'readAuditView' in input
    ) {
      return {
        readAuditView: input.readAuditView,
        safeInteractionMetadata: input.safeInteractionMetadata ?? null,
        safeAssignmentHints: input.safeAssignmentHints ?? null,
      };
    }

    return {
      readAuditView: input as AiTaskDraftReviewArtifactReadAuditView,
      safeInteractionMetadata: null,
      safeAssignmentHints: null,
    };
  }

  private resolveDraftType(
    value: unknown,
  ): AiTaskDraftReviewType {
    const normalized = this.normalizeToken(value);
    if (normalized in DRAFT_TYPE_TO_RECOMMENDED_TASK_TYPE) {
      return normalized as AiTaskDraftReviewType;
    }
    return 'manual_review_task';
  }

  private buildManualTaskDraftId(
    artifactId: unknown,
    recommendedTaskType: AiManualTaskBridgeRecommendedTaskType,
  ): string {
    const safeArtifactId =
      this.normalizeToken(artifactId).replace(/:+/g, ':') || 'unknown_artifact';
    return `ai_manual_task_draft:${safeArtifactId}:${recommendedTaskType}`;
  }

  private resolveSourceAiInteractionId(
    input: AiManualTaskBridgeCandidateInput,
  ): string | number | null {
    const metadata = input.safeInteractionMetadata;
    return this.sanitizeEntityId(
      metadata?.sourceAiInteractionId ??
        metadata?.createdByAiInteractionId ??
        metadata?.aiInteractionId ??
        metadata?.interactionId ??
        metadata?.id ??
        input.readAuditView.createdByAiInteractionId,
    );
  }

  private resolveTitle(
    view: AiTaskDraftReviewArtifactReadAuditView,
    recommendedTaskType: AiManualTaskBridgeRecommendedTaskType,
  ): string {
    const title = this.sanitizeSafeTaskText(view.title);
    if (title) {
      return title;
    }
    const fallbackTitles: Record<AiManualTaskBridgeRecommendedTaskType, string> = {
      manual_review: 'Manual review draft candidate',
      evidence_collection: 'Evidence collection draft candidate',
      investigation: 'Investigation draft candidate',
      handoff: 'Human handoff draft candidate',
      approval_prefill_review: 'Approval prefill review draft candidate',
      confirmation_required_review:
        'Confirmation required review draft candidate',
    };
    return fallbackTitles[recommendedTaskType];
  }

  private resolveSummary(
    view: AiTaskDraftReviewArtifactReadAuditView,
    recommendedTaskType: AiManualTaskBridgeRecommendedTaskType,
  ): string {
    const summary = this.sanitizeSafeTaskText(view.summary);
    if (summary) {
      return summary;
    }
    if (recommendedTaskType === 'approval_prefill_review') {
      return 'Prepare non-executable approval material for human review.';
    }
    if (recommendedTaskType === 'confirmation_required_review') {
      return 'Prepare non-executable confirmation material for human review.';
    }
    return 'Prepare a non-executable manual task draft candidate for human review.';
  }

  private resolveChecklistItems(
    view: AiTaskDraftReviewArtifactReadAuditView,
    recommendedTaskType: AiManualTaskBridgeRecommendedTaskType,
  ): string[] {
    const items = this.sanitizeSafeTaskTextArray(view.safeChecklistItems);
    if (items.length > 0) {
      return items;
    }
    if (recommendedTaskType === 'evidence_collection') {
      return ['Collect safe evidence categories in the authorized system.'];
    }
    if (recommendedTaskType === 'handoff') {
      return ['Hand off the safe summary to an authorized human reviewer.'];
    }
    if (recommendedTaskType === 'approval_prefill_review') {
      return ['Review prepared material in the authorized approval workflow.'];
    }
    if (recommendedTaskType === 'confirmation_required_review') {
      return ['Require explicit human confirmation before any business action.'];
    }
    return ['Review policy trace and safe source context.'];
  }

  private resolveEvidenceRequirements(
    view: AiTaskDraftReviewArtifactReadAuditView,
    recommendedTaskType: AiManualTaskBridgeRecommendedTaskType,
  ): string[] {
    const safeChecklistItems = this.sanitizeSafeTaskTextArray(
      view.safeChecklistItems,
    );
    if (recommendedTaskType === 'evidence_collection') {
      return safeChecklistItems.length
        ? safeChecklistItems
        : ['Safe evidence category review is required.'];
    }
    if (
      recommendedTaskType === 'approval_prefill_review' ||
      recommendedTaskType === 'confirmation_required_review'
    ) {
      return [
        'Approval trace category',
        'Human actor confirmation category',
        'Source bundle reference category',
      ];
    }
    return ['Source bundle reference category'];
  }

  private resolvePolicyTraceSummary(
    trace: AiTaskDraftReviewArtifactPolicyTraceSummary,
  ): AiTaskDraftReviewArtifactPolicyTraceSummary {
    return {
      candidateId:
        this.sanitizeReadText(trace?.candidateId) || 'unknown_candidate',
      actionPermissionLevel:
        this.sanitizeReadText(trace?.actionPermissionLevel) || 'explain_only',
      allowedAssistantSurface: this.sanitizeReadTextArray(
        trace?.allowedAssistantSurface,
      ),
      allowedDraftTypes: this.sanitizeReadTextArray(trace?.allowedDraftTypes),
      reasonCodes: this.sanitizeReadTextArray(trace?.reasonCodes),
      sourceBundleIds: this.sanitizeReadTextArray(trace?.sourceBundleIds),
    };
  }

  private resolveForbiddenActionCodes(
    view: AiTaskDraftReviewArtifactReadAuditView,
  ): string[] {
    return this.unique(
      (view.forbiddenActionCodes ?? [])
        .map((code) => this.sanitizeAuditCode(code))
        .filter((code): code is string => code.length > 0),
    );
  }

  private resolveBoundaryExplanations(
    view: AiTaskDraftReviewArtifactReadAuditView,
    assigneeRoleCodes: readonly string[],
  ): string[] {
    const explanations = this.sanitizeSafeTaskTextArray(
      view.boundaryExplanations,
    );
    explanations.push(
      'Manual task draft candidates are not task completion, business execution, or finance approval.',
      'Assignment hints are candidate recommendations only and require dispatch audit before activation.',
      'A future completed_by_human manual task status still does not execute the underlying business action.',
    );
    if (assigneeRoleCodes.length === 0) {
      explanations.push(
        'No valid assignment role was provided, so this candidate remains unassigned and non-executable.',
      );
    }
    return this.unique(explanations);
  }

  private resolveAuditRequirement(
    source: AiTaskDraftReviewArtifactAuditRequirement,
    requiresOwnerApproval: boolean,
  ): AiManualTaskBridgeAuditRequirement {
    return {
      auditLogRequired: source?.auditLogRequired !== false,
      approvalTraceRequired:
        requiresOwnerApproval || source?.approvalTraceRequired === true,
      sourceBundleIdsRequired: source?.sourceBundleIdsRequired !== false,
      humanActorRequired: true,
      dispatchAuditRequired: true,
    };
  }

  private resolveAssigneeRoleCodes(
    hints: AiManualTaskBridgeSafeAssignmentHints | null | undefined,
  ): string[] {
    return this.unique(
      (hints?.assigneeRoleCodes ?? [])
        .map((role) => this.normalizeToken(role))
        .filter((role) => ASSIGNABLE_ROLE_CODES.has(role)),
    );
  }

  private resolveCandidateAssigneeEmployeeIds(
    hints: AiManualTaskBridgeSafeAssignmentHints | null | undefined,
  ): Array<string | number> {
    return this.unique(
      (hints?.candidateAssigneeEmployeeIds ?? [])
        .map((id) => this.sanitizeEntityId(id))
        .filter((id): id is string | number => id !== null),
    );
  }

  private sanitizeSafeTaskTextArray(
    values: readonly unknown[] | null | undefined,
  ): string[] {
    return this.unique(
      (values ?? [])
        .map((value) => this.sanitizeSafeTaskText(value))
        .filter((value): value is string => value.length > 0),
    );
  }

  private sanitizeReadTextArray(
    values: readonly unknown[] | null | undefined,
  ): string[] {
    return this.unique(
      (values ?? [])
        .map((value) => this.sanitizeReadText(value))
        .filter((value): value is string => value.length > 0),
    );
  }

  private sanitizeSafeTaskText(value: unknown): string {
    const text = this.sanitizeReadText(value);
    if (!text) {
      return '';
    }
    if (this.containsForbiddenActionCode(text)) {
      return text.replace(
        new RegExp(
          FORBIDDEN_ACTION_CODES.map((code) => this.escapeRegExp(code)).join('|'),
          'gi',
        ),
        BLOCKED_ACTION_MARKER,
      );
    }
    return text;
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

  private sanitizeAuditCode(value: unknown): string {
    if (this.hasSensitiveMarker(value)) {
      return '';
    }
    return this.normalizePlainToken(value);
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

  private containsForbiddenActionCode(value: string): boolean {
    const normalized = this.normalizePlainToken(value);
    if (FORBIDDEN_ACTION_CODE_SET.has(normalized)) {
      return true;
    }
    return FORBIDDEN_ACTION_CODES.some((code) =>
      value.toLowerCase().includes(code),
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

  private unique<T>(items: readonly T[]): T[] {
    return [...new Set(items)];
  }
}
