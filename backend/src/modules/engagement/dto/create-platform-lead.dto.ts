import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePlatformLeadDto {
  @IsString()
  @MaxLength(50)
  platform!: string;

  @IsString()
  @MaxLength(100)
  accountId!: string;

  @IsString()
  @MaxLength(100)
  leadRef!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  campaignId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contentId?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  interactionId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  leadType?: string;

  @IsIn(['confirmed', 'inferred', 'unknown'])
  leadStatus!: 'confirmed' | 'inferred' | 'unknown';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  leadValue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceUserRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceSessionRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceContactRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  subjectType?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  subjectId?: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
  @IsInt()
  merchantId?: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
  @IsInt()
  employeeId?: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
  @IsInt()
  customerId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  linkedBusinessType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  linkedBusinessId?: string;

  @IsOptional()
  @IsIn(['confirmed', 'inferred', 'uncertain'])
  evidenceStatus?: 'confirmed' | 'inferred' | 'uncertain';

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : String(value)))
  @IsString()
  @MaxLength(10)
  confidenceScore?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ruleCode?: string;

  @IsOptional()
  @IsObject()
  matchedFields?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  sourceFile?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  importBatchId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @IsOptional()
  @IsObject()
  normalizedPayload?: Record<string, unknown>;
}
