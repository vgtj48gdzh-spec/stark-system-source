import { IsOptional, IsString, Length } from 'class-validator';

export class ConfirmPointsRedemptionDto {
  @IsOptional()
  @IsString()
  @Length(1, 500)
  remark?: string;
}
