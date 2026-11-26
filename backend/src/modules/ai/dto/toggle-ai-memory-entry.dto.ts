import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

function normalizeString(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const normalized = String(value).trim();
  return normalized || undefined;
}

export class ToggleAiMemoryEntryDto {
  @IsBoolean()
  enabledFlag!: boolean;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
