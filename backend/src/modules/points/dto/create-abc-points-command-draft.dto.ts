import { IsIn, IsInt, IsNumberString, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { AbcPointsCommandType, AbcPointsCommandOwnerType } from '../entities/abc-points-command-request.entity';

export class CreateAbcPointsCommandDraftDto {
  @IsIn(['issue_score', 'adjust_score', 'revoke_score'] satisfies AbcPointsCommandType[])
  commandType!: AbcPointsCommandType;

  @IsIn(['customer', 'employee'] satisfies AbcPointsCommandOwnerType[])
  ownerType!: AbcPointsCommandOwnerType;

  @IsOptional()
  @IsInt()
  ownerId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  ownerMobile?: string | null;

  @IsNumberString()
  changeAmount!: string;

  @IsString()
  @MaxLength(64)
  sourceType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  requestSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reasonCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  providerKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  sourceActionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  threadKey?: string;

  @IsOptional()
  @IsObject()
  normalizedPayload?: Record<string, unknown>;
}
