import { IsInt, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

/** A complete draft snapshot. Explicit null means unknown, never an invented fact. */
export class UpdateWorkOrderIntakeDetailsDto {
  @IsUUID('4')
  requestId!: string;

  @IsInt()
  @Min(0)
  @Max(2147483646)
  expectedRevision!: number;

  @ValidateIf((_, value) => value !== null)
  @Matches(/^[A-HJ-NPR-Z0-9]{17}$/i, { message: 'VIN 应为 17 位；未核实请留空' })
  vin!: string | null;

  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(9999999)
  odometerKm!: number | null;

  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(100)
  requestedService!: string | null;
}
