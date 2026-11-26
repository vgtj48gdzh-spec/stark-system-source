import { Transform } from 'class-transformer';
import { IsIn, IsNumberString, IsOptional, IsString, Length } from 'class-validator';

function normalizeString(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const normalized = String(value).trim();
  return normalized || undefined;
}

export class PatchPointsWelfareBatchItemDto {
  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @IsIn(['default', 'custom', 'hold', 'excluded'])
  allocationMode?: 'default' | 'custom' | 'hold' | 'excluded';

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsNumberString()
  finalAmount?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @Length(1, 64)
  exclusionReason?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @Length(1, 100)
  adjustmentReasonCode?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @Length(1, 500)
  adjustmentRemark?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @IsIn(['manual', 'ai_suggested', 'rule'])
  basisType?: 'manual' | 'ai_suggested' | 'rule';

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @IsIn(['case_only', 'same_pattern', 'global_rule'])
  decisionScope?: 'case_only' | 'same_pattern' | 'global_rule';

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @IsIn([
    'do_not_generalize',
    'suggest_same_pattern_only',
    'can_generalize_with_review',
    'treat_as_global_reference',
  ])
  aiLearningMode?:
    | 'do_not_generalize'
    | 'suggest_same_pattern_only'
    | 'can_generalize_with_review'
    | 'treat_as_global_reference';
}
