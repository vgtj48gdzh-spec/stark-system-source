import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './config/database.config';
import { AbcIntegrationModule } from './modules/abc-integration/abc-integration.module';
import { AbcRawCard } from './modules/abc-raw/entities/abc-raw-card.entity';
import { AbcRawInventory } from './modules/abc-raw/entities/abc-raw-inventory.entity';
import { AbcRawOrder } from './modules/abc-raw/entities/abc-raw-order.entity';
import { AbcRawTransaction } from './modules/abc-raw/entities/abc-raw-transaction.entity';
import { AbcSyncModule } from './modules/abc-sync/abc-sync.module';
import { AbcAmountRule } from './modules/abc-sync/entities/abc-amount-rule.entity';
import { AbcSyncCardLedger } from './modules/abc-sync/entities/abc-sync-card-ledger.entity';
import { AbcSyncCard } from './modules/abc-sync/entities/abc-sync-card.entity';
import { AbcSyncInventoryLedger } from './modules/abc-sync/entities/abc-sync-inventory-ledger.entity';
import { AbcSyncMaterial } from './modules/abc-sync/entities/abc-sync-material.entity';
import { AbcStatusMapping } from './modules/abc-sync/entities/abc-status-mapping.entity';
import { AbcSyncFund } from './modules/abc-sync/entities/abc-sync-fund.entity';
import { AbcSyncOrder } from './modules/abc-sync/entities/abc-sync-order.entity';
import { AbcSyncSupplier } from './modules/abc-sync/entities/abc-sync-supplier.entity';
import { AbcSyncWarehouse } from './modules/abc-sync/entities/abc-sync-warehouse.entity';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { ApprovalLog } from './modules/approval-requests/entities/approval-log.entity';
import { ApprovalPaymentIntent } from './modules/approval-requests/entities/approval-payment-intent.entity';
import { ApprovalRequestDraft } from './modules/approval-requests/entities/approval-request-draft.entity';
import { ApprovalRequest } from './modules/approval-requests/entities/approval-request.entity';
import { ApprovalRequestsModule } from './modules/approval-requests/approval-requests.module';
import { AiModule } from './modules/ai/ai.module';
import { AI_RUNTIME_ENTITIES } from './modules/ai/ai-runtime-entities';
import { OperationLogsModule } from './modules/operation-logs/operation-logs.module';
import { OperationLog } from './modules/operation-logs/entities/operation-log.entity';
import { InventoryTransactionsModule } from './modules/inventory-transactions/inventory-transactions.module';
import { InventoryTransaction } from './modules/inventory-transactions/entities/inventory-transaction.entity';
import { BusinessReportsModule } from './modules/business-reports/business-reports.module';
import { BusinessStatsModule } from './modules/business-stats/business-stats.module';
import { EngagementModule } from './modules/engagement/engagement.module';
import { EmployeeBenefitsModule } from './modules/employee-benefits/employee-benefits.module';
import { MaterialPreparationsModule } from './modules/material-preparations/material-preparations.module';
import { MaterialPreparation } from './modules/material-preparations/entities/material-preparation.entity';
import { MaterialsModule } from './modules/materials/materials.module';
import { Material } from './modules/materials/entities/material.entity';
import { MaterialStocksModule } from './modules/material-stocks/material-stocks.module';
import { MaterialStock } from './modules/material-stocks/entities/material-stock.entity';
import { PaymentRecordsModule } from './modules/payment-records/payment-records.module';
import { PaymentRecord } from './modules/payment-records/entities/payment-record.entity';
import { MobileBridgeModule } from './modules/mobile-bridge/mobile-bridge.module';
import { MobileSmsEvent } from './modules/mobile-bridge/entities/mobile-sms-event.entity';
import { MessageHubModule } from './modules/message-hub/message-hub.module';
import { SmsMessageRaw } from './modules/message-hub/entities/sms-message-raw.entity';
import { SmsMessageClassification } from './modules/message-hub/entities/sms-message-classification.entity';
import { VerificationForwardModule } from './modules/verification-forward/verification-forward.module';
import { VerificationCodeDispatchLog } from './modules/verification-forward/entities/verification-code-dispatch-log.entity';
import { FinanceBankAccountModule } from './modules/finance-bank-account/finance-bank-account.module';
import { BankAccountRegistry } from './modules/finance-bank-account/entities/bank-account-registry.entity';
import { BankAccountRegistryReviewAuthority } from './modules/finance-bank-account/entities/bank-account-registry-review-authority.entity';
import { FinanceBankSmsModule } from './modules/finance-bank-sms/finance-bank-sms.module';
import { MobileSmsRaw } from './modules/finance-bank-sms/entities/mobile-sms-raw.entity';
import { BankSmsTransaction } from './modules/finance-bank-sms/entities/bank-sms-transaction.entity';
import { FinanceWechatModule } from './modules/finance-wechat/finance-wechat.module';
import { WechatMerchantRegistry } from './modules/finance-wechat/entities/wechat-merchant-registry.entity';
import { WechatPaymentReceipt } from './modules/finance-wechat/entities/wechat-payment-receipt.entity';
import { WechatSettlementBatch } from './modules/finance-wechat/entities/wechat-settlement-batch.entity';
import { WechatSettlementReceiptLink } from './modules/finance-wechat/entities/wechat-settlement-receipt-link.entity';
import { FinanceReconciliationModule } from './modules/finance-reconciliation/finance-reconciliation.module';
import { FinanceCollectionOrder } from './modules/finance-reconciliation/entities/finance-collection-order.entity';
import { FinanceCollectionConfirmationAuthority } from './modules/finance-reconciliation/entities/finance-collection-confirmation-authority.entity';
import { FinancePaymentRequest } from './modules/finance-reconciliation/entities/finance-payment-request.entity';
import { FinanceReceivableTracking } from './modules/finance-reconciliation/entities/finance-receivable-tracking.entity';
import { FinanceReconciliationLink } from './modules/finance-reconciliation/entities/finance-reconciliation-link.entity';
import { WechatPayCallbackEvidence } from './modules/finance-reconciliation/entities/wechat-pay-callback-evidence.entity';
import { WechatPayCryptoVerificationAudit } from './modules/finance-reconciliation/entities/wechat-pay-crypto-verification-audit.entity';
import { WechatPayManualReviewTask } from './modules/finance-reconciliation/entities/wechat-pay-manual-review-task.entity';
import { WechatPaySettlementEvidence } from './modules/finance-reconciliation/entities/wechat-pay-settlement-evidence.entity';
import { FinanceInternalFundFlowModule } from './modules/finance-internal-fund-flow/finance-internal-fund-flow.module';
import { FinanceInternalFundFlow } from './modules/finance-internal-fund-flow/entities/finance-internal-fund-flow.entity';
import { MobileDiagnosticsModule } from './modules/mobile-diagnostics/mobile-diagnostics.module';
import { MobileDeviceDiagnostic } from './modules/mobile-diagnostics/entities/mobile-device-diagnostic.entity';
import { MobileDeviceCommand } from './modules/mobile-diagnostics/entities/mobile-device-command.entity';
import { HomeClimateModule } from './modules/home-climate/home-climate.module';
import { HOME_CLIMATE_ENTITIES } from './modules/home-climate/entities/home-climate.entities';
import { FundTruthReconciliationsModule } from './modules/fund-truth-reconciliations/fund-truth-reconciliations.module';
import { CustomerIdentificationBinding } from './modules/performance/entities/customer-identification-binding.entity';
import { EmployeeSourceBinding } from './modules/performance/entities/employee-source-binding.entity';
import { Employee } from './modules/performance/entities/employee.entity';
import { ExternalCardSalesStaging } from './modules/performance/entities/external-card-sales-staging.entity';
import { PerformanceEvent } from './modules/performance/entities/performance-event.entity';
import { PerformanceEventClassification } from './modules/performance/entities/performance-event-classification.entity';
import { PerformancePeriod } from './modules/performance/entities/performance-period.entity';
import { PerformanceRule } from './modules/performance/entities/performance-rule.entity';
import { PerformanceSummaryManualDecision } from './modules/performance/entities/performance-summary-manual-decision.entity';
import { PerformanceSummary } from './modules/performance/entities/performance-summary.entity';
import { PerformanceModule } from './modules/performance/performance.module';
import { PayrollTrialsModule } from './modules/payroll-trials/payroll-trials.module';
import { PayrollTrialRun } from './modules/payroll-trials/entities/payroll-trial-run.entity';
import { PayrollTrialItem } from './modules/payroll-trials/entities/payroll-trial-item.entity';
import { PayrollTrialItemDetail } from './modules/payroll-trials/entities/payroll-trial-item-detail.entity';
import { PayoutRecordsModule } from './modules/payout-records/payout-records.module';
import { PayoutRecord } from './modules/payout-records/entities/payout-record.entity';
import { PointsModule } from './modules/points/points.module';
import { AbcPointsCommandRequest } from './modules/points/entities/abc-points-command-request.entity';
import { PointsCommandBatch } from './modules/points/entities/points-command-batch.entity';
import { PointsCommandRequest } from './modules/points/entities/points-command-request.entity';
import { PointsLedgerEntry } from './modules/points/entities/points-ledger-entry.entity';
import { PointsRedeemable } from './modules/points/entities/points-redeemable.entity';
import { PointsRedemptionRequest } from './modules/points/entities/points-redemption-request.entity';
import { PointsWelfareBatchItem } from './modules/points/entities/points-welfare-batch-item.entity';
import { Role } from './modules/roles/entities/role.entity';
import { UserRole } from './modules/roles/entities/user-role.entity';
import { SequenceModule } from './modules/sequence/sequence.module';
import { Sequence } from './modules/sequence/entities/sequence.entity';
import { SourceSystemsModule } from './modules/source-systems/source-systems.module';
import { SourceSystem } from './modules/source-systems/entities/source-system.entity';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { Supplier } from './modules/suppliers/entities/supplier.entity';
import { SyncCheckpoint } from './modules/sync-jobs/entities/sync-checkpoint.entity';
import { SyncJobRun } from './modules/sync-jobs/entities/sync-job-run.entity';
import { SyncJob } from './modules/sync-jobs/entities/sync-job.entity';
import { SyncJobsModule } from './modules/sync-jobs/sync-jobs.module';
import { User } from './modules/users/entities/user.entity';
import { WarehousesModule } from './modules/warehouses/warehouses.module';
import { Warehouse } from './modules/warehouses/entities/warehouse.entity';
import { WorkOrderMaterialsModule } from './modules/work-order-materials/work-order-materials.module';
import { WorkOrderMaterial } from './modules/work-order-materials/entities/work-order-material.entity';
import { WorkOrdersModule } from './modules/work-orders/work-orders.module';
import { TemporaryServiceOrder } from './modules/work-orders/entities/temporary-service-order.entity';
import { WorkOrder } from './modules/work-orders/entities/work-order.entity';
import { BusinessFoundationModule } from './modules/business-foundation/business-foundation.module';
import { BUSINESS_FOUNDATION_ENTITIES } from './modules/business-foundation/entities/business-foundation.entities';
import { GROUP_OPERATIONS_ENTITIES } from './modules/group-operations/entities/group-operations.entities';
import { GroupOperationsModule } from './modules/group-operations/group-operations.module';
import { RepairShopModule } from './modules/repair-shop/repair-shop.module';
import { REPAIR_SHOP_ENTITIES } from './modules/repair-shop/entities/repair-shop.entities';
import { BusinessStatSummary } from './modules/business-stats/entities/business-stat-summary.entity';
import { BusinessStatTag } from './modules/business-stats/entities/business-stat-tag.entity';
import { RewardEvent } from './modules/business-stats/entities/reward-event.entity';
import { RewardEventRule } from './modules/business-stats/entities/reward-event-rule.entity';
import { AiRecommendation } from './modules/engagement/entities/ai-recommendation.entity';
import { AttributionResult } from './modules/engagement/entities/attribution-result.entity';
import { AttributionRule } from './modules/engagement/entities/attribution-rule.entity';
import { InteractionLink } from './modules/engagement/entities/interaction-link.entity';
import { LeadCandidate } from './modules/engagement/entities/lead-candidate.entity';
import { MemoryEntry } from './modules/engagement/entities/memory-entry.entity';
import { PlatformContent } from './modules/engagement/entities/platform-content.entity';
import { PlatformConnectorConfig } from './modules/engagement/entities/platform-connector-config.entity';
import { PlatformImportBatch } from './modules/engagement/entities/platform-import-batch.entity';
import { PlatformImportRecord } from './modules/engagement/entities/platform-import-record.entity';
import { PlatformInteraction } from './modules/engagement/entities/platform-interaction.entity';
import { PlatformLead } from './modules/engagement/entities/platform-lead.entity';
import { ProfileSnapshot } from './modules/engagement/entities/profile-snapshot.entity';
import { RecommendationRule } from './modules/engagement/entities/recommendation-rule.entity';
import { ScriptExperimentResult } from './modules/engagement/entities/script-experiment-result.entity';
import { ScriptExperiment } from './modules/engagement/entities/script-experiment.entity';
import { ScriptTemplate } from './modules/engagement/entities/script-template.entity';
import { FollowupFeedback } from './modules/engagement/entities/followup-feedback.entity';
import { ExecutionPlaybook } from './modules/engagement/entities/execution-playbook.entity';
import { ExecutionTask } from './modules/engagement/entities/execution-task.entity';
import { ExecutionTaskItem } from './modules/engagement/entities/execution-task-item.entity';
import { ExecutionResult } from './modules/engagement/entities/execution-result.entity';
import { EmployeeBenefitCardRecord } from './modules/employee-benefits/entities/employee-benefit-card-record.entity';
import { EmployeeBenefitFundLink } from './modules/employee-benefits/entities/employee-benefit-fund-link.entity';
import { EmployeeBenefitIssueItem } from './modules/employee-benefits/entities/employee-benefit-issue-item.entity';
import { EmployeeBenefitIssue } from './modules/employee-benefits/entities/employee-benefit-issue.entity';
import { EmployeeBenefitNotification } from './modules/employee-benefits/entities/employee-benefit-notification.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ...configService.get('database'),
        entities: [
          User,
          Role,
          UserRole,
          ...AI_RUNTIME_ENTITIES,
          WorkOrder,
          ...BUSINESS_FOUNDATION_ENTITIES,
          ...GROUP_OPERATIONS_ENTITIES,
          ...REPAIR_SHOP_ENTITIES,
          PaymentRecord,
          ApprovalPaymentIntent,
          ApprovalRequest,
          ApprovalRequestDraft,
          ApprovalLog,
          Warehouse,
          Supplier,
          Material,
          MaterialStock,
          InventoryTransaction,
          MaterialPreparation,
          WorkOrderMaterial,
          PayoutRecord,
          OperationLog,
          Sequence,
          SourceSystem,
          SyncJob,
          SyncJobRun,
          SyncCheckpoint,
          AbcRawOrder,
          AbcRawTransaction,
          AbcRawCard,
          AbcRawInventory,
          AbcStatusMapping,
          AbcAmountRule,
          AbcSyncCard,
          AbcSyncCardLedger,
          AbcSyncInventoryLedger,
          AbcSyncMaterial,
          AbcSyncOrder,
          AbcSyncFund,
          AbcSyncSupplier,
          AbcSyncWarehouse,
          Employee,
          CustomerIdentificationBinding,
          ExternalCardSalesStaging,
          EmployeeSourceBinding,
          PerformanceEvent,
          PerformanceEventClassification,
          PerformancePeriod,
          PerformanceRule,
          PerformanceSummaryManualDecision,
          PerformanceSummary,
          PayrollTrialRun,
          PayrollTrialItem,
          PayrollTrialItemDetail,
          BusinessStatTag,
          RewardEvent,
          RewardEventRule,
          BusinessStatSummary,
          PlatformContent,
          PlatformInteraction,
          PlatformImportBatch,
          PlatformImportRecord,
          PlatformLead,
          PlatformConnectorConfig,
          MemoryEntry,
          InteractionLink,
          AiRecommendation,
          LeadCandidate,
          AttributionRule,
          AttributionResult,
          ProfileSnapshot,
          RecommendationRule,
          ScriptTemplate,
          ScriptExperiment,
          ScriptExperimentResult,
          FollowupFeedback,
          ExecutionPlaybook,
          ExecutionTask,
          ExecutionTaskItem,
          ExecutionResult,
          EmployeeBenefitIssue,
          EmployeeBenefitIssueItem,
          EmployeeBenefitCardRecord,
          EmployeeBenefitFundLink,
          EmployeeBenefitNotification,
          AbcPointsCommandRequest,
          PointsCommandBatch,
          PointsCommandRequest,
          PointsLedgerEntry,
          PointsRedeemable,
          PointsRedemptionRequest,
          PointsWelfareBatchItem,
          MobileSmsEvent,
          SmsMessageRaw,
          SmsMessageClassification,
          VerificationCodeDispatchLog,
          BankAccountRegistry,
          BankAccountRegistryReviewAuthority,
          MobileSmsRaw,
          BankSmsTransaction,
          WechatMerchantRegistry,
          WechatPaymentReceipt,
          WechatSettlementBatch,
          WechatSettlementReceiptLink,
          FinanceCollectionOrder,
          FinanceCollectionConfirmationAuthority,
          FinancePaymentRequest,
          FinanceReceivableTracking,
          FinanceReconciliationLink,
          WechatPayCallbackEvidence,
          WechatPayCryptoVerificationAudit,
          WechatPayManualReviewTask,
          WechatPaySettlementEvidence,
          FinanceInternalFundFlow,
          MobileDeviceDiagnostic,
          MobileDeviceCommand,
          ...HOME_CLIMATE_ENTITIES,
          TemporaryServiceOrder,
        ],
      }),
    }),
    AuthModule,
    HealthModule,
    AiModule,
    SourceSystemsModule,
    SyncJobsModule,
    AbcIntegrationModule,
    AbcSyncModule,
    PerformanceModule,
    PayrollTrialsModule,
    SequenceModule,
    OperationLogsModule,
    WorkOrdersModule,
    BusinessFoundationModule,
    GroupOperationsModule,
    RepairShopModule,
    WarehousesModule,
    SuppliersModule,
    MaterialsModule,
    MaterialStocksModule,
    InventoryTransactionsModule,
    MaterialPreparationsModule,
    WorkOrderMaterialsModule,
    BusinessReportsModule,
    BusinessStatsModule,
    EngagementModule,
    EmployeeBenefitsModule,
    PaymentRecordsModule,
    FundTruthReconciliationsModule,
    ApprovalRequestsModule,
    PayoutRecordsModule,
    PointsModule,
    MobileBridgeModule,
    MessageHubModule,
    VerificationForwardModule,
    FinanceBankAccountModule,
    FinanceBankSmsModule,
    FinanceWechatModule,
    FinanceReconciliationModule,
    FinanceInternalFundFlowModule,
    MobileDiagnosticsModule,
    HomeClimateModule,
  ],
})
export class AppModule {}
