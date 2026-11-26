import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteMobileDeviceCommandDto {
  @IsIn(['completed', 'failed'])
  status!: 'completed' | 'failed';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsObject()
  responsePayload?: Record<string, unknown>;
}
