import { IsDateString, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ReportPaginationDto } from './report-pagination.dto';

export class QueryUnboundOverduePreparationsDto extends ReportPaginationDto {
  @IsOptional()
  @IsIn([
    'preparationNo',
    'supplierName',
    'materialName',
    'quantity',
    'totalPrice',
    'bindDeadlineAt',
    'preparedAt',
    'createdAt',
  ])
  sortBy?:
    | 'preparationNo'
    | 'supplierName'
    | 'materialName'
    | 'quantity'
    | 'totalPrice'
    | 'bindDeadlineAt'
    | 'preparedAt'
    | 'createdAt';

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
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
