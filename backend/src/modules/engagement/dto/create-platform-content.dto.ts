import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePlatformContentDto {
  @IsString()
  @MaxLength(50)
  platform!: string;

  @IsString()
  @MaxLength(100)
  accountId!: string;

  @IsString()
  @MaxLength(100)
  contentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  campaignId?: string;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  @MaxLength(50)
  contentType!: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return Array.isArray(value) ? value : [value];
  })
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @Type(() => String)
  @IsDateString()
  publishedAt?: string;

  @IsString()
  @MaxLength(30)
  status!: string;

  @IsOptional()
  @IsObject()
  normalizedPayload?: Record<string, unknown>;
}
