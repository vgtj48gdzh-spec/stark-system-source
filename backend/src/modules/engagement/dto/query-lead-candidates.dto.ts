import { IsBooleanString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryLeadCandidatesDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  candidateType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  evidenceStatus?: string;

  @IsOptional()
  @IsBooleanString()
  hasMerchant?: string;

  @IsOptional()
  @IsBooleanString()
  hasEmployee?: string;

  @IsOptional()
  @IsIn(['platform', 'candidateType', 'status', 'evidenceStatus', 'confidenceScore', 'createdAt', 'updatedAt'])
  sortBy?:
    | 'platform'
    | 'candidateType'
    | 'status'
    | 'evidenceStatus'
    | 'confidenceScore'
    | 'createdAt'
    | 'updatedAt';
}
