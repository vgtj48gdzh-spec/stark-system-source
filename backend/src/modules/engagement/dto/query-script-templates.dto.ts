import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryScriptTemplatesDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  templateGroup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  recommendationType?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === '' ? undefined : value === true || value === 'true',
  )
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(['templateCode', 'templateName', 'templateGroup', 'recommendationType', 'isActive', 'updatedAt', 'createdAt'])
  sortBy?:
    | 'templateCode'
    | 'templateName'
    | 'templateGroup'
    | 'recommendationType'
    | 'isActive'
    | 'updatedAt'
    | 'createdAt';
}
