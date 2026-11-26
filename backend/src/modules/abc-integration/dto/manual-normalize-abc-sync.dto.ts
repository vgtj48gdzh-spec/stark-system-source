import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { AbcSyncTargetDomain } from '../../../shared/enums/abc-sync-target-domain.enum';

export class ManualNormalizeAbcSyncDto {
  @IsOptional()
  @IsString()
  sourceSystemCode: string = 'ABC';

  @IsOptional()
  @IsString()
  batchNo?: string;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => (Array.isArray(value) ? value : undefined))
  @IsIn(
    [
      AbcSyncTargetDomain.ORDERS,
      AbcSyncTargetDomain.FUNDS,
      AbcSyncTargetDomain.CARDS,
      AbcSyncTargetDomain.INVENTORY,
    ],
    {
    each: true,
    },
  )
  targetDomains?: AbcSyncTargetDomain[];

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => (Array.isArray(value) ? value : undefined))
  @Matches(/^[a-z0-9_]+$/, {
    each: true,
  })
  sourceTables?: string[];
}
