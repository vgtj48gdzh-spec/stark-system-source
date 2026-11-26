import {
  IsBoolean,
  IsDecimal,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AbcMappingConfidence } from '../../../shared/enums/abc-mapping-confidence.enum';

export class UpdateAbcAmountRuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceTable?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  amountField?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  amountUnitRaw?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  standardUnit?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '0,6' })
  conversionRate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  standardScale?: number;

  @IsOptional()
  @IsEnum(AbcMappingConfidence)
  confidenceLevel?: AbcMappingConfidence;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
