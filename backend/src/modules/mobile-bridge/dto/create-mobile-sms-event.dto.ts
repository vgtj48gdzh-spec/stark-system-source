import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export type MobileSmsIngestSource = 'live_broadcast' | 'inbox_sync';

export type MobileSmsIngestSourceNormalization = {
  ingestSource?: MobileSmsIngestSource | string;
  originalIngestSource?: string;
  normalizedIngestSource?: MobileSmsIngestSource;
  normalizeReason?: string;
  retryActionSource?: boolean;
};

const VALID_MOBILE_SMS_INGEST_SOURCES = new Set<MobileSmsIngestSource>([
  'live_broadcast',
  'inbox_sync',
]);

const LIVE_BROADCAST_SOURCE_ALIASES = new Set(['default_sms_deliver']);

const INBOX_SYNC_SOURCE_ALIASES = new Set([
  'inbox_fallback_scan',
  'provider_probe',
  'pending_queue_retry',
  'force_retry',
  'manual_retry',
  'queue_flush',
  'server_command_force_pending_queue_retry',
  'auto_reachable_pending_backlog',
]);

const RETRY_ACTION_SOURCE_ALIASES = new Set([
  'pending_queue_retry',
  'force_retry',
  'manual_retry',
  'queue_flush',
  'server_command_force_pending_queue_retry',
  'auto_reachable_pending_backlog',
]);

export function isAllowedMobileSmsIngestSource(value: unknown): value is MobileSmsIngestSource {
  return VALID_MOBILE_SMS_INGEST_SOURCES.has(value as MobileSmsIngestSource);
}

export function normalizeMobileSmsIngestSource(
  value: unknown,
  rawPayloadJson?: Record<string, unknown>,
): MobileSmsIngestSourceNormalization {
  const originalValue = typeof value === 'string' ? value.trim() : '';
  const rawActionSource =
    readRawPayloadString(rawPayloadJson, 'attemptSource') ??
    readRawPayloadString(rawPayloadJson, 'retryReason') ??
    readRawPayloadString(rawPayloadJson, 'source');
  const sourceForDecision = originalValue || rawActionSource || '';

  if (isAllowedMobileSmsIngestSource(originalValue)) {
    return {
      ingestSource: originalValue,
    };
  }

  if (!sourceForDecision) {
    return {
      ingestSource: undefined,
    };
  }

  if (LIVE_BROADCAST_SOURCE_ALIASES.has(sourceForDecision)) {
    return {
      ingestSource: 'live_broadcast',
      originalIngestSource: originalValue || sourceForDecision,
      normalizedIngestSource: 'live_broadcast',
      normalizeReason: 'legacy_live_broadcast_alias',
      retryActionSource: false,
    };
  }

  const retryActionSource = RETRY_ACTION_SOURCE_ALIASES.has(sourceForDecision);
  if (INBOX_SYNC_SOURCE_ALIASES.has(sourceForDecision) || retryActionSource) {
    return {
      ingestSource: 'inbox_sync',
      originalIngestSource: originalValue || sourceForDecision || 'missing',
      normalizedIngestSource: 'inbox_sync',
      normalizeReason: retryActionSource
        ? 'retry_action_source_normalized_to_inbox_sync'
        : 'legacy_inbox_source_alias',
      retryActionSource,
    };
  }

  return {
    ingestSource: originalValue,
  };
}

export function appendMobileSmsIngestSourceNormalizationMetadata(
  rawPayloadJson: Record<string, unknown> | undefined,
  normalization: MobileSmsIngestSourceNormalization,
) {
  if (!normalization.normalizeReason || !normalization.normalizedIngestSource) {
    return rawPayloadJson;
  }

  const originalIngestSource = normalization.originalIngestSource || 'missing';
  const nextRawPayloadJson: Record<string, unknown> = {
    ...(rawPayloadJson ?? {}),
    originalIngestSource,
    normalizedIngestSource: normalization.normalizedIngestSource,
    normalizeReason: normalization.normalizeReason,
  };
  if (normalization.retryActionSource) {
    nextRawPayloadJson.attemptSource =
      nextRawPayloadJson.attemptSource ?? originalIngestSource;
    nextRawPayloadJson.retryReason =
      nextRawPayloadJson.retryReason ?? originalIngestSource;
  }

  return nextRawPayloadJson;
}

function readRawPayloadString(
  rawPayloadJson: Record<string, unknown> | undefined,
  key: string,
) {
  const value = rawPayloadJson?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export class CreateMobileSmsEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  deviceId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  senderAddress!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  messageBody!: string;

  @IsDateString()
  receivedAtDevice!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  simSlot?: number;

  @Transform(({ value, obj }) => {
    const dtoObject = obj as { rawPayloadJson?: Record<string, unknown> };
    const normalization = normalizeMobileSmsIngestSource(value, dtoObject.rawPayloadJson);
    dtoObject.rawPayloadJson = appendMobileSmsIngestSourceNormalizationMetadata(
      dtoObject.rawPayloadJson,
      normalization,
    );
    return normalization.ingestSource;
  })
  @IsDefined()
  @IsIn(['live_broadcast', 'inbox_sync'])
  ingestSource!: MobileSmsIngestSource;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  smsFormat?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(32)
  pduCount!: number;

  @IsOptional()
  @IsObject()
  rawPayloadJson?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  deliveryStatus?: string;
}
