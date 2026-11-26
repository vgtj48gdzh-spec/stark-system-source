import { Injectable } from '@nestjs/common';
import type {
  AiOperationLogRiskLevel,
  AiReadableOperationLogPermissionHints,
} from './ai-readable-operation-log-context.service';

export const AI_ACTION_PERMISSION_LEVELS = [
  'explain_only',
  'suggest_only',
  'draft_task_allowed',
  'human_confirmation_required',
  'forbidden_for_ai',
] as const;

export type AiActionPermissionLevel =
  (typeof AI_ACTION_PERMISSION_LEVELS)[number];

export type AiAssistantSurface =
  | 'answer_section'
  | 'risk_summary'
  | 'safe_suggestion_label'
  | 'review_checklist'
  | 'handoff_note'
  | 'task_draft'
  | 'approval_prefill'
  | 'confirmation_required_draft'
  | 'boundary_explanation';

export type AiAllowedDraftType =
  | 'manual_review_task'
  | 'evidence_collection_checklist'
  | 'handoff_note'
  | 'investigation_task'
  | 'engagement_followup_task'
  | 'approval_prefill'
  | 'confirmation_required_draft';

export interface AiActionPermissionMatrixInput {
  sourceModule?: string | null;
  sourceEntityType?: string | null;
  eventType?: string | null;
  action?: string | null;
  riskLevel?: AiOperationLogRiskLevel | string | null;
  permissionHints?: Partial<AiReadableOperationLogPermissionHints> | null;
  forbiddenActions?: readonly string[] | null;
  currentStatus?: string | null;
  missingEvidence?: readonly string[] | null;
  suggestedNextSteps?: readonly string[] | null;
  currentUserRoleCodes?: readonly string[] | null;
  proposedAssistantActionCode?: string | null;
  proposedAssistantSurface?: string | null;
  proposedDraftType?: string | null;
  touchesMoney?: boolean | null;
  touchesWorkOrderStatus?: boolean | null;
  touchesCustomerRights?: boolean | null;
  touchesPayroll?: boolean | null;
  touchesBenefits?: boolean | null;
  touchesVirtualLedger?: boolean | null;
  createsBusinessObject?: boolean | null;
  mutatesBusinessState?: boolean | null;
  usesProductionConnector?: boolean | null;
}

export interface AiActionPermissionMatrixAuditRequirement {
  auditLogRequired: boolean;
  approvalTraceRequired: boolean;
  sourceBundleIdsRequired: boolean;
  humanActorRequired: boolean;
}

export interface AiActionPermissionMatrixResult {
  actionPermissionLevel: AiActionPermissionLevel;
  allowedAssistantSurface: AiAssistantSurface[];
  requiresHumanConfirmation: boolean;
  requiresOwnerApproval: boolean;
  allowedDraftTypes: AiAllowedDraftType[];
  forbiddenActionCodes: string[];
  safeSuggestedActionLabels: string[];
  reasonCodes: string[];
  auditRequirement: AiActionPermissionMatrixAuditRequirement;
}

interface NormalizedAiActionPermissionMatrixInput {
  sourceModule: string;
  sourceEntityType: string;
  eventType: string;
  action: string;
  riskLevel: string;
  permissionHints: Partial<AiReadableOperationLogPermissionHints>;
  contextForbiddenActionCodes: string[];
  currentStatus: string;
  missingEvidence: string[];
  suggestedNextSteps: string[];
  roleCodes: string[];
  proposedAssistantActionCode: string;
  proposedAssistantSurface: string;
  proposedDraftType: string;
  touchesMoney: boolean;
  touchesWorkOrderStatus: boolean;
  touchesCustomerRights: boolean;
  touchesPayroll: boolean;
  touchesBenefits: boolean;
  touchesVirtualLedger: boolean;
  createsBusinessObject: boolean;
  mutatesBusinessState: boolean;
  usesProductionConnector: boolean;
}

const FORBIDDEN_ACTION_ALIASES: Record<string, string> = {
  ai_confirm_bank_sms: 'confirm_bank_sms',
  ai_confirm_bank_sms_apply: 'confirm_bank_sms_apply',
  bank_sms_confirm_apply: 'confirm_bank_sms_apply',
  bank_sms_confirm: 'confirm_bank_sms',
  bank_sms_ignore: 'ignore_bank_sms',
  bank_sms_reconcile: 'reconcile_bank_sms',
  ai_confirm_collection_order: 'create_confirmed_collection_order',
  create_collection_order: 'create_collection_order',
  create_confirmed_collectionorder: 'create_confirmed_collection_order',
  promote_collection_order_confirmed: 'create_confirmed_collection_order',
  create_payment_request_and_execute: 'execute_payment',
  ai_mutate_payment_records: 'create_payment_record',
  payment_records_service_create: 'create_payment_record',
  paymentrecordsservice_create: 'create_payment_record',
  payment_record_create: 'create_payment_record',
  ai_mutate_work_order_amount_received: 'update_work_order_amount_received',
  ai_mutate_work_order_status: 'update_work_order_status',
  mark_work_order_paid: 'update_work_order_status',
  ai_execute_real_payment: 'execute_payment',
  real_payment_execution: 'execute_payment',
  ai_mutate_virtual_ledger: 'mutate_virtual_ledger',
  ai_confirm_payroll: 'confirm_payroll',
  ai_confirm_employee_benefits: 'issue_employee_benefits',
  ai_confirm_customer_rights: 'confirm_customer_rights',
  ai_bypass_approval_or_permission: 'bypass_approval_or_permission',
  use_execution_task_as_finance_approval:
    'use_execution_task_as_finance_approval',
  convert_execution_result_to_payment: 'convert_execution_result_to_payment',
  convert_engagement_result_to_payment:
    'convert_execution_result_to_payment',
  convert_engagement_result_to_ledger:
    'convert_execution_result_to_payment',
  convert_engagement_result_to_status:
    'convert_execution_result_to_payment',
  draft_finance_approval_from_execution_task:
    'use_execution_task_as_finance_approval',
};

const HARD_FORBIDDEN_ACTION_CODES = new Set([
  'confirm_bank_sms',
  'ignore_bank_sms',
  'reconcile_bank_sms',
  'confirm_bank_sms_apply',
  'create_collection_order',
  'create_confirmed_collection_order',
  'create_payment_record',
  'update_work_order_amount_received',
  'update_work_order_status',
  'execute_payment',
  'mutate_virtual_ledger',
  'confirm_payroll',
  'issue_employee_benefits',
  'confirm_customer_rights',
  'invoke_real_wechat_pay',
  'bypass_approval_or_permission',
  'use_execution_task_as_finance_approval',
  'convert_execution_result_to_payment',
]);

const SAFE_EXPLANATION_ACTION_CODES = new Set([
  '',
  'explain',
  'explain_context',
  'explain_blocker',
  'explain_confirm_blocked',
  'explain_historical_result',
  'explain_no_candidate_diagnostic',
  'summarize',
  'summarize_history',
  'review_context',
]);

const SAFE_SUGGESTION_ACTION_CODES = new Set([
  'suggest_evidence',
  'suggest_missing_evidence',
  'suggest_manual_review',
  'suggest_next_steps',
  'request_manual_review_label',
]);

const SAFE_DRAFT_ACTION_CODES = new Set([
  'collect_evidence',
  'create_evidence_collection_task_draft',
  'draft_review_task',
  'create_manual_review_draft',
  'request_manual_review',
  'handoff_to_finance',
  'draft_engagement_task',
]);

const HUMAN_CONFIRMATION_ACTION_CODES = new Set([
  'prepare_approval_material',
  'prepare_collection_order_draft_material',
  'prepare_payment_request_draft_material',
  'prepare_work_order_update_material',
  'prepare_virtual_ledger_adjustment_material',
  'prepare_employee_benefit_issue_draft',
]);

const SAFE_DRAFT_TYPES = new Set<AiAllowedDraftType>([
  'manual_review_task',
  'evidence_collection_checklist',
  'handoff_note',
  'investigation_task',
  'engagement_followup_task',
]);

const APPROVAL_DRAFT_TYPES = new Set<AiAllowedDraftType>([
  'approval_prefill',
  'confirmation_required_draft',
]);

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

const DEFAULT_FORBIDDEN_ACTION_CODES = [
  'confirm_bank_sms',
  'ignore_bank_sms',
  'reconcile_bank_sms',
  'confirm_bank_sms_apply',
  'create_collection_order',
  'create_confirmed_collection_order',
  'create_payment_record',
  'update_work_order_amount_received',
  'update_work_order_status',
  'execute_payment',
  'mutate_virtual_ledger',
  'confirm_payroll',
  'issue_employee_benefits',
  'confirm_customer_rights',
  'invoke_real_wechat_pay',
  'bypass_approval_or_permission',
];

@Injectable()
export class AiActionPermissionMatrixService {
  evaluate(
    input: AiActionPermissionMatrixInput,
  ): AiActionPermissionMatrixResult {
    const normalized = this.normalizeInput(input);
    const directForbiddenActionCodes =
      this.findDirectForbiddenActionCodes(normalized);

    if (directForbiddenActionCodes.length > 0) {
      return this.buildResult(
        'forbidden_for_ai',
        normalized,
        ['direct_forbidden_action'],
        directForbiddenActionCodes,
      );
    }

    if (
      normalized.riskLevel === 'forbidden_for_ai_action' &&
      !this.isReadOnlyExplanationRequest(normalized)
    ) {
      return this.buildResult(
        'forbidden_for_ai',
        normalized,
        ['forbidden_history_cannot_be_replayed'],
        [
          normalized.proposedAssistantActionCode ||
            normalized.action ||
            'forbidden_for_ai_action',
        ],
      );
    }

    if (
      normalized.riskLevel === 'forbidden_for_ai_action' &&
      this.isReadOnlyExplanationRequest(normalized)
    ) {
      return this.buildResult('explain_only', normalized, [
        'historical_result_read_only',
      ]);
    }

    if (this.isSafeDraftRequest(normalized)) {
      if (this.touchesProtectedDomain(normalized)) {
        return this.buildResult('human_confirmation_required', normalized, [
          'protected_domain_requires_human_confirmation',
        ]);
      }
      if (!this.hasDraftCapableRole(normalized.roleCodes)) {
        return this.buildResult('suggest_only', normalized, [
          'role_lacks_draft_scope',
        ]);
      }
      return this.buildResult('draft_task_allowed', normalized, [
        'safe_review_draft_only',
      ]);
    }

    if (
      this.requiresHumanConfirmation(normalized) ||
      HUMAN_CONFIRMATION_ACTION_CODES.has(
        normalized.proposedAssistantActionCode,
      )
    ) {
      return this.buildResult('human_confirmation_required', normalized, [
        'human_confirmation_required',
      ]);
    }

    if (this.isSuggestionRequest(normalized)) {
      return this.buildResult('suggest_only', normalized, [
        'safe_non_executable_suggestion',
      ]);
    }

    if (this.isUnknownExecutableRequest(normalized)) {
      return this.buildResult('explain_only', normalized, [
        'unknown_action_default_read_only',
      ]);
    }

    return this.buildResult('explain_only', normalized, [
      'read_only_explanation',
    ]);
  }

  private normalizeInput(
    input: AiActionPermissionMatrixInput,
  ): NormalizedAiActionPermissionMatrixInput {
    return {
      sourceModule: this.normalizeText(input.sourceModule),
      sourceEntityType: this.normalizeText(input.sourceEntityType),
      eventType: this.normalizeText(input.eventType),
      action: this.canonicalActionCode(input.action),
      riskLevel: this.normalizeText(input.riskLevel),
      permissionHints: input.permissionHints ?? {},
      contextForbiddenActionCodes: this.unique([
        ...DEFAULT_FORBIDDEN_ACTION_CODES,
        ...((input.forbiddenActions ?? []).map((action) =>
          this.canonicalActionCode(action),
        )),
      ]),
      currentStatus: this.normalizeText(input.currentStatus),
      missingEvidence: (input.missingEvidence ?? []).map((item) =>
        this.normalizeText(item),
      ),
      suggestedNextSteps: (input.suggestedNextSteps ?? []).map((item) =>
        this.normalizeText(item),
      ),
      roleCodes: (input.currentUserRoleCodes ?? ['']).map((role) =>
        this.normalizeText(role),
      ),
      proposedAssistantActionCode: this.canonicalActionCode(
        input.proposedAssistantActionCode,
      ),
      proposedAssistantSurface: this.normalizeText(
        input.proposedAssistantSurface,
      ),
      proposedDraftType: this.normalizeText(input.proposedDraftType),
      touchesMoney: input.touchesMoney === true,
      touchesWorkOrderStatus: input.touchesWorkOrderStatus === true,
      touchesCustomerRights: input.touchesCustomerRights === true,
      touchesPayroll: input.touchesPayroll === true,
      touchesBenefits: input.touchesBenefits === true,
      touchesVirtualLedger: input.touchesVirtualLedger === true,
      createsBusinessObject: input.createsBusinessObject === true,
      mutatesBusinessState: input.mutatesBusinessState === true,
      usesProductionConnector: input.usesProductionConnector === true,
    };
  }

  private buildResult(
    level: AiActionPermissionLevel,
    input: NormalizedAiActionPermissionMatrixInput,
    reasonCodes: readonly string[],
    triggeredForbiddenActionCodes: readonly string[] = [],
  ): AiActionPermissionMatrixResult {
    const forbiddenActionCodes = this.unique([
      ...input.contextForbiddenActionCodes,
      ...triggeredForbiddenActionCodes.map((action) =>
        this.canonicalActionCode(action),
      ),
    ]).filter(Boolean);
    return {
      actionPermissionLevel: level,
      allowedAssistantSurface: this.allowedAssistantSurface(level),
      requiresHumanConfirmation:
        level === 'human_confirmation_required' ||
        level === 'forbidden_for_ai',
      requiresOwnerApproval: this.requiresOwnerApproval(input, level),
      allowedDraftTypes: this.allowedDraftTypes(level, input),
      forbiddenActionCodes,
      safeSuggestedActionLabels: this.safeSuggestedActionLabels(level, input),
      reasonCodes: this.unique([...reasonCodes, ...this.contextReasonCodes(input)]),
      auditRequirement: this.auditRequirement(level, input),
    };
  }

  private allowedAssistantSurface(
    level: AiActionPermissionLevel,
  ): AiAssistantSurface[] {
    if (level === 'forbidden_for_ai') {
      return ['answer_section', 'risk_summary', 'boundary_explanation'];
    }
    if (level === 'human_confirmation_required') {
      return [
        'answer_section',
        'risk_summary',
        'approval_prefill',
        'confirmation_required_draft',
      ];
    }
    if (level === 'draft_task_allowed') {
      return [
        'answer_section',
        'risk_summary',
        'safe_suggestion_label',
        'review_checklist',
        'handoff_note',
        'task_draft',
      ];
    }
    if (level === 'suggest_only') {
      return ['answer_section', 'risk_summary', 'safe_suggestion_label'];
    }
    return ['answer_section', 'risk_summary'];
  }

  private allowedDraftTypes(
    level: AiActionPermissionLevel,
    input: NormalizedAiActionPermissionMatrixInput,
  ): AiAllowedDraftType[] {
    if (level === 'draft_task_allowed') {
      const draftTypes: AiAllowedDraftType[] = [
        'manual_review_task',
        'evidence_collection_checklist',
        'handoff_note',
        'investigation_task',
      ];
      if (input.sourceModule === 'engagement') {
        draftTypes.push('engagement_followup_task');
      }
      if (SAFE_DRAFT_TYPES.has(input.proposedDraftType as AiAllowedDraftType)) {
        draftTypes.push(input.proposedDraftType as AiAllowedDraftType);
      }
      return this.unique(draftTypes);
    }
    if (level === 'human_confirmation_required') {
      return ['approval_prefill', 'confirmation_required_draft'];
    }
    return [];
  }

  private safeSuggestedActionLabels(
    level: AiActionPermissionLevel,
    input: NormalizedAiActionPermissionMatrixInput,
  ): string[] {
    let labels: string[];
    if (level === 'forbidden_for_ai') {
      labels = ['explain_boundary', 'request_manual_review'];
    } else if (level === 'human_confirmation_required') {
      labels = ['prepare_approval_material', 'request_human_confirmation'];
    } else if (level === 'draft_task_allowed') {
      labels = [
        'collect_evidence',
        'request_manual_review',
        'draft_review_task',
        'handoff_to_finance',
      ];
      if (input.sourceModule === 'engagement') {
        labels.push('draft_engagement_task');
      }
    } else if (level === 'suggest_only') {
      labels = ['review_context', 'collect_evidence', 'request_manual_review'];
    } else {
      labels = ['review_context', 'summarize_history'];
    }
    return this.unique(labels).filter(
      (label) => !HARD_FORBIDDEN_ACTION_CODES.has(this.canonicalActionCode(label)),
    );
  }

  private auditRequirement(
    level: AiActionPermissionLevel,
    input: NormalizedAiActionPermissionMatrixInput,
  ): AiActionPermissionMatrixAuditRequirement {
    const protectedDomain = this.touchesProtectedDomain(input);
    return {
      auditLogRequired:
        level === 'draft_task_allowed' ||
        level === 'human_confirmation_required' ||
        level === 'forbidden_for_ai' ||
        protectedDomain,
      approvalTraceRequired:
        level === 'human_confirmation_required' ||
        level === 'forbidden_for_ai' ||
        protectedDomain,
      sourceBundleIdsRequired: true,
      humanActorRequired:
        level === 'human_confirmation_required' ||
        level === 'forbidden_for_ai',
    };
  }

  private contextReasonCodes(
    input: NormalizedAiActionPermissionMatrixInput,
  ): string[] {
    const reasonCodes: string[] = [];
    if (input.riskLevel) {
      reasonCodes.push(`risk_${input.riskLevel}`);
    }
    if (input.permissionHints.requiresHumanApproval === true) {
      reasonCodes.push('permission_hint_requires_human_approval');
    }
    if (input.permissionHints.actionPermissionMatrixRequired === true) {
      reasonCodes.push('permission_matrix_required');
    }
    if (input.missingEvidence.length > 0) {
      reasonCodes.push('missing_evidence_present');
    }
    if (input.suggestedNextSteps.length > 0) {
      reasonCodes.push('suggested_next_steps_are_labels_only');
    }
    return reasonCodes;
  }

  private requiresHumanConfirmation(
    input: NormalizedAiActionPermissionMatrixInput,
  ): boolean {
    return (
      this.touchesProtectedDomain(input) ||
      input.createsBusinessObject ||
      input.mutatesBusinessState ||
      input.usesProductionConnector ||
      input.riskLevel === 'approval_required' ||
      input.permissionHints.requiresHumanApproval === true
    );
  }

  private requiresOwnerApproval(
    input: NormalizedAiActionPermissionMatrixInput,
    level: AiActionPermissionLevel,
  ): boolean {
    return (
      level === 'forbidden_for_ai' ||
      input.touchesMoney ||
      input.touchesVirtualLedger ||
      input.touchesPayroll ||
      input.touchesBenefits ||
      input.touchesCustomerRights ||
      input.usesProductionConnector
    );
  }

  private touchesProtectedDomain(
    input: NormalizedAiActionPermissionMatrixInput,
  ): boolean {
    return (
      input.touchesMoney ||
      input.touchesWorkOrderStatus ||
      input.touchesCustomerRights ||
      input.touchesPayroll ||
      input.touchesBenefits ||
      input.touchesVirtualLedger
    );
  }

  private findDirectForbiddenActionCodes(
    input: NormalizedAiActionPermissionMatrixInput,
  ): string[] {
    const proposedAction = input.proposedAssistantActionCode;
    if (!proposedAction) {
      return [];
    }
    if (HARD_FORBIDDEN_ACTION_CODES.has(proposedAction)) {
      return [proposedAction];
    }
    return input.contextForbiddenActionCodes.filter(
      (actionCode) => actionCode === proposedAction,
    );
  }

  private isReadOnlyExplanationRequest(
    input: NormalizedAiActionPermissionMatrixInput,
  ): boolean {
    return (
      SAFE_EXPLANATION_ACTION_CODES.has(input.proposedAssistantActionCode) &&
      !input.createsBusinessObject &&
      !input.mutatesBusinessState &&
      !input.usesProductionConnector &&
      !this.touchesProtectedDomain(input)
    );
  }

  private isSafeDraftRequest(
    input: NormalizedAiActionPermissionMatrixInput,
  ): boolean {
    return (
      SAFE_DRAFT_ACTION_CODES.has(input.proposedAssistantActionCode) ||
      SAFE_DRAFT_TYPES.has(input.proposedDraftType as AiAllowedDraftType)
    );
  }

  private isSuggestionRequest(
    input: NormalizedAiActionPermissionMatrixInput,
  ): boolean {
    return (
      SAFE_SUGGESTION_ACTION_CODES.has(input.proposedAssistantActionCode) ||
      input.riskLevel === 'review_required' ||
      input.riskLevel === 'finance_blocked' ||
      input.missingEvidence.length > 0 ||
      input.suggestedNextSteps.length > 0
    );
  }

  private isUnknownExecutableRequest(
    input: NormalizedAiActionPermissionMatrixInput,
  ): boolean {
    if (!input.proposedAssistantActionCode) {
      return false;
    }
    return (
      !SAFE_EXPLANATION_ACTION_CODES.has(input.proposedAssistantActionCode) &&
      !SAFE_SUGGESTION_ACTION_CODES.has(input.proposedAssistantActionCode) &&
      !SAFE_DRAFT_ACTION_CODES.has(input.proposedAssistantActionCode) &&
      !HUMAN_CONFIRMATION_ACTION_CODES.has(input.proposedAssistantActionCode)
    );
  }

  private hasDraftCapableRole(roleCodes: readonly string[]): boolean {
    return roleCodes.some((roleCode) => DRAFT_CAPABLE_ROLES.has(roleCode));
  }

  private normalizeText(value: unknown): string {
    if (value === undefined || value === null) {
      return '';
    }
    return String(value)
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private canonicalActionCode(value: unknown): string {
    const normalized = this.normalizeText(value);
    return FORBIDDEN_ACTION_ALIASES[normalized] ?? normalized;
  }

  private unique<T>(items: readonly T[]): T[] {
    return [...new Set(items)];
  }
}
