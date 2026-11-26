import { Controller, Get, Header, Query } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { BusinessReportsService } from './business-reports.service';
import { QueryInventoryAlertsDto } from './dto/query-inventory-alerts.dto';
import { QuerySupplierMaterialUsageDto } from './dto/query-supplier-material-usage.dto';
import { QueryUnboundOverduePreparationsDto } from './dto/query-unbound-overdue-preparations.dto';
import { QueryWorkOrderMaterialCostsDto } from './dto/query-work-order-material-costs.dto';
import { OwnerCommandCenterSummaryService } from './owner-command-center-summary.service';

@Controller('reports')
export class BusinessReportsController {
  constructor(
    private readonly businessReportsService: BusinessReportsService,
    private readonly ownerCommandCenterSummaryService: OwnerCommandCenterSummaryService,
  ) {}

  @Get('owner-command-center-summary')
  @Header('Cache-Control', 'no-store')
  @Roles('owner', 'admin', 'super_admin')
  async getOwnerCommandCenterSummary(
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '老板驾驶舱只读安全汇总查询成功',
      data: await this.ownerCommandCenterSummaryService.getSummary(currentUser),
    };
  }

  @Get('work-order-material-costs')
  @Roles('finance')
  async getWorkOrderMaterialCosts(@Query() query: QueryWorkOrderMaterialCostsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.businessReportsService.getWorkOrderMaterialCosts(query),
    };
  }

  @Get('inventory-alerts')
  @Roles('finance')
  async getInventoryAlerts(@Query() query: QueryInventoryAlertsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.businessReportsService.getInventoryAlerts(query),
    };
  }

  @Get('material-preparations/unbound-overdue')
  @Roles('finance', 'approver')
  async getUnboundOverduePreparations(@Query() query: QueryUnboundOverduePreparationsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.businessReportsService.getUnboundOverduePreparations(query),
    };
  }

  @Get('supplier-material-usage')
  @Roles('finance')
  async getSupplierMaterialUsage(@Query() query: QuerySupplierMaterialUsageDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.businessReportsService.getSupplierMaterialUsage(query),
    };
  }
}
