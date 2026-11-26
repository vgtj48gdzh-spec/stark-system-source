import { PartialType } from '@nestjs/mapped-types';
import { CreateScriptTemplateDto } from './create-script-template.dto';

export class UpdateScriptTemplateDto extends PartialType(CreateScriptTemplateDto) {}
