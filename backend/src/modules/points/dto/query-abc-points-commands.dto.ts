import { IsBooleanString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryAbcPointsCommandsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  commandStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  requestSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  ownerMobile?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  blockedReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  providerKey?: string;

  @IsOptional()
  @IsBooleanString()
  blockedOnly?: string;

  @IsOptional()
  @IsBooleanString()
  hasUniqueUserMatch?: string;

  @IsOptional()
  @IsBooleanString()
  canExecute?: string;

  @IsOptional()
  @IsBooleanString()
  includeDiagnostics?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  periodKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(19)
  dateFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(19)
  dateTo?: string;

  @IsOptional()
  @IsIn(['createdAt', 'requestedAt', 'updatedAt', 'changeAmount'])
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc', 'ASC', 'DESC'])
  sortOrder?: 'asc' | 'desc' | 'ASC' | 'DESC';
}
