import { IsIn, IsOptional } from 'class-validator';

export class QueryAiSummaryContextDto {
  @IsOptional()
  @IsIn(['performance', 'business_stats'])
  summaryType?: 'performance' | 'business_stats';
}
