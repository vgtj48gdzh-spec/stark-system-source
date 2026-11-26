import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ReassignRewardEventDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  responsibleEmployeeId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
