import { IntersectionType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { DateRangeQueryDto } from '../../../common/dto/date-range-query.dto';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';
import { InventoryTransactionType } from '../../../shared/enums/inventory-transaction-type.enum';

export class QueryInventoryTransactionsDto extends IntersectionType(
  PaginationSortQueryDto,
  DateRangeQueryDto,
) {
  @IsOptional()
  @IsEnum(InventoryTransactionType)
  transactionType?: InventoryTransactionType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  relatedWorkOrderMaterialId?: number;

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
  @IsIn(['createdAt', 'transactionType', 'quantity', 'unitPrice', 'totalPrice'])
  sortBy?: 'createdAt' | 'transactionType' | 'quantity' | 'unitPrice' | 'totalPrice';
}
