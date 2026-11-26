import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class ToggleRecommendationRuleDto {
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isActive!: boolean;
}
