import { IsBoolean } from 'class-validator';

export class ToggleAbcRuleDto {
  @IsBoolean()
  isActive!: boolean;
}
