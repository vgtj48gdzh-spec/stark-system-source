import { IsOptional, IsString, MaxLength } from 'class-validator';

export class IgnoreRewardEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
