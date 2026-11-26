import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryPlatformConnectorConfigsDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;

  @IsOptional()
  @IsIn(['platform', 'connectorCode', 'connectorType', 'status', 'lastSyncedAt', 'updatedAt'])
  sortBy?: 'platform' | 'connectorCode' | 'connectorType' | 'status' | 'lastSyncedAt' | 'updatedAt';
}
