import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ReportPaginationDto } from './report-pagination.dto';

export class QueryInventoryAlertsDto extends ReportPaginationDto {
  @IsOptional()
  @IsIn([
    'warehouseName',
    'materialName',
    'currentQuantity',
    'warningQuantity',
    'shortageQuantity',
    'updatedAt',
  ])
  sortBy?:
    | 'warehouseName'
    | 'materialName'
    | 'currentQuantity'
    | 'warningQuantity'
    | 'shortageQuantity'
    | 'updatedAt';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  warehouseId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  materialId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  supplierId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @Transform(({ value }) => value === undefined ? undefined : value === true || value === 'true')
  @IsBoolean()
  onlyAlerts?: boolean;
}
