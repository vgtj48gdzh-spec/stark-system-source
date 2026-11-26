import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateEmployeeBenefitIssueItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  itemType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  itemName!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amountStandard!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  quantityStandard?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  validityDays?: number;

  @IsOptional()
  @IsDateString()
  effectiveAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sourceSystem?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceTable?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceOrderNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @IsOptional()
  @IsObject()
  normalizedPayload?: Record<string, unknown>;
}

export class CreateEmployeeBenefitIssueDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  periodKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  issueType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @IsOptional()
  @IsObject()
  normalizedPayload?: Record<string, unknown>;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateEmployeeBenefitIssueItemDto)
  items!: CreateEmployeeBenefitIssueItemDto[];
}
