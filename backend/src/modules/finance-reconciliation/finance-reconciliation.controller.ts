import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { RequireFormalActorIdentity } from '../../common/decorators/require-formal-actor-identity.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { ConfirmCollectionOrderDto } from './dto/confirm-collection-order.dto';
import { CreateReceivableTrackingEvidenceDto } from './dto/create-receivable-tracking-evidence.dto';
import { PaymentCallbackDryRunReceiverDto } from './dto/payment-callback-dry-run-receiver.dto';
import { QueryEvidenceQueueDto } from './dto/query-evidence-queue.dto';
import { FinanceEvidenceQueueService } from './evidence-queue.service';
import { FinanceReconciliationService } from './finance-reconciliation.service';

@Controller('finance/reconciliation')
export class FinanceReconciliationController {
  constructor(
    private readonly financeEvidenceQueueService: FinanceEvidenceQueueService,
    private readonly financeReconciliationService: FinanceReconciliationService,
  ) {}

  @Get('virtual-amount-check')
  @Roles(
    'admin',
    'finance',
    'super_admin',
    'owner',
    'finance_manager',
    'finance_operator',
    'auditor',
  )
  async getVirtualAmountCheck() {
    return {
      success: true,
      message: '铏氭嫙閲戦鏍稿鏁版嵁鏌ヨ鎴愬姛',
      data: await this.financeReconciliationService.getVirtualAmountCheck(),
    };
  }

  @Get('evidence-queue')
  @Roles(
    'admin',
    'finance',
    'super_admin',
    'owner',
    'finance_manager',
    'finance_operator',
    'auditor',
  )
  async getEvidenceQueue(@Query() query: QueryEvidenceQueueDto) {
    return {
      success: true,
      message: 'Finance evidence queue queried successfully.',
      data: await this.financeEvidenceQueueService.findEvidenceQueue(query),
    };
  }

  @Get('unmatched-exceptions')
  @Roles(
    'admin',
    'finance',
    'super_admin',
    'owner',
    'finance_manager',
    'finance_operator',
    'auditor',
  )
  async getUnmatchedExceptions(@Query() query: QueryEvidenceQueueDto) {
    return {
      success: true,
      message: 'Finance unmatched exception pool queried successfully.',
      data: await this.financeEvidenceQueueService.findUnmatchedExceptions({
        ...query,
        type: 'unmatched_exception',
      }),
    };
  }

  @Post('receivable-tracking')
  @Roles('admin', 'finance', 'super_admin', 'owner', 'finance_manager', 'finance_operator')
  async createReceivableTrackingEvidence(@Body() dto: CreateReceivableTrackingEvidenceDto) {
    return {
      success: true,
      message: '搴旀敹璇佹嵁鍐欏叆鎴愬姛',
      data: await this.financeReconciliationService.createReceivableTrackingEvidence(dto),
    };
  }

  @Get('collection-orders/:id/confirmation-preview')
  @Roles(
    'admin',
    'finance',
    'super_admin',
    'owner',
    'finance_manager',
    'finance_operator',
    'auditor',
  )
  async previewCollectionOrderConfirmation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: 'Collection order confirmation preview queried successfully.',
      data: await this.financeReconciliationService.previewCollectionOrderConfirmation(id, currentUser),
    };
  }

  @Post('collection-orders/:id/confirm')
  @Roles('admin', 'finance', 'super_admin', 'owner', 'finance_manager', 'finance_operator')
  @RequireFormalActorIdentity()
  async confirmCollectionOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmCollectionOrderDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: 'Collection order confirmed successfully.',
      data: await this.financeReconciliationService.confirmCollectionOrder(id, dto, currentUser),
    };
  }

  @Post('internal/payment-callbacks/enterprise-wechat/dry-run')
  @Roles('admin', 'finance', 'super_admin', 'owner', 'finance_manager')
  async handleEnterpriseWechatDryRunCallback(
    @Body() dto: PaymentCallbackDryRunReceiverDto,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return {
      success: true,
      message: 'Payment callback dry-run receiver processed.',
      data: await this.financeReconciliationService.handlePaymentCallbackDryRunReceiver(
        dto,
        currentUser,
        { headers },
      ),
    };
  }
}
