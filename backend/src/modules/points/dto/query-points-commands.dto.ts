import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryPointsCommandsDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsIn(['commandType', 'commandStatus', 'requestedAt', 'createdAt', 'updatedAt', 'changeAmount'])
  sortBy?: 'commandType' | 'commandStatus' | 'requestedAt' | 'createdAt' | 'updatedAt' | 'changeAmount';

  @IsOptional()
  @IsString()
  @Length(1, 32)
  commandStatus?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  commandType?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  sourceType?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  requestSource?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  ownerType?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  ownerMobile?: string;
}
