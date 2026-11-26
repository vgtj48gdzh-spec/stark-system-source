import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class GeneratePayrollTrialsDto {
  @IsString()
  periodKey!: string;

  @IsOptional()
  @IsString()
  batchNo?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  forceRegenerate?: boolean;
}
