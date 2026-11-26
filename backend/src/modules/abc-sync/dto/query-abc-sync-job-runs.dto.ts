import { IsIn, IsOptional } from 'class-validator';
import { AbcSyncQueryBaseDto } from './abc-sync-query-base.dto';

export class QueryAbcSyncJobRunsDto extends AbcSyncQueryBaseDto {
  @IsOptional()
  @IsIn(['running', 'success', 'failed'])
  runStatus?: 'running' | 'success' | 'failed';

  @IsOptional()
  @IsIn([
    'sourceTable',
    'batchNo',
    'runStatus',
    'startedAt',
    'finishedAt',
    'totalRecords',
    'importedRecords',
    'failedRecords',
    'createdAt',
  ])
  sortBy?:
    | 'sourceTable'
    | 'batchNo'
    | 'runStatus'
    | 'startedAt'
    | 'finishedAt'
    | 'totalRecords'
    | 'importedRecords'
    | 'failedRecords'
    | 'createdAt';
}
