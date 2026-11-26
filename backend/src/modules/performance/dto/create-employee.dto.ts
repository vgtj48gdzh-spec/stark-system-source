import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  nameRemark?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  linkedUserId?: number;

  @IsOptional()
  @IsString()
  @Length(0, 20)
  mobile?: string;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  companyName?: string;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  sourceCompanyName?: string;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  positionName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceRowIndex?: number;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  sourceFileName?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  importBatchNo?: string;

  @IsOptional()
  @IsString()
  importedAt?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  importConflictNote?: string;

  @IsOptional()
  @IsString()
  @Length(0, 64)
  referralCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  referredByEmployeeId?: number;

  @IsOptional()
  @IsString()
  @Length(0, 20)
  referredByEmployeeMobile?: string;

  @IsOptional()
  @IsString()
  @Length(0, 50)
  referralSourceType?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  remark?: string;
}
