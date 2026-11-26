import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SkipExecutionTaskItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  skipReason?: string;
}
