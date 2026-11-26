import { Type } from 'class-transformer';
import { IsDateString, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePlatformInteractionDto {
  @IsString()
  @MaxLength(50)
  platform!: string;

  @IsString()
  @MaxLength(100)
  accountId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contentId?: string;

  @IsString()
  @MaxLength(50)
  interactionType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  interactionValue?: string;

  @Type(() => String)
  @IsDateString()
  interactionTime!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceUserRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceSessionRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceContactRef?: string;

  @IsOptional()
  @IsObject()
  normalizedPayload?: Record<string, unknown>;
}
