import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AiMemoryEntry } from '../entities/ai-memory-entry.entity';

export type AiOwnerMemoryProjectionAudience =
  | 'owner_assistant'
  | 'internal_assistant'
  | 'external_assistant';

export interface AiOwnerMemoryProjectionInput {
  audience?: AiOwnerMemoryProjectionAudience;
  businessDomain?: string;
  assistantRole?: string;
  scene?: string;
  routePath?: string;
  entityType?: string;
  limit?: number;
  requesterRoleCodes?: readonly string[];
  generatedAt?: Date;
}

export type AiOwnerMemoryProjectionSource = Pick<
  AiMemoryEntry,
  | 'id'
  | 'memoryType'
  | 'scopeType'
  | 'scopeKey'
  | 'roleScope'
  | 'sceneScope'
  | 'title'
  | 'summary'
  | 'content'
  | 'tags'
  | 'priorityLevel'
  | 'enabledFlag'
  | 'generalizationMode'
  | 'aiUsageMode'
  | 'updatedAt'
>;

export type AiOwnerMemoryProjectionRedactionCategory =
  | 'account_number'
  | 'credential'
  | 'email'
  | 'phone'
  | 'secret_block'
  | 'sms_body'
  | 'verification_code';

interface SanitizedText {
  value: string;
  categories: AiOwnerMemoryProjectionRedactionCategory[];
}

export interface AiOwnerMemoryProjectionExclusionCounts {
  disabled: number;
  limit: number;
  projectionBlocked: number;
  routingMismatch: number;
  unsupportedMemoryType: number;
  unsupportedScopeType: number;
  visibilityDenied: number;
}

const SUPPORTED_MEMORY_TYPES = new Set([
  'founder_principle',
  'founder_preference',
  'role_playbook',
  'reasoning_pattern',
  'rule_exception',
  'do_not_generalize_case',
  'language_style',
  'term_definition',
]);

const SUPPORTED_SCOPE_TYPES = new Set([
  'founder',
  'role',
  'global',
  'scene',
  'route',
  'entity_type',
]);

const VISIBILITY_TAGS = new Set([
  'owner_only',
  'internal_safe',
  'external_safe',
  'projection_blocked',
]);

@Injectable()
export class AiOwnerMemoryProjectionService {
  project(
    sourceEntries: readonly AiOwnerMemoryProjectionSource[],
    input: AiOwnerMemoryProjectionInput = {},
  ) {
    const audience = input.audience ?? 'owner_assistant';
    const requesterRoleCodes = this.normalizeCodes(input.requesterRoleCodes);
    if (
      audience === 'owner_assistant' &&
      !requesterRoleCodes.some((role) =>
        ['owner', 'founder', 'super_admin'].includes(role),
      )
    ) {
      throw new ForbiddenException('老板记忆投影仅允许老板、创始人或超级管理员访问');
    }
    const businessDomain = this.normalizeCode(input.businessDomain) ?? 'shared';
    const assistantRole =
      this.normalizeCode(input.assistantRole) ??
      (audience === 'owner_assistant' ? 'owner' : 'assistant');
    const scene = this.normalizeCode(input.scene) ?? 'global';
    const routePath = this.normalizeRoutePath(input.routePath);
    const entityType = this.normalizeCode(input.entityType);
    const limit = Math.min(50, Math.max(1, Number(input.limit ?? 20)));
    const exclusionCounts: AiOwnerMemoryProjectionExclusionCounts = {
      disabled: 0,
      limit: 0,
      projectionBlocked: 0,
      routingMismatch: 0,
      unsupportedMemoryType: 0,
      unsupportedScopeType: 0,
      visibilityDenied: 0,
    };

    const eligible = sourceEntries
      .filter((entry) => {
        if (!entry.enabledFlag) {
          exclusionCounts.disabled += 1;
          return false;
        }
        if (!SUPPORTED_MEMORY_TYPES.has(entry.memoryType)) {
          exclusionCounts.unsupportedMemoryType += 1;
          return false;
        }
        if (!SUPPORTED_SCOPE_TYPES.has(entry.scopeType)) {
          exclusionCounts.unsupportedScopeType += 1;
          return false;
        }

        const tags = this.normalizeTags(entry.tags);
        if (tags.includes('projection_blocked')) {
          exclusionCounts.projectionBlocked += 1;
          return false;
        }
        if (!this.isVisibleForAudience(entry, tags, audience)) {
          exclusionCounts.visibilityDenied += 1;
          return false;
        }
        if (
          !this.matchesRouting(entry, tags, {
            assistantRole,
            businessDomain,
            entityType,
            routePath,
            scene,
          })
        ) {
          exclusionCounts.routingMismatch += 1;
          return false;
        }
        return true;
      })
      .slice()
      .sort(
        (left, right) =>
          Number(right.priorityLevel ?? 0) - Number(left.priorityLevel ?? 0) ||
          this.toTime(right.updatedAt) - this.toTime(left.updatedAt) ||
          right.id - left.id,
      );

    exclusionCounts.limit = Math.max(0, eligible.length - limit);
    const redactionCategories = new Set<AiOwnerMemoryProjectionRedactionCategory>();
    let redactedEntryCount = 0;
    const entries = eligible.slice(0, limit).map((entry) => {
      const title = this.sanitizeText(entry.title);
      const summary = this.sanitizeText(entry.summary);
      const content = this.sanitizeText(entry.content);
      const scopeKey = this.sanitizeText(entry.scopeKey);
      const safeTags = this.normalizeTags(entry.tags)
        .filter((tag) => !VISIBILITY_TAGS.has(tag))
        .map((tag) => this.sanitizeText(tag));
      const entryCategories = new Set<AiOwnerMemoryProjectionRedactionCategory>([
        ...title.categories,
        ...summary.categories,
        ...content.categories,
        ...scopeKey.categories,
        ...safeTags.flatMap((tag) => tag.categories),
      ]);
      for (const category of entryCategories) {
        redactionCategories.add(category);
      }
      if (entryCategories.size > 0) {
        redactedEntryCount += 1;
      }

      return {
        memoryRef: `ai_memory:${entry.id}`,
        memoryType: entry.memoryType,
        scope: {
          type: entry.scopeType,
          key: scopeKey.value || null,
        },
        title: title.value,
        summary: summary.value,
        content: content.value,
        tags: safeTags.map((tag) => tag.value).filter(Boolean),
        priorityLevel: Number(entry.priorityLevel ?? 0),
        generalizationMode: entry.generalizationMode ?? 'case_only',
        aiUsageMode: entry.aiUsageMode ?? 'cite_when_relevant',
        updatedAt: this.toIsoString(entry.updatedAt),
        redactionApplied: entryCategories.size > 0,
        redactionCategories: Array.from(entryCategories).sort(),
      };
    });

    return {
      contractVersion: 'owner-memory-projection/v1',
      source: {
        table: 'ai_memory_entries',
        mode: 'read_only',
        sourceRecordCount: sourceEntries.length,
      },
      audience,
      routing: {
        businessDomain,
        assistantRole,
        scene,
        routePath: routePath ?? null,
        entityType: entityType ?? null,
      },
      entries,
      summary: {
        projectedCount: entries.length,
        eligibleCount: eligible.length,
        redactedEntryCount,
        redactionDetectionCount: redactionCategories.size,
        redactionCategories: Array.from(redactionCategories).sort(),
        exclusionCounts,
      },
      controls: {
        customerEngagementMemoryIncluded: false,
        rawNormalizedPayloadIncluded: false,
        databaseWriteAllowed: false,
        businessActionAllowed: false,
        customerContactExecutionAllowed: false,
        mediumRiskRequiresHumanConfirmation: true,
        highRiskRequiresFormalApproval: true,
        externalSafeTagRequired: audience === 'external_assistant',
        internalSafeTagRequired: audience === 'internal_assistant',
      },
      audit: {
        generatedAt: (input.generatedAt ?? new Date()).toISOString(),
        policy: 'fail_closed_safelisted_projection',
        requesterRoleCodes,
        persistentAuditWritten: false,
        persistentAuditRequirement: 'gateway_or_operation_log_before_external_delivery',
      },
    };
  }

  private isVisibleForAudience(
    entry: AiOwnerMemoryProjectionSource,
    tags: readonly string[],
    audience: AiOwnerMemoryProjectionAudience,
  ) {
    if (audience === 'owner_assistant') {
      return true;
    }
    if (tags.includes('owner_only')) {
      return false;
    }
    if (entry.memoryType === 'do_not_generalize_case') {
      return false;
    }
    if (audience === 'external_assistant') {
      return tags.includes('external_safe');
    }
    return tags.includes('internal_safe') || tags.includes('external_safe');
  }

  private matchesRouting(
    entry: AiOwnerMemoryProjectionSource,
    tags: readonly string[],
    routing: {
      assistantRole: string;
      businessDomain: string;
      entityType?: string;
      routePath?: string;
      scene: string;
    },
  ) {
    const roleScope = this.normalizeCodes(entry.roleScope);
    if (
      roleScope.length > 0 &&
      !roleScope.includes('all') &&
      !roleScope.includes(routing.assistantRole)
    ) {
      return false;
    }

    const sceneScope = this.normalizeCodes(entry.sceneScope);
    if (
      sceneScope.length > 0 &&
      !sceneScope.includes('global') &&
      !sceneScope.includes(routing.scene)
    ) {
      return false;
    }

    const scopeKey = this.normalizeCode(entry.scopeKey);
    if (entry.scopeType === 'role' && scopeKey !== routing.assistantRole) {
      return false;
    }
    if (entry.scopeType === 'scene' && scopeKey !== 'global' && scopeKey !== routing.scene) {
      return false;
    }
    if (
      entry.scopeType === 'route' &&
      (!routing.routePath || !this.matchesRouteScope(routing.routePath, entry.scopeKey))
    ) {
      return false;
    }
    if (entry.scopeType === 'entity_type' && scopeKey !== routing.entityType) {
      return false;
    }

    const businessTags = tags.filter((tag) => tag.startsWith('business:'));
    return (
      businessTags.length === 0 ||
      businessTags.includes('business:all') ||
      businessTags.includes('business:shared') ||
      businessTags.includes(`business:${routing.businessDomain}`)
    );
  }

  private sanitizeText(input: unknown): SanitizedText {
    let value = this.normalizeText(input) ?? '';
    const categories = new Set<AiOwnerMemoryProjectionRedactionCategory>();
    const redact = (
      pattern: RegExp,
      replacement: string | ((substring: string, ...args: string[]) => string),
      category: AiOwnerMemoryProjectionRedactionCategory,
    ) => {
      if (value.search(pattern) >= 0) {
        categories.add(category);
        value = value.replace(pattern, replacement as string);
      }
    };

    redact(
      /-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/gi,
      '[REDACTED_SECRET_BLOCK]',
      'secret_block',
    );
    redact(
      /\b(password|passwd|pwd|token|api[_ -]?key|secret)\s*[:=]\s*([^\s,;，；。]+)/gi,
      '$1=[REDACTED]',
      'credential',
    );
    redact(
      /\b(rawSmsBody|smsBody)\s*[:=]\s*([^\r\n]+)/gi,
      '$1=[REDACTED]',
      'sms_body',
    );
    redact(
      /(短信正文)\s*[:：=]\s*([^\r\n]+)/g,
      '$1=[REDACTED]',
      'sms_body',
    );
    redact(
      /(验证码|verification\s*code|otp)\s*[:：=]?\s*\d{4,8}/gi,
      '$1=[REDACTED]',
      'verification_code',
    );
    redact(
      /(?<![\d@])1[3-9]\d{9}(?!\d)/g,
      (phone) => `${phone.slice(0, 3)}****${phone.slice(-4)}`,
      'phone',
    );
    redact(
      /(?<!\d)\d(?:[ -]?\d){15,18}(?!\d)/g,
      '[REDACTED_ACCOUNT]',
      'account_number',
    );
    redact(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      '[REDACTED_EMAIL]',
      'email',
    );

    return {
      value,
      categories: Array.from(categories).sort(),
    };
  }

  private normalizeTags(input: unknown) {
    return this.normalizeCodes(input).slice(0, 64);
  }

  private normalizeCodes(input: unknown): string[] {
    if (!Array.isArray(input)) {
      return [];
    }
    return Array.from(
      new Set(
        input
          .map((item) => this.normalizeCode(item))
          .filter((item): item is string => Boolean(item)),
      ),
    );
  }

  private normalizeCode(input: unknown) {
    const value = this.normalizeText(input)?.toLowerCase();
    return value && /^[a-z][a-z0-9:_-]{0,95}$/.test(value) ? value : undefined;
  }

  private normalizeRoutePath(input: unknown) {
    const value = this.normalizeText(input);
    return value && /^\/[A-Za-z0-9/_-]*$/.test(value) ? value : undefined;
  }

  private matchesRouteScope(routePath: string, scopePath: unknown) {
    const normalizedScope = this.normalizeRoutePath(scopePath);
    if (!normalizedScope) {
      return false;
    }
    if (routePath === normalizedScope) {
      return true;
    }
    const scopePrefix = normalizedScope.endsWith('/')
      ? normalizedScope
      : `${normalizedScope}/`;
    return routePath.startsWith(scopePrefix);
  }

  private normalizeText(input: unknown) {
    if (typeof input !== 'string') {
      return undefined;
    }
    const value = input.trim();
    return value || undefined;
  }

  private toTime(input: unknown) {
    const date = input instanceof Date ? input : new Date(String(input));
    const time = date.getTime();
    return Number.isFinite(time) ? time : 0;
  }

  private toIsoString(input: unknown) {
    const time = this.toTime(input);
    return time > 0 ? new Date(time).toISOString() : null;
  }
}
