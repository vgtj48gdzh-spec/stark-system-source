import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { Employee } from '../performance/entities/employee.entity';
import { User } from '../users/entities/user.entity';
import { EngagementAttributionController } from './engagement-attribution.controller';
import { EngagementAttributionService } from './engagement-attribution.service';
import { EngagementImportController } from './engagement-import.controller';
import { EngagementImportService } from './engagement-import.service';
import { EngagementOptimizationController } from './engagement-optimization.controller';
import { EngagementOptimizationService } from './engagement-optimization.service';
import { EngagementExecutionController } from './engagement-execution.controller';
import { EngagementExecutionService } from './engagement-execution.service';
import { AiRecommendation } from './entities/ai-recommendation.entity';
import { AttributionResult } from './entities/attribution-result.entity';
import { AttributionRule } from './entities/attribution-rule.entity';
import { ExecutionPlaybook } from './entities/execution-playbook.entity';
import { ExecutionResult } from './entities/execution-result.entity';
import { ExecutionTaskItem } from './entities/execution-task-item.entity';
import { ExecutionTask } from './entities/execution-task.entity';
import { FollowupFeedback } from './entities/followup-feedback.entity';
import { InteractionLink } from './entities/interaction-link.entity';
import { LeadCandidate } from './entities/lead-candidate.entity';
import { MemoryEntry } from './entities/memory-entry.entity';
import { PlatformContent } from './entities/platform-content.entity';
import { PlatformConnectorConfig } from './entities/platform-connector-config.entity';
import { PlatformImportBatch } from './entities/platform-import-batch.entity';
import { PlatformImportRecord } from './entities/platform-import-record.entity';
import { PlatformInteraction } from './entities/platform-interaction.entity';
import { PlatformLead } from './entities/platform-lead.entity';
import { ProfileSnapshot } from './entities/profile-snapshot.entity';
import { RecommendationRule } from './entities/recommendation-rule.entity';
import { ScriptExperimentResult } from './entities/script-experiment-result.entity';
import { ScriptExperiment } from './entities/script-experiment.entity';
import { ScriptTemplate } from './entities/script-template.entity';
import { EngagementController } from './engagement.controller';
import { EngagementService } from './engagement.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlatformContent,
      PlatformInteraction,
      MemoryEntry,
      InteractionLink,
      AiRecommendation,
      PlatformImportBatch,
      PlatformImportRecord,
      PlatformLead,
      PlatformConnectorConfig,
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
      Employee,
      User,
    ]),
    OperationLogsModule,
  ],
  controllers: [
    EngagementController,
    EngagementAttributionController,
    EngagementImportController,
    EngagementOptimizationController,
    EngagementExecutionController,
  ],
  providers: [
    EngagementService,
    EngagementAttributionService,
    EngagementImportService,
    EngagementOptimizationService,
    EngagementExecutionService,
  ],
  exports: [
    EngagementService,
    EngagementAttributionService,
    EngagementImportService,
    EngagementOptimizationService,
    EngagementExecutionService,
  ],
})
export class EngagementModule {}
