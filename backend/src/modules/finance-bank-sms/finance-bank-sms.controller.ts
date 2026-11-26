import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { ConfirmApplyBankSmsTransactionDto } from './dto/confirm-apply-bank-sms-transaction.dto';
import { IgnoreBankSmsTransactionDto } from './dto/ignore-bank-sms-transaction.dto';
import { QueryPendingBankSmsLedgerDto } from './dto/query-pending-bank-sms-ledger.dto';
import { QueryBankSmsTransactionsDto } from './dto/query-bank-sms-transactions.dto';
import { ReconcileBankSmsTransactionDto } from './dto/reconcile-bank-sms-transaction.dto';
import { FinanceBankSmsService } from './finance-bank-sms.service';

function toPagedResult<T>(result: {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}) {
  return {
    list: result.list,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  };
}

@Controller('finance/bank-sms')
export class FinanceBankSmsController {
  constructor(private readonly financeBankSmsService: FinanceBankSmsService) {}

  @Get('overview')
  @Roles(
    'admin',
    'finance',
    'super_admin',
    'owner',
    'finance_manager',
    'finance_operator',
    'auditor',
  )
  async getOverview(@CurrentUserDecorator() currentUser: CurrentUser) {
    return {
      success: true,
      data: await this.financeBankSmsService.getOverview(currentUser),
      message: 'Bank SMS overview retrieved successfully.',
    };
  }

  @Get('pending')
  @Roles(
    'admin',
    'finance',
    'super_admin',
    'owner',
    'finance_manager',
    'finance_operator',
    'auditor',
  )
  async findPendingLedger(
    @Query() query: QueryPendingBankSmsLedgerDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      data: await this.financeBankSmsService.findPendingLedger(query, currentUser),
      message: 'Pending bank SMS ledger retrieved successfully.',
    };
  }

  @Get('transactions')
  @Roles(
    'admin',
    'finance',
    'super_admin',
    'owner',
    'finance_manager',
    'finance_operator',
    'auditor',
  )
  async findAll(
    @Query() query: QueryBankSmsTransactionsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      data: toPagedResult(await this.financeBankSmsService.findAll(query, currentUser)),
      message: 'Bank SMS transactions retrieved successfully.',
    };
  }

  @Get('transactions/:id')
  @Roles(
    'admin',
    'finance',
    'super_admin',
    'owner',
    'finance_manager',
    'finance_operator',
    'auditor',
  )
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      data: await this.financeBankSmsService.findOne(id, currentUser),
      message: 'Bank SMS transaction retrieved successfully.',
    };
  }

  @Post('transactions/:id/reconcile')
  @Roles('admin', 'finance', 'super_admin', 'owner', 'finance_manager', 'finance_operator')
  async reconcile(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReconcileBankSmsTransactionDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      data: await this.financeBankSmsService.reconcile(id, dto, currentUser),
      message: 'Bank SMS suggestion generated successfully.',
    };
  }

  @Post('transactions/:id/confirm-apply')
  @Roles('admin', 'finance', 'super_admin', 'owner', 'finance_manager', 'finance_operator')
  async confirmApply(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmApplyBankSmsTransactionDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      data: await this.financeBankSmsService.confirmApply(id, dto, currentUser),
      message: 'Bank SMS applied successfully.',
    };
  }

  @Post('transactions/:id/ignore')
  @Roles('admin', 'finance', 'super_admin', 'owner', 'finance_manager', 'finance_operator')
  async ignore(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: IgnoreBankSmsTransactionDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      data: await this.financeBankSmsService.ignore(id, dto, currentUser),
      message: 'Bank SMS ignored successfully.',
    };
  }
}
