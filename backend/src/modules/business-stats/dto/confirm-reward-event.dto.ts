import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmRewardEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
