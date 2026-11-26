import { IsArray, IsEnum, IsOptional } from 'class-validator';
import { PerformanceEventSourceDomain } from '../../../shared/enums/performance-event-source-domain.enum';

export class GeneratePerformanceEventsDto {
  @IsOptional()
  @IsArray()
  @IsEnum(PerformanceEventSourceDomain, { each: true })
  sourceDomains?: PerformanceEventSourceDomain[];
}
