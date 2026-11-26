import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryEmployeeBenefitIssuesDto extends PaginationSortQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  periodKey?: string;

  @IsOptional()
  @IsIn(['draft', 'confirmed', 'issued'])
  status?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  confirmedFlag?: boolean;

  @IsOptional()
  @IsIn(['issueNo', 'employeeId', 'periodKey', 'status', 'issuedAt', 'createdAt'])
  sortBy?: 'issueNo' | 'employeeId' | 'periodKey' | 'status' | 'issuedAt' | 'createdAt';
}
