import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateExecutionResultDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  taskId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  taskItemId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recommendationId?: number;

  @IsOptional()
  executedAt?: string;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  repliedFlag!: boolean;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  convertedFlag!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nonConversionReason?: string;

  @IsOptional()
  @IsIn(['recorded', 'reviewed', 'ignored'])
  resultStatus?: 'recorded' | 'reviewed' | 'ignored';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @IsOptional()
  @IsObject()
  normalizedPayload?: Record<string, unknown>;
}
