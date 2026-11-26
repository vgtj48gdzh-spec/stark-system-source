import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AbcMappingConfidence } from '../../../shared/enums/abc-mapping-confidence.enum';

export class CreateAbcStatusMappingDto {
  @IsString()
  @MaxLength(100)
  sourceTable!: string;

  @IsString()
  @MaxLength(100)
  sourceField!: string;

  @IsString()
  @MaxLength(100)
  sourceValue!: string;

  @IsString()
  @MaxLength(50)
  targetDomain!: string;

  @IsString()
  @MaxLength(100)
  targetValue!: string;

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
