import { Injectable } from '@nestjs/common';
import {
  ContactPhonePermissionPolicyService,
  type ContactPhoneDecisionResult,
  type ContactPhonePermissionCode,
  type ContactPhonePermissionPolicyInput,
  type ContactPhonePermissionPolicyResult,
  type ContactPhonePolicySubject,
} from './contact-phone-permission-policy.service';

export interface AiContactPhonePolicyConsumptionInput
  extends ContactPhonePermissionPolicyInput {
  contextId: string;
}

export interface AiContactPhonePolicyContextFragment {
  contextType: 'contact_phone_permission_policy';
  contextId: string;
  reviewOnly: true;
  safeSummaryOnly: true;
  draftOnly: true;
  actor: ContactPhonePolicySubject;
  channel: ContactPhonePermissionPolicyResult['channel'];
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
  safeReference: ContactPhonePermissionPolicyResult['safeReference'];
  reasonCodes: string[];
  forbiddenExternalFields: ContactPhonePermissionPolicyResult['forbiddenExternalFields'];
  fullPhoneIncluded: false;
  phoneHashIncluded: false;
  phoneNormalizedIncluded: false;
  customerContactExecutionAllowed: false;
  databaseReadAllowed: false;
  databaseWriteAllowed: false;
  businessActionAllowed: false;
  liveGatewayAllowed: false;
  mcpGatewayAllowed: false;
  voiceIntegrationAllowed: false;
}

export interface AiContactPhonePolicyConsumption {
  contextType: 'ai_contact_phone_policy_consumption';
  reviewOnly: true;
  safeSummaryOnly: true;
  draftOnly: true;
  syntheticOnly: true;
  fragments: AiContactPhonePolicyContextFragment[];
  summary: {
    fragmentCount: number;
    allowedCount: number;
    deniedCount: number;
    auditRequiredCount: number;
    approvalRequiredCount: number;
    fullPhoneAllowedDecisionCount: number;
    maskedPhoneAllowedCount: number;
    callWithoutRevealAllowedCount: number;
    externalSafeCount: number;
    externalFullPhoneIncludedAllowed: false;
    phoneHashExternalSafeByDefault: false;
    safeReferenceCustomerIds: string[];
    safeReferencePhoneTails: string[];
    safeReferenceMaskedPhones: string[];
    forbiddenExternalFields: string[];
    fullPhoneIncludedCount: 0;
    phoneHashIncludedCount: 0;
    phoneNormalizedIncludedCount: 0;
    databaseReadCount: 0;
    databaseWriteCount: 0;
    businessActionCount: 0;
    customerContactExecutionCount: 0;
    liveGatewayCount: 0;
    mcpGatewayCount: 0;
    voiceIntegrationCount: 0;
    reviewOnly: true;
    safeSummaryOnly: true;
    draftOnly: true;
    syntheticOnly: true;
  };
}

@Injectable()
export class AiContactPhonePolicyConsumptionService {
  constructor(
    private readonly contactPhonePermissionPolicyService: ContactPhonePermissionPolicyService = new ContactPhonePermissionPolicyService(),
  ) {}

  toContextFragment(
    input: AiContactPhonePolicyConsumptionInput,
  ): AiContactPhonePolicyContextFragment {
    const result = this.contactPhonePermissionPolicyService.evaluate(input);

    return {
      contextType: 'contact_phone_permission_policy',
      contextId: input.contextId,
      reviewOnly: true,
      safeSummaryOnly: true,
      draftOnly: true,
      actor: result.actor,
      channel: result.channel,
      permission: result.permission,
      primaryDecision: result.primaryDecision,
      decisionResults: [...result.decisionResults],
      auditRequired: result.auditRequired,
      approvalRequired: result.approvalRequired,
      fullPhoneAllowed: result.fullPhoneAllowed,
      maskedPhoneAllowed: result.maskedPhoneAllowed,
      callWithoutRevealAllowed: result.callWithoutRevealAllowed,
      externalSafe: result.externalSafe,
      externalFullPhoneIncludedAllowed:
        result.externalFullPhoneIncludedAllowed,
      phoneHashExternalSafeByDefault: result.phoneHashExternalSafeByDefault,
      safeReference: { ...result.safeReference },
      reasonCodes: [...result.reasonCodes],
      forbiddenExternalFields: [...result.forbiddenExternalFields],
      fullPhoneIncluded: false,
      phoneHashIncluded: false,
      phoneNormalizedIncluded: false,
      customerContactExecutionAllowed: false,
      databaseReadAllowed: false,
      databaseWriteAllowed: false,
      businessActionAllowed: false,
      liveGatewayAllowed: false,
      mcpGatewayAllowed: false,
      voiceIntegrationAllowed: false,
    };
  }

  toContextBundle(
    inputs: readonly AiContactPhonePolicyConsumptionInput[],
  ): AiContactPhonePolicyConsumption {
    const fragments = inputs.map((input) => this.toContextFragment(input));

    return {
      contextType: 'ai_contact_phone_policy_consumption',
      reviewOnly: true,
      safeSummaryOnly: true,
      draftOnly: true,
      syntheticOnly: true,
      fragments,
      summary: {
        fragmentCount: fragments.length,
        allowedCount: fragments.filter((item) =>
          item.decisionResults.includes('allowed'),
        ).length,
        deniedCount: fragments.filter((item) =>
          item.decisionResults.includes('denied'),
        ).length,
        auditRequiredCount: fragments.filter((item) => item.auditRequired)
          .length,
        approvalRequiredCount: fragments.filter(
          (item) => item.approvalRequired,
        ).length,
        fullPhoneAllowedDecisionCount: fragments.filter(
          (item) => item.fullPhoneAllowed,
        ).length,
        maskedPhoneAllowedCount: fragments.filter(
          (item) => item.maskedPhoneAllowed,
        ).length,
        callWithoutRevealAllowedCount: fragments.filter(
          (item) => item.callWithoutRevealAllowed,
        ).length,
        externalSafeCount: fragments.filter((item) => item.externalSafe).length,
        externalFullPhoneIncludedAllowed: false,
        phoneHashExternalSafeByDefault: false,
        safeReferenceCustomerIds: this.uniqueStrings(
          fragments.map((item) => item.safeReference.customerId),
        ),
        safeReferencePhoneTails: this.uniqueStrings(
          fragments.map((item) => item.safeReference.phoneTail),
        ),
        safeReferenceMaskedPhones: this.uniqueStrings(
          fragments.map((item) => item.safeReference.maskedPhone),
        ),
        forbiddenExternalFields: this.uniqueStrings(
          fragments.flatMap((item) => item.forbiddenExternalFields),
        ),
        fullPhoneIncludedCount: 0,
        phoneHashIncludedCount: 0,
        phoneNormalizedIncludedCount: 0,
        databaseReadCount: 0,
        databaseWriteCount: 0,
        businessActionCount: 0,
        customerContactExecutionCount: 0,
        liveGatewayCount: 0,
        mcpGatewayCount: 0,
        voiceIntegrationCount: 0,
        reviewOnly: true,
        safeSummaryOnly: true,
        draftOnly: true,
        syntheticOnly: true,
      },
    };
  }

  private uniqueStrings(values: readonly string[]): string[] {
    return [...new Set(values)];
  }
}
