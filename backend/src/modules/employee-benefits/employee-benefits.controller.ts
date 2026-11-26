import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { ConfirmEmployeeBenefitIssueDto } from './dto/confirm-employee-benefit-issue.dto';
import { CreateEmployeeBenefitIssueDto } from './dto/create-employee-benefit-issue.dto';
import { IssueEmployeeBenefitIssueDto } from './dto/issue-employee-benefit-issue.dto';
import { QueryEmployeeBenefitExpiringDto } from './dto/query-employee-benefit-expiring.dto';
import { QueryEmployeeBenefitIssuesDto } from './dto/query-employee-benefit-issues.dto';
import { QueryEmployeeBenefitLedgerDto } from './dto/query-employee-benefit-ledger.dto';
import { QueryEmployeeBenefitNotificationsDto } from './dto/query-employee-benefit-notifications.dto';
import { EmployeeBenefitsService } from './employee-benefits.service';

@Controller('employee-benefits')
export class EmployeeBenefitsController {
  constructor(private readonly employeeBenefitsService: EmployeeBenefitsService) {}

  @Post('issues')
  @Roles('admin')
  async createIssue(
    @Body() dto: CreateEmployeeBenefitIssueDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '员工福利发放单创建成功',
      data: await this.employeeBenefitsService.createIssue(dto, currentUser),
    };
  }

  @Get('issues')
  @Roles('admin', 'finance', 'approver')
  async findIssues(@Query() query: QueryEmployeeBenefitIssuesDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.employeeBenefitsService.findIssues(query),
    };
  }

  @Get('issues/:id')
  @Roles('admin', 'finance', 'approver')
  async findIssueById(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: '查询成功',
      data: await this.employeeBenefitsService.findIssueById(id),
    };
  }

  @Post('issues/:id/confirm')
  @Roles('admin', 'finance')
  async confirmIssue(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmEmployeeBenefitIssueDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '员工福利发放单已确认',
      data: await this.employeeBenefitsService.confirmIssue(id, dto, currentUser),
    };
  }

  @Post('issues/:id/issue')
  @Roles('admin', 'finance')
  async issueBenefit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: IssueEmployeeBenefitIssueDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '员工福利已发放',
      data: await this.employeeBenefitsService.issueBenefit(id, dto, currentUser),
    };
  }

  @Get('accounts/:employeeId/summary')
  @Roles('admin', 'finance', 'approver')
  async getAccountSummary(@Param('employeeId', ParseIntPipe) employeeId: number) {
    return {
      success: true,
      message: '查询成功',
      data: await this.employeeBenefitsService.getAccountSummary(employeeId),
    };
  }

  @Get('accounts/:employeeId/ledger')
  @Roles('admin', 'finance', 'approver')
  async getAccountLedger(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Query() query: QueryEmployeeBenefitLedgerDto,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.employeeBenefitsService.getAccountLedger(employeeId, query),
    };
  }

  @Get('accounts/:employeeId/expiring')
  @Roles('admin', 'finance', 'approver')
  async getAccountExpiring(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Query() query: QueryEmployeeBenefitExpiringDto,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.employeeBenefitsService.getAccountExpiring(employeeId, query),
    };
  }

  @Get('notifications')
  @Roles('admin', 'finance')
  async findNotifications(@Query() query: QueryEmployeeBenefitNotificationsDto) {
    return {
      success: true,
      message: '查询成功',
      data: await this.employeeBenefitsService.findNotifications(query),
    };
  }

  @Post('notifications/:id/read')
  @Roles('admin', 'finance')
  async markNotificationRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '通知已标记为已读',
      data: await this.employeeBenefitsService.markNotificationRead(id, currentUser),
    };
  }

  @Get('ai-context/:employeeId')
  @Roles('admin', 'finance', 'approver')
  async getAiContext(@Param('employeeId', ParseIntPipe) employeeId: number) {
    return {
      success: true,
      message: '查询成功',
      data: await this.employeeBenefitsService.getAiContext(employeeId),
    };
  }
}
