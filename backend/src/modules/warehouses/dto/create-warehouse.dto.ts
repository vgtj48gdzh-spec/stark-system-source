import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { WarehouseStatus } from '../../../shared/enums/warehouse-status.enum';

export class CreateWarehouseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  managerUserId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsIn(Object.values(WarehouseStatus))
  status?: WarehouseStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
