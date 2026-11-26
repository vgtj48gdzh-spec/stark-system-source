import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateScriptTemplateDto {
  @IsString()
  @MaxLength(100)
  templateCode!: string;

  @IsString()
  @MaxLength(120)
  templateName!: string;

  @IsIn(['price', 'experience', 'benefit', 'saving', 'service'])
  templateGroup!: 'price' | 'experience' | 'benefit' | 'saving' | 'service';

  @IsOptional()
  @IsString()
  @MaxLength(50)
  recommendationType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  channel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  openingText?: string;

  @IsString()
  scriptContent!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  closingText?: string;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isActive!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @IsOptional()
  @IsObject()
  normalizedPayload?: Record<string, unknown>;
}
