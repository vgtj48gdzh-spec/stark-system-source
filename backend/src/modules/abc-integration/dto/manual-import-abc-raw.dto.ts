import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { SyncInputFormat } from '../../../shared/enums/sync-input-format.enum';

export class ManualImportAbcRawDto {
  @IsOptional()
  @IsString()
  sourceSystemCode: string = 'ABC';

  @IsString()
  @Matches(/^[a-z0-9_]+$/)
  sourceTable!: string;

  @IsEnum(SyncInputFormat)
  inputFormat!: SyncInputFormat;

  @IsString()
  inputPath!: string;

  @IsOptional()
  @IsString()
  batchNo?: string;

  @IsOptional()
  @IsString()
  checkpointKey?: string;

  @IsOptional()
  @IsString()
  delimiter?: string;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => (Array.isArray(value) ? value : undefined))
  syncScope?: string[];
}
