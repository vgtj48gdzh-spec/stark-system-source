import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
} from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

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

export class QueryPerformanceSummaryDetailDto extends PaginationSortQueryDto {
  @IsOptional()
  @Transform(({ value }) => normalizeBoolean(value))
  @IsBoolean()
  confirmedFlag?: boolean;

  @IsOptional()
  @IsIn(['occurredAt', 'eventType', 'confirmedFlag', 'amountStandard', 'updatedAt'])
  sortBy?: 'occurredAt' | 'eventType' | 'confirmedFlag' | 'amountStandard' | 'updatedAt';
}
