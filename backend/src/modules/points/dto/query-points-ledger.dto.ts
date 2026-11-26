import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryPointsLedgerDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsIn(['executedAt', 'createdAt', 'changeAmount', 'balanceAfter'])
  sortBy?: 'executedAt' | 'createdAt' | 'changeAmount' | 'balanceAfter';

  @IsOptional()
  @IsString()
  @Length(1, 32)
  ownerType?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  ownerMobile?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  sourceType?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  sourceId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  changeType?: string;
}
