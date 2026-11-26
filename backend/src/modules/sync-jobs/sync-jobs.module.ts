import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncCheckpoint } from './entities/sync-checkpoint.entity';
import { SyncJobRun } from './entities/sync-job-run.entity';
import { SyncJob } from './entities/sync-job.entity';
import { SyncJobsService } from './sync-jobs.service';

@Module({
  imports: [TypeOrmModule.forFeature([SyncJob, SyncJobRun, SyncCheckpoint])],
  providers: [SyncJobsService],
  exports: [SyncJobsService],
})
export class SyncJobsModule {}
