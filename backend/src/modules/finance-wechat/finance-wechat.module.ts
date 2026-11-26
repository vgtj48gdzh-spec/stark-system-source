import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankAccountRegistry } from '../finance-bank-account/entities/bank-account-registry.entity';
import { BankSmsTransaction } from '../finance-bank-sms/entities/bank-sms-transaction.entity';
import { FinanceSafetyModule } from '../finance-safety/finance-safety.module';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { FinanceWechatController } from './finance-wechat.controller';
import { FinanceWechatService } from './finance-wechat.service';
import { WechatMerchantRegistry } from './entities/wechat-merchant-registry.entity';
import { WechatPaymentReceipt } from './entities/wechat-payment-receipt.entity';
import { WechatSettlementBatch } from './entities/wechat-settlement-batch.entity';
import { WechatSettlementReceiptLink } from './entities/wechat-settlement-receipt-link.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WechatMerchantRegistry,
      WechatPaymentReceipt,
      WechatSettlementBatch,
      WechatSettlementReceiptLink,
      WorkOrder,
      BankAccountRegistry,
      BankSmsTransaction,
    ]),
    OperationLogsModule,
    FinanceSafetyModule,
  ],
  controllers: [FinanceWechatController],
  providers: [FinanceWechatService],
  exports: [FinanceWechatService],
})
export class FinanceWechatModule {}
