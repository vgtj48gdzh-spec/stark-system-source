import { Module } from '@nestjs/common';
import { AbcRawModule } from '../abc-raw/abc-raw.module';
import { AbcSyncModule } from '../abc-sync/abc-sync.module';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { SourceSystemsModule } from '../source-systems/source-systems.module';
import { SyncJobsModule } from '../sync-jobs/sync-jobs.module';
import { OfflineImportAdapter } from './adapters/offline-import.adapter';
import { AbcIntegrationController } from './abc-integration.controller';
import { AbcIntegrationService } from './abc-integration.service';

@Module({
  imports: [SourceSystemsModule, SyncJobsModule, AbcRawModule, AbcSyncModule, OperationLogsModule],
  controllers: [AbcIntegrationController],
  providers: [AbcIntegrationService, OfflineImportAdapter],
})
export class AbcIntegrationModule {}
