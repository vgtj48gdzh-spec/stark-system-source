import { IsIn, IsInt, IsNumberString, IsOptional, IsString, Length } from 'class-validator';
import { PointsRedemptionOwnerType } from '../entities/points-redemption-request.entity';

export class CreatePointsRedemptionDraftDto {
  @IsIn(['customer', 'employee'])
  ownerType!: PointsRedemptionOwnerType;

  @IsOptional()
  @IsInt()
  ownerId?: number;

  @IsOptional()
  @IsString()
  @Length(6, 32)
  ownerMobile?: string;

  @IsString()
  @Length(1, 100)
  redeemableCode!: string;

  @IsNumberString()
  pointsCost!: string;

  @IsNumberString()
  targetValue!: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  reasonCode?: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  remark?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  requestSource?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  providerKey?: string;

  @IsOptional()
  @IsString()
  @Length(1, 150)
  sourceActionId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 150)
  threadKey?: string;

  @IsOptional()
  normalizedPayload?: Record<string, unknown>;
}
