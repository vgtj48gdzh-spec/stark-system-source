import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class ToggleRewardEventRuleDto {
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isActive!: boolean;
}
