import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsOptional, Matches } from 'class-validator';

function toOptionalBoolean(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === true || value === 'true' || value === 1 || value === '1') {
    return true;
  }
  if (value === false || value === 'false' || value === 0 || value === '0') {
    return false;
  }
  return value;
}

export class QueryAiNextActionsDto {
  @IsOptional()
  @IsIn(['founder', 'finance', 'admin', 'approver', 'operator', 'store_manager', 'customer_service'])
  role?:
    | 'founder'
    | 'finance'
    | 'admin'
    | 'approver'
    | 'operator'
    | 'store_manager'
    | 'customer_service';

  @IsOptional()
  @IsIn(['must_handle_today', 'should_handle_this_week', 'can_defer'])
  dueLevel?: 'must_handle_today' | 'should_handle_this_week' | 'can_defer';

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  onlyBlocking?: boolean;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  includeDone?: boolean;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  includeDeferred?: boolean;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  backlogOnly?: boolean;

  @IsOptional()
  @IsIn([
    'this_week',
    'last_week',
    'this_month',
    'last_month',
    'future',
    'backlog_history',
    'custom_range',
  ])
  timeBucket?:
    | 'this_week'
    | 'last_week'
    | 'this_month'
    | 'last_month'
    | 'future'
    | 'backlog_history'
    | 'custom_range';

  @IsOptional()
  @IsIn(['week', 'month'])
  periodMode?: 'week' | 'month';

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  periodKey?: string;
}
