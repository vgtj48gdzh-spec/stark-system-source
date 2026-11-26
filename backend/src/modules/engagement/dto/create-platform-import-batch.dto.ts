import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePlatformImportBatchDto {
  @IsString()
  @MaxLength(50)
  sourcePlatform!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  accountId?: string;

  @IsIn(['content', 'interaction', 'lead'])
  importType!: 'content' | 'interaction' | 'lead';

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  triggerLeadGeneration?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  triggerAttributionGeneration?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  syncLeadMemories?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return Number(value);
  })
  @IsInt()
  @Min(1)
  connectorConfigId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
