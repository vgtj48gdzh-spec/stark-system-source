import { IsArray, IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { PerformanceEventSourceDomain } from '../../../shared/enums/performance-event-source-domain.enum';

export class GeneratePerformanceSummariesDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  periodKey?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(PerformanceEventSourceDomain, { each: true })
  sourceDomains?: PerformanceEventSourceDomain[];
}
