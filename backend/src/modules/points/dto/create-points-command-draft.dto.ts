import { IsIn, IsInt, IsNumberString, IsOptional, IsString, Length, MinLength } from 'class-validator';
import { PointsCommandOwnerType, PointsCommandType } from '../entities/points-command-request.entity';

export class CreatePointsCommandDraftDto {
  @IsIn(['issue_points', 'adjust_points', 'revoke_points'])
  commandType!: PointsCommandType;

  @IsIn(['customer', 'employee'])
  ownerType!: PointsCommandOwnerType;

  @IsOptional()
  @IsInt()
  ownerId?: number;

  @IsOptional()
  @IsString()
  @Length(6, 32)
  ownerMobile?: string;

  @IsOptional()
  @IsInt()
  merchantId?: number;

  @IsOptional()
  @IsInt()
  batchId?: number;

  @IsNumberString()
  changeAmount!: string;

  @IsString()
  @Length(1, 64)
  sourceType!: string;

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
