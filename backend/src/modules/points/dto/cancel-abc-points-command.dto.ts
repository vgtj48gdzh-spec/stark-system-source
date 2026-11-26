import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelAbcPointsCommandDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
