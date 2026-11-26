import { IsOptional, IsString, Length } from 'class-validator';

export class ConfirmPointsCommandDto {
  @IsOptional()
  @IsString()
  @Length(1, 500)
  remark?: string;
}
