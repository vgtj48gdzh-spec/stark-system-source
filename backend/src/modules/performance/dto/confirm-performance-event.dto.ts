import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class ConfirmPerformanceEventDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  employeeId?: number;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  remark?: string;
}
