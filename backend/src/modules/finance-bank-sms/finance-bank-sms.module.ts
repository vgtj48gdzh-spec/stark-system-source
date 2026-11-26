import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalRequest } from '../approval-requests/entities/approval-request.entity';
import { BusinessFoundationModule } from '../business-foundation/business-foundation.module';
import { FinanceBankAccountModule } from '../finance-bank-account/finance-bank-account.module';
import { FinanceInternalFundFlowModule } from '../finance-internal-fund-flow/finance-internal-fund-flow.module';
import { FinanceWechatModule } from '../finance-wechat/finance-wechat.module';
import { FinanceReconciliationModule } from '../finance-reconciliation/finance-reconciliation.module';
import { FinanceReconciliationLink } from '../finance-reconciliation/entities/finance-reconciliation-link.entity';
import { FinanceSafetyModule } from '../finance-safety/finance-safety.module';
import { BankAccountRegistry } from '../finance-bank-account/entities/bank-account-registry.entity';
import { SmsMessageClassification } from '../message-hub/entities/sms-message-classification.entity';
import { SmsMessageRaw } from '../message-hub/entities/sms-message-raw.entity';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { FinanceBankSmsController } from './finance-bank-sms.controller';
import { FinanceBankSmsService } from './finance-bank-sms.service';
import { BankSmsTransaction } from './entities/bank-sms-transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SmsMessageRaw,
      SmsMessageClassification,
      BankSmsTransaction,
      BankAccountRegistry,
      FinanceReconciliationLink,
      WorkOrder,
      ApprovalRequest,
    ]),
    OperationLogsModule,
    BusinessFoundationModule,
    FinanceReconciliationModule,
    FinanceSafetyModule,
    FinanceBankAccountModule,
    FinanceInternalFundFlowModule,
    FinanceWechatModule,
  ],
  controllers: [FinanceBankSmsController],
  providers: [FinanceBankSmsService],
  exports: [FinanceBankSmsService],
})
export class FinanceBankSmsModule {}
