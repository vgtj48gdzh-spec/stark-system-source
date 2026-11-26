import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { PreparationBindStatus } from '../../../shared/enums/preparation-bind-status.enum';

export class QueryMaterialPreparationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  responsibleUserId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  supplierId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  materialId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  warehouseId?: number;

  @IsOptional()
  @IsEnum(PreparationBindStatus)
  bindStatus?: PreparationBindStatus;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isOverdue?: boolean;
}
