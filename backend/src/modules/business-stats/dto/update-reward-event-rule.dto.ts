import { PartialType } from '@nestjs/mapped-types';
import { CreateRewardEventRuleDto } from './create-reward-event-rule.dto';

export class UpdateRewardEventRuleDto extends PartialType(CreateRewardEventRuleDto) {}
