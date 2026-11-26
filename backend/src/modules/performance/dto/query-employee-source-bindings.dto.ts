import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

function normalizeString(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized || undefined;
}

function normalizeBoolean(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return value;
}

export class QueryEmployeeSourceBindingsDto extends PaginationSortQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;

  @IsOptional()
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  sourceSystem?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  sourceTable?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  bindingType?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeBoolean(value))
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(['employeeId', 'sourceSystem', 'sourceTable', 'bindingType', 'createdAt', 'updatedAt'])
  sortBy?:
    | 'employeeId'
    | 'sourceSystem'
    | 'sourceTable'
    | 'bindingType'
    | 'createdAt'
    | 'updatedAt';
}
