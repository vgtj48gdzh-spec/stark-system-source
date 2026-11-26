import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncInputFormat } from '../../shared/enums/sync-input-format.enum';
import { SyncJobRunStatus } from '../../shared/enums/sync-job-run-status.enum';
import { SyncJobStatus } from '../../shared/enums/sync-job-status.enum';
import { SyncCheckpoint } from './entities/sync-checkpoint.entity';
import { SyncJobRun } from './entities/sync-job-run.entity';
import { SyncJob } from './entities/sync-job.entity';

interface EnsureSyncJobInput {
  sourceSystemId: number;
  sourceSystemCode: string;
  sourceTable: string;
  targetRawTable: string;
  syncScope?: string[];
  checkpointKey?: string | null;
}

interface StartSyncRunInput {
  syncJobId: number;
  batchNo: string;
  inputFormat?: SyncInputFormat | null;
  inputPath?: string | null;
  createdBy: number;
}

interface EnsureNormalizationJobInput {
  sourceSystemId: number;
  sourceSystemCode: string;
  sourceTable: string;
  targetTable: string;
  targetDomain: string;
  syncScope?: string[];
  checkpointKey?: string | null;
}

interface CompleteSyncRunInput {
  runId: number;
  runStatus: SyncJobRunStatus;
  totalRecords: number;
  importedRecords: number;
  skippedRecords: number;
  failedRecords: number;
  errorMessage?: string | null;
  resultPayload?: Record<string, unknown> | null;
}

interface UpdateCheckpointInput {
  syncJobId: number;
  checkpointKey: string;
  checkpointValue?: string | null;
  batchNo: string;
  lastSyncedAt: Date;
}

@Injectable()
export class SyncJobsService {
  constructor(
    @InjectRepository(SyncJob)
    private readonly syncJobRepository: Repository<SyncJob>,
    @InjectRepository(SyncJobRun)
    private readonly syncJobRunRepository: Repository<SyncJobRun>,
    @InjectRepository(SyncCheckpoint)
    private readonly syncCheckpointRepository: Repository<SyncCheckpoint>,
  ) {}

  async ensureOfflineImportJob(input: EnsureSyncJobInput) {
    const jobCode = this.buildJobCode(input.sourceSystemCode, input.sourceTable);
    const existing = await this.syncJobRepository.findOne({
      where: { jobCode },
    });

    if (existing) {
      existing.status = SyncJobStatus.ACTIVE;
      existing.sourceSystemId = input.sourceSystemId;
      existing.sourceSystemCode = input.sourceSystemCode;
      existing.sourceTable = input.sourceTable;
      existing.targetRawTable = input.targetRawTable;
      existing.importMode = 'offline';
      existing.syncScope = input.syncScope ?? existing.syncScope;
      existing.checkpointKey = input.checkpointKey ?? existing.checkpointKey;
      return this.syncJobRepository.save(existing);
    }

    const job = this.syncJobRepository.create({
      sourceSystemId: input.sourceSystemId,
      sourceSystemCode: input.sourceSystemCode,
      jobCode,
      name: `ABC offline import: ${input.sourceTable}`,
      status: SyncJobStatus.ACTIVE,
      syncScope: input.syncScope ?? null,
      sourceTable: input.sourceTable,
      targetRawTable: input.targetRawTable,
      importMode: 'offline',
      checkpointKey: input.checkpointKey ?? null,
    });

    return this.syncJobRepository.save(job);
  }

  async ensureNormalizationJob(input: EnsureNormalizationJobInput) {
    const jobCode = `${input.sourceSystemCode.toLowerCase()}_normalize_${input.targetDomain}_${input.sourceTable.toLowerCase()}`;
    const existing = await this.syncJobRepository.findOne({
      where: { jobCode },
    });

    if (existing) {
      existing.status = SyncJobStatus.ACTIVE;
      existing.sourceSystemId = input.sourceSystemId;
      existing.sourceSystemCode = input.sourceSystemCode;
      existing.sourceTable = input.sourceTable;
      existing.targetRawTable = input.targetTable;
      existing.importMode = 'normalize';
      existing.syncScope = input.syncScope ?? existing.syncScope;
      existing.checkpointKey = input.checkpointKey ?? existing.checkpointKey;
      existing.name = `ABC normalize ${input.sourceTable} -> ${input.targetTable}`;
      return this.syncJobRepository.save(existing);
    }

    const job = this.syncJobRepository.create({
      sourceSystemId: input.sourceSystemId,
      sourceSystemCode: input.sourceSystemCode,
      jobCode,
      name: `ABC normalize ${input.sourceTable} -> ${input.targetTable}`,
      status: SyncJobStatus.ACTIVE,
      syncScope: input.syncScope ?? null,
      sourceTable: input.sourceTable,
      targetRawTable: input.targetTable,
      importMode: 'normalize',
      checkpointKey: input.checkpointKey ?? null,
    });

    return this.syncJobRepository.save(job);
  }

  async startRun(input: StartSyncRunInput) {
    const run = this.syncJobRunRepository.create({
      syncJobId: input.syncJobId,
      batchNo: input.batchNo,
      runStatus: SyncJobRunStatus.RUNNING,
      startedAt: new Date(),
      inputFormat: input.inputFormat ?? null,
      inputPath: input.inputPath ?? null,
      createdBy: input.createdBy,
    });

    return this.syncJobRunRepository.save(run);
  }

  async completeRun(input: CompleteSyncRunInput) {
    const finishedAt = new Date();
    const run = await this.syncJobRunRepository.findOneOrFail({
      where: { id: input.runId },
      relations: { syncJob: true },
    });

    run.runStatus = input.runStatus;
    run.finishedAt = finishedAt;
    run.totalRecords = input.totalRecords;
    run.importedRecords = input.importedRecords;
    run.skippedRecords = input.skippedRecords;
    run.failedRecords = input.failedRecords;
    run.errorMessage = input.errorMessage ?? null;
    run.resultPayload = (input.resultPayload ?? null) as Record<string, unknown> | null;

    await this.syncJobRunRepository.save(run);

    if (input.runStatus !== SyncJobRunStatus.FAILED) {
      await this.syncJobRepository.update(run.syncJobId, {
        lastSyncedAt: finishedAt,
      });
    }

    return run;
  }

  async updateCheckpoint(input: UpdateCheckpointInput) {
    const existing = await this.syncCheckpointRepository.findOne({
      where: {
        syncJobId: input.syncJobId,
        checkpointKey: input.checkpointKey,
      },
    });

    if (existing) {
      existing.checkpointValue = input.checkpointValue ?? null;
      existing.lastSyncedAt = input.lastSyncedAt;
      existing.batchNo = input.batchNo;
      return this.syncCheckpointRepository.save(existing);
    }

    const checkpoint = this.syncCheckpointRepository.create({
      syncJobId: input.syncJobId,
      checkpointKey: input.checkpointKey,
      checkpointValue: input.checkpointValue ?? null,
      lastSyncedAt: input.lastSyncedAt,
      batchNo: input.batchNo,
    });

    return this.syncCheckpointRepository.save(checkpoint);
  }

  private buildJobCode(sourceSystemCode: string, sourceTable: string) {
    return `${sourceSystemCode.toLowerCase()}_offline_import_${sourceTable.toLowerCase()}`;
  }
}
