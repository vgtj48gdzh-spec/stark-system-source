import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CloseExecutionTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
