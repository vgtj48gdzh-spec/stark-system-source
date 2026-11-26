import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryEmployeeBenefitNotificationsDto extends PaginationSortQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;

  @IsOptional()
  @IsIn([
    'benefit_issued',
    'benefit_balance_changed',
    'benefit_expiring_30d',
    'benefit_expiring_15d',
    'benefit_expiring_7d',
    'benefit_expiring_3d',
    'benefit_expiring_1d',
    'benefit_expired',
  ])
  notificationType?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  readFlag?: boolean;

  @IsOptional()
  @IsIn(['notifyAt', 'createdAt', 'notificationType'])
  sortBy?: 'notifyAt' | 'createdAt' | 'notificationType';
}
