import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

/**
 * Formal review authority payload. The reviewer is ALWAYS derived from
 * CurrentUser.id — never from the request body — so an ordinary edit path
 * cannot self-report "reviewed".
 */
export class ReviewBankAccountRegistryDto {
  @IsIn(['approved', 'rejected'])
  decision!: 'approved' | 'rejected';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedContentVersion!: number;

  @IsString()
  @Matches(/^[0-9a-f]{64}$/)
  expectedContentSnapshotHash!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
