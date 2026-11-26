import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { WorkOrderMaterialSource } from '../../../shared/enums/work-order-material-source.enum';

export class CreateWorkOrderMaterialDto {
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._:-]{15,95}$/, {
    message: 'requestIdempotencyKey 必须为 16-96 位安全字符',
  })
  requestIdempotencyKey!: string;

  @IsInt()
  @Min(1)
  materialId!: number;

  @IsEnum(WorkOrderMaterialSource)
  @IsNotEmpty()
  sourceType!: WorkOrderMaterialSource;

  @IsOptional()
  @IsInt()
  @Min(1)
  warehouseId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  preparationId?: number;

  @IsNumberString({}, { message: '数量格式错误' })
  quantity!: string;

  @IsNumberString({}, { message: '金额格式错误' })
  unitPrice!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
