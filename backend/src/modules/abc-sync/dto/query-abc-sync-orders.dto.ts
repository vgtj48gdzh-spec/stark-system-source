import { IsIn, IsOptional } from 'class-validator';
import { AbcSyncQueryBaseDto } from './abc-sync-query-base.dto';

export class QueryAbcSyncOrdersDto extends AbcSyncQueryBaseDto {
  @IsOptional()
  @IsIn([
    'sourceTable',
    'sourceOrderNo',
    'statusStandard',
    'amountStandard',
    'mappingConfirmed',
    'sourceUpdatedAt',
    'syncedAt',
    'updatedAt',
    'createdAt',
  ])
  sortBy?:
    | 'sourceTable'
    | 'sourceOrderNo'
    | 'statusStandard'
    | 'amountStandard'
    | 'mappingConfirmed'
    | 'sourceUpdatedAt'
    | 'syncedAt'
    | 'updatedAt'
    | 'createdAt';
}
