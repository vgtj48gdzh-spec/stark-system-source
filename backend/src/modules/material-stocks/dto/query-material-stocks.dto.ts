import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class QueryMaterialStocksDto {
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
}
