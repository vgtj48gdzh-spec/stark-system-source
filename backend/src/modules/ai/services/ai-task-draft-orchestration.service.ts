import { Injectable } from '@nestjs/common';
import {
  AiActionPermissionMatrixInput,
  AiActionPermissionMatrixResult,
  AiActionPermissionMatrixService,
  AiAllowedDraftType,
} from './ai-action-permission-matrix.service';

export type AiTaskDraftReviewType =
  | 'manual_review_task'
  | 'evidence_collection_checklist'
  | 'investigation_task'
  | 'handoff_note'
  | 'approval_prefill'
  | 'confirmation_required_draft';

export interface AiTaskDraftPolicyTrace {
  candidateId: string;
  actionPermissionLevel: AiActionPermissionMatrixResult['actionPermissionLevel'];
  allowedAssistantSurface: string[];
  allowedDraftTypes: string[];
  forbiddenActionCodes: string[];
  safeSuggestedActionLabels: string[];
  reasonCodes: string[];
  requiresHumanConfirmation: boolean;
  requiresOwnerApproval: boolean;
  auditRequirement: AiActionPermissionMatrixResult['auditRequirement'];
  sourceBundleIds: string[];
}

export interface AiTaskDraftCandidateMetadata {
  candidateId: string;
  source?: string | null;
  sourceModule?: string | null;
  sourceEntityType?: string | null;
  sourceEntityId?: string | number | null;
  targetEntityType?: string | null;
  targetEntityId?: string | number | null;
  sourceBundleIds?: readonly string[] | null;
  proposedDraftType?: string | null;
  currentUserRoleCodes?: readonly string[] | null;
  title?: string | null;
  summary?: string | null;
  reason?: string | null;
  checklistItems?: readonly string[] | null;
  missingEvidence?: readonly string[] | null;
  boundaryExplanations?: readonly string[] | null;
}

export interface AiTaskDraftOrchestrationInput {
  candidate: AiTaskDraftCandidateMetadata;
  policyResult?: AiActionPermissionMatrixResult | null;
  policyInput?: AiActionPermissionMatrixInput | null;
  policyTrace?: Partial<AiTaskDraftPolicyTrace> | null;
}

export interface AiTaskDraftReviewArtifact {
  draftId: string;
  draftType: AiTaskDraftReviewType;
  title: string;
  summary: string;
  source: string;
  sourceModule: string | null;
  sourceEntityType: string | null;
  sourceEntityId: string | number | null;
  targetEntityType: string | null;
  targetEntityId: string | number | null;
  sourceBundleIds: string[];
  policyTrace: AiTaskDraftPolicyTrace;
  requiresHumanConfirmation: boolean;
  requiresOwnerApproval: boolean;
  requiredHumanRoleCodes: string[];
  checklistItems: string[];
  missingEvidence: string[];
  forbiddenActionCodes: string[];
  boundaryExplanations: string[];
  safeSuggestedActionLabels: string[];
  auditRequirement: AiActionPermissionMatrixResult['auditRequirement'];
  executable: false;
  executionStatus: 'draft_only';
}

export interface AiTaskDraftOrchestrationResult {
  draft: AiTaskDraftReviewArtifact | null;
  boundaryExplanations: string[];
  policyTrace: AiTaskDraftPolicyTrace;
  blockedActionCodes: string[];
}

const SAFE_TASK_DRAFT_TYPES: readonly AiTaskDraftReviewType[] = [
  'manual_review_task',
  'evidence_collection_checklist',
  'investigation_task',
  'handoff_note',
];

const HUMAN_CONFIRMATION_DRAFT_TYPES: readonly AiTaskDraftReviewType[] = [
  'approval_prefill',
  'confirmation_required_draft',
];

const DRAFT_CAPABLE_ROLES = new Set([
  'owner',
  'founder',
  'admin',
  'system_admin',
  'finance_manager',
  'finance_operator',
  'operator',
  'reviewer',
  'ai_operator',
]);

const DEFAULT_FORBIDDEN_ACTION_LABELS = [
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
];

@Injectable()
export class AiTaskDraftOrchestrationService {
  constructor(
    private readonly actionPermissionMatrixService: AiActionPermissionMatrixService,
  ) {}

  orchestrate(
    input: AiTaskDraftOrchestrationInput,
  ): AiTaskDraftOrchestrationResult {
    const policy = this.resolvePolicy(input);
    const candidate = input.candidate;
    const policyTrace = this.buildPolicyTrace(input, policy);
    const blockedActionCodes = this.unique(policy.forbiddenActionCodes);

    if (policy.actionPermissionLevel === 'forbidden_for_ai') {
      return this.noDraftResult(policyTrace, blockedActionCodes, [
        this.boundaryTextForLevel('forbidden_for_ai'),
      ]);
    }

    if (
      policy.actionPermissionLevel === 'explain_only' ||
      policy.actionPermissionLevel === 'suggest_only'
    ) {
      return this.noDraftResult(policyTrace, blockedActionCodes, [
        this.boundaryTextForLevel(policy.actionPermissionLevel),
      ]);
    }

    if (
      policy.actionPermissionLevel === 'draft_task_allowed' &&
      !this.hasDraftCapableRole(candidate.currentUserRoleCodes)
    ) {
      return this.noDraftResult(policyTrace, blockedActionCodes, [
        'Policy did not grant a draft-capable role for this candidate.',
      ]);
    }

    const draftType = this.resolveDraftType(policy, candidate);
    if (!draftType) {
      return this.noDraftResult(policyTrace, blockedActionCodes, [
        'Policy did not allow a non-executable draft type for this candidate.',
      ]);
    }

    const boundaryExplanations = this.buildDraftBoundaryExplanations(
      candidate,
      policy,
    );
    const missingEvidence = this.sanitizeTextArray(candidate.missingEvidence);
    const checklistItems = this.buildChecklistItems(
      draftType,
      candidate,
      missingEvidence,
    );
    const safeSuggestedActionLabels = this.sanitizeTextArray(
      policy.safeSuggestedActionLabels,
    );

    const draft: AiTaskDraftReviewArtifact = {
      draftId: this.buildDraftId(candidate, draftType),
      draftType,
      title: this.buildDraftTitle(candidate, draftType),
      summary: this.buildDraftSummary(candidate, draftType),
      source: this.sanitizeText(candidate.source) || 'ai_task_draft_orchestration',
      sourceModule: this.sanitizeNullableText(candidate.sourceModule),
      sourceEntityType: this.sanitizeNullableText(candidate.sourceEntityType),
      sourceEntityId: this.sanitizeEntityId(candidate.sourceEntityId),
      targetEntityType: this.sanitizeNullableText(candidate.targetEntityType),
      targetEntityId: this.sanitizeEntityId(candidate.targetEntityId),
      sourceBundleIds: this.sanitizeTextArray(candidate.sourceBundleIds),
      policyTrace,
      requiresHumanConfirmation:
        policy.actionPermissionLevel === 'human_confirmation_required' ||
        policy.requiresHumanConfirmation,
      requiresOwnerApproval: policy.requiresOwnerApproval,
      requiredHumanRoleCodes: this.requiredHumanRoleCodes(draftType, policy),
      checklistItems,
      missingEvidence,
      forbiddenActionCodes: blockedActionCodes,
      boundaryExplanations,
      safeSuggestedActionLabels,
      auditRequirement: policy.auditRequirement,
      executable: false,
      executionStatus: 'draft_only',
    };

    return {
      draft,
      boundaryExplanations,
      policyTrace,
      blockedActionCodes,
    };
  }

  orchestrateMany(
    inputs: readonly AiTaskDraftOrchestrationInput[],
  ): AiTaskDraftOrchestrationResult[] {
    return inputs.map((input) => this.orchestrate(input));
  }

  private resolvePolicy(
    input: AiTaskDraftOrchestrationInput,
  ): AiActionPermissionMatrixResult {
    if (input.policyInput) {
      return this.actionPermissionMatrixService.evaluate(input.policyInput);
    }
    if (input.policyResult) {
      return input.policyResult;
    }
    return this.actionPermissionMatrixService.evaluate({
      proposedAssistantActionCode: 'review_context',
      currentUserRoleCodes: input.candidate.currentUserRoleCodes ?? null,
    });
  }

  private buildPolicyTrace(
    input: AiTaskDraftOrchestrationInput,
    policy: AiActionPermissionMatrixResult,
  ): AiTaskDraftPolicyTrace {
    const candidate = input.candidate;
    return {
      candidateId:
        this.sanitizeText(input.policyTrace?.candidateId) ||
        this.sanitizeText(candidate.candidateId) ||
        'unknown_candidate',
      actionPermissionLevel: policy.actionPermissionLevel,
      allowedAssistantSurface: this.sanitizeTextArray(
        policy.allowedAssistantSurface,
      ),
      allowedDraftTypes: this.sanitizeTextArray(policy.allowedDraftTypes),
      forbiddenActionCodes: this.unique(policy.forbiddenActionCodes),
      safeSuggestedActionLabels: this.sanitizeTextArray(
        policy.safeSuggestedActionLabels,
      ),
      reasonCodes: this.sanitizeTextArray(policy.reasonCodes),
      requiresHumanConfirmation: policy.requiresHumanConfirmation,
      requiresOwnerApproval: policy.requiresOwnerApproval,
      auditRequirement: policy.auditRequirement,
      sourceBundleIds: this.sanitizeTextArray(
        input.policyTrace?.sourceBundleIds ?? candidate.sourceBundleIds,
      ),
    };
  }

  private resolveDraftType(
    policy: AiActionPermissionMatrixResult,
    candidate: AiTaskDraftCandidateMetadata,
  ): AiTaskDraftReviewType | null {
    const proposedDraftType = this.sanitizeText(
      candidate.proposedDraftType,
    ) as AiTaskDraftReviewType;
    const allowedDraftTypes = new Set(policy.allowedDraftTypes);

    if (policy.actionPermissionLevel === 'human_confirmation_required') {
      if (
        HUMAN_CONFIRMATION_DRAFT_TYPES.includes(proposedDraftType) &&
        allowedDraftTypes.has(proposedDraftType as AiAllowedDraftType)
      ) {
        return proposedDraftType;
      }
      if (allowedDraftTypes.has('confirmation_required_draft')) {
        return 'confirmation_required_draft';
      }
      if (allowedDraftTypes.has('approval_prefill')) {
        return 'approval_prefill';
      }
      return null;
    }

    if (policy.actionPermissionLevel !== 'draft_task_allowed') {
      return null;
    }

    if (
      SAFE_TASK_DRAFT_TYPES.includes(proposedDraftType) &&
      allowedDraftTypes.has(proposedDraftType as AiAllowedDraftType)
    ) {
      return proposedDraftType;
    }

    if (
      candidate.missingEvidence?.length &&
      allowedDraftTypes.has('evidence_collection_checklist')
    ) {
      return 'evidence_collection_checklist';
    }
    if (allowedDraftTypes.has('manual_review_task')) {
      return 'manual_review_task';
    }
    if (allowedDraftTypes.has('investigation_task')) {
      return 'investigation_task';
    }
    if (allowedDraftTypes.has('handoff_note')) {
      return 'handoff_note';
    }
    return null;
  }

  private buildDraftTitle(
    candidate: AiTaskDraftCandidateMetadata,
    draftType: AiTaskDraftReviewType,
  ): string {
    const explicitTitle = this.sanitizeText(candidate.title);
    if (explicitTitle) {
      return explicitTitle;
    }
    const titleByType: Record<AiTaskDraftReviewType, string> = {
      manual_review_task: 'Manual review task draft',
      evidence_collection_checklist: 'Evidence collection checklist draft',
      investigation_task: 'Investigation task draft',
      handoff_note: 'Human handoff note draft',
      approval_prefill: 'Approval prefill draft',
      confirmation_required_draft: 'Confirmation required draft',
    };
    return titleByType[draftType];
  }

  private buildDraftSummary(
    candidate: AiTaskDraftCandidateMetadata,
    draftType: AiTaskDraftReviewType,
  ): string {
    const explicitSummary =
      this.sanitizeText(candidate.summary) || this.sanitizeText(candidate.reason);
    if (explicitSummary) {
      return explicitSummary;
    }
    if (draftType === 'approval_prefill') {
      return 'Prepare non-executable approval material for human review.';
    }
    if (draftType === 'confirmation_required_draft') {
      return 'Prepare non-executable material that requires explicit human confirmation and backend authorization.';
    }
    return 'Prepare a non-executable review artifact for human follow-up.';
  }

  private buildChecklistItems(
    draftType: AiTaskDraftReviewType,
    candidate: AiTaskDraftCandidateMetadata,
    missingEvidence: readonly string[],
  ): string[] {
    const explicitItems = this.sanitizeTextArray(candidate.checklistItems);
    if (explicitItems.length > 0) {
      return explicitItems;
    }
    if (draftType === 'evidence_collection_checklist') {
      return missingEvidence.length > 0
        ? missingEvidence.map((item) => `Collect evidence: ${item}`)
        : ['Collect missing evidence in the existing authorized system.'];
    }
    if (draftType === 'approval_prefill') {
      return [
        'Review prepared material.',
        'Confirm through the existing authorized approval workflow.',
      ];
    }
    if (draftType === 'confirmation_required_draft') {
      return [
        'Review policy trace and source context.',
        'Require explicit human confirmation before any business action.',
      ];
    }
    if (draftType === 'handoff_note') {
      return ['Hand off the safe summary to the responsible human reviewer.'];
    }
    return [
      'Review policy trace and source context.',
      'Confirm evidence in the existing authorized system.',
    ];
  }

  private buildDraftBoundaryExplanations(
    candidate: AiTaskDraftCandidateMetadata,
    policy: AiActionPermissionMatrixResult,
  ): string[] {
    const explanations = this.sanitizeTextArray(candidate.boundaryExplanations);
    if (policy.actionPermissionLevel === 'human_confirmation_required') {
      explanations.push(
        'This draft requires explicit human confirmation and backend permission checks before any business action.',
      );
    }
    explanations.push('This artifact is non-executable and cannot mutate business state.');
    return this.unique(explanations);
  }

  private requiredHumanRoleCodes(
    draftType: AiTaskDraftReviewType,
    policy: AiActionPermissionMatrixResult,
  ): string[] {
    if (
      draftType === 'approval_prefill' ||
      draftType === 'confirmation_required_draft' ||
      policy.requiresOwnerApproval
    ) {
      return ['owner', 'founder', 'finance_manager'];
    }
    return ['reviewer', 'finance_operator'];
  }

  private noDraftResult(
    policyTrace: AiTaskDraftPolicyTrace,
    blockedActionCodes: readonly string[],
    boundaryExplanations: readonly string[],
  ): AiTaskDraftOrchestrationResult {
    return {
      draft: null,
      boundaryExplanations: this.sanitizeTextArray(boundaryExplanations),
      policyTrace,
      blockedActionCodes: this.unique([...blockedActionCodes]),
    };
  }

  private boundaryTextForLevel(
    level: AiActionPermissionMatrixResult['actionPermissionLevel'],
  ): string {
    if (level === 'forbidden_for_ai') {
      return 'AI cannot execute, draft, or prepare this forbidden business action.';
    }
    if (level === 'suggest_only') {
      return 'Policy allows suggestion labels only; no task draft was created.';
    }
    return 'Policy allows explanation only; no task draft was created.';
  }

  private buildDraftId(
    candidate: AiTaskDraftCandidateMetadata,
    draftType: AiTaskDraftReviewType,
  ): string {
    const candidateId = this.normalizeToken(candidate.candidateId) || 'candidate';
    return `ai_task_draft:${candidateId}:${draftType}`;
  }

  private hasDraftCapableRole(roleCodes: readonly string[] | null | undefined): boolean {
    return (roleCodes ?? [])
      .map((role) => this.normalizeToken(role))
      .some((role) => DRAFT_CAPABLE_ROLES.has(role));
  }

  private sanitizeNullableText(value: unknown): string | null {
    return this.sanitizeText(value) || null;
  }

  private sanitizeEntityId(
    value: string | number | null | undefined,
  ): string | number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    const sanitized = this.sanitizeText(value);
    if (!sanitized) {
      return null;
    }
    return sanitized;
  }

  private sanitizeTextArray(values: readonly unknown[] | null | undefined): string[] {
    return this.unique(
      (values ?? [])
        .map((value) => this.sanitizeText(value))
        .filter((value): value is string => value.length > 0),
    );
  }

  private sanitizeText(value: unknown): string {
    if (value === undefined || value === null) {
      return '';
    }
    let text = String(value).trim();
    if (!text) {
      return '';
    }
    for (const label of DEFAULT_FORBIDDEN_ACTION_LABELS) {
      text = text.replace(new RegExp(this.escapeRegExp(label), 'gi'), '[blocked_action]');
    }
    text = text
      .replace(/\b1[3-9]\d{9}\b/g, '[redacted_phone]')
      .replace(/\b\d{12,}\b/g, '[redacted_account]')
      .replace(/raw[_\s-]?sms[_\s:a-z0-9-]*/gi, '[redacted_sensitive]')
      .replace(/verification[_\s-]?code[_\s:a-z0-9-]*/gi, '[redacted_sensitive]')
      .replace(/full[_\s-]?phone[_\s:a-z0-9-]*/gi, '[redacted_sensitive]')
      .replace(/full[_\s-]?account[_\s:a-z0-9-]*/gi, '[redacted_sensitive]')
      .replace(/secret[_\s:a-z0-9-]*/gi, '[redacted_sensitive]')
      .replace(/private[_\s-]?key[_\s:a-z0-9-]*/gi, '[redacted_sensitive]')
      .replace(/\.env/gi, '[redacted_sensitive]');
    return text.trim();
  }

  private normalizeToken(value: unknown): string {
    return this.sanitizeText(value)
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
