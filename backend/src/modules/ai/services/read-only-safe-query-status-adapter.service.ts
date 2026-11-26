import {
  READ_ONLY_SAFE_QUERY_FORBIDDEN_ACTIONS,
  READ_ONLY_SAFE_QUERY_FORBIDDEN_OUTPUT_MARKERS,
  READ_ONLY_SAFE_QUERY_REDACTION_LEVELS,
  READ_ONLY_SAFE_QUERY_ROLES,
  makeBlockedRedactionReport,
  makeZeroCounters,
  type ReadOnlySafeQueryAggregateRow,
  type ReadOnlySafeQueryJsonValue,
  type ReadOnlySafeQueryRedactionLevel,
  type ReadOnlySafeQueryRequest,
  type ReadOnlySafeQueryResult,
  type ReadOnlySafeQueryRiskLevel,
  type ReadOnlySafeQueryRole,
} from '../contracts/read-only-safe-query-gateway.contract';

export const READ_ONLY_SAFE_QUERY_STATUS_ADAPTER_QUERY_TYPE =
  'ai_sync_packet_current_status_summary' as const;

export interface ReadOnlySafeQueryStatusAdapterInput {
  readonly request: ReadOnlySafeQueryRequest;
  readonly currentStage?: ReadOnlySafeQueryJsonValue;
  readonly currentMode?: ReadOnlySafeQueryJsonValue;
  readonly latestMergedPr?: ReadOnlySafeQueryJsonValue;
  readonly currentOpenPr?: ReadOnlySafeQueryJsonValue;
  readonly implementationBranch?: ReadOnlySafeQueryJsonValue;
  readonly sourceRefs?: readonly string[] | null;
  readonly blockers?: readonly string[] | null;
  readonly nextSingleGoal?: ReadOnlySafeQueryJsonValue;
  readonly generatedAt?: string | Date | null;
}

interface RequestValidation {
  readonly role: ReadOnlySafeQueryRole;
  readonly redactionLevel: ReadOnlySafeQueryRedactionLevel;
  readonly ownerApprovalRequired: boolean;
  readonly blockedReasons: string[];
}

export class ReadOnlySafeQueryStatusAdapterService {
  buildAiSyncPacketCurrentStatusSummary(
    input: ReadOnlySafeQueryStatusAdapterInput,
  ): ReadOnlySafeQueryResult {
    const request = this.toRecord(input?.request);
    const requestValidation = this.validateRequest(request);
    const unsafeInputBlocked = this.hasForbiddenInputMarker(input);
    const blockedReasons = this.uniqueStrings([
      ...requestValidation.blockedReasons,
      ...(unsafeInputBlocked ? ['unsafe_status_adapter_input_blocked'] : []),
    ]);
    const allowed = blockedReasons.length === 0;
    const generatedAt = this.resolveGeneratedAt(input?.generatedAt);
    const sourceRefs = this.resolveSourceRefs(input, request, allowed);
    const blockerLabels = this.resolveBlockerLabels(input?.blockers, blockedReasons);

    return {
      contextType: 'stark_system_safe_query_result',
      queryType: READ_ONLY_SAFE_QUERY_STATUS_ADAPTER_QUERY_TYPE,
      generatedAt,
      reviewOnly: true,
      safeSummaryOnly: true,
      readOnly: true,
      noExecution: true,
      redactionReport: makeBlockedRedactionReport(),
      permissionResult: {
        allowed,
        role: requestValidation.role,
        redactionLevel: requestValidation.redactionLevel,
        ownerApprovalRequired: requestValidation.ownerApprovalRequired,
        ownerApprovalSatisfied: false,
        ...(allowed ? {} : { deniedReason: blockedReasons.join('|') }),
      },
      safeRows: [],
      aggregateRows: [
        this.buildStatusAggregateRow(input, sourceRefs, blockerLabels, allowed),
      ],
      evidenceRefs: sourceRefs,
      blockerLabels,
      riskLevel: this.resolveRiskLevel(allowed, blockerLabels),
      nextSuggestedQuestions: this.buildNextSuggestedQuestions(allowed),
      forbiddenActions: [...READ_ONLY_SAFE_QUERY_FORBIDDEN_ACTIONS],
      zeroCounters: makeZeroCounters(),
    };
  }

  private validateRequest(request: Record<string, unknown>): RequestValidation {
    const blockedReasons: string[] = [];
    if (
      request.queryType !== READ_ONLY_SAFE_QUERY_STATUS_ADAPTER_QUERY_TYPE
    ) {
      blockedReasons.push('status_query_type_not_allowlisted');
    }
    if (request.noMutation !== true) {
      blockedReasons.push('request_no_mutation_required');
    }

    const role = this.isRole(request.role)
      ? request.role
      : 'codex_implementation_assistant';
    if (!this.isRole(request.role)) {
      blockedReasons.push('request_role_not_allowlisted');
    }

    const redactionLevel = this.isRedactionLevel(request.redactionLevel)
      ? request.redactionLevel
      : 'blocked';
    if (!this.isRedactionLevel(request.redactionLevel)) {
      blockedReasons.push('request_redaction_level_not_allowlisted');
    }

    return {
      role,
      redactionLevel,
      ownerApprovalRequired: request.ownerApprovalRequired === true,
      blockedReasons,
    };
  }

  private buildStatusAggregateRow(
    input: ReadOnlySafeQueryStatusAdapterInput,
    sourceRefs: readonly string[],
    blockerLabels: readonly string[],
    allowed: boolean,
  ): ReadOnlySafeQueryAggregateRow {
    if (!allowed) {
      return {
        summaryType: READ_ONLY_SAFE_QUERY_STATUS_ADAPTER_QUERY_TYPE,
        currentStage: 'blocked_until_safe_request',
        currentMode: 'SAFE',
        latestMergedPr: 'redacted_until_safe_request',
        currentOpenPr: 'redacted_until_safe_request',
        implementationBranch: 'redacted_until_safe_request',
        blockerCount: blockerLabels.length,
        nextSingleGoal: 'complete_read_only_safe_query_status_adapter_skeleton',
        sourceRefs,
      };
    }

    return {
      summaryType: READ_ONLY_SAFE_QUERY_STATUS_ADAPTER_QUERY_TYPE,
      currentStage: this.toSafeJsonValue(input.currentStage, 'unknown'),
      currentMode: this.toSafeJsonValue(input.currentMode, 'SAFE'),
      latestMergedPr: this.toSafeJsonValue(input.latestMergedPr, 'not_provided'),
      currentOpenPr: this.toSafeJsonValue(input.currentOpenPr, 'none'),
      implementationBranch: this.toSafeJsonValue(
        input.implementationBranch,
        'not_provided',
      ),
      blockerCount: blockerLabels.length,
      nextSingleGoal: this.toSafeJsonValue(input.nextSingleGoal, 'not_provided'),
      sourceRefs,
    };
  }

  private resolveSourceRefs(
    input: ReadOnlySafeQueryStatusAdapterInput,
    request: Record<string, unknown>,
    allowed: boolean,
  ): string[] {
    const requestRefs = Array.isArray(request.sourceRefs)
      ? request.sourceRefs.filter((item): item is string => typeof item === 'string')
      : [];
    const inputRefs = input?.sourceRefs ?? [];
    const refs = [...requestRefs, ...inputRefs];
    if (!allowed) {
      return refs.length > 0
        ? ['redacted_source_refs_available_after_safe_request']
        : [];
    }
    return this.uniqueStrings(
      refs
        .map((ref) => this.toSafeText(ref))
        .filter((ref) => ref.length > 0),
    );
  }

  private resolveBlockerLabels(
    blockers: readonly string[] | null | undefined,
    blockedReasons: readonly string[],
  ): string[] {
    const safeInputBlockers = (blockers ?? [])
      .map((blocker) => this.toSafeLabel(blocker))
      .filter((blocker) => blocker.length > 0);
    return this.uniqueStrings([...safeInputBlockers, ...blockedReasons]);
  }

  private buildNextSuggestedQuestions(allowed: boolean): string[] {
    if (!allowed) {
      return ['Which safe request field should be corrected for review?'];
    }
    return [
      'Which bounded SAFE follow-up should be reviewed next?',
      'Should GitHub and status refs be refreshed before the next slice?',
    ];
  }

  private resolveRiskLevel(
    allowed: boolean,
    blockerLabels: readonly string[],
  ): ReadOnlySafeQueryRiskLevel {
    if (!allowed || blockerLabels.length > 0) {
      return 'review';
    }
    return 'info';
  }

  private toSafeJsonValue(
    value: ReadOnlySafeQueryJsonValue | undefined,
    fallback: string,
  ): ReadOnlySafeQueryJsonValue {
    if (value === undefined || value === null) {
      return fallback;
    }
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return typeof value === 'string' ? this.toSafeText(value) : value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.toSafeJsonValue(item, fallback));
    }
    if (typeof value === 'object') {
      const safeRecord: Record<string, ReadOnlySafeQueryJsonValue> = {};
      for (const [key, entry] of Object.entries(value)) {
        const safeKey = this.toSafeLabel(key) || 'safe_field';
        safeRecord[safeKey] = this.toSafeJsonValue(entry, fallback);
      }
      return safeRecord;
    }
    return fallback;
  }

  private toSafeText(value: unknown): string {
    const text = String(value ?? '').trim();
    if (!text) {
      return '';
    }
    return text
      .replace(/\b1[3-9]\d{9}\b/g, 'redacted_numeric_identifier')
      .replace(/\b\d{12,19}\b/g, 'redacted_numeric_identifier')
      .slice(0, 240);
  }

  private toSafeLabel(value: unknown): string {
    return this.toSafeText(value)
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);
  }

  private hasForbiddenInputMarker(value: unknown): boolean {
    return this.findForbiddenInputMarker(value) !== null;
  }

  private findForbiddenInputMarker(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return this.findForbiddenTextMarker(String(value));
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const hit = this.findForbiddenInputMarker(item);
        if (hit) {
          return hit;
        }
      }
      return null;
    }
    if (value instanceof Date) {
      return null;
    }
    if (typeof value === 'object') {
      for (const [key, entry] of Object.entries(value)) {
        const keyHit = this.findForbiddenTextMarker(key);
        if (keyHit) {
          return keyHit;
        }
        const entryHit = this.findForbiddenInputMarker(entry);
        if (entryHit) {
          return entryHit;
        }
      }
    }
    return null;
  }

  private findForbiddenTextMarker(text: string): string | null {
    const compactText = this.compactMarker(text);
    return (
      READ_ONLY_SAFE_QUERY_FORBIDDEN_OUTPUT_MARKERS.find((marker) =>
        compactText.includes(this.compactMarker(marker)),
      ) ?? null
    );
  }

  private compactMarker(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  private resolveGeneratedAt(value: string | Date | null | undefined): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? value.trim() : parsed.toISOString();
    }
    return new Date().toISOString();
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private isRole(value: unknown): value is ReadOnlySafeQueryRole {
    return (
      typeof value === 'string' &&
      READ_ONLY_SAFE_QUERY_ROLES.includes(value as ReadOnlySafeQueryRole)
    );
  }

  private isRedactionLevel(
    value: unknown,
  ): value is ReadOnlySafeQueryRedactionLevel {
    return (
      typeof value === 'string' &&
      READ_ONLY_SAFE_QUERY_REDACTION_LEVELS.includes(
        value as ReadOnlySafeQueryRedactionLevel,
      )
    );
  }

  private uniqueStrings(values: readonly string[]): string[] {
    return [...new Set(values)];
  }
}
