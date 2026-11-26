import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmExecutionTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
