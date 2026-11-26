import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryPayrollTrialPendingItemsDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsString()
  periodKey?: string;

  @IsOptional()
  @IsString()
  summaryDomain?: string;

  @IsOptional()
  @IsIn(['periodKey', 'summaryDomain', 'pendingCount', 'updatedAt', 'createdAt'])
  sortBy?: string;
}
