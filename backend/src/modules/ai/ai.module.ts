import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbcSyncCardLedger } from '../abc-sync/entities/abc-sync-card-ledger.entity';
import { AbcSyncCard } from '../abc-sync/entities/abc-sync-card.entity';
import { BusinessStatTag } from '../business-stats/entities/business-stat-tag.entity';
import { RewardEvent } from '../business-stats/entities/reward-event.entity';
import { ApprovalRequestsModule } from '../approval-requests/approval-requests.module';
import { BusinessStatsModule } from '../business-stats/business-stats.module';
import { OperationLog } from '../operation-logs/entities/operation-log.entity';
import { PaymentRecordsModule } from '../payment-records/payment-records.module';
import { PerformanceEvent } from '../performance/entities/performance-event.entity';
import { PerformanceSummaryManualDecision } from '../performance/entities/performance-summary-manual-decision.entity';
import { ExternalCardSalesStaging } from '../performance/entities/external-card-sales-staging.entity';
import { PerformanceModule } from '../performance/performance.module';
import { Employee } from '../performance/entities/employee.entity';
import { PointsModule } from '../points/points.module';
import { AbcPointsCommandRequest } from '../points/entities/abc-points-command-request.entity';
import { PointsCommandBatch } from '../points/entities/points-command-batch.entity';
import { PointsCommandRequest } from '../points/entities/points-command-request.entity';
import { PointsLedgerEntry } from '../points/entities/points-ledger-entry.entity';
import { PointsRedeemable } from '../points/entities/points-redeemable.entity';
import { PointsRedemptionRequest } from '../points/entities/points-redemption-request.entity';
import { PointsWelfareBatchItem } from '../points/entities/points-welfare-batch-item.entity';
import { AiController } from './ai.controller';
import { AI_RUNTIME_ENTITIES } from './ai-runtime-entities';
import { AiService } from './ai.service';
import { AiActionPermissionMatrixService } from './services/ai-action-permission-matrix.service';
import { AiReadableOperationLogContextService } from './services/ai-readable-operation-log-context.service';
import { AiManualTaskBridgeEmployeeHandoffPreviewService } from './services/ai-manual-task-bridge-employee-handoff-preview.service';
import { AiManualTaskBridgeDispatchReadinessService } from './services/ai-manual-task-bridge-dispatch-readiness.service';
import { AiManualTaskBridgeCandidateService } from './services/ai-manual-task-bridge-candidate.service';
import { AiOwnerMemoryProjectionService } from './services/ai-owner-memory-projection.service';
import { AiTaskDraftReviewArtifactReadAuditService } from './services/ai-task-draft-review-artifact-read-audit.service';
import { AiTaskDraftOrchestrationService } from './services/ai-task-draft-orchestration.service';
import { StarkAiDatabaseSafeSummaryProviderService } from './services/stark-ai-database-safe-summary-provider.service';
import { StarkAiFinanceBankSmsReadonlySourceAdapterService } from './services/stark-ai-finance-bank-sms-readonly-source-adapter.service';
import { StarkAiFinanceSafeSummarySourceMapperService } from './services/stark-ai-finance-safe-summary-source-mapper.service';
import { StarkAiFinanceReadonlySafeSummaryAdapterService } from './services/stark-ai-finance-readonly-safe-summary-adapter.service';
import { StarkAiChatGptInteractionPacketService } from './services/stark-ai-chatgpt-interaction-packet.service';
import { StarkAiChatGptContactPhoneSummaryHandoffService } from './services/stark-ai-chatgpt-contact-phone-summary-handoff.service';
import { StarkAiChatGptContactPhoneReviewResponseValidatorService } from './services/stark-ai-chatgpt-contact-phone-review-response-validator.service';
import { StarkAiChatGptNextStepSelectorService } from './services/stark-ai-chatgpt-next-step-selector.service';
import { StarkAiChatGptNextStepCandidateReviewHandoffService } from './services/stark-ai-chatgpt-next-step-candidate-review-handoff.service';
import { StarkAiChatGptNextStepCandidateReviewResponseValidatorService } from './services/stark-ai-chatgpt-next-step-candidate-review-response-validator.service';
import { AiChatGptContactPhoneReviewResponseConsumptionService } from './services/ai-chatgpt-contact-phone-review-response-consumption.service';
import { StarkAiSyncPacketService } from './services/stark-ai-sync-packet.service';
import { AiContactPhonePolicyConsumptionService } from './services/ai-contact-phone-policy-consumption.service';
import { ContactPhonePermissionPolicyService } from './services/contact-phone-permission-policy.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ...AI_RUNTIME_ENTITIES,
      ExternalCardSalesStaging,
      PerformanceSummaryManualDecision,
      PerformanceEvent,
      RewardEvent,
      BusinessStatTag,
      OperationLog,
      Employee,
      AbcPointsCommandRequest,
      AbcSyncCard,
      AbcSyncCardLedger,
      PointsCommandBatch,
      PointsCommandRequest,
      PointsLedgerEntry,
      PointsRedeemable,
      PointsRedemptionRequest,
      PointsWelfareBatchItem,
    ]),
    forwardRef(() => PointsModule),
    ApprovalRequestsModule,
    PerformanceModule,
    BusinessStatsModule,
    PaymentRecordsModule,
  ],
  controllers: [AiController],
  providers: [
    AiService,
    AiReadableOperationLogContextService,
    AiActionPermissionMatrixService,
    AiTaskDraftOrchestrationService,
    AiTaskDraftReviewArtifactReadAuditService,
    AiManualTaskBridgeCandidateService,
    AiManualTaskBridgeDispatchReadinessService,
    AiManualTaskBridgeEmployeeHandoffPreviewService,
    AiOwnerMemoryProjectionService,
    StarkAiDatabaseSafeSummaryProviderService,
    StarkAiFinanceBankSmsReadonlySourceAdapterService,
    StarkAiFinanceSafeSummarySourceMapperService,
    StarkAiFinanceReadonlySafeSummaryAdapterService,
    StarkAiChatGptInteractionPacketService,
    StarkAiChatGptContactPhoneSummaryHandoffService,
    StarkAiChatGptContactPhoneReviewResponseValidatorService,
    StarkAiChatGptNextStepSelectorService,
    StarkAiChatGptNextStepCandidateReviewHandoffService,
    StarkAiChatGptNextStepCandidateReviewResponseValidatorService,
    AiChatGptContactPhoneReviewResponseConsumptionService,
    StarkAiSyncPacketService,
    AiContactPhonePolicyConsumptionService,
    ContactPhonePermissionPolicyService,
  ],
  exports: [
    AiService,
    AiReadableOperationLogContextService,
    AiActionPermissionMatrixService,
    AiTaskDraftOrchestrationService,
    AiTaskDraftReviewArtifactReadAuditService,
    AiManualTaskBridgeCandidateService,
    AiManualTaskBridgeDispatchReadinessService,
    AiManualTaskBridgeEmployeeHandoffPreviewService,
    AiOwnerMemoryProjectionService,
    StarkAiDatabaseSafeSummaryProviderService,
    StarkAiFinanceBankSmsReadonlySourceAdapterService,
    StarkAiFinanceSafeSummarySourceMapperService,
    StarkAiFinanceReadonlySafeSummaryAdapterService,
    StarkAiChatGptInteractionPacketService,
    StarkAiChatGptContactPhoneSummaryHandoffService,
    StarkAiChatGptContactPhoneReviewResponseValidatorService,
    StarkAiChatGptNextStepSelectorService,
    StarkAiChatGptNextStepCandidateReviewHandoffService,
    StarkAiChatGptNextStepCandidateReviewResponseValidatorService,
    AiChatGptContactPhoneReviewResponseConsumptionService,
    StarkAiSyncPacketService,
    AiContactPhonePolicyConsumptionService,
    ContactPhonePermissionPolicyService,
  ],
})
export class AiModule {}
