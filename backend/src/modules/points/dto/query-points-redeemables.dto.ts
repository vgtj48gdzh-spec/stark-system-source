import { IsOptional, IsString, Length } from 'class-validator';

export class QueryPointsRedeemablesDto {
  @IsOptional()
  @IsString()
  @Length(1, 64)
  redeemableType?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  providerSystem?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  sceneScope?: string;
}
