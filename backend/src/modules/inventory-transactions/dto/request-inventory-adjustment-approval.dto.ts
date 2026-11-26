import { IsEnum, IsNotEmpty, IsNumberString, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { InventoryAdjustmentAction } from '../../../shared/enums/inventory-adjustment-action.enum';

export class RequestInventoryAdjustmentApprovalDto {
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._:-]{15,95}$/, {
    message: 'requestIdempotencyKey 必须为 16-96 位安全字符',
  })
  requestIdempotencyKey!: string;

  @IsEnum(InventoryAdjustmentAction)
  action!: InventoryAdjustmentAction;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;

  @ValidateIf((input: RequestInventoryAdjustmentApprovalDto) =>
    input.action === InventoryAdjustmentAction.ADJUST,
  )
  @IsNumberString({}, { message: '目标数量格式错误' })
  targetQuantity?: string;

  @ValidateIf((input: RequestInventoryAdjustmentApprovalDto) =>
    input.action === InventoryAdjustmentAction.ADJUST,
  )
  @IsNumberString({}, { message: '目标单价格式错误' })
  targetUnitPrice?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  verificationCode?: string;
}
