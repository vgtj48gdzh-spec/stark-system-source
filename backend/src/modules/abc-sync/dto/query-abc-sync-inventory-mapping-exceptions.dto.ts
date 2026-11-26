import { IsIn, IsOptional } from 'class-validator';
import { AbcSyncQueryBaseDto } from './abc-sync-query-base.dto';

export class QueryAbcSyncInventoryMappingExceptionsDto extends AbcSyncQueryBaseDto {
  @IsOptional()
  @IsIn(['materials', 'suppliers', 'warehouses', 'inventory_ledger'])
  recordType?: 'materials' | 'suppliers' | 'warehouses' | 'inventory_ledger';

  @IsOptional()
  @IsIn([
    'recordType',
    'sourceTable',
    'sourceOrderNo',
    'statusStandard',
    'mappingConfirmed',
    'syncedAt',
    'sourceUpdatedAt',
    'updatedAt',
  ])
  sortBy?:
    | 'recordType'
    | 'sourceTable'
    | 'sourceOrderNo'
    | 'statusStandard'
    | 'mappingConfirmed'
    | 'syncedAt'
    | 'sourceUpdatedAt'
    | 'updatedAt';
}
