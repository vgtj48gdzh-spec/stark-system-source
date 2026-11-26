import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { ConfirmPayrollTrialDto } from './dto/confirm-payroll-trial.dto';
import { GeneratePayrollTrialsDto } from './dto/generate-payroll-trials.dto';
import { QueryPayrollTrialDetailDto } from './dto/query-payroll-trial-detail.dto';
import { QueryPayrollTrialPendingItemsDto } from './dto/query-payroll-trial-pending-items.dto';
import { QueryPayrollTrialsDto } from './dto/query-payroll-trials.dto';
import { PayrollTrialsService } from './payroll-trials.service';

@Controller('payroll-trials')
export class PayrollTrialsController {
  constructor(private readonly payrollTrialsService: PayrollTrialsService) {}

  @Post('generate')
  @Roles('admin')
  async generate(
    @Body() dto: GeneratePayrollTrialsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '工资试算生成完成',
      data: await this.payrollTrialsService.generatePayrollTrials(dto, currentUser),
    };
  }

  @Get('pending-items')
  @Roles('admin', 'finance', 'approver')
  async findPendingItems(
    @Query() query: QueryPayrollTrialPendingItemsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.payrollTrialsService.findPendingItems(query, currentUser),
    };
  }

  @Get()
  @Roles('admin', 'finance', 'approver')
  async findPayrollTrials(
    @Query() query: QueryPayrollTrialsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.payrollTrialsService.findPayrollTrials(query, currentUser),
    };
  }

  @Get(':id/detail')
  @Roles('admin', 'finance', 'approver')
  async findPayrollTrialDetail(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QueryPayrollTrialDetailDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.payrollTrialsService.findPayrollTrialDetail(id, query, currentUser),
    };
  }

  @Get(':id')
  @Roles('admin', 'finance', 'approver')
  async findPayrollTrialById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '查询成功',
      data: await this.payrollTrialsService.findPayrollTrialById(id, currentUser),
    };
  }

  @Post(':id/confirm')
  @Roles('admin', 'finance')
  async confirmPayrollTrial(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmPayrollTrialDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: '工资试算已确认',
      data: await this.payrollTrialsService.confirmPayrollTrial(id, dto, currentUser),
    };
  }
}
