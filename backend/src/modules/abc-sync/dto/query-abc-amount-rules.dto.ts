import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { AbcRuleQueryBaseDto } from './abc-sync-query-base.dto';

function normalizeString(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized || undefined;
}

export class QueryAbcAmountRulesDto extends AbcRuleQueryBaseDto {
  @IsOptional()
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  amountField?: string;

  @IsOptional()
  @IsIn([
    'sourceTable',
    'amountField',
    'amountUnitRaw',
    'standardUnit',
    'confidenceLevel',
    'isActive',
    'updatedAt',
    'createdAt',
  ])
  sortBy?:
    | 'sourceTable'
    | 'amountField'
    | 'amountUnitRaw'
    | 'standardUnit'
    | 'confidenceLevel'
    | 'isActive'
    | 'updatedAt'
    | 'createdAt';
}
