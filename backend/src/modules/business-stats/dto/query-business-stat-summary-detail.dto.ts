import { IsIn, IsOptional } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryBusinessStatSummaryDetailDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsIn(['occurredAt', 'updatedAt', 'createdAt'])
  sortBy?: string;
}
