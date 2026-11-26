import { IsIn, IsOptional } from 'class-validator';
import { AbcSyncQueryBaseDto } from './abc-sync-query-base.dto';

export class QueryAbcSyncCardMappingExceptionsDto extends AbcSyncQueryBaseDto {
  @IsOptional()
  @IsIn(['cards', 'card_ledger'])
  recordType?: 'cards' | 'card_ledger';

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
