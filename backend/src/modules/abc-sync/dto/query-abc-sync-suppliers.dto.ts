import { IsIn, IsOptional } from 'class-validator';
import { AbcSyncQueryBaseDto } from './abc-sync-query-base.dto';

export class QueryAbcSyncSuppliersDto extends AbcSyncQueryBaseDto {
  @IsOptional()
  @IsIn([
    'sourceTable',
    'supplierName',
    'supplierStatusStandard',
    'mappingConfirmed',
    'sourceUpdatedAt',
    'syncedAt',
    'updatedAt',
    'createdAt',
  ])
  sortBy?:
    | 'sourceTable'
    | 'supplierName'
    | 'supplierStatusStandard'
    | 'mappingConfirmed'
    | 'sourceUpdatedAt'
    | 'syncedAt'
    | 'updatedAt'
    | 'createdAt';
}
