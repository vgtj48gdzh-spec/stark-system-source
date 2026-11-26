import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

/** References to existing verified authorities, never caller-supplied identity facts. */
export class QueryRepairPrequoteReadinessDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  companyRef!: string;
  @IsString() @IsNotEmpty() @MaxLength(100)
  businessSectorRef!: string;
  @IsString() @IsNotEmpty() @MaxLength(100)
  storeRef!: string;
  @IsString() @IsNotEmpty() @MaxLength(100)
  customerRef!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(2147483647)
  vehicleId!: number;
}

export class AdmitRepairPrequoteDto extends QueryRepairPrequoteReadinessDto {
  @IsUUID('4')
  requestId!: string;
  @IsInt() @Min(1) @Max(2147483647)
  expectedRevision!: number;
  @Matches(/^[a-f0-9]{64}$/)
  expectedAuthorityHash!: string;
  @IsString() @Matches(/^[A-Za-z0-9][A-Za-z0-9._:/-]{2,254}$/)
  scopeResolutionEvidenceRef!: string;
}
