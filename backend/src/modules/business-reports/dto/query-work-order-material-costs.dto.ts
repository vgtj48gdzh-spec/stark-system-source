import { IsDateString, IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { WorkOrderStatus } from '../../../shared/enums/work-order-status.enum';
import { ReportPaginationDto } from './report-pagination.dto';

export class QueryWorkOrderMaterialCostsDto extends ReportPaginationDto {
  @IsOptional()
  @IsIn([
    'workOrderNo',
    'title',
    'customerName',
    'status',
    'amountDue',
    'amountReceived',
    'materialCostTotal',
    'materialLineCount',
    'createdAt',
    'updatedAt',
  ])
  sortBy?:
    | 'workOrderNo'
    | 'title'
    | 'customerName'
    | 'status'
    | 'amountDue'
    | 'amountReceived'
    | 'materialCostTotal'
    | 'materialLineCount'
    | 'createdAt'
    | 'updatedAt';

  @IsOptional()
  @IsString()
  @MaxLength(30)
  workOrderNo?: string;

  @IsOptional()
  @IsEnum(WorkOrderStatus)
  status?: WorkOrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerName?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
