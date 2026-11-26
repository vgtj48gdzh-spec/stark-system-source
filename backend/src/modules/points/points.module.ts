import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbcSyncCardLedger } from '../abc-sync/entities/abc-sync-card-ledger.entity';
import { AbcSyncCard } from '../abc-sync/entities/abc-sync-card.entity';
import { AiModule } from '../ai/ai.module';
import { AiKnowledgeEntry } from '../ai/entities/ai-knowledge-entry.entity';
import { AiMemoryEntry } from '../ai/entities/ai-memory-entry.entity';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { Employee } from '../performance/entities/employee.entity';
import { PerformanceSummaryManualDecision } from '../performance/entities/performance-summary-manual-decision.entity';
import { AbcPointsCommandRequest } from './entities/abc-points-command-request.entity';
import { PointsCommandBatch } from './entities/points-command-batch.entity';
import { PointsCommandRequest } from './entities/points-command-request.entity';
import { PointsLedgerEntry } from './entities/points-ledger-entry.entity';
import { PointsRedeemable } from './entities/points-redeemable.entity';
import { PointsRedemptionRequest } from './entities/points-redemption-request.entity';
import { PointsWelfareBatchItem } from './entities/points-welfare-batch-item.entity';
import { AbcPointsController } from './abc-points.controller';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AbcPointsCommandRequest,
      PointsCommandBatch,
      PointsCommandRequest,
      PointsLedgerEntry,
      PointsRedeemable,
      PointsRedemptionRequest,
      PointsWelfareBatchItem,
      AbcSyncCard,
      AbcSyncCardLedger,
      Employee,
      AiKnowledgeEntry,
      AiMemoryEntry,
      PerformanceSummaryManualDecision,
    ]),
    forwardRef(() => AiModule),
    OperationLogsModule,
  ],
  controllers: [PointsController, AbcPointsController],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
