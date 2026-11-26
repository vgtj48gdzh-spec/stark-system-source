import { IsIn, IsOptional } from 'class-validator';
import { AbcSyncQueryBaseDto } from './abc-sync-query-base.dto';

export class QueryAbcSyncFundsDto extends AbcSyncQueryBaseDto {
  @IsOptional()
  @IsIn([
    'sourceTable',
    'sourceOrderNo',
    'fundTypeStandard',
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
    | 'fundTypeStandard'
    | 'statusStandard'
    | 'amountStandard'
    | 'mappingConfirmed'
    | 'sourceUpdatedAt'
    | 'syncedAt'
    | 'updatedAt'
    | 'createdAt';
}
