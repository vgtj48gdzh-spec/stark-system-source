import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length } from 'class-validator';

function normalizeString(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const normalized = String(value).trim();
  return normalized || undefined;
}

export class ExecutePointsWelfareBatchDto {
  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @Length(1, 500)
  remark?: string;
}
