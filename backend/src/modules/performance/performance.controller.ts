import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { ConfirmPerformanceEventDto } from './dto/confirm-performance-event.dto';
import { ConfirmPerformanceSummaryCustomerBindingDto } from './dto/confirm-performance-summary-customer-binding.dto';
import { DecidePerformanceSummaryManualDecisionDto } from './dto/decide-performance-summary-manual-decision.dto';
import { CreateEmployeeSourceBindingDto } from './dto/create-employee-source-binding.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { CreatePerformanceRuleDto } from './dto/create-performance-rule.dto';
import { GeneratePerformanceEventsDto } from './dto/generate-performance-events.dto';
import { GeneratePerformanceSummariesDto } from './dto/generate-performance-summaries.dto';
import { IgnorePerformanceEventDto } from './dto/ignore-performance-event.dto';
import { QueryEmployeeSourceBindingsDto } from './dto/query-employee-source-bindings.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { QueryPendingPerformanceItemsDto } from './dto/query-pending-performance-items.dto';
import { QueryPerformanceEventsDto } from './dto/query-performance-events.dto';
import { QueryPerformanceRulesDto } from './dto/query-performance-rules.dto';
import { QueryPerformanceSummariesDto } from './dto/query-performance-summaries.dto';
import { QueryPerformanceSummaryDetailDto } from './dto/query-performance-summary-detail.dto';
import { RebindPerformanceEventDto } from './dto/rebind-performance-event.dto';
import { UpdateEmployeeSourceBindingDto } from './dto/update-employee-source-binding.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdatePerformanceRuleDto } from './dto/update-performance-rule.dto';
import { PerformanceService } from './performance.service';

@Controller('performance')
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get('employees')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async findEmployees(@Query() query: QueryEmployeesDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.performanceService.findEmployees(query),
    };
  }

  @Post('employees')
  @Roles('admin')
  async createEmployee(
    @Body() dto: CreateEmployeeDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '员工创建成功',
      data: await this.performanceService.createEmployee(dto, currentUser),
    };
  }

  @Patch('employees/:id')
  @Roles('admin')
  async updateEmployee(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '员工更新成功',
      data: await this.performanceService.updateEmployee(id, dto, currentUser),
    };
  }

  @Get('employee-source-bindings')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async findBindings(@Query() query: QueryEmployeeSourceBindingsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.performanceService.findEmployeeSourceBindings(query),
    };
  }

  @Post('employee-source-bindings')
  @Roles('admin')
  async createBinding(
    @Body() dto: CreateEmployeeSourceBindingDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '绑定创建成功',
      data: await this.performanceService.createEmployeeSourceBinding(dto, currentUser),
    };
  }

  @Patch('employee-source-bindings/:id')
  @Roles('admin')
  async updateBinding(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeSourceBindingDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '绑定更新成功',
      data: await this.performanceService.updateEmployeeSourceBinding(id, dto, currentUser),
    };
  }

  @Get('rules')
  @Roles('admin', 'finance')
  async findRules(@Query() query: QueryPerformanceRulesDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.performanceService.findPerformanceRules(query),
    };
  }

  @Post('rules')
  @Roles('admin')
  async createRule(
    @Body() dto: CreatePerformanceRuleDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '绩效规则创建成功',
      data: await this.performanceService.createPerformanceRule(dto, currentUser),
    };
  }

  @Patch('rules/:id')
  @Roles('admin')
  async updateRule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePerformanceRuleDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '绩效规则更新成功',
      data: await this.performanceService.updatePerformanceRule(id, dto, currentUser),
    };
  }

  @Post('events/generate')
  @Roles('admin')
  async generateEvents(
    @Body() dto: GeneratePerformanceEventsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '绩效事件生成完成',
      data: await this.performanceService.generatePerformanceEvents(dto, currentUser),
    };
  }

  @Get('events')
  @Roles('admin', 'finance', 'approver', 'operator', 'founder', 'super_admin', 'owner')
  async findEvents(
    @Query() query: QueryPerformanceEventsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.performanceService.findPerformanceEvents(query, currentUser),
    };
  }

  @Post('summaries/generate')
  @Roles('admin')
  async generateSummaries(
    @Body() dto: GeneratePerformanceSummariesDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '绩效汇总生成完成',
      data: await this.performanceService.generatePerformanceSummaries(dto, currentUser),
    };
  }

  @Get('summaries')
  @Roles('admin', 'finance', 'approver', 'founder', 'super_admin', 'owner')
  async findSummaries(
    @Query() query: QueryPerformanceSummariesDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.performanceService.findPerformanceSummaries(query, currentUser),
    };
  }

  @Get('summaries/:id/detail')
  @Roles('admin', 'finance', 'approver', 'founder', 'super_admin', 'owner')
  async findSummaryDetail(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QueryPerformanceSummaryDetailDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ): Promise<any> {
    return {
      success: true,
      message: '查询成功',
      data: await this.performanceService.findPerformanceSummaryDetail(id, query, currentUser),
    };
  }

  @Post('summaries/:id/confirm-customer-binding')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async confirmSummaryCustomerBinding(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmPerformanceSummaryCustomerBindingDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ): Promise<any> {
    return {
      success: true,
      message: '月度汇总客户绑定确认成功',
      data: await this.performanceService.confirmPerformanceSummaryCustomerBinding(
        id,
        dto,
        currentUser,
      ),
    };
  }

  @Post('summaries/:id/manual-decision')
  @Roles('admin', 'finance', 'founder', 'super_admin', 'owner')
  async decideSummaryManualDecision(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecidePerformanceSummaryManualDecisionDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ): Promise<any> {
    return {
      success: true,
      message: '绩效汇总人工裁决已记录',
      data: await this.performanceService.decidePerformanceSummaryManualDecision(
        id,
        dto,
        currentUser,
      ),
    };
  }

  @Get('pending-items')
  @Roles('finance', 'approver')
  async findPendingItems(
    @Query() query: QueryPendingPerformanceItemsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.performanceService.findPendingPerformanceItems(query, currentUser),
    };
  }

  @Post('pending-items/:id/rebind')
  @Roles('admin', 'finance')
  async rebindPendingItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RebindPerformanceEventDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '待确认事件重新绑定成功',
      data: await this.performanceService.rebindPendingPerformanceItem(id, dto, currentUser),
    };
  }

  @Post('pending-items/:id/confirm')
  @Roles('admin', 'finance')
  async confirmPendingItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmPerformanceEventDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '待确认事件手工确认成功',
      data: await this.performanceService.confirmPendingPerformanceItem(id, dto, currentUser),
    };
  }

  @Post('pending-items/:id/ignore')
  @Roles('admin', 'finance')
  async ignorePendingItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: IgnorePerformanceEventDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '待确认事件已标记忽略',
      data: await this.performanceService.ignorePendingPerformanceItem(id, dto, currentUser),
    };
  }
}
