import { IsDateString, IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RawImportSmsMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sender!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body!: string;

  @IsDateString()
  receivedAt!: string;

  @IsIn(['manual_import'])
  source!: 'manual_import';
}
