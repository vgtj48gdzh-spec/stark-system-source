import { IsOptional, IsString, Length } from 'class-validator';

export class IgnorePerformanceEventDto {
  @IsOptional()
  @IsString()
  @Length(0, 500)
  remark?: string;
}
