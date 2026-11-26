import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, Equals, IsArray, IsIn, IsInt, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class IntakeProposalLineDto {
  @IsIn(['part', 'labor', 'other']) category!: 'part' | 'labor' | 'other';
  @IsString() @MaxLength(120) name!: string;
  @IsString() @MaxLength(200) specification!: string;
  @IsString() @MaxLength(20) unit!: string;
  // Empty strings mean unknown, never zero. Exact decimal validation is server-side.
  @IsString() @MaxLength(9) quantity!: string;
  @IsString() @MaxLength(9) unitPrice!: string;
  @IsString() @MaxLength(120) supplierCandidate!: string;
  @IsIn(['unknown', 'pending_purchase', 'existing_stock', 'customer_supplied'])
  sourceHint!: 'unknown' | 'pending_purchase' | 'existing_stock' | 'customer_supplied';
}
export class SaveIntakeProposalDto {
  @IsUUID('4') requestId!: string;
  @IsInt() @Min(1) @Max(2147483647) expectedIntakeRevision!: number;
  @IsInt() @Min(1) @Max(2147483647) expectedAssociationRevision!: number;
  @IsInt() @Min(0) @Max(2147483646) expectedDraftRevision!: number;
  @IsString() @MaxLength(1000) plan!: string;
  @IsString() @MaxLength(1000) notes!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true })
  @Type(() => IntakeProposalLineDto) rows!: IntakeProposalLineDto[];
  @Equals(true) pendingDeclarationAcknowledged!: true;
}
