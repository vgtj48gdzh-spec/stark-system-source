import { IsArray, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateApprovalRequestDraftFromWarehousePreviewDto {
  @IsString()
  @MaxLength(160)
  candidateRef!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  draftReason?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  reasonCodes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  riskLabels?: string[];

  @IsOptional()
  @IsObject()
  aiSuggestionSnapshot?: Record<string, unknown> | null;
}
