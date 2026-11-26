import { IsIn, IsOptional } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryEmployeeBenefitLedgerDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsIn(['active', 'expired', 'consumed'])
  status?: string;

  @IsOptional()
  @IsIn(['effectiveAt', 'expiresAt', 'amountRemaining', 'createdAt'])
  sortBy?: 'effectiveAt' | 'expiresAt' | 'amountRemaining' | 'createdAt';
}
