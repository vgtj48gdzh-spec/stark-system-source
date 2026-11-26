import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class SaveWechatMerchantRegistryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId!: number;

  @IsString()
  @MaxLength(100)
  merchantId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  appId?: string;

  @IsString()
  @MaxLength(200)
  merchantName!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  settlementBankAccountRegistryId?: number;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
