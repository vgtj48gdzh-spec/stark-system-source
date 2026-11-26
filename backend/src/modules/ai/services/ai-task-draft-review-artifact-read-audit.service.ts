import { Injectable } from '@nestjs/common';
import type {
  AiTaskDraftPolicyTrace,
  AiTaskDraftReviewArtifact,
  AiTaskDraftReviewType,
} from './ai-task-draft-orchestration.service';
import type {
  AiActionPermissionLevel,
} from './ai-action-permission-matrix.service';

export type AiTaskDraftReviewArtifactLifecycleStatus =
  | 'draft_only'
  | 'pending_human_review'
  | 'accepted_for_manual_task'
  | 'rejected_by_human'
  | 'converted_to_manual_task'
  | 'closed_without_action';

export type AiTaskDraftReviewArtifactReviewDecision =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'converted_to_manual_task'
  | 'closed_without_action'
  | null;

export interface AiTaskDraftReviewArtifactPolicyTraceSummary {
  candidateId: string;
  actionPermissionLevel: string;
  allowedAssistantSurface: string[];
  allowedDraftTypes: string[];
  reasonCodes: string[];
  sourceBundleIds: string[];
}

export interface AiTaskDraftReviewArtifactAuditRequirement {
  auditLogRequired: boolean;
  approvalTraceRequired: boolean;
  sourceBundleIdsRequired: boolean;
  humanActorRequired: boolean;
}

export interface AiTaskDraftReviewArtifactReadAuditView {
  artifactId: string;
  artifactType: AiTaskDraftReviewType;
  title: string;
  summary: string;
  source: string;
  sourceEntityType: string | null;
  sourceEntityId: string | number | null;
  targetEntityType: string | null;
  targetEntityId: string | number | null;
  policyTraceSummary: AiTaskDraftReviewArtifactPolicyTraceSummary;
  requiresHumanConfirmation: boolean;
  requiresOwnerApproval: boolean;
  forbiddenActionCodes: string[];
  boundaryExplanations: string[];
  safeChecklistItems: string[];
  auditRequirement: AiTaskDraftReviewArtifactAuditRequirement;
  executable: false;
  executionStatus: 'draft_only';
  lifecycleStatus: AiTaskDraftReviewArtifactLifecycleStatus;
  createdByAiInteractionId: string | number | null;
  humanReviewerId: null;
  reviewedAt: null;
  reviewDecision: AiTaskDraftReviewArtifactReviewDecision;
}

export type AiTaskDraftReviewArtifactLike = Partial<
  AiTaskDraftReviewArtifact & {
    artifactId: string;
    artifactType: AiTaskDraftReviewType;
    safeChecklistItems: readonly unknown[];
    lifecycleStatus: string;
    createdByAiInteractionId: string | number | null;
    humanReviewerId: string | number | null;
    reviewedAt: string | Date | null;
    reviewDecision: string | null;
  }
> &
  Record<string, unknown>;

export interface AiTaskDraftReviewArtifactSafeInteractionMetadata {
  id?: string | number | null;
  interactionId?: string | number | null;
  aiInteractionId?: string | number | null;
  createdByAiInteractionId?: string | number | null;
}

export interface AiTaskDraftReviewArtifactReadAuditInput {
  artifact: AiTaskDraftReviewArtifactLike;
  taskDraftReviewArtifactSummary?: Record<string, unknown> | null;
  taskDraftReviewPolicyTrace?: readonly Record<string, unknown>[] | null;
  aiAssistantInteractionMetadata?:
    | AiTaskDraftReviewArtifactSafeInteractionMetadata
    | null;
}

interface NormalizedReadAuditInput {
  artifact: AiTaskDraftReviewArtifactLike;
  policyTraceRows: readonly Record<string, unknown>[];
  aiAssistantInteractionMetadata:
    | AiTaskDraftReviewArtifactSafeInteractionMetadata
    | null;
}

const ARTIFACT_TYPES: readonly AiTaskDraftReviewType[] = [
  'manual_review_task',
  'evidence_collection_checklist',
  'investigation_task',
  'handoff_note',
  'approval_prefill',
  'confirmation_required_draft',
];

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
];

const FORBIDDEN_ACTION_CODE_SET = new Set(FORBIDDEN_ACTION_CODES);

const REDACTED_SENSITIVE_MARKER = '[redacted_sensitive]';
const REDACTED_PHONE_MARKER = '[redacted_phone]';
const REDACTED_ACCOUNT_MARKER = '[redacted_account]';
const BLOCKED_ACTION_MARKER = '[blocked_action]';

@Injectable()
export class AiTaskDraftReviewArtifactReadAuditService {
  toReadAuditView(
    input:
      | AiTaskDraftReviewArtifact
      | AiTaskDraftReviewArtifactLike
      | AiTaskDraftReviewArtifactReadAuditInput,
  ): AiTaskDraftReviewArtifactReadAuditView {
    const normalized = this.normalizeInput(input);
    const artifact = normalized.artifact;
    const artifactType = this.resolveArtifactType(artifact);
    const policyTrace = this.resolvePolicyTrace(normalized, artifact);
    const auditRequirement = this.resolveAuditRequirement(artifact, policyTrace);
    const forbiddenActionCodes = this.resolveForbiddenActionCodes(
      artifact,
      policyTrace,
    );

    return {
      artifactId: this.resolveArtifactId(artifact, artifactType),
      artifactType,
      title: this.resolveTitle(artifact, artifactType),
      summary: this.resolveSummary(artifact, artifactType),
      source:
        this.sanitizeReadText(artifact.source) ||
        'ai_service_policy_gated_suggested_action',
      sourceEntityType: this.sanitizeNullableReadText(artifact.sourceEntityType),
      sourceEntityId: this.sanitizeEntityId(artifact.sourceEntityId),
      targetEntityType: this.sanitizeNullableReadText(artifact.targetEntityType),
      targetEntityId: this.sanitizeEntityId(artifact.targetEntityId),
      policyTraceSummary: {
        candidateId:
          this.sanitizeReadText(policyTrace.candidateId) || 'unknown_candidate',
        actionPermissionLevel: this.sanitizePolicyLevel(
          policyTrace.actionPermissionLevel,
        ),
        allowedAssistantSurface: this.sanitizeReadTextArray(
          policyTrace.allowedAssistantSurface,
        ),
        allowedDraftTypes: this.sanitizeReadTextArray(
          policyTrace.allowedDraftTypes,
        ),
        reasonCodes: this.sanitizeReadTextArray(policyTrace.reasonCodes),
        sourceBundleIds: this.sanitizeReadTextArray(policyTrace.sourceBundleIds),
      },
      requiresHumanConfirmation: this.readBoolean(
        artifact.requiresHumanConfirmation,
        policyTrace.requiresHumanConfirmation === true,
      ),
      requiresOwnerApproval: this.readBoolean(
        artifact.requiresOwnerApproval,
        policyTrace.requiresOwnerApproval === true,
      ),
      forbiddenActionCodes,
      boundaryExplanations: this.resolveBoundaryExplanations(artifact),
      safeChecklistItems: this.resolveSafeChecklistItems(artifact, artifactType),
      auditRequirement,
      executable: false,
      executionStatus: 'draft_only',
      lifecycleStatus: 'draft_only',
      createdByAiInteractionId:
        this.resolveCreatedByAiInteractionId(normalized, artifact),
      humanReviewerId: null,
      reviewedAt: null,
      reviewDecision: 'pending',
    };
  }

  toReadAuditViews(
    inputs: readonly (
      | AiTaskDraftReviewArtifact
      | AiTaskDraftReviewArtifactLike
      | AiTaskDraftReviewArtifactReadAuditInput
    )[],
  ): AiTaskDraftReviewArtifactReadAuditView[] {
    return inputs.map((input) => this.toReadAuditView(input));
  }

  private normalizeInput(
    input:
      | AiTaskDraftReviewArtifact
      | AiTaskDraftReviewArtifactLike
      | AiTaskDraftReviewArtifactReadAuditInput,
  ): NormalizedReadAuditInput {
    if (this.isReadAuditInput(input)) {
      return {
        artifact: input.artifact,
        policyTraceRows: input.taskDraftReviewPolicyTrace ?? [],
        aiAssistantInteractionMetadata:
          input.aiAssistantInteractionMetadata ?? null,
      };
    }
    return {
      artifact: input as AiTaskDraftReviewArtifactLike,
      policyTraceRows: [],
      aiAssistantInteractionMetadata: null,
    };
  }

  private isReadAuditInput(
    input:
      | AiTaskDraftReviewArtifact
      | AiTaskDraftReviewArtifactLike
      | AiTaskDraftReviewArtifactReadAuditInput,
  ): input is AiTaskDraftReviewArtifactReadAuditInput {
    return (
      typeof input === 'object' &&
      input !== null &&
      'artifact' in input &&
      typeof (input as AiTaskDraftReviewArtifactReadAuditInput).artifact ===
        'object' &&
      (input as AiTaskDraftReviewArtifactReadAuditInput).artifact !== null
    );
  }

  private resolveArtifactType(
    artifact: AiTaskDraftReviewArtifactLike,
  ): AiTaskDraftReviewType {
    const normalized = this.normalizeToken(
      artifact.artifactType ?? artifact.draftType,
    );
    if (ARTIFACT_TYPES.includes(normalized as AiTaskDraftReviewType)) {
      return normalized as AiTaskDraftReviewType;
    }
    return 'manual_review_task';
  }

  private resolveArtifactId(
    artifact: AiTaskDraftReviewArtifactLike,
    artifactType: AiTaskDraftReviewType,
  ): string {
    return (
      this.sanitizeReadText(artifact.artifactId ?? artifact.draftId) ||
      `ai_task_draft:unknown:${artifactType}`
    );
  }

  private resolveTitle(
    artifact: AiTaskDraftReviewArtifactLike,
    artifactType: AiTaskDraftReviewType,
  ): string {
    const title = this.sanitizeReadText(artifact.title);
    if (title) {
      return title;
    }
    const fallbackTitles: Record<AiTaskDraftReviewType, string> = {
      manual_review_task: 'Manual review task draft',
      evidence_collection_checklist: 'Evidence collection checklist draft',
      investigation_task: 'Investigation task draft',
      handoff_note: 'Human handoff note draft',
      approval_prefill: 'Approval prefill draft',
      confirmation_required_draft: 'Confirmation required draft',
    };
    return fallbackTitles[artifactType];
  }

  private resolveSummary(
    artifact: AiTaskDraftReviewArtifactLike,
    artifactType: AiTaskDraftReviewType,
  ): string {
    const summary = this.sanitizeReadText(artifact.summary);
    if (summary) {
      return summary;
    }
    if (artifactType === 'approval_prefill') {
      return 'Prepare non-executable approval material for human review.';
    }
    if (artifactType === 'confirmation_required_draft') {
      return 'Prepare non-executable material that requires explicit human confirmation and backend authorization.';
    }
    return 'Prepare a non-executable read/audit artifact for human follow-up.';
  }

  private resolvePolicyTrace(
    input: NormalizedReadAuditInput,
    artifact: AiTaskDraftReviewArtifactLike,
  ): Partial<AiTaskDraftPolicyTrace> {
    const directTrace = this.asRecord(artifact.policyTrace);
    if (directTrace) {
      return directTrace as Partial<AiTaskDraftPolicyTrace>;
    }

    const artifactCandidateId = this.sanitizeReadText(
      this.asRecord(artifact.policyTrace)?.candidateId ??
        this.readRecordValue(artifact, 'candidateId') ??
        artifact.draftId ??
        artifact.artifactId,
    );
    const matchingTrace =
      input.policyTraceRows.find((trace) => {
        const traceCandidateId = this.sanitizeReadText(trace.candidateId);
        return (
          artifactCandidateId.length > 0 &&
          traceCandidateId.length > 0 &&
          traceCandidateId === artifactCandidateId
        );
      }) ?? input.policyTraceRows[0];

    if (matchingTrace) {
      return matchingTrace as Partial<AiTaskDraftPolicyTrace>;
    }

    return {
      candidateId: artifactCandidateId || 'unknown_candidate',
      actionPermissionLevel: 'explain_only',
      allowedAssistantSurface: [],
      allowedDraftTypes: [],
      reasonCodes: [],
      sourceBundleIds: this.sanitizeReadTextArray(artifact.sourceBundleIds),
    };
  }

  private resolveForbiddenActionCodes(
    artifact: AiTaskDraftReviewArtifactLike,
    policyTrace: Partial<AiTaskDraftPolicyTrace>,
  ): string[] {
    const codes = [
      ...this.sanitizeAuditCodeArray(policyTrace.forbiddenActionCodes),
      ...this.sanitizeAuditCodeArray(artifact.forbiddenActionCodes),
    ];
    return this.unique(codes);
  }

  private resolveBoundaryExplanations(
    artifact: AiTaskDraftReviewArtifactLike,
  ): string[] {
    const explanations = this.sanitizeReadTextArray(
      artifact.boundaryExplanations,
    );
    const safeExplanations =
      explanations.length > 0
        ? explanations
        : ['This read/audit view is non-executable and draft-only.'];
    return this.unique(
      safeExplanations.filter((item) => !this.containsForbiddenActionCode(item)),
    );
  }

  private resolveSafeChecklistItems(
    artifact: AiTaskDraftReviewArtifactLike,
    artifactType: AiTaskDraftReviewType,
  ): string[] {
    const rawItems = Array.isArray(artifact.safeChecklistItems)
      ? artifact.safeChecklistItems
      : artifact.checklistItems;
    const items = this.sanitizeReadTextArray(rawItems).filter(
      (item) => !this.containsForbiddenActionCode(item),
    );
    if (items.length > 0) {
      return items;
    }
    if (artifactType === 'evidence_collection_checklist') {
      return ['Collect safe evidence in the existing authorized system.'];
    }
    if (artifactType === 'approval_prefill') {
      return ['Review prepared material in the authorized approval workflow.'];
    }
    if (artifactType === 'confirmation_required_draft') {
      return ['Require explicit human confirmation before any business action.'];
    }
    if (artifactType === 'handoff_note') {
      return ['Hand off the safe summary to the responsible human reviewer.'];
    }
    return ['Review policy trace and source context.'];
  }

  private resolveAuditRequirement(
    artifact: AiTaskDraftReviewArtifactLike,
    policyTrace: Partial<AiTaskDraftPolicyTrace>,
  ): AiTaskDraftReviewArtifactAuditRequirement {
    const source =
      this.asRecord(artifact.auditRequirement) ??
      this.asRecord(policyTrace.auditRequirement) ??
      {};
    return {
      auditLogRequired: this.readBoolean(source.auditLogRequired, true),
      approvalTraceRequired: this.readBoolean(
        source.approvalTraceRequired,
        false,
      ),
      sourceBundleIdsRequired: this.readBoolean(
        source.sourceBundleIdsRequired,
        true,
      ),
      humanActorRequired: this.readBoolean(source.humanActorRequired, false),
    };
  }

  private resolveCreatedByAiInteractionId(
    input: NormalizedReadAuditInput,
    artifact: AiTaskDraftReviewArtifactLike,
  ): string | number | null {
    const metadata = input.aiAssistantInteractionMetadata;
    const rawId =
      artifact.createdByAiInteractionId ??
      metadata?.createdByAiInteractionId ??
      metadata?.interactionId ??
      metadata?.aiInteractionId ??
      metadata?.id ??
      null;
    return this.sanitizeEntityId(rawId);
  }

  private sanitizePolicyLevel(value: unknown): string {
    const normalized = this.normalizeToken(value);
    const allowedLevels = new Set<AiActionPermissionLevel>([
      'explain_only',
      'suggest_only',
      'draft_task_allowed',
      'human_confirmation_required',
      'forbidden_for_ai',
    ]);
    if (allowedLevels.has(normalized as AiActionPermissionLevel)) {
      return normalized;
    }
    return 'explain_only';
  }

  private sanitizeAuditCodeArray(
    values: readonly unknown[] | null | undefined,
  ): string[] {
    return this.unique(
      (values ?? [])
        .map((value) => this.sanitizeAuditCode(value))
        .filter((value): value is string => value.length > 0),
    );
  }

  private sanitizeAuditCode(value: unknown): string {
    if (this.hasSensitiveMarker(value)) {
      return '';
    }
    const normalized = this.normalizePlainToken(value);
    if (!normalized) {
      return '';
    }
    return normalized;
  }

  private sanitizeNullableReadText(value: unknown): string | null {
    return this.sanitizeReadText(value) || null;
  }

  private sanitizeEntityId(value: unknown): string | number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    const sanitized = this.sanitizeReadText(value);
    return sanitized || null;
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
      .replace(/raw[_\s-]?sms[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(
        /verification[_\s-]?(code|marker)[_\s:a-z0-9-]*/gi,
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
      .replace(/runtime[_\s-]?log[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/\.env/gi, REDACTED_SENSITIVE_MARKER);
    return text.trim();
  }

  private hasSensitiveMarker(value: unknown): boolean {
    const text = String(value ?? '').toLowerCase();
    return (
      /raw[_\s-]?sms/.test(text) ||
      /verification[_\s-]?(code|marker)/.test(text) ||
      /full[_\s-]?phone/.test(text) ||
      /full[_\s-]?(bank[_\s-]?)?account/.test(text) ||
      /secret/.test(text) ||
      /private[_\s-]?key/.test(text) ||
      /certificate/.test(text) ||
      /cert[_\s-]?marker/.test(text) ||
      /runtime[_\s-]?log/.test(text) ||
      text.includes('.env') ||
      /\b1[3-9]\d{9}\b/.test(text) ||
      /\b\d{12,}\b/.test(text)
    );
  }

  private containsForbiddenActionCode(value: string): boolean {
    const normalized = this.normalizeToken(value);
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

  private readBoolean(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    return fallback;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private readRecordValue(
    record: Record<string, unknown>,
    key: string,
  ): unknown {
    return record[key];
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private unique<T>(items: readonly T[]): T[] {
    return [...new Set(items)];
  }
}
