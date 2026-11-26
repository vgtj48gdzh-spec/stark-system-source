import { IsBooleanString, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryPointsRedemptionsDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsIn([
    'requestStatus',
    'requestedAt',
    'fulfilledAt',
    'createdAt',
    'updatedAt',
    'pointsCost',
    'targetValue',
  ])
  sortBy?:
    | 'requestStatus'
    | 'requestedAt'
    | 'fulfilledAt'
    | 'createdAt'
    | 'updatedAt'
    | 'pointsCost'
    | 'targetValue';

  @IsOptional()
  @IsString()
  @Length(1, 32)
  requestStatus?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  redeemableType?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  redeemableCode?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  sourceType?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  providerSystem?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  requestSource?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  ownerType?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  ownerMobile?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  reconciliationStatus?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  exceptionFlag?: string;

  @IsOptional()
  @IsString()
  @Length(1, 7)
  periodKey?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  dateFrom?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  dateTo?: string;

  @IsOptional()
  @IsBooleanString()
  fulfilledOnly?: string;

  @IsOptional()
  @IsBooleanString()
  hasConsumeLedger?: string;
}
