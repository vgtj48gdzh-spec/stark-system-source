import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { MaterialStatus } from '../../../shared/enums/material-status.enum';

export class CreateMaterialDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  specification?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  unit!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultSupplierId?: number;

  @IsOptional()
  @IsNumberString({}, { message: '金额格式错误' })
  defaultUnitPrice?: string;

  @IsOptional()
  @IsNumberString({}, { message: '数量格式错误' })
  warningQuantity?: string;

  @IsOptional()
  @IsIn(Object.values(MaterialStatus))
  status?: MaterialStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
