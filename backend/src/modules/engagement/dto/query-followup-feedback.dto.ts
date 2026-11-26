import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryFollowupFeedbackDto extends PaginationSortQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  scriptExperimentId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  scriptTemplateId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  subjectType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  subjectId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  feedbackStatus?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === '' ? undefined : value === true || value === 'true',
  )
  @IsBoolean()
  convertedFlag?: boolean;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === '' ? undefined : value === true || value === 'true',
  )
  @IsBoolean()
  followedUpFlag?: boolean;

  @IsOptional()
  @IsIn([
    'scriptExperimentId',
    'scriptTemplateId',
    'subjectType',
    'subjectId',
    'feedbackStatus',
    'followupAt',
    'createdAt',
    'updatedAt',
  ])
  sortBy?:
    | 'scriptExperimentId'
    | 'scriptTemplateId'
    | 'subjectType'
    | 'subjectId'
    | 'feedbackStatus'
    | 'followupAt'
    | 'createdAt'
    | 'updatedAt';
}
