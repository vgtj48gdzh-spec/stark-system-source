import { IsIn, IsOptional } from 'class-validator';
import { QueryAiNextActionsDto } from './query-ai-next-actions.dto';

export class QueryAiConsoleOverviewDto extends QueryAiNextActionsDto {
  @IsOptional()
  @IsIn([
    'global',
    'customer_binding',
    'sheet_repair',
    'performance_confirmation',
    'data_cleanup',
  ])
  scene?:
    | 'global'
    | 'customer_binding'
    | 'sheet_repair'
    | 'performance_confirmation'
    | 'data_cleanup';

  @IsOptional()
  @IsIn(['web_console', 'management_command', 'mobile_assistant', 'finance_review'])
  channel?: 'web_console' | 'management_command' | 'mobile_assistant' | 'finance_review';

  @IsOptional()
  providerKey?: string;
}
