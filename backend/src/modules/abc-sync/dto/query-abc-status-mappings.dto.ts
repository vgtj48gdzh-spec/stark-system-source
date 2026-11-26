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

export class QueryAbcStatusMappingsDto extends AbcRuleQueryBaseDto {
  @IsOptional()
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  targetDomain?: string;

  @IsOptional()
  @IsIn([
    'sourceTable',
    'sourceField',
    'sourceValue',
    'targetDomain',
    'targetValue',
    'confidenceLevel',
    'isActive',
    'updatedAt',
    'createdAt',
  ])
  sortBy?:
    | 'sourceTable'
    | 'sourceField'
    | 'sourceValue'
    | 'targetDomain'
    | 'targetValue'
    | 'confidenceLevel'
    | 'isActive'
    | 'updatedAt'
    | 'createdAt';
}
