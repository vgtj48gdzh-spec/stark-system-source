import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeactivateMemoryEntryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
