import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

function normalizeString(value: unknown) {
  if (value === undefined || value === null) {
    return value;
  }

  return String(value).trim();
}

export class CreateEmployeeSourceBindingDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId!: number;

  @Transform(({ value }) => normalizeString(value))
  @IsString()
  @Length(1, 50)
  sourceSystem!: string;

  @Transform(({ value }) => normalizeString(value))
  @IsString()
  @Length(1, 100)
  sourceTable!: string;

  @Transform(({ value }) => normalizeString(value))
  @IsString()
  @Length(1, 100)
  sourceId!: string;

  @Transform(({ value }) => normalizeString(value))
  @IsString()
  @Length(1, 100)
  bindingType!: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  @Length(0, 500)
  remark?: string;
}
