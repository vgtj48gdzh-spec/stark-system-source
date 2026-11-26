import { PartialType } from '@nestjs/mapped-types';
import { CreateRecommendationRuleDto } from './create-recommendation-rule.dto';

export class UpdateRecommendationRuleDto extends PartialType(CreateRecommendationRuleDto) {}
