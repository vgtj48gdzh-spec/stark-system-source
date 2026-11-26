import { Injectable } from '@nestjs/common';
import {
  StarkAiChatGptContactPhoneReviewResponseValidatorService,
  type StarkAiChatGptContactPhoneReviewResponseValidationResult,
  type StarkAiChatGptContactPhoneReviewResponseStatus,
  type StarkAiChatGptContactPhoneReviewResponseType,
  type StarkAiChatGptContactPhoneReviewResponseValidationInput,
} from './stark-ai-chatgpt-contact-phone-review-response-validator.service';

export type AiChatGptContactPhoneReviewResponseBlockedReasonGroup =
  | 'english_customer_phone_request'
  | 'chinese_sensitive_request'
  | 'customer_contact_execution'
  | 'gateway_request'
  | 'allowed_operations_forbidden'
  | 'compact_allowed_operation_bypass'
  | 'unsafe_safe_boundary_bypass'
  | 'real_phone_like_digits'
  | 'forbidden_true_flags';

export interface AiChatGptContactPhoneReviewResponseConsumptionArtifact {
  contextType: 'ai_chatgpt_contact_phone_review_response_consumption_artifact';
  artifactId: string;
  reviewOnly: true;
  safeSummaryOnly: true;
  draftOnly: true;
  syntheticOnly: true;
  interactionType: StarkAiChatGptContactPhoneReviewResponseType;
  status: StarkAiChatGptContactPhoneReviewResponseStatus;
  result: StarkAiChatGptContactPhoneReviewResponseStatus;
  expectedStatus: StarkAiChatGptContactPhoneReviewResponseStatus;
  statusMatchesExpected: boolean;
  valid: boolean;
  issueCount: number;
  blockedReasonGroups: AiChatGptContactPhoneReviewResponseBlockedReasonGroup[];
  sourceReviewRequestValidationStatus: StarkAiChatGptContactPhoneReviewResponseStatus;
  sourceReviewRequestInteractionType: 'review_request';
  noWriteNoExecutionGuarantee: true;
  executable: false;
  approvalGranted: false;
  dispatchAllowed: false;
  businessObjectCreationAllowed: false;
}

export interface AiChatGptContactPhoneReviewResponseConsumptionSummary {
  contextType: 'ai_chatgpt_contact_phone_review_response_consumption';
  reviewOnly: true;
  safeSummaryOnly: true;
  draftOnly: true;
  syntheticOnly: true;
  validFixtureCount: number;
  blockedFixtureCount: number;
  validArtifactCount: number;
  blockedArtifactCount: number;
  supportedInteractionTypes: StarkAiChatGptContactPhoneReviewResponseType[];
  resultStatuses: StarkAiChatGptContactPhoneReviewResponseStatus[];
  blockedReasonGroups: AiChatGptContactPhoneReviewResponseBlockedReasonGroup[];
  sourceReviewResponseValidatorPr122: 'merged_source';
  sourceReviewRequestHandoffPr121: 'merged_source';
  sourceInteractionPacketPr116: 'merged_source';
  noWriteNoExecutionGuarantee: true;
  databaseReads: 0;
  databaseWrites: 0;
  businessActions: 0;
  customerContactExecutionCount: 0;
  dispatchCount: 0;
  taskCreationCount: 0;
  liveGatewayCount: 0;
  mcpGatewayCount: 0;
  voiceIntegrationCount: 0;
}

export interface AiChatGptContactPhoneReviewResponseConsumption {
  contextType: 'ai_chatgpt_contact_phone_review_response_consumption';
  reviewOnly: true;
  safeSummaryOnly: true;
  draftOnly: true;
  syntheticOnly: true;
  artifacts: AiChatGptContactPhoneReviewResponseConsumptionArtifact[];
  summary: AiChatGptContactPhoneReviewResponseConsumptionSummary;
}

export interface AiChatGptContactPhoneReviewResponseConsumptionFixtureExpectation {
  artifactId: string;
  expectedStatus: StarkAiChatGptContactPhoneReviewResponseStatus;
  expectedBlockedReasonGroups: AiChatGptContactPhoneReviewResponseBlockedReasonGroup[];
}

interface AiChatGptContactPhoneReviewResponseFixture {
  artifactId: string;
  expectedStatus: StarkAiChatGptContactPhoneReviewResponseStatus;
  input: StarkAiChatGptContactPhoneReviewResponseValidationInput;
  expectedBlockedReasonGroups?: readonly AiChatGptContactPhoneReviewResponseBlockedReasonGroup[];
}

type AiChatGptContactPhoneReviewResponseValidationIssue =
  StarkAiChatGptContactPhoneReviewResponseValidationResult['issues'][number];

const DEFAULT_REPO = 'vgtj48gdzh-spec/stark-system';
const DEFAULT_VERIFIED_MAIN_COMMIT =
  '18ce8d63f1e9935f9578d75375f57f02f9127244';

const SUPPORTED_INTERACTION_TYPES: StarkAiChatGptContactPhoneReviewResponseType[] =
  ['review_response', 'clarification_request', 'codex_instruction_candidate'];

const RESULT_STATUSES: StarkAiChatGptContactPhoneReviewResponseStatus[] = [
  'valid_review_artifact',
  'blocked_review_artifact',
];

const BLOCKED_REASON_GROUP_ORDER: AiChatGptContactPhoneReviewResponseBlockedReasonGroup[] =
  [
    'english_customer_phone_request',
    'chinese_sensitive_request',
    'customer_contact_execution',
    'gateway_request',
    'allowed_operations_forbidden',
    'compact_allowed_operation_bypass',
    'unsafe_safe_boundary_bypass',
    'real_phone_like_digits',
    'forbidden_true_flags',
  ];

const VALID_REVIEW_RESPONSE_PAYLOAD = {
  reviewConclusion: 'contact_phone_policy_summary_boundary_safe',
  boundarySummary: [
    'The artifact remains redacted, review-only, synthetic-only, and non-executable.',
    'The safe summary can be reviewed without customer contact execution.',
  ],
  policyGaps: [
    'Future slices can add more audit references while preserving redaction.',
  ],
};

const VALID_CLARIFICATION_REQUEST_PAYLOAD = {
  questionsForStarkAi: [
    'Please provide more redacted business summary and audit reference IDs only.',
    'Which repository review artifact proves the boundary?',
  ],
  allowedAnswerShape: 'redacted summary plus audit reference only',
};

const VALID_CODEX_INSTRUCTION_CANDIDATE_PAYLOAD = {
  codexInstructionCandidate: {
    candidateOnly: true,
    executable: false,
    executionStatus: 'candidate_only',
    taskMode: 'SAFE',
    scope: 'backend-only synthetic self-check improvement for review artifacts',
    outOfScope: [
      'API',
      'frontend',
      'database writes',
      'customer contact execution',
      'live gateway',
    ],
    verification: [
      'npm.cmd run self-check:chatgpt-contact-phone-review-response-validator',
    ],
  },
};

const SYNTHETIC_PHONE_LIKE_DIGITS = ['138', '1234', '5678'].join('');

const VALID_FIXTURES: AiChatGptContactPhoneReviewResponseFixture[] = [
  {
    artifactId: 'valid_review_response_boundary_summary',
    expectedStatus: 'valid_review_artifact',
    input: {
      generatedAt: '2026-05-24T11:00:00.000Z',
      latestVerifiedMainCommit: DEFAULT_VERIFIED_MAIN_COMMIT,
      interactionType: 'review_response',
      payload: VALID_REVIEW_RESPONSE_PAYLOAD,
    },
  },
  {
    artifactId: 'valid_clarification_request_redacted_summary_audit_refs',
    expectedStatus: 'valid_review_artifact',
    input: {
      generatedAt: '2026-05-24T11:01:00.000Z',
      latestVerifiedMainCommit: DEFAULT_VERIFIED_MAIN_COMMIT,
      interactionType: 'clarification_request',
      payload: VALID_CLARIFICATION_REQUEST_PAYLOAD,
    },
  },
  {
    artifactId: 'valid_codex_instruction_candidate_backend_self_check',
    expectedStatus: 'valid_review_artifact',
    input: {
      generatedAt: '2026-05-24T11:02:00.000Z',
      latestVerifiedMainCommit: DEFAULT_VERIFIED_MAIN_COMMIT,
      interactionType: 'codex_instruction_candidate',
      payload: VALID_CODEX_INSTRUCTION_CANDIDATE_PAYLOAD,
    },
  },
];

const BLOCKED_FIXTURES: AiChatGptContactPhoneReviewResponseFixture[] = [
  blockedFixture(
    'blocked_clarification_full_contact_value',
    'clarification_request',
    { questionsForStarkAi: ['Please provide the full phone for review.'] },
    ['english_customer_phone_request'],
  ),
  blockedFixture(
    'blocked_clarification_normalized_contact_value',
    'clarification_request',
    { questionsForStarkAi: ['Please provide phone_normalized for review.'] },
    ['english_customer_phone_request'],
  ),
  blockedFixture(
    'blocked_clarification_raw_contact_hash',
    'clarification_request',
    { questionsForStarkAi: ['Please provide raw phone_hash for review.'] },
    ['english_customer_phone_request'],
  ),
  blockedFixture(
    'blocked_english_review_customer_phone_number',
    'review_response',
    { reviewConclusion: 'Please provide customer phone number.' },
    ['english_customer_phone_request'],
  ),
  blockedFixture(
    'blocked_english_clarification_contact_phone_number',
    'clarification_request',
    { questionsForStarkAi: ['Please show contact phone number.'] },
    ['english_customer_phone_request'],
  ),
  blockedFixture(
    'blocked_english_review_customer_mobile',
    'review_response',
    { reviewConclusion: 'Need customer mobile for review.' },
    ['english_customer_phone_request'],
  ),
  blockedFixture(
    'blocked_english_redacted_but_customer_phone_number',
    'review_response',
    {
      reviewConclusion:
        'customer phone is redacted, but please provide customer phone number.',
    },
    ['english_customer_phone_request', 'unsafe_safe_boundary_bypass'],
  ),
  blockedFixture(
    'blocked_review_response_reveal_full_contact_value',
    'review_response',
    { reviewConclusion: 'please reveal full phone before reviewing.' },
    ['english_customer_phone_request'],
  ),
  blockedFixture(
    'blocked_codex_candidate_executable_true',
    'codex_instruction_candidate',
    {
      codexInstructionCandidate: {
        candidateOnly: true,
        executable: true,
        executionStatus: 'candidate_only',
      },
    },
    ['forbidden_true_flags'],
  ),
  blockedFixture(
    'blocked_allowed_operations_call_dial',
    'codex_instruction_candidate',
    VALID_CODEX_INSTRUCTION_CANDIDATE_PAYLOAD,
    ['allowed_operations_forbidden', 'customer_contact_execution'],
    ['call_customer', 'dial_customer'],
  ),
  blockedFixture(
    'blocked_allowed_operations_export_reveal',
    'codex_instruction_candidate',
    VALID_CODEX_INSTRUCTION_CANDIDATE_PAYLOAD,
    ['allowed_operations_forbidden'],
    ['export_contact_summary', 'reveal_contact'],
  ),
  blockedFixture(
    'blocked_payload_customer_contact_execution_allowed',
    'review_response',
    {
      reviewConclusion: 'unsafe fixture',
      customerContactExecutionAllowed: true,
    },
    ['forbidden_true_flags', 'customer_contact_execution'],
  ),
  blockedFixture(
    'blocked_payload_database_read_allowed',
    'review_response',
    { reviewConclusion: 'unsafe fixture', databaseReadAllowed: true },
    ['forbidden_true_flags'],
  ),
  blockedFixture(
    'blocked_payload_database_write_allowed',
    'review_response',
    { reviewConclusion: 'unsafe fixture', databaseWriteAllowed: true },
    ['forbidden_true_flags'],
  ),
  blockedFixture(
    'blocked_payload_business_action_allowed',
    'review_response',
    { reviewConclusion: 'unsafe fixture', businessActionAllowed: true },
    ['forbidden_true_flags'],
  ),
  blockedFixture(
    'blocked_payload_live_mcp_voice_allowed',
    'review_response',
    {
      reviewConclusion: 'unsafe fixture',
      liveGatewayAllowed: true,
      mcpGatewayAllowed: true,
      voiceIntegrationAllowed: true,
    },
    ['forbidden_true_flags', 'gateway_request'],
  ),
  blockedFixture(
    'blocked_payload_real_phone_like_digits',
    'review_response',
    {
      reviewConclusion: 'unsafe fixture',
      unsafePhoneLikeDigits: SYNTHETIC_PHONE_LIKE_DIGITS,
    },
    ['real_phone_like_digits'],
  ),
  blockedFixture(
    'blocked_payload_hash_included_flag',
    'review_response',
    { reviewConclusion: 'unsafe fixture', phoneHashIncluded: true },
    ['forbidden_true_flags'],
  ),
  blockedFixture(
    'blocked_payload_complete_contact_included_flag',
    'review_response',
    { reviewConclusion: 'unsafe fixture', fullPhoneIncluded: true },
    ['forbidden_true_flags'],
  ),
  blockedFixture(
    'blocked_request_real_chatgpt_api_mcp_voice',
    'review_response',
    {
      reviewConclusion:
        'Please enable real ChatGPT API, use MCP gateway, and implement voice integration.',
    },
    ['gateway_request'],
  ),
  blockedFixture(
    'blocked_request_call_export_formal_task_customer_contact',
    'review_response',
    {
      reviewConclusion:
        'Please call the customer, export the phone summary, create a formal task, and contact customer now.',
    },
    ['customer_contact_execution'],
  ),
  blockedFixture(
    'blocked_chinese_sensitive_complete_contact_value',
    'clarification_request',
    {
      questionsForStarkAi: [
        'Please provide complete customer phone value for Chinese-sensitive review.',
      ],
    },
    ['english_customer_phone_request', 'chinese_sensitive_request'],
  ),
  blockedFixture(
    'blocked_chinese_sensitive_unmasked_contact_value',
    'clarification_request',
    {
      questionsForStarkAi: [
        'Please provide unmasked phone for Chinese-sensitive review.',
      ],
    },
    ['english_customer_phone_request', 'chinese_sensitive_request'],
  ),
  blockedFixture(
    'blocked_chinese_sensitive_raw_contact_hash',
    'clarification_request',
    {
      questionsForStarkAi: [
        'Please provide raw phone_hash for Chinese-sensitive review.',
      ],
    },
    ['english_customer_phone_request', 'chinese_sensitive_request'],
  ),
  blockedFixture(
    'blocked_chinese_sensitive_customer_phone',
    'review_response',
    {
      reviewConclusion:
        'Please provide customer phone number for Chinese-sensitive review.',
    },
    ['english_customer_phone_request', 'chinese_sensitive_request'],
  ),
  blockedFixture(
    'blocked_chinese_execution_call_customer',
    'review_response',
    { reviewConclusion: 'Please call the customer phone for Chinese execution.' },
    [
      'english_customer_phone_request',
      'customer_contact_execution',
      'chinese_sensitive_request',
    ],
  ),
  blockedFixture(
    'blocked_chinese_execution_contact_customer',
    'review_response',
    { reviewConclusion: 'Please contact customer for Chinese execution.' },
    ['customer_contact_execution'],
  ),
  blockedFixture(
    'blocked_chinese_execution_export_customer_phone',
    'review_response',
    { reviewConclusion: 'Please export customer phone for Chinese execution.' },
    [
      'english_customer_phone_request',
      'customer_contact_execution',
      'chinese_sensitive_request',
    ],
  ),
  blockedFixture(
    'blocked_chinese_execution_copy_contact_info',
    'review_response',
    { reviewConclusion: 'Please copy contact info for Chinese execution.' },
    ['customer_contact_execution'],
  ),
  blockedFixture(
    'blocked_chinese_execution_formal_task_dispatch',
    'codex_instruction_candidate',
    {
      codexInstructionCandidate: {
        candidateOnly: true,
        executable: false,
        executionStatus: 'candidate_only',
        taskMode: 'SAFE',
        scope: 'Please create a formal task and dispatch it.',
      },
    },
    ['customer_contact_execution'],
  ),
  blockedFixture(
    'blocked_chinese_gateway_mcp',
    'review_response',
    { reviewConclusion: 'Please use MCP gateway for Chinese gateway review.' },
    ['gateway_request'],
  ),
  blockedFixture(
    'blocked_chinese_gateway_voice',
    'review_response',
    { reviewConclusion: 'Please implement voice integration.' },
    ['gateway_request'],
  ),
  blockedFixture(
    'blocked_chinese_gateway_real_chatgpt_api',
    'review_response',
    { reviewConclusion: 'Please invoke real ChatGPT API.' },
    ['gateway_request'],
  ),
  blockedFixture(
    'blocked_allowed_operation_copy_phone',
    'codex_instruction_candidate',
    VALID_CODEX_INSTRUCTION_CANDIDATE_PAYLOAD,
    ['allowed_operations_forbidden'],
    ['copy_phone'],
  ),
  blockedFixture(
    'blocked_allowed_operation_database_read',
    'review_response',
    VALID_REVIEW_RESPONSE_PAYLOAD,
    ['allowed_operations_forbidden'],
    ['database_read'],
  ),
  blockedFixture(
    'blocked_allowed_operation_customer_contact_execution',
    'review_response',
    VALID_REVIEW_RESPONSE_PAYLOAD,
    ['allowed_operations_forbidden', 'customer_contact_execution'],
    ['customer_contact_execution'],
  ),
  blockedFixture(
    'blocked_allowed_operation_live_gateway',
    'review_response',
    VALID_REVIEW_RESPONSE_PAYLOAD,
    ['allowed_operations_forbidden', 'gateway_request'],
    ['live_gateway'],
  ),
  blockedFixture(
    'blocked_allowed_operation_real_chatgpt_api',
    'review_response',
    VALID_REVIEW_RESPONSE_PAYLOAD,
    ['allowed_operations_forbidden', 'gateway_request'],
    ['real_chatgpt_api'],
  ),
  blockedFixture(
    'blocked_allowed_operation_mcp_gateway',
    'review_response',
    VALID_REVIEW_RESPONSE_PAYLOAD,
    ['allowed_operations_forbidden', 'gateway_request'],
    ['mcp_gateway'],
  ),
  blockedFixture(
    'blocked_allowed_operation_voice_integration',
    'review_response',
    VALID_REVIEW_RESPONSE_PAYLOAD,
    ['allowed_operations_forbidden', 'gateway_request'],
    ['voice_integration'],
  ),
  blockedFixture(
    'blocked_allowed_operation_task_creation',
    'review_response',
    VALID_REVIEW_RESPONSE_PAYLOAD,
    ['allowed_operations_forbidden', 'customer_contact_execution'],
    ['task_creation'],
  ),
  blockedFixture(
    'blocked_allowed_operation_compact_callcustomer',
    'review_response',
    VALID_REVIEW_RESPONSE_PAYLOAD,
    [
      'customer_contact_execution',
      'allowed_operations_forbidden',
      'compact_allowed_operation_bypass',
    ],
    ['callcustomer'],
  ),
  blockedFixture(
    'blocked_allowed_operation_compact_copyphone',
    'review_response',
    VALID_REVIEW_RESPONSE_PAYLOAD,
    ['allowed_operations_forbidden', 'compact_allowed_operation_bypass'],
    ['copyphone'],
  ),
  blockedFixture(
    'blocked_allowed_operation_compact_revealphone',
    'review_response',
    VALID_REVIEW_RESPONSE_PAYLOAD,
    ['allowed_operations_forbidden', 'compact_allowed_operation_bypass'],
    ['revealphone'],
  ),
  blockedFixture(
    'blocked_allowed_operation_compact_exportcontact',
    'review_response',
    VALID_REVIEW_RESPONSE_PAYLOAD,
    ['allowed_operations_forbidden', 'compact_allowed_operation_bypass'],
    ['exportcontact'],
  ),
  blockedFixture(
    'blocked_allowed_operation_compact_dialcustomer',
    'review_response',
    VALID_REVIEW_RESPONSE_PAYLOAD,
    [
      'customer_contact_execution',
      'allowed_operations_forbidden',
      'compact_allowed_operation_bypass',
    ],
    ['dialcustomer'],
  ),
  blockedFixture(
    'blocked_allowed_operation_compact_customercontactexecution',
    'review_response',
    VALID_REVIEW_RESPONSE_PAYLOAD,
    [
      'customer_contact_execution',
      'allowed_operations_forbidden',
      'compact_allowed_operation_bypass',
    ],
    ['customercontactexecution'],
  ),
  blockedFixture(
    'blocked_allowed_operation_compact_databaseread',
    'review_response',
    VALID_REVIEW_RESPONSE_PAYLOAD,
    ['allowed_operations_forbidden', 'compact_allowed_operation_bypass'],
    ['databaseread'],
  ),
  blockedFixture(
    'blocked_allowed_operation_compact_livegateway',
    'review_response',
    VALID_REVIEW_RESPONSE_PAYLOAD,
    [
      'gateway_request',
      'allowed_operations_forbidden',
      'compact_allowed_operation_bypass',
    ],
    ['livegateway'],
  ),
  blockedFixture(
    'blocked_allowed_operation_compact_realchatgptapi',
    'review_response',
    VALID_REVIEW_RESPONSE_PAYLOAD,
    [
      'gateway_request',
      'allowed_operations_forbidden',
      'compact_allowed_operation_bypass',
    ],
    ['realchatgptapi'],
  ),
  blockedFixture(
    'blocked_allowed_operation_compact_mcpgateway',
    'review_response',
    VALID_REVIEW_RESPONSE_PAYLOAD,
    [
      'gateway_request',
      'allowed_operations_forbidden',
      'compact_allowed_operation_bypass',
    ],
    ['mcpgateway'],
  ),
  blockedFixture(
    'blocked_allowed_operation_compact_voiceintegration',
    'review_response',
    VALID_REVIEW_RESPONSE_PAYLOAD,
    [
      'gateway_request',
      'allowed_operations_forbidden',
      'compact_allowed_operation_bypass',
    ],
    ['voiceintegration'],
  ),
  blockedFixture(
    'blocked_allowed_operation_compact_taskcreation',
    'review_response',
    VALID_REVIEW_RESPONSE_PAYLOAD,
    [
      'customer_contact_execution',
      'allowed_operations_forbidden',
      'compact_allowed_operation_bypass',
    ],
    ['taskcreation'],
  ),
  blockedFixture(
    'blocked_safe_reference_false_but_reveal',
    'review_response',
    {
      reviewConclusion: 'fullPhoneIncluded=false, but please reveal full phone.',
    },
    ['english_customer_phone_request', 'unsafe_safe_boundary_bypass'],
  ),
  blockedFixture(
    'blocked_safe_reference_redacted_but_customer_phone',
    'review_response',
    {
      reviewConclusion:
        'redacted summary, but please provide customer phone number.',
    },
    ['unsafe_safe_boundary_bypass', 'english_customer_phone_request'],
  ),
  blockedFixture(
    'blocked_safe_reference_denied_but_call_customer',
    'review_response',
    { reviewConclusion: 'denied by policy, but call customer now.' },
    ['unsafe_safe_boundary_bypass', 'customer_contact_execution'],
  ),
];

@Injectable()
export class AiChatGptContactPhoneReviewResponseConsumptionService {
  constructor(
    private readonly reviewResponseValidatorService: StarkAiChatGptContactPhoneReviewResponseValidatorService = new StarkAiChatGptContactPhoneReviewResponseValidatorService(),
  ) {}

  buildSyntheticValidationConsumption(input: {
    generatedAt?: string | Date;
    latestVerifiedMainCommit?: string | null;
    repo?: string | null;
  } = {}): AiChatGptContactPhoneReviewResponseConsumption {
    const artifacts = this.buildSyntheticFixtures(input).map((fixture) =>
      this.toConsumptionArtifact(fixture),
    );
    const summary = this.toConsumptionSummary(artifacts);

    return {
      contextType: 'ai_chatgpt_contact_phone_review_response_consumption',
      reviewOnly: true,
      safeSummaryOnly: true,
      draftOnly: true,
      syntheticOnly: true,
      artifacts,
      summary,
    };
  }

  buildSyntheticValidationFixtureExpectations(): AiChatGptContactPhoneReviewResponseConsumptionFixtureExpectation[] {
    return [...VALID_FIXTURES, ...BLOCKED_FIXTURES].map((fixture) => ({
      artifactId: fixture.artifactId,
      expectedStatus: fixture.expectedStatus,
      expectedBlockedReasonGroups: this.orderBlockedReasonGroups(
        fixture.expectedBlockedReasonGroups ?? [],
      ),
    }));
  }

  private buildSyntheticFixtures(input: {
    generatedAt?: string | Date;
    latestVerifiedMainCommit?: string | null;
    repo?: string | null;
  }): AiChatGptContactPhoneReviewResponseFixture[] {
    return [...VALID_FIXTURES, ...BLOCKED_FIXTURES].map((fixture) => ({
      ...fixture,
      input: {
        ...fixture.input,
        generatedAt: input.generatedAt ?? fixture.input.generatedAt,
        latestVerifiedMainCommit:
          input.latestVerifiedMainCommit ??
          fixture.input.latestVerifiedMainCommit ??
          DEFAULT_VERIFIED_MAIN_COMMIT,
        repo: input.repo ?? fixture.input.repo ?? DEFAULT_REPO,
      },
    }));
  }

  private toConsumptionArtifact(
    fixture: AiChatGptContactPhoneReviewResponseFixture,
  ): AiChatGptContactPhoneReviewResponseConsumptionArtifact {
    const validation =
      this.reviewResponseValidatorService.validateSyntheticReviewResponseArtifact(
        fixture.input,
      );
    const blockedReasonGroups =
      validation.issueCount > 0
        ? this.mapValidationIssuesToBlockedReasonGroups(
            validation.issues,
            fixture,
          )
        : [];

    return {
      contextType:
        'ai_chatgpt_contact_phone_review_response_consumption_artifact',
      artifactId: fixture.artifactId,
      reviewOnly: true,
      safeSummaryOnly: true,
      draftOnly: true,
      syntheticOnly: true,
      interactionType: validation.interactionType,
      status: validation.status,
      result: validation.result,
      expectedStatus: fixture.expectedStatus,
      statusMatchesExpected: validation.status === fixture.expectedStatus,
      valid: validation.valid,
      issueCount: validation.issueCount,
      blockedReasonGroups,
      sourceReviewRequestValidationStatus:
        validation.sourceReviewRequestValidationStatus,
      sourceReviewRequestInteractionType:
        validation.sourceReviewRequestInteractionType,
      noWriteNoExecutionGuarantee: true,
      executable: false,
      approvalGranted: false,
      dispatchAllowed: false,
      businessObjectCreationAllowed: false,
    };
  }

  private mapValidationIssuesToBlockedReasonGroups(
    issues: readonly AiChatGptContactPhoneReviewResponseValidationIssue[],
    fixture: AiChatGptContactPhoneReviewResponseFixture,
  ): AiChatGptContactPhoneReviewResponseBlockedReasonGroup[] {
    if (issues.length === 0) {
      return [];
    }

    const groups =
      new Set<AiChatGptContactPhoneReviewResponseBlockedReasonGroup>();

    for (const issue of issues) {
      const code = this.normalizeSignal(issue.code);

      if (this.isEnglishCustomerPhoneIssue(code)) {
        groups.add('english_customer_phone_request');
      }
      if (this.isCustomerContactExecutionIssue(code)) {
        groups.add('customer_contact_execution');
      }
      if (this.isGatewayRequestIssue(code)) {
        groups.add('gateway_request');
      }
      if (this.isAllowedOperationIssue(code)) {
        groups.add('allowed_operations_forbidden');
      }
      if (this.isCompactAllowedOperationBypassIssue(issue, fixture)) {
        groups.add('compact_allowed_operation_bypass');
      }
      if (this.isUnsafeSafeBoundaryBypassIssue(issue, fixture)) {
        groups.add('unsafe_safe_boundary_bypass');
      }
      if (code.includes('real_phone_like_digits')) {
        groups.add('real_phone_like_digits');
      }
      if (this.isForbiddenTrueFlagIssue(code)) {
        groups.add('forbidden_true_flags');
      }
      if (this.isChineseSensitiveIssue(issue, fixture)) {
        groups.add('chinese_sensitive_request');
      }
    }

    return this.orderBlockedReasonGroups([...groups]);
  }

  private toConsumptionSummary(
    artifacts: readonly AiChatGptContactPhoneReviewResponseConsumptionArtifact[],
  ): AiChatGptContactPhoneReviewResponseConsumptionSummary {
    const validArtifactCount = artifacts.filter(
      (artifact) => artifact.status === 'valid_review_artifact',
    ).length;
    const blockedArtifactCount = artifacts.filter(
      (artifact) => artifact.status === 'blocked_review_artifact',
    ).length;

    return {
      contextType: 'ai_chatgpt_contact_phone_review_response_consumption',
      reviewOnly: true,
      safeSummaryOnly: true,
      draftOnly: true,
      syntheticOnly: true,
      validFixtureCount: validArtifactCount,
      blockedFixtureCount: blockedArtifactCount,
      validArtifactCount,
      blockedArtifactCount,
      supportedInteractionTypes: [...SUPPORTED_INTERACTION_TYPES],
      resultStatuses: RESULT_STATUSES.filter((status) =>
        artifacts.some((artifact) => artifact.status === status),
      ),
      blockedReasonGroups: this.orderBlockedReasonGroups(
        artifacts.flatMap((artifact) => artifact.blockedReasonGroups),
      ),
      sourceReviewResponseValidatorPr122: 'merged_source',
      sourceReviewRequestHandoffPr121: 'merged_source',
      sourceInteractionPacketPr116: 'merged_source',
      noWriteNoExecutionGuarantee: true,
      databaseReads: 0,
      databaseWrites: 0,
      businessActions: 0,
      customerContactExecutionCount: 0,
      dispatchCount: 0,
      taskCreationCount: 0,
      liveGatewayCount: 0,
      mcpGatewayCount: 0,
      voiceIntegrationCount: 0,
    };
  }

  private orderBlockedReasonGroups(
    groups: readonly AiChatGptContactPhoneReviewResponseBlockedReasonGroup[],
  ): AiChatGptContactPhoneReviewResponseBlockedReasonGroup[] {
    const present = new Set(groups);
    return BLOCKED_REASON_GROUP_ORDER.filter((group) => present.has(group));
  }

  private isEnglishCustomerPhoneIssue(code: string): boolean {
    return [
      'full_phone_request',
      'customer_phone',
      'phone_normalized',
      'raw_phone_hash',
      'phone_hash_request',
      'forbidden_raw_field',
    ].some((token) => code.includes(token));
  }

  private isCustomerContactExecutionIssue(code: string): boolean {
    return [
      'customer_contact_execution',
      'call_or_dial_request',
      'contact_customer',
      'formal_task_creation_request',
      'copy_or_export_request',
      'allowed_operation_blocked:call',
      'allowed_operation_blocked:dial',
      'allowed_operation_forbidden:call',
      'allowed_operation_forbidden:dial',
      'allowed_operation_forbidden:task_creation',
      'allowed_operation_forbidden:dispatch',
    ].some((token) => code.includes(token));
  }

  private isGatewayRequestIssue(code: string): boolean {
    return [
      'mcp_gateway_request',
      'voice_integration_request',
      'real_chatgpt_api_request',
      'live_gateway',
      'real_chatgpt_api',
      'mcp_gateway',
      'voice_integration',
      'gateway',
    ].some((token) => code.includes(token));
  }

  private isAllowedOperationIssue(code: string): boolean {
    return (
      code.includes('allowed_operation_forbidden') ||
      code.includes('allowed_operation_blocked')
    );
  }

  private isCompactAllowedOperationBypassIssue(
    issue: AiChatGptContactPhoneReviewResponseValidationIssue,
    fixture: AiChatGptContactPhoneReviewResponseFixture,
  ): boolean {
    const code = this.normalizeSignal(issue.code);
    if (!this.isAllowedOperationIssue(code)) {
      return false;
    }

    const operation = this.allowedOperationForIssuePath(issue.path, fixture);
    const normalizedOperation = this.normalizeToken(operation);
    const compactOperation = this.compactToken(operation);
    if (!normalizedOperation || normalizedOperation !== compactOperation) {
      return false;
    }

    return [
      'callcustomer',
      'copyphone',
      'revealphone',
      'exportcontact',
      'dialcustomer',
      'customercontactexecution',
      'databaseread',
      'livegateway',
      'realchatgptapi',
      'mcpgateway',
      'voiceintegration',
      'taskcreation',
    ].some((token) => compactOperation.includes(token));
  }

  private isUnsafeSafeBoundaryBypassIssue(
    issue: AiChatGptContactPhoneReviewResponseValidationIssue,
    fixture: AiChatGptContactPhoneReviewResponseFixture,
  ): boolean {
    const code = this.normalizeSignal(issue.code);
    if (
      !(
        code.includes('unsafe_safe_boundary') ||
        code.includes('reveal_phone_request') ||
        this.isEnglishCustomerPhoneIssue(code) ||
        this.isCustomerContactExecutionIssue(code)
      )
    ) {
      return false;
    }

    const fixtureSignal = this.fixtureTextSignal(fixture);
    return (
      fixture.artifactId.includes('safe_reference') ||
      /\b(redacted|denied|false|fullphoneincluded=false)\b.*\bbut\b/.test(
        fixtureSignal,
      ) ||
      /\bbut\b.*\b(reveal|provide|call|contact|customer phone)\b/.test(
        fixtureSignal,
      )
    );
  }

  private isForbiddenTrueFlagIssue(code: string): boolean {
    return [
      'forbidden_true_flag',
      'executable',
      'approval',
      'dispatch',
      'database_read_allowed',
      'business_action_allowed',
      'full_phone_included',
      'phone_hash_included',
      'phone_normalized_included',
      'customer_contact_execution_allowed',
      'live_gateway_allowed',
      'mcp_gateway_allowed',
      'voice_integration_allowed',
    ].some((token) => code.includes(token));
  }

  private isChineseSensitiveIssue(
    issue: AiChatGptContactPhoneReviewResponseValidationIssue,
    fixture: AiChatGptContactPhoneReviewResponseFixture,
  ): boolean {
    const code = this.normalizeSignal(issue.code);
    if (code.includes('chinese')) {
      return true;
    }

    const fixtureSignal = this.fixtureTextSignal(fixture);
    if (
      fixture.artifactId.includes('chinese_sensitive') ||
      fixtureSignal.includes('chinese-sensitive')
    ) {
      return true;
    }

    return (
      fixtureSignal.includes('chinese execution') &&
      /\bcustomer phone\b|\bphone for chinese\b|\bexport customer phone\b/.test(
        fixtureSignal,
      )
    );
  }

  private allowedOperationForIssuePath(
    path: string | undefined,
    fixture: AiChatGptContactPhoneReviewResponseFixture,
  ): unknown {
    const match = String(path ?? '').match(/allowedOperations\[(\d+)]/);
    if (!match || !Array.isArray(fixture.input.allowedOperations)) {
      return '';
    }

    return fixture.input.allowedOperations[Number(match[1])] ?? '';
  }

  private fixtureTextSignal(
    fixture: AiChatGptContactPhoneReviewResponseFixture,
  ): string {
    return this.normalizeSignal(
      `${fixture.artifactId} ${this.collectText(fixture.input.payload).join(' ')}`,
    );
  }

  private collectText(value: unknown): string[] {
    if (value === undefined || value === null) {
      return [];
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return [String(value)];
    }
    if (Array.isArray(value)) {
      return value.flatMap((entry) => this.collectText(entry));
    }
    if (typeof value === 'object') {
      return Object.values(value).flatMap((entry) => this.collectText(entry));
    }
    return [];
  }

  private normalizeSignal(value: unknown): string {
    return String(value ?? '').toLowerCase();
  }

  private normalizeToken(value: unknown): string {
    return String(value ?? '')
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private compactToken(value: unknown): string {
    return String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }
}

function blockedFixture(
  artifactId: string,
  interactionType: StarkAiChatGptContactPhoneReviewResponseType,
  payload: unknown,
  expectedBlockedReasonGroups: readonly AiChatGptContactPhoneReviewResponseBlockedReasonGroup[],
  allowedOperations?: readonly unknown[],
): AiChatGptContactPhoneReviewResponseFixture {
  return {
    artifactId,
    expectedStatus: 'blocked_review_artifact',
    expectedBlockedReasonGroups,
    input: {
      generatedAt: '2026-05-24T11:10:00.000Z',
      latestVerifiedMainCommit: DEFAULT_VERIFIED_MAIN_COMMIT,
      interactionType,
      allowedOperations,
      payload,
    },
  };
}
