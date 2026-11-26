import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectAttributionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
