import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessFoundationModule } from '../business-foundation/business-foundation.module';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { BankAccountRegistry } from '../finance-bank-account/entities/bank-account-registry.entity';
import { BankSmsTransaction } from '../finance-bank-sms/entities/bank-sms-transaction.entity';
import { FinanceSafetyModule } from '../finance-safety/finance-safety.module';
import { WechatPaymentReceipt } from '../finance-wechat/entities/wechat-payment-receipt.entity';
import { WechatSettlementBatch } from '../finance-wechat/entities/wechat-settlement-batch.entity';
import { SmsMessageClassification } from '../message-hub/entities/sms-message-classification.entity';
import { SequenceModule } from '../sequence/sequence.module';
import { TemporaryServiceOrder } from '../work-orders/entities/temporary-service-order.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { FinanceCollectionOrder } from './entities/finance-collection-order.entity';
import { FinanceCollectionConfirmationAuthority } from './entities/finance-collection-confirmation-authority.entity';
import { FinancePaymentRequest } from './entities/finance-payment-request.entity';
import { FinanceReceivableTracking } from './entities/finance-receivable-tracking.entity';
import { FinanceReconciliationLink } from './entities/finance-reconciliation-link.entity';
import { WechatPayCallbackEvidence } from './entities/wechat-pay-callback-evidence.entity';
import { WechatPayCryptoVerificationAudit } from './entities/wechat-pay-crypto-verification-audit.entity';
import { WechatPayManualReviewTask } from './entities/wechat-pay-manual-review-task.entity';
import { WechatPaySettlementEvidence } from './entities/wechat-pay-settlement-evidence.entity';
import { FinanceEvidenceQueueService } from './evidence-queue.service';
import { FinanceReconciliationController } from './finance-reconciliation.controller';
import { FinanceReconciliationService } from './finance-reconciliation.service';
import { EnterpriseWechatMockPaymentAdapter } from './payment-adapters/enterprise-wechat-mock-payment.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BankAccountRegistry,
      BankSmsTransaction,
      FinanceCollectionOrder,
      FinanceCollectionConfirmationAuthority,
      FinancePaymentRequest,
      FinanceReconciliationLink,
      FinanceReceivableTracking,
      SmsMessageClassification,
      TemporaryServiceOrder,
      WechatPaymentReceipt,
      WechatPayCallbackEvidence,
      WechatPayCryptoVerificationAudit,
      WechatPayManualReviewTask,
      WechatPaySettlementEvidence,
      WechatSettlementBatch,
      WorkOrder,
    ]),
    SequenceModule,
    FinanceSafetyModule,
    OperationLogsModule,
    BusinessFoundationModule,
  ],
  controllers: [FinanceReconciliationController],
  providers: [EnterpriseWechatMockPaymentAdapter, FinanceEvidenceQueueService, FinanceReconciliationService],
  exports: [FinanceEvidenceQueueService, FinanceReconciliationService],
})
export class FinanceReconciliationModule {}
