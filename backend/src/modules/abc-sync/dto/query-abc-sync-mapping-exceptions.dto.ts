import { IsIn, IsOptional } from 'class-validator';
import { AbcSyncQueryBaseDto } from './abc-sync-query-base.dto';

export class QueryAbcSyncMappingExceptionsDto extends AbcSyncQueryBaseDto {
  @IsOptional()
  @IsIn(['orders', 'funds'])
  targetDomain?: 'orders' | 'funds';

  @IsOptional()
  @IsIn([
    'targetDomain',
    'sourceTable',
    'sourceOrderNo',
    'statusStandard',
    'mappingConfirmed',
    'syncedAt',
    'sourceUpdatedAt',
    'updatedAt',
  ])
  sortBy?:
    | 'targetDomain'
    | 'sourceTable'
    | 'sourceOrderNo'
    | 'statusStandard'
    | 'mappingConfirmed'
    | 'syncedAt'
    | 'sourceUpdatedAt'
    | 'updatedAt';
}
