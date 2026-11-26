import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class DecidePerformanceSummaryManualDecisionDto {
  @IsString()
  @IsIn([
    'confirm_binding',
    'reject_candidate',
    'reassign_customer',
    'reclassify_record',
    'hold_pending',
  ])
  actionType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  matchedCustomerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  finalMatchedCustomerId?: string;

  @IsOptional()
  @IsString()
  @IsIn([
    'a_card_sale',
    'a_plus_c_bundle',
    'points_redemption',
    'employee_welfare',
    'manual_activity',
    'test_data',
    'sheet_missing',
    'self_recharge',
    'other',
  ])
  finalClassification?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    const normalized = String(value).trim().replace(/\s+/g, '_');
    if (!normalized) {
      return undefined;
    }

    if (normalized.length > 100) {
      return undefined;
    }

    return normalized;
  })
  @IsString()
  @MaxLength(100)
  reasonCode?: string;

  @IsString()
  @IsIn([
    'case_only',
    'same_pattern',
    'same_product_family',
    'same_source_rule',
    'global_rule',
    'temporary_rule',
  ])
  decisionScope!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(
    [
      'price_abnormal',
      'non_catalog_product',
      'manual_omission',
      'bank_verified',
      'paid_fact_overrides_sheet',
      'points_redemption',
      'employee_test',
      'admin_test',
      'source_conflict',
      'operator_experience',
      'other',
    ],
    { each: true },
  )
  judgmentBasis!: string[];

  @IsString()
  @IsIn([
    'do_not_generalize',
    'suggest_same_pattern_only',
    'can_generalize_with_review',
    'treat_as_global_reference',
  ])
  aiLearningMode!: string;

  @IsString()
  @MaxLength(500)
  remark!: string;
}
