import { PartialType } from '@nestjs/mapped-types';
import { CreatePerformanceRuleDto } from './create-performance-rule.dto';

export class UpdatePerformanceRuleDto extends PartialType(CreatePerformanceRuleDto) {}
