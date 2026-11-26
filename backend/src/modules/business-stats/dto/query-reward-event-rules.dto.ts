import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryRewardEventRulesDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsString()
  businessDomain?: string;

  @IsOptional()
  @IsString()
  requiredTagCode?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === '' ? undefined : value === true || value === 'true',
  )
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(['ruleCode', 'eventType', 'businessDomain', 'isActive', 'updatedAt', 'createdAt'])
  sortBy?: string;
}
