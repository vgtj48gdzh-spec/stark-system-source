import { BadRequestException, Injectable } from '@nestjs/common';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { OperationLogAction } from '../../shared/enums/operation-log-action.enum';
import { SyncJobRunStatus } from '../../shared/enums/sync-job-run-status.enum';
import { AbcRawService } from '../abc-raw/abc-raw.service';
import { AbcSyncService } from '../abc-sync/abc-sync.service';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { SourceSystemsService } from '../source-systems/source-systems.service';
import { SyncJobsService } from '../sync-jobs/sync-jobs.service';
import { OfflineImportAdapter } from './adapters/offline-import.adapter';
import { ManualImportAbcRawDto } from './dto/manual-import-abc-raw.dto';
import { ManualNormalizeAbcSyncDto } from './dto/manual-normalize-abc-sync.dto';
import { OfflineImportRecord } from './interfaces/offline-import-record.interface';

const SOURCE_ORDER_NUMBER_FIELDS: Record<string, string[]> = {
  order: ['num'],
  top_up_order: ['num'],
  supermarket_order: ['order_no'],
  goods_group_order: ['order_num', 'pay_num', 'merge_id'],
  points_order: ['sn'],
  transaction: ['order_num'],
  user_shopping_card_recharge: ['order_num'],
  merchant_point_recharge: ['order_no'],
};

const SOURCE_UPDATED_AT_FIELDS = [
  'updated_at',
  'updatedAt',
  'source_updated_at',
  'payment_at',
  'pay_at',
  'finished_at',
  'created_at',
  'createdAt',
];

@Injectable()
export class AbcIntegrationService {
  constructor(
    private readonly sourceSystemsService: SourceSystemsService,
    private readonly syncJobsService: SyncJobsService,
    private readonly abcRawService: AbcRawService,
    private readonly abcSyncService: AbcSyncService,
    private readonly offlineImportAdapter: OfflineImportAdapter,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async runManualImport(dto: ManualImportAbcRawDto, currentUser: CurrentUser) {
    const sourceTable = dto.sourceTable.trim().toLowerCase();
    const sourceSystemCode = dto.sourceSystemCode.trim().toUpperCase();
    const syncBatchNo = dto.batchNo?.trim() || this.buildBatchNo(sourceSystemCode, sourceTable);
    const syncedAt = new Date();
    const rawGroup = this.abcRawService.resolveRawGroup(sourceTable);
    const targetRawTable = this.abcRawService.getRawTableName(rawGroup);

    const sourceSystem = await this.sourceSystemsService.ensureSourceSystem({
      sourceSystemCode,
      name: 'ABC Source System',
      syncScope: dto.syncScope ?? ['readonly', 'offline', 'raw'],
    });

    const syncJob = await this.syncJobsService.ensureOfflineImportJob({
      sourceSystemId: sourceSystem.id,
      sourceSystemCode,
      sourceTable,
      targetRawTable,
      syncScope: dto.syncScope ?? ['readonly', 'offline', rawGroup],
      checkpointKey: dto.checkpointKey ?? 'source_updated_at_or_source_id',
    });

    const syncRun = await this.syncJobsService.startRun({
      syncJobId: syncJob.id,
      batchNo: syncBatchNo,
      inputFormat: dto.inputFormat,
      inputPath: dto.inputPath,
      createdBy: currentUser.id,
    });

    await this.operationLogsService.create({
      module: 'abc_integration',
      targetId: syncRun.id,
      action: OperationLogAction.START_SYNC_JOB_RUN,
      operatorId: currentUser.id,
      detail: `Start offline ABC raw import for ${sourceTable}`,
      detailJson: {
        sourceSystemCode,
        sourceTable,
        inputFormat: dto.inputFormat,
        inputPath: dto.inputPath,
        batchNo: syncBatchNo,
      },
    });

    try {
      const parsedRows = await this.offlineImportAdapter.loadRecords(
        dto.inputFormat,
        dto.inputPath,
        sourceTable,
        dto.delimiter ?? ',',
      );

      const normalizedRecords = parsedRows.map((row, index) =>
        this.toOfflineImportRecord(sourceTable, row, index),
      );

      const upsertSummary = await this.abcRawService.upsertRecords(
        sourceTable,
        normalizedRecords.map((record) => ({
          sourceSystem: sourceSystemCode,
          sourceTable,
          sourceId: record.sourceId,
          sourceOrderNo: record.sourceOrderNo ?? null,
          sourceUpdatedAt: record.sourceUpdatedAt ?? null,
          syncedAt,
          syncBatchNo,
          rawPayload: record.rawPayload,
        })),
      );

      const checkpointValue = this.resolveCheckpointValue(normalizedRecords);
      await this.syncJobsService.updateCheckpoint({
        syncJobId: syncJob.id,
        checkpointKey: dto.checkpointKey ?? 'source_updated_at_or_source_id',
        checkpointValue,
        batchNo: syncBatchNo,
        lastSyncedAt: syncedAt,
      });
      await this.sourceSystemsService.touchLastSyncedAt(sourceSystem.id, syncedAt);

      await this.syncJobsService.completeRun({
        runId: syncRun.id,
        runStatus: SyncJobRunStatus.SUCCESS,
        totalRecords: normalizedRecords.length,
        importedRecords: upsertSummary.createdRecords,
        skippedRecords: 0,
        failedRecords: 0,
        resultPayload: {
          rawGroup,
          targetRawTable,
          createdRecords: upsertSummary.createdRecords,
          updatedRecords: upsertSummary.updatedRecords,
          totalRecords: normalizedRecords.length,
          checkpointValue,
        },
      });

      await this.operationLogsService.create({
        module: 'abc_integration',
        targetId: syncRun.id,
        action: OperationLogAction.COMPLETE_SYNC_JOB_RUN,
        operatorId: currentUser.id,
        detail: `Completed offline ABC raw import for ${sourceTable}`,
        detailJson: {
          sourceSystemCode,
          sourceTable,
          syncBatchNo,
          rawGroup,
          targetRawTable,
          createdRecords: upsertSummary.createdRecords,
          updatedRecords: upsertSummary.updatedRecords,
          totalRecords: normalizedRecords.length,
        },
      });

      return {
        sourceSystemCode,
        sourceTable,
        rawGroup,
        targetRawTable,
        batchNo: syncBatchNo,
        totalRecords: normalizedRecords.length,
        createdRecords: upsertSummary.createdRecords,
        updatedRecords: upsertSummary.updatedRecords,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown import error';

      await this.syncJobsService.completeRun({
        runId: syncRun.id,
        runStatus: SyncJobRunStatus.FAILED,
        totalRecords: 0,
        importedRecords: 0,
        skippedRecords: 0,
        failedRecords: 1,
        errorMessage,
        resultPayload: {
          sourceTable,
          batchNo: syncBatchNo,
        },
      });

      await this.operationLogsService.create({
        module: 'abc_integration',
        targetId: syncRun.id,
        action: OperationLogAction.FAIL_SYNC_JOB_RUN,
        operatorId: currentUser.id,
        detail: `Failed offline ABC raw import for ${sourceTable}`,
        detailJson: {
          sourceSystemCode,
          sourceTable,
          batchNo: syncBatchNo,
          errorMessage,
        },
      });

      throw error;
    }
  }

  async runManualNormalization(dto: ManualNormalizeAbcSyncDto, currentUser: CurrentUser) {
    return this.abcSyncService.runManualNormalization(dto, currentUser);
  }

  private toOfflineImportRecord(
    sourceTable: string,
    rawRow: Record<string, unknown>,
    index: number,
  ): OfflineImportRecord {
    const sourceIdValue = rawRow.id ?? rawRow.source_id;

    if (sourceIdValue === undefined || sourceIdValue === null || sourceIdValue === '') {
      throw new BadRequestException(
        `导入记录缺少主键字段 id/source_id，sourceTable=${sourceTable}，rowIndex=${index + 1}`,
      );
    }

    return {
      sourceId: String(sourceIdValue),
      sourceOrderNo: this.resolveSourceOrderNo(sourceTable, rawRow),
      sourceUpdatedAt: this.resolveSourceUpdatedAt(rawRow),
      rawPayload: rawRow,
    };
  }

  private resolveSourceOrderNo(sourceTable: string, rawRow: Record<string, unknown>) {
    const candidateFields = SOURCE_ORDER_NUMBER_FIELDS[sourceTable] ?? [];

    for (const fieldName of candidateFields) {
      const value = rawRow[fieldName];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value);
      }
    }

    return null;
  }

  private resolveSourceUpdatedAt(rawRow: Record<string, unknown>) {
    for (const fieldName of SOURCE_UPDATED_AT_FIELDS) {
      const value = rawRow[fieldName];
      if (!value) {
        continue;
      }

      const date = new Date(String(value));
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }

    return null;
  }

  private resolveCheckpointValue(records: OfflineImportRecord[]) {
    if (!records.length) {
      return null;
    }

    const maxUpdatedAt = records
      .map((record) => record.sourceUpdatedAt?.toISOString())
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);

    if (maxUpdatedAt) {
      return maxUpdatedAt;
    }

    return records
      .map((record) => record.sourceId)
      .sort((left, right) => left.localeCompare(right, 'en'))
      .at(-1) ?? null;
  }

  private buildBatchNo(sourceSystemCode: string, sourceTable: string) {
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('');

    return `${sourceSystemCode}_${sourceTable}_${timestamp}`;
  }
}
