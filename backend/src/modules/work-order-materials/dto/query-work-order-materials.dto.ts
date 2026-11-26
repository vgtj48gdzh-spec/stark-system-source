import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

function normalizeBoolean(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return false;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();

    if (['true', '1', 'yes'].includes(normalizedValue)) {
      return true;
    }

    if (['false', '0', 'no'].includes(normalizedValue)) {
      return false;
    }
  }

  return value;
}

export class QueryWorkOrderMaterialsDto {
  @IsOptional()
  @Transform(({ value }) => normalizeBoolean(value))
  @IsBoolean()
  includeDeleted: boolean = false;
}
