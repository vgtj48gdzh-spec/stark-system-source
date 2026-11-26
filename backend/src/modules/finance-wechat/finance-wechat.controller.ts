import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { CreateWechatSettlementBatchDto } from './dto/create-wechat-settlement-batch.dto';
import { ImportWechatPaymentReceiptDto } from './dto/import-wechat-payment-receipt.dto';
import { QueryWechatMerchantRegistryDto } from './dto/query-wechat-merchant-registry.dto';
import { QueryWechatPaymentReceiptsDto } from './dto/query-wechat-payment-receipts.dto';
import { QueryWechatSettlementBatchesDto } from './dto/query-wechat-settlement-batches.dto';
import { SaveWechatMerchantRegistryDto } from './dto/save-wechat-merchant-registry.dto';
import { FinanceWechatService } from './finance-wechat.service';

@Controller('finance/wechat')
export class FinanceWechatController {
  constructor(private readonly financeWechatService: FinanceWechatService) {}

  @Get('merchants')
  @Roles(
    'admin',
    'finance',
    'super_admin',
    'owner',
    'finance_manager',
    'finance_operator',
    'auditor',
  )
  async findMerchants(
    @Query() query: QueryWechatMerchantRegistryDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      data: await this.financeWechatService.findMerchants(query, currentUser),
      message: 'WeChat merchants retrieved successfully.',
    };
  }

  @Post('merchants')
  @Roles('admin', 'finance', 'super_admin', 'owner', 'finance_manager', 'finance_operator')
  async createMerchant(
    @Body() dto: SaveWechatMerchantRegistryDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      data: await this.financeWechatService.createMerchant(dto, currentUser),
      message: 'WeChat merchant saved successfully.',
    };
  }

  @Get('receipts')
  @Roles(
    'admin',
    'finance',
    'super_admin',
    'owner',
    'finance_manager',
    'finance_operator',
    'auditor',
  )
  async findPaymentReceipts(
    @Query() query: QueryWechatPaymentReceiptsDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      data: await this.financeWechatService.findPaymentReceipts(query, currentUser),
      message: 'WeChat payment receipts retrieved successfully.',
    };
  }

  @Get('receipts/:id')
  @Roles(
    'admin',
    'finance',
    'super_admin',
    'owner',
    'finance_manager',
    'finance_operator',
    'auditor',
  )
  async findPaymentReceipt(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      data: await this.financeWechatService.findPaymentReceipt(id, currentUser),
      message: 'WeChat payment receipt retrieved successfully.',
    };
  }

  @Post('receipts/manual-import')
  @Roles('admin', 'finance', 'super_admin', 'owner', 'finance_manager', 'finance_operator')
  async importPaymentReceipt(
    @Body() dto: ImportWechatPaymentReceiptDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      data: await this.financeWechatService.importPaymentReceipt(dto, currentUser),
      message: 'WeChat payment receipt imported successfully.',
    };
  }

  @Get('settlement-batches')
  @Roles(
    'admin',
    'finance',
    'super_admin',
    'owner',
    'finance_manager',
    'finance_operator',
    'auditor',
  )
  async findSettlementBatches(
    @Query() query: QueryWechatSettlementBatchesDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      data: await this.financeWechatService.findSettlementBatches(query, currentUser),
      message: 'WeChat settlement batches retrieved successfully.',
    };
  }

  @Get('settlement-batches/:id')
  @Roles(
    'admin',
    'finance',
    'super_admin',
    'owner',
    'finance_manager',
    'finance_operator',
    'auditor',
  )
  async findSettlementBatch(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      data: await this.financeWechatService.findSettlementBatch(id, currentUser),
      message: 'WeChat settlement batch retrieved successfully.',
    };
  }

  @Post('settlement-batches')
  @Roles('admin', 'finance', 'super_admin', 'owner', 'finance_manager', 'finance_operator')
  async createSettlementBatch(
    @Body() dto: CreateWechatSettlementBatchDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      data: await this.financeWechatService.createSettlementBatch(dto, currentUser),
      message: 'WeChat settlement batch created successfully.',
    };
  }
}
