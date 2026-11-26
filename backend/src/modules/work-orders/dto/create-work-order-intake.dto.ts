import { IsNotEmpty, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

/** Registration only. Prices, evidence confirmations and financial states are not input fields. */
export class CreateWorkOrderIntakeDto {
  @IsUUID('4')
  requestId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  storeRef!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  customerName!: string;

  @Matches(/^1[3-9]\d{9}$/, { message: '请输入有效手机号；不得用脱敏号码建立客户联系' })
  customerMobile!: string;

  @Matches(/^[\u4e00-\u9fffA-Za-z0-9·-]{2,16}$/, { message: '车牌格式无效' })
  plateNumber!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  vehicleModel!: string;
}
