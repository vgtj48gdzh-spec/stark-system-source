import { IsOptional, IsString, Length } from 'class-validator';

export class CancelPointsRedemptionDto {
  @IsOptional()
  @IsString()
  @Length(1, 500)
  remark?: string;
}
