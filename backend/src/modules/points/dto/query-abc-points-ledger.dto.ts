import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryAbcPointsLedgerDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  ownerMobile?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;

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
}
