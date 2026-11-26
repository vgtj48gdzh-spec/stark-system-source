import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ExecuteAbcPointsCommandDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
