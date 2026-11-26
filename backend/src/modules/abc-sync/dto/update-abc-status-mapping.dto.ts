import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AbcMappingConfidence } from '../../../shared/enums/abc-mapping-confidence.enum';

export class UpdateAbcStatusMappingDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceTable?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceField?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceValue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  targetDomain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetValue?: string;

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
