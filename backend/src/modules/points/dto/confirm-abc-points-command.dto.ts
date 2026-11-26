import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmAbcPointsCommandDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reasonCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
