import {
  IsDateString,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateMaterialPreparationDto {
  @IsInt()
  @Min(1)
  materialId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  supplierId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  warehouseId?: number;

  @IsNumberString({}, { message: '数量格式错误' })
  quantity!: string;

  @IsNumberString({}, { message: '金额格式错误' })
  unitPrice!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  linkedWorkOrderId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  responsibleUserId?: number;

  @IsOptional()
  @IsDateString()
  preparedAt?: string;

  @IsOptional()
  @IsDateString()
  bindDeadlineAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
