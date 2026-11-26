import { IsOptional, IsString, Length } from 'class-validator';

export class MarkPointsRedemptionFulfilledDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  externalEntityId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  externalNo?: string;

  @IsString()
  @Length(1, 500)
  remark!: string;
}
