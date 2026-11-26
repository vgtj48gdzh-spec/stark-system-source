import { Injectable } from '@nestjs/common';
import {
  AiContactPhonePolicyConsumptionService,
  type AiContactPhonePolicyConsumptionInput,
} from './ai-contact-phone-policy-consumption.service';
import { ContactPhonePermissionPolicyService } from './contact-phone-permission-policy.service';
import {
  StarkAiChatGptInteractionPacketService,
  type StarkAiChatGptInteractionPacket,
  type StarkAiChatGptInteractionValidationResult,
} from './stark-ai-chatgpt-interaction-packet.service';
import {
  StarkAiSyncPacketService,
  type StarkAiSyncPacket,
  type StarkAiSyncPacketArtifacts,
  type StarkAiSyncPacketContactPhonePolicySummary,
} from './stark-ai-sync-packet.service';

export interface StarkAiChatGptContactPhoneSummaryHandoffInput {
  generatedAt?: string | Date;
  latestVerifiedMainCommit?: string | null;
  repo?: string | null;
}

export interface StarkAiChatGptContactPhoneSummaryHandoffPayload
  extends Record<string, unknown> {
  contextType: 'chatgpt_interaction_contact_phone_summary_handoff';
  reviewOnly: true;
  safeSummaryOnly: true;
  draftOnly: true;
  candidateOnly: true;
  syntheticOnly: true;
  nonExecutable: true;
  sourcePacketValidatorPr116: 'merged_source';
  sourcePolicyPr117: 'merged_source';
  sourcePolicyContractPr118: 'merged_source';
  sourceAiServiceConsumptionPr119: 'merged_source';
  sourceSyncPacketSummaryPr120: 'merged_source';
  sourceSyncPacketStatus: StarkAiSyncPacket['packetStatus'];
  sourceSyncPacketHandoffAllowed: boolean;
  contactPhonePolicySummary: StarkAiSyncPacketContactPhonePolicySummary;
  fragmentCount: number;
  contextFragments: number;
  fullPhoneAllowedDecisions: number;
  callWithoutRevealAllowed: number;
  databaseWrites: 0;
  businessActions: 0;
  externalFullPhoneIncludedAllowed: false;
  phoneHashExternalSafeByDefault: false;
  forbiddenExternalFields: string[];
  safeReferenceCustomerIds: string[];
  safeReferencePhoneTails: string[];
  safeReferenceMaskedPhones: string[];
  customerContactExecutionAllowed: false;
  databaseReadAllowed: false;
  databaseWriteAllowed: false;
  businessActionAllowed: false;
  liveGatewayAllowed: false;
  mcpGatewayAllowed: false;
  voiceIntegrationAllowed: false;
}

export interface StarkAiChatGptContactPhoneSummaryHandoff {
  contextType: 'chatgpt_interaction_contact_phone_summary_handoff_result';
  reviewOnly: true;
  safeSummaryOnly: true;
  draftOnly: true;
  candidateOnly: true;
  syntheticOnly: true;
  nonExecutable: true;
  syncPacket: StarkAiSyncPacket;
  contactPhonePolicySummary: StarkAiSyncPacketContactPhonePolicySummary;
  interactionPacket: StarkAiChatGptInteractionPacket;
  validationResult: StarkAiChatGptInteractionValidationResult;
}

const SYNTHETIC_CONTACT_PHONE_POLICY_INPUTS: AiContactPhonePolicyConsumptionInput[] =
  [
    {
      contextId: 'owner_contact_full_read_review',
      actor: 'owner',
      permission: 'contact_full_read',
    },
    {
      contextId: 'owner_ai_contact_ai_use_internal_review_only',
      actor: 'owner_ai',
      permission: 'contact_ai_use_internal',
    },
    {
      contextId: 'operator_call_without_reveal_assigned_task',
      actor: 'operator',
      permission: 'contact_call_without_reveal',
      taskAssigned: true,
    },
    {
      contextId: 'operator_call_without_reveal_role_permission',
      actor: 'operator',
      permission: 'contact_call_without_reveal',
      hasExplicitRolePermission: true,
    },
    {
      contextId: 'chatgpt_external_masked_read_safe_summary',
      actor: 'chatgpt_external',
      permission: 'contact_masked_read',
    },
    {
      contextId: 'chatgpt_external_full_read_denied_redacted',
      actor: 'chatgpt_external',
      permission: 'contact_full_read',
      fullPhoneIncluded: true,
    },
    {
      contextId: 'sync_packet_phone_hash_denied',
      actor: 'sync_packet',
      permission: 'contact_masked_read',
      phoneHashRequested: true,
    },
    {
      contextId: 'ai_memory_internal_use_denied_redacted',
      actor: 'ai_memory',
      permission: 'contact_ai_use_internal',
    },
  ];

@Injectable()
export class StarkAiChatGptContactPhoneSummaryHandoffService {
  constructor(
    private readonly interactionPacketService: StarkAiChatGptInteractionPacketService = new StarkAiChatGptInteractionPacketService(),
    private readonly starkAiSyncPacketService: StarkAiSyncPacketService = new StarkAiSyncPacketService(),
    private readonly contactPhonePolicyConsumptionService: AiContactPhonePolicyConsumptionService = new AiContactPhonePolicyConsumptionService(
      new ContactPhonePermissionPolicyService(),
    ),
  ) {}

  buildContactPhoneSummaryReviewRequestHandoff(
    input: StarkAiChatGptContactPhoneSummaryHandoffInput = {},
  ): StarkAiChatGptContactPhoneSummaryHandoff {
    const syncPacketArtifacts = this.buildSyntheticStarkAiSyncPacket(input);
    const syncPacket = syncPacketArtifacts.jsonPacket;
    const contactPhonePolicySummary = syncPacket.contactPhonePolicySummary;
    const interactionPacket =
      this.interactionPacketService.buildInteractionPacket({
        createdAt: input.generatedAt,
        direction: 'stark_ai_to_chatgpt',
        interactionType: 'review_request',
        reviewMode: 'redaction_review',
        trustLevel: 'repository_verified',
        latestVerifiedMainCommit: input.latestVerifiedMainCommit ?? '',
        repo: input.repo ?? 'vgtj48gdzh-spec/stark-system',
        allowedOperations: [
          'summarize',
          'identify_gap',
          'ask_clarifying_question',
        ],
        forbiddenOperations: [
          'call',
          'dial',
          'reveal',
          'export',
          'customer_contact_execution',
          'database_read',
          'live_gateway',
          'mcp_gateway',
          'voice_integration',
        ],
        payload: this.buildReviewRequestPayload(
          syncPacket,
          contactPhonePolicySummary,
        ),
      });
    const validationResult =
      this.interactionPacketService.validateInteractionPacket(
        interactionPacket,
      );

    return {
      contextType: 'chatgpt_interaction_contact_phone_summary_handoff_result',
      reviewOnly: true,
      safeSummaryOnly: true,
      draftOnly: true,
      candidateOnly: true,
      syntheticOnly: true,
      nonExecutable: true,
      syncPacket,
      contactPhonePolicySummary,
      interactionPacket,
      validationResult,
    };
  }

  buildSyntheticStarkAiSyncPacket(
    input: StarkAiChatGptContactPhoneSummaryHandoffInput = {},
  ): StarkAiSyncPacketArtifacts {
    const contactPhonePolicyConsumption =
      this.contactPhonePolicyConsumptionService.toContextBundle(
        SYNTHETIC_CONTACT_PHONE_POLICY_INPUTS,
      );

    return this.starkAiSyncPacketService.toSyncPacketArtifacts({
      generatedAt: input.generatedAt,
      repo: input.repo ?? 'vgtj48gdzh-spec/stark-system',
      latestVerifiedMainCommit: input.latestVerifiedMainCommit ?? '',
      currentSystemState: {
        mode: 'SAFE',
        slice: 'chatgpt_interaction_contact_phone_summary_handoff',
        backendOnly: true,
        syntheticOnly: true,
      },
      aiCapabilitySummary: {
        reviewOnly: true,
        safeSummaryOnly: true,
        draftOnly: true,
        candidateOnly: true,
        nonExecutable: true,
      },
      currentBlockers: [],
      recentTaskDrafts: [],
      employeeHandoffPreviewSummary: {},
      supervisorReviewSummary: {},
      databaseSafeSummaries: [],
      contactPhonePolicySummary: contactPhonePolicyConsumption.summary,
      aiSelfReviewQuestions: [
        'Can ChatGPT review the safe summary without receiving sensitive contact data?',
        'Are all execution, gateway, and database flags blocked?',
      ],
      questionsForChatGPT: [
        'Review the contact-phone safe summary handoff boundaries.',
      ],
      redactionReport: {
        rawSmsIncluded: false,
        verificationCodesIncluded: false,
        fullPhoneIncluded: false,
        fullBankAccountIncluded: false,
        secretsIncluded: false,
        runtimeLogsIncluded: false,
        privateKeysIncluded: false,
        certificatesIncluded: false,
        databaseFilesIncluded: false,
        productionConnectorPayloadsIncluded: false,
        forbiddenCommandPayloadIncluded: false,
      },
      safeBoundaryFlags: {
        databaseWriteCounter: 0,
        businessWriteCounter: 0,
        dispatchCounter: 0,
        taskCreationCounter: 0,
        lifecycleMutationCounter: 0,
        paymentOrCollectionMutationCounter: 0,
        workOrderMutationCounter: 0,
        virtualLedgerMutationCounter: 0,
      },
    });
  }

  private buildReviewRequestPayload(
    syncPacket: StarkAiSyncPacket,
    summary: StarkAiSyncPacketContactPhonePolicySummary,
  ): StarkAiChatGptContactPhoneSummaryHandoffPayload {
    return {
      contextType: 'chatgpt_interaction_contact_phone_summary_handoff',
      reviewOnly: true,
      safeSummaryOnly: true,
      draftOnly: true,
      candidateOnly: true,
      syntheticOnly: true,
      nonExecutable: true,
      sourcePacketValidatorPr116: 'merged_source',
      sourcePolicyPr117: 'merged_source',
      sourcePolicyContractPr118: 'merged_source',
      sourceAiServiceConsumptionPr119: 'merged_source',
      sourceSyncPacketSummaryPr120: 'merged_source',
      sourceSyncPacketStatus: syncPacket.packetStatus,
      sourceSyncPacketHandoffAllowed: syncPacket.chatGptHandoffAllowed,
      contactPhonePolicySummary: summary,
      fragmentCount: summary.fragmentCount,
      contextFragments: summary.contextFragments,
      fullPhoneAllowedDecisions: summary.fullPhoneAllowedDecisions,
      callWithoutRevealAllowed: summary.callWithoutRevealAllowed,
      databaseWrites: summary.databaseWrites,
      businessActions: summary.businessActions,
      externalFullPhoneIncludedAllowed:
        summary.externalFullPhoneIncludedAllowed,
      phoneHashExternalSafeByDefault:
        summary.phoneHashExternalSafeByDefault,
      forbiddenExternalFields: [...summary.forbiddenExternalFields],
      safeReferenceCustomerIds: [...summary.safeReferenceCustomerIds],
      safeReferencePhoneTails: [...summary.safeReferencePhoneTails],
      safeReferenceMaskedPhones: [...summary.safeReferenceMaskedPhones],
      customerContactExecutionAllowed:
        summary.customerContactExecutionAllowed,
      databaseReadAllowed: summary.databaseReadAllowed,
      databaseWriteAllowed: summary.databaseWriteAllowed,
      businessActionAllowed: summary.businessActionAllowed,
      liveGatewayAllowed: summary.liveGatewayAllowed,
      mcpGatewayAllowed: summary.mcpGatewayAllowed,
      voiceIntegrationAllowed: summary.voiceIntegrationAllowed,
    };
  }
}
