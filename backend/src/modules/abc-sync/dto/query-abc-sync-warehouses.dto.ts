import { IsIn, IsOptional } from 'class-validator';
import { AbcSyncQueryBaseDto } from './abc-sync-query-base.dto';

export class QueryAbcSyncWarehousesDto extends AbcSyncQueryBaseDto {
  @IsOptional()
  @IsIn([
    'sourceTable',
    'warehouseSourceId',
    'warehouseName',
    'warehouseStatusStandard',
    'quantityStandard',
    'amountStandard',
    'mappingConfirmed',
    'sourceUpdatedAt',
    'syncedAt',
    'updatedAt',
    'createdAt',
  ])
  sortBy?:
    | 'sourceTable'
    | 'warehouseSourceId'
    | 'warehouseName'
    | 'warehouseStatusStandard'
    | 'quantityStandard'
    | 'amountStandard'
    | 'mappingConfirmed'
    | 'sourceUpdatedAt'
    | 'syncedAt'
    | 'updatedAt'
    | 'createdAt';
}
