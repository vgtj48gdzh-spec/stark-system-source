import { IsIn, IsOptional } from 'class-validator';
import { AbcSyncQueryBaseDto } from './abc-sync-query-base.dto';

export class QueryAbcSyncCheckpointsDto extends AbcSyncQueryBaseDto {
  @IsOptional()
  @IsIn([
    'sourceTable',
    'batchNo',
    'checkpointKey',
    'checkpointValue',
    'lastSyncedAt',
    'updatedAt',
    'createdAt',
  ])
  sortBy?:
    | 'sourceTable'
    | 'batchNo'
    | 'checkpointKey'
    | 'checkpointValue'
    | 'lastSyncedAt'
    | 'updatedAt'
    | 'createdAt';
}
