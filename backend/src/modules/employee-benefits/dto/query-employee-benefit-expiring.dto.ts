import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryEmployeeBenefitExpiringDto extends PaginationSortQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeExpired?: boolean;
}
