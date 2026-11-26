import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ConfirmExecutionTaskItemDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  scriptTemplateId?: number;
}
