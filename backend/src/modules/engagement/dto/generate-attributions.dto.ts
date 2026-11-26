import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateAttributionsDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  accountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  candidateType?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsBoolean()
  forceRegenerate?: boolean;
}
