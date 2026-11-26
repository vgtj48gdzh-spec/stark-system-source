import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class ToggleScriptTemplateDto {
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isActive!: boolean;
}
