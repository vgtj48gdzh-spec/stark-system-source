import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbcRawCard } from '../abc-raw/entities/abc-raw-card.entity';
import { AbcRawInventory } from '../abc-raw/entities/abc-raw-inventory.entity';
import { AbcRawOrder } from '../abc-raw/entities/abc-raw-order.entity';
import { AbcRawTransaction } from '../abc-raw/entities/abc-raw-transaction.entity';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { SourceSystemsModule } from '../source-systems/source-systems.module';
import { SyncCheckpoint } from '../sync-jobs/entities/sync-checkpoint.entity';
import { SyncJobRun } from '../sync-jobs/entities/sync-job-run.entity';
import { SyncJob } from '../sync-jobs/entities/sync-job.entity';
import { SyncJobsModule } from '../sync-jobs/sync-jobs.module';
import { AbcSyncController } from './abc-sync.controller';
import { AbcSyncService } from './abc-sync.service';
import { AbcAmountRule } from './entities/abc-amount-rule.entity';
import { AbcSyncCardLedger } from './entities/abc-sync-card-ledger.entity';
import { AbcSyncCard } from './entities/abc-sync-card.entity';
import { AbcSyncInventoryLedger } from './entities/abc-sync-inventory-ledger.entity';
import { AbcSyncMaterial } from './entities/abc-sync-material.entity';
import { AbcStatusMapping } from './entities/abc-status-mapping.entity';
import { AbcSyncFund } from './entities/abc-sync-fund.entity';
import { AbcSyncOrder } from './entities/abc-sync-order.entity';
import { AbcSyncSupplier } from './entities/abc-sync-supplier.entity';
import { AbcSyncWarehouse } from './entities/abc-sync-warehouse.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AbcRawCard,
      AbcRawInventory,
      AbcRawOrder,
      AbcRawTransaction,
      AbcSyncCard,
      AbcSyncCardLedger,
      AbcSyncInventoryLedger,
      AbcSyncMaterial,
      AbcSyncOrder,
      AbcSyncFund,
      AbcSyncSupplier,
      AbcSyncWarehouse,
      AbcStatusMapping,
      AbcAmountRule,
      SyncJob,
      SyncJobRun,
      SyncCheckpoint,
    ]),
    SourceSystemsModule,
    SyncJobsModule,
    OperationLogsModule,
  ],
  controllers: [AbcSyncController],
  providers: [AbcSyncService],
  exports: [AbcSyncService],
})
export class AbcSyncModule {}
