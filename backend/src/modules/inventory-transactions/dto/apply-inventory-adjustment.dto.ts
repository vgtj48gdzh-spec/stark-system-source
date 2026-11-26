import { IsInt, IsString, Matches, Min } from 'class-validator';

export class ApplyInventoryAdjustmentDto {
  @IsInt()
  @Min(1)
  approvalRequestId!: number;

  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._:-]{15,95}$/, {
    message: 'requestIdempotencyKey 必须为 16-96 位安全字符',
  })
  requestIdempotencyKey!: string;
}
