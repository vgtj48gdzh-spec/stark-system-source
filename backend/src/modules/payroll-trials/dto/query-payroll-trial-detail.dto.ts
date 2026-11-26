import { IsIn, IsOptional } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryPayrollTrialDetailDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsIn(['occurredAt', 'detailType', 'sourceTable', 'rewardAmount', 'rewardPoints', 'createdAt'])
  sortBy?: string;
}
