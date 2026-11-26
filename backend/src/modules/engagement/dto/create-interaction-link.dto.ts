import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateInteractionLinkDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  interactionId!: number;

  @IsString()
  @MaxLength(30)
  linkedSubjectType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  linkedSubjectId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  linkedBusinessType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  linkedBusinessId?: string;

  @IsIn(['confirmed', 'inferred', 'unknown'])
  attributionStatus!: 'confirmed' | 'inferred' | 'unknown';

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  attributionConfidence!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
