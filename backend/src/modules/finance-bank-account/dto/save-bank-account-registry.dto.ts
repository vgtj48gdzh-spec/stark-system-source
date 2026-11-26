import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class SaveBankAccountRegistryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId!: number;

  @IsString()
  @MaxLength(100)
  bankName!: string;

  @IsString()
  @MaxLength(100)
  smsSender!: string;

  @IsString()
  @MaxLength(8)
  accountTail!: string;

  @IsString()
  @MaxLength(100)
  accountAlias!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  accountHolder?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  virtualLedgerId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  accountUse?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  evidenceSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  evidenceRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  simSlot?: number;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
