import { IsIn, IsOptional } from 'class-validator';
import { AbcSyncQueryBaseDto } from './abc-sync-query-base.dto';

export class QueryAbcSyncCardLedgerDto extends AbcSyncQueryBaseDto {
  @IsOptional()
  @IsIn([
    'sourceTable',
    'sourceOrderNo',
    'ledgerTypeStandard',
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
    | 'ledgerTypeStandard'
    | 'statusStandard'
    | 'amountStandard'
    | 'mappingConfirmed'
    | 'sourceUpdatedAt'
    | 'syncedAt'
    | 'updatedAt'
    | 'createdAt';
}
