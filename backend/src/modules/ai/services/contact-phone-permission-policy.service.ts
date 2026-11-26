import { Injectable } from '@nestjs/common';

export const CONTACT_PHONE_PERMISSION_CODES = [
  'contact_masked_read',
  'contact_full_read',
  'contact_call_without_reveal',
  'contact_reveal_request',
  'contact_copy',
  'contact_export',
  'contact_batch_export',
  'contact_ai_use_internal',
] as const;

export type ContactPhonePermissionCode =
  (typeof CONTACT_PHONE_PERMISSION_CODES)[number];

export const CONTACT_PHONE_ACTORS = [
  'owner',
  'owner_ai',
  'highest_admin',
  'admin',
  'customer_service',
  'operator',
  'construction_employee',
  'warehouse_employee',
  'external_collaborator',
] as const;

export type ContactPhoneActor = (typeof CONTACT_PHONE_ACTORS)[number];

export const CONTACT_PHONE_CHANNELS = [
  'chatgpt_external',
  'codex',
  'github',
  'sync_packet',
  'ai_memory',
  'prompt_transcript',
  'review_artifact',
  'employee_handoff_preview',
  'supervisor_review_packet',
] as const;

export type ContactPhoneChannel = (typeof CONTACT_PHONE_CHANNELS)[number];

export type ContactPhonePolicySubject =
  | ContactPhoneActor
  | ContactPhoneChannel;

export const CONTACT_PHONE_DECISION_RESULTS = [
  'allowed',
  'denied',
  'approval_required',
  'audit_required',
  'masked_only',
  'call_without_reveal_only',
  'redacted_external_only',
] as const;

export type ContactPhoneDecisionResult =
  (typeof CONTACT_PHONE_DECISION_RESULTS)[number];

export interface ContactPhonePermissionPolicyInput {
  actor: ContactPhonePolicySubject;
  permission: ContactPhonePermissionCode;
  channel?: ContactPhoneChannel | null;
  hasExplicitRolePermission?: boolean | null;
  responsibleCustomer?: boolean | null;
  taskAssigned?: boolean | null;
  crossDepartment?: boolean | null;
  fullPhoneIncluded?: boolean | null;
  phoneHashRequested?: boolean | null;
}

export interface ContactPhoneSyntheticReference {
  customerId: 'CUST_SYNTH_001';
  phoneTail: '1234';
  maskedPhone: '****1234';
}

export interface ContactPhoneStorageContract {
  phoneNormalizedSensitive: true;
  phoneHashInternalOnly: true;
  phoneHashDerivation: 'keyed_hmac_or_peppered_identifier';
  rawPhoneHashExternalSafeByDefault: false;
  externalSafeIdentifiers: Array<
    'customer_id' | 'maskedPhone' | 'phone_tail' | 'audit_reference'
  >;
}

export interface ContactPhonePermissionPolicyResult {
  actor: ContactPhonePolicySubject;
  channel: ContactPhoneChannel | null;
  permission: ContactPhonePermissionCode;
  primaryDecision: ContactPhoneDecisionResult;
  decisionResults: ContactPhoneDecisionResult[];
  auditRequired: boolean;
  approvalRequired: boolean;
  fullPhoneAllowed: boolean;
  maskedPhoneAllowed: boolean;
  callWithoutRevealAllowed: boolean;
  externalSafe: boolean;
  externalFullPhoneIncludedAllowed: false;
  phoneHashExternalSafeByDefault: false;
  safeReference: ContactPhoneSyntheticReference;
  storageContract: ContactPhoneStorageContract;
  forbiddenExternalFields: Array<
    'phone_normalized' | 'phone_hash' | 'fullPhone' | 'fullPhoneIncluded'
  >;
  reasonCodes: string[];
}

export interface ContactPhonePermissionVocabulary {
  permissions: ContactPhonePermissionCode[];
  actors: ContactPhoneActor[];
  channels: ContactPhoneChannel[];
  decisionResults: ContactPhoneDecisionResult[];
}

const EXTERNAL_SURFACES = new Set<ContactPhonePolicySubject>([
  'chatgpt_external',
  'codex',
  'github',
  'sync_packet',
  'ai_memory',
  'prompt_transcript',
  'review_artifact',
  'employee_handoff_preview',
  'supervisor_review_packet',
]);

const EXECUTION_EMPLOYEE_ACTORS = new Set<ContactPhonePolicySubject>([
  'operator',
  'construction_employee',
  'warehouse_employee',
]);

const HIGH_RISK_EXPORT_PERMISSIONS = new Set<ContactPhonePermissionCode>([
  'contact_copy',
  'contact_export',
  'contact_batch_export',
]);

const FULL_PHONE_PERMISSIONS = new Set<ContactPhonePermissionCode>([
  'contact_full_read',
  'contact_copy',
  'contact_export',
  'contact_batch_export',
  'contact_ai_use_internal',
]);

const SYNTHETIC_REFERENCE: ContactPhoneSyntheticReference = {
  customerId: 'CUST_SYNTH_001',
  phoneTail: '1234',
  maskedPhone: '****1234',
};

const STORAGE_CONTRACT: ContactPhoneStorageContract = {
  phoneNormalizedSensitive: true,
  phoneHashInternalOnly: true,
  phoneHashDerivation: 'keyed_hmac_or_peppered_identifier',
  rawPhoneHashExternalSafeByDefault: false,
  externalSafeIdentifiers: [
    'customer_id',
    'maskedPhone',
    'phone_tail',
    'audit_reference',
  ],
};

@Injectable()
export class ContactPhonePermissionPolicyService {
  getVocabulary(): ContactPhonePermissionVocabulary {
    return {
      permissions: [...CONTACT_PHONE_PERMISSION_CODES],
      actors: [...CONTACT_PHONE_ACTORS],
      channels: [...CONTACT_PHONE_CHANNELS],
      decisionResults: [...CONTACT_PHONE_DECISION_RESULTS],
    };
  }

  getStorageContract(): ContactPhoneStorageContract {
    return { ...STORAGE_CONTRACT };
  }

  buildExternalSafeReference(): ContactPhoneSyntheticReference {
    return { ...SYNTHETIC_REFERENCE };
  }

  evaluate(
    input: ContactPhonePermissionPolicyInput,
  ): ContactPhonePermissionPolicyResult {
    const actor = input.actor;
    const channel = input.channel ?? null;
    const decisions: ContactPhoneDecisionResult[] = [];
    const reasonCodes: string[] = [];

    if (this.isExternalSurface(actor) || this.isExternalSurface(channel)) {
      this.applyExternalSurfaceDecision(input, decisions, reasonCodes);
    } else if (HIGH_RISK_EXPORT_PERMISSIONS.has(input.permission)) {
      decisions.push('approval_required', 'audit_required');
      reasonCodes.push('high_risk_contact_data_movement');
    } else if (input.permission === 'contact_reveal_request') {
      decisions.push('approval_required', 'audit_required');
      reasonCodes.push('full_phone_reveal_requires_approval');
    } else if (
      input.permission === 'contact_full_read' &&
      input.crossDepartment === true
    ) {
      decisions.push('approval_required', 'audit_required');
      reasonCodes.push('cross_department_full_read_requires_approval');
    } else {
      this.applyInternalDecision(input, decisions, reasonCodes);
    }

    if (
      input.phoneHashRequested === true &&
      !this.isExternalSurface(actor) &&
      !this.isExternalSurface(channel)
    ) {
      reasonCodes.push('phone_hash_internal_only');
    }

    const decisionResults = this.unique(decisions);
    const primaryDecision = this.resolvePrimaryDecision(decisionResults);
    const fullPhoneAllowed =
      decisionResults.includes('allowed') &&
      !decisionResults.includes('approval_required') &&
      !decisionResults.includes('denied') &&
      (input.permission === 'contact_full_read' ||
        input.permission === 'contact_ai_use_internal');

    return {
      actor,
      channel,
      permission: input.permission,
      primaryDecision,
      decisionResults,
      auditRequired: decisionResults.includes('audit_required'),
      approvalRequired: decisionResults.includes('approval_required'),
      fullPhoneAllowed,
      maskedPhoneAllowed:
        decisionResults.includes('masked_only') ||
        decisionResults.includes('redacted_external_only') ||
        input.permission === 'contact_masked_read',
      callWithoutRevealAllowed:
        decisionResults.includes('call_without_reveal_only') &&
        decisionResults.includes('allowed'),
      externalSafe:
        decisionResults.includes('redacted_external_only') ||
        !FULL_PHONE_PERMISSIONS.has(input.permission),
      externalFullPhoneIncludedAllowed: false,
      phoneHashExternalSafeByDefault: false,
      safeReference: this.buildExternalSafeReference(),
      storageContract: this.getStorageContract(),
      forbiddenExternalFields: [
        'phone_normalized',
        'phone_hash',
        'fullPhone',
        'fullPhoneIncluded',
      ],
      reasonCodes: this.unique(reasonCodes),
    };
  }

  private applyExternalSurfaceDecision(
    input: ContactPhonePermissionPolicyInput,
    decisions: ContactPhoneDecisionResult[],
    reasonCodes: string[],
  ): void {
    decisions.push('redacted_external_only', 'masked_only');
    reasonCodes.push('external_surface_redacted_only');

    if (input.fullPhoneIncluded === true) {
      decisions.push('denied');
      reasonCodes.push('external_full_phone_forbidden');
      return;
    }

    if (input.phoneHashRequested === true) {
      decisions.push('denied');
      reasonCodes.push('external_phone_hash_forbidden');
      return;
    }

    if (input.permission !== 'contact_masked_read') {
      decisions.push('denied');
      reasonCodes.push('external_permission_not_allowed');
      return;
    }

    decisions.push('allowed');
    reasonCodes.push('external_masked_summary_allowed');
  }

  private applyInternalDecision(
    input: ContactPhonePermissionPolicyInput,
    decisions: ContactPhoneDecisionResult[],
    reasonCodes: string[],
  ): void {
    if (input.actor === 'owner' && input.permission === 'contact_full_read') {
      decisions.push('allowed', 'audit_required');
      reasonCodes.push('owner_full_read_internal_audited');
      return;
    }

    if (
      input.actor === 'owner_ai' &&
      input.permission === 'contact_ai_use_internal'
    ) {
      decisions.push('allowed', 'audit_required');
      reasonCodes.push('owner_ai_internal_use_audited');
      return;
    }

    if (
      input.actor === 'highest_admin' &&
      input.permission === 'contact_full_read'
    ) {
      if (input.hasExplicitRolePermission === true) {
        decisions.push('allowed', 'audit_required');
        reasonCodes.push('highest_admin_explicit_role_permission');
      } else {
        decisions.push('approval_required', 'audit_required');
        reasonCodes.push('highest_admin_missing_explicit_role_permission');
      }
      return;
    }

    if (
      input.actor === 'customer_service' &&
      input.permission === 'contact_full_read'
    ) {
      if (input.responsibleCustomer === true) {
        decisions.push('allowed', 'audit_required');
        reasonCodes.push('customer_service_responsible_customer');
      } else {
        decisions.push('approval_required', 'audit_required');
        reasonCodes.push('customer_service_not_responsible_customer');
      }
      return;
    }

    if (
      EXECUTION_EMPLOYEE_ACTORS.has(input.actor) &&
      input.permission === 'contact_call_without_reveal'
    ) {
      const taskAssigned = input.taskAssigned === true;
      const hasRolePermission = input.hasExplicitRolePermission === true;
      if (taskAssigned || hasRolePermission) {
        decisions.push('allowed', 'audit_required', 'call_without_reveal_only');
        reasonCodes.push(
          taskAssigned
            ? 'assigned_task_call_without_reveal'
            : 'role_permission_call_without_reveal',
        );
      } else {
        decisions.push('approval_required', 'audit_required');
        reasonCodes.push(
          'execution_employee_call_without_reveal_requires_task_or_role_permission',
        );
      }
      return;
    }

    if (
      EXECUTION_EMPLOYEE_ACTORS.has(input.actor) &&
      input.permission === 'contact_full_read'
    ) {
      decisions.push('denied', 'masked_only');
      reasonCodes.push('execution_employee_full_read_denied');
      return;
    }

    if (
      input.actor === 'external_collaborator' ||
      input.permission === 'contact_ai_use_internal'
    ) {
      decisions.push('denied', 'masked_only');
      reasonCodes.push('default_denied');
      return;
    }

    if (input.permission === 'contact_masked_read') {
      decisions.push('allowed', 'masked_only');
      reasonCodes.push('masked_read_default_allowed');
      return;
    }

    decisions.push('approval_required', 'audit_required');
    reasonCodes.push('default_approval_required');
  }

  private resolvePrimaryDecision(
    decisions: readonly ContactPhoneDecisionResult[],
  ): ContactPhoneDecisionResult {
    if (decisions.includes('denied')) {
      return 'denied';
    }
    if (decisions.includes('approval_required')) {
      return 'approval_required';
    }
    if (decisions.includes('allowed')) {
      return 'allowed';
    }
    if (decisions.includes('redacted_external_only')) {
      return 'redacted_external_only';
    }
    return 'masked_only';
  }

  private isExternalSurface(
    value: ContactPhonePolicySubject | ContactPhoneChannel | null,
  ): boolean {
    return value !== null && EXTERNAL_SURFACES.has(value);
  }

  private unique<T>(items: readonly T[]): T[] {
    return [...new Set(items)];
  }
}
