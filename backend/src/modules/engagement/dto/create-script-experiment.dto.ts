import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateScriptExperimentDto {
  @IsString()
  @MaxLength(100)
  experimentCode!: string;

  @IsString()
  @MaxLength(120)
  experimentName!: string;

  @IsString()
  @MaxLength(50)
  experimentType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  recommendationType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  subjectType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  businessDomain?: string;

  @IsIn(['draft', 'running', 'completed', 'paused'])
  status!: 'draft' | 'running' | 'completed' | 'paused';

  @IsOptional()
  @IsString()
  hypothesis?: string;

  @IsOptional()
  startAt?: string;

  @IsOptional()
  endAt?: string;

  @Type(() => Number)
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(1, { each: true })
  templateIds!: number[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @IsOptional()
  @IsObject()
  normalizedPayload?: Record<string, unknown>;
}
