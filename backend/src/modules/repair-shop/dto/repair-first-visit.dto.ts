import { Equals, IsInt, IsNotEmpty, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

export class QueryRepairFirstVisitDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  businessSectorRef!: string;
}

/** No caller-supplied customer, vehicle, employee, phone, VIN or verified flags. */
export class ReviewRepairFirstVisitDto extends QueryRepairFirstVisitDto {
  @IsUUID('4')
  requestId!: string;
  @IsInt() @Min(1) @Max(2147483647)
  expectedIntakeRevision!: number;
  @IsInt() @Min(1) @Max(2147483647)
  expectedDeclarationRevision!: number;
  @Matches(/^[a-f0-9]{64}$/)
  expectedReviewHash!: string;
  @IsString() @Matches(/^[A-Za-z0-9][A-Za-z0-9._:/-]{2,254}$/)
  evidenceRef!: string;
  @Equals(true)
  identityAndRelationshipChecked!: true;
  @Equals(true)
  vehicleAndDetailsChecked!: true;
}
