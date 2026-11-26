import {
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SupplierStatus } from '../../../shared/enums/supplier-status.enum';

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactMobile?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsIn(Object.values(SupplierStatus))
  status?: SupplierStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @IsOptional()
  @IsNumberString({}, { message: '评分格式错误' })
  score?: string;
}
