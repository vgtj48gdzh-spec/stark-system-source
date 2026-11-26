import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateExecutionTaskDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  playbookId!: number;

  @IsString()
  @MaxLength(100)
  taskCode!: string;

  @IsString()
  @MaxLength(120)
  taskName!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignedTo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  scriptTemplateId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  merchantId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  recommendationIds?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxItems?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  autoSelectCandidates?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @IsOptional()
  @IsObject()
  normalizedPayload?: Record<string, unknown>;
}
