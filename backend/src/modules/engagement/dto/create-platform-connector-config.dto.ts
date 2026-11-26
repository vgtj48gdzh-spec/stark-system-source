import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePlatformConnectorConfigDto {
  @IsString()
  @MaxLength(50)
  platform!: string;

  @IsString()
  @MaxLength(100)
  accountId!: string;

  @IsString()
  @MaxLength(100)
  connectorCode!: string;

  @IsString()
  @MaxLength(100)
  connectorName!: string;

  @IsString()
  @MaxLength(30)
  connectorType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  authMode?: string;

  @IsOptional()
  @IsObject()
  configJson?: Record<string, unknown>;

  @IsString()
  @MaxLength(20)
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
