import { IsIn, IsOptional } from 'class-validator';
import { AbcSyncQueryBaseDto } from './abc-sync-query-base.dto';

export class QueryAbcSyncMaterialsDto extends AbcSyncQueryBaseDto {
  @IsOptional()
  @IsIn([
    'sourceTable',
    'sourceOrderNo',
    'materialCode',
    'materialName',
    'materialStatusStandard',
    'storageAmountStandard',
    'saleAmountStandard',
    'mappingConfirmed',
    'sourceUpdatedAt',
    'syncedAt',
    'updatedAt',
    'createdAt',
  ])
  sortBy?:
    | 'sourceTable'
    | 'sourceOrderNo'
    | 'materialCode'
    | 'materialName'
    | 'materialStatusStandard'
    | 'storageAmountStandard'
    | 'saleAmountStandard'
    | 'mappingConfirmed'
    | 'sourceUpdatedAt'
    | 'syncedAt'
    | 'updatedAt'
    | 'createdAt';
}
