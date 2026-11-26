import { IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ReassignAttributionDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  attributedSubjectType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  attributedSubjectId?: number;

  @IsOptional()
  @IsInt()
  merchantId?: number;

  @IsOptional()
  @IsInt()
  employeeId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  attributedBusinessType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  attributedBusinessId?: string;

  @IsOptional()
  @IsIn(['confirmed', 'inferred', 'unknown'])
  attributionStatus?: 'confirmed' | 'inferred' | 'unknown';

  @IsOptional()
  @IsIn(['confirmed', 'inferred', 'uncertain'])
  evidenceStatus?: 'confirmed' | 'inferred' | 'uncertain';

  @IsOptional()
  @IsObject()
  matchedFields?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
