import { Equals, IsIn, IsInt, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

/** Declaration for one existing intake, NOT a customer/vehicle verification. */
export class SaveIntakeAssociationDto {
  @IsUUID('4') requestId!: string;
  @IsInt() @Min(1) @Max(2147483647) expectedIntakeRevision!: number;
  @IsInt() @Min(0) @Max(2147483646) expectedDraftRevision!: number;
  @IsString() @MinLength(1) @MaxLength(100) customerName!: string;
  @IsIn(['owner', 'user', 'contact']) relationshipType!: 'owner' | 'user' | 'contact';
  @Equals(true) pendingDeclarationAcknowledged!: true;
}
