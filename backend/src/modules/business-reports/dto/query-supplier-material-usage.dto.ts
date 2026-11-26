import { IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ReportPaginationDto } from './report-pagination.dto';

export class QuerySupplierMaterialUsageDto extends ReportPaginationDto {
  @IsOptional()
  @IsIn([
    'supplierName',
    'materialName',
    'usageCount',
    'totalQuantity',
    'totalAmount',
    'workOrderCount',
  ])
  sortBy?:
    | 'supplierName'
    | 'materialName'
    | 'usageCount'
    | 'totalQuantity'
    | 'totalAmount'
    | 'workOrderCount';

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
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
