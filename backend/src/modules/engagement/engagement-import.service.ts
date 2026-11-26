import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import * as XLSX from 'xlsx';
import { Repository } from 'typeorm';
import { buildPaginationResult, getPagination } from '../../common/utils/pagination.util';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { CreatePlatformImportBatchDto } from './dto/create-platform-import-batch.dto';
import { QueryPlatformImportBatchesDto } from './dto/query-platform-import-batches.dto';
import { QueryPlatformImportRecordsDto } from './dto/query-platform-import-records.dto';
import { CreatePlatformLeadDto } from './dto/create-platform-lead.dto';
import { QueryPlatformLeadsDto } from './dto/query-platform-leads.dto';
import { CreatePlatformConnectorConfigDto } from './dto/create-platform-connector-config.dto';
import { UpdatePlatformConnectorConfigDto } from './dto/update-platform-connector-config.dto';
import { QueryPlatformConnectorConfigsDto } from './dto/query-platform-connector-configs.dto';
import { AiRecommendation } from './entities/ai-recommendation.entity';
import { MemoryEntry } from './entities/memory-entry.entity';
import { PlatformContent } from './entities/platform-content.entity';
import { PlatformConnectorConfig } from './entities/platform-connector-config.entity';
import { PlatformImportBatch } from './entities/platform-import-batch.entity';
import { PlatformImportRecord } from './entities/platform-import-record.entity';
import { PlatformInteraction } from './entities/platform-interaction.entity';
import { PlatformLead } from './entities/platform-lead.entity';
import { EngagementAttributionService } from './engagement-attribution.service';

type SourceFormat = 'csv' | 'json' | 'xlsx';

const IMPORT_BATCH_SORT_COLUMNS: Record<string, string> = {
  sourcePlatform: 'batch.sourcePlatform',
  importType: 'batch.importType',
  importStatus: 'batch.importStatus',
  recordCount: 'batch.recordCount',
  successCount: 'batch.successCount',
  failedCount: 'batch.failedCount',
  startedAt: 'batch.startedAt',
  finishedAt: 'batch.finishedAt',
  createdAt: 'batch.createdAt',
  updatedAt: 'batch.updatedAt',
};

const IMPORT_RECORD_SORT_COLUMNS: Record<string, string> = {
  recordIndex: 'record.recordIndex',
  importStatus: 'record.importStatus',
  targetTable: 'record.targetTable',
  createdAt: 'record.createdAt',
  updatedAt: 'record.updatedAt',
};

const PLATFORM_LEAD_SORT_COLUMNS: Record<string, string> = {
  platform: 'lead.platform',
  leadType: 'lead.leadType',
  leadStatus: 'lead.leadStatus',
  evidenceStatus: 'lead.evidenceStatus',
  confidenceScore: 'lead.confidenceScore',
  merchantId: 'lead.merchantId',
  employeeId: 'lead.employeeId',
  createdAt: 'lead.createdAt',
  updatedAt: 'lead.updatedAt',
};

const CONNECTOR_CONFIG_SORT_COLUMNS: Record<string, string> = {
  platform: 'config.platform',
  connectorCode: 'config.connectorCode',
  connectorType: 'config.connectorType',
  status: 'config.status',
  lastSyncedAt: 'config.lastSyncedAt',
  updatedAt: 'config.updatedAt',
};

interface ProcessedImportRow {
  targetTable: string;
  targetId: string;
  created: boolean;
  normalizedPayload: Record<string, unknown>;
  sourceRecordRef: string | null;
}

@Injectable()
export class EngagementImportService {
  constructor(
    @InjectRepository(PlatformContent)
    private readonly platformContentRepository: Repository<PlatformContent>,
    @InjectRepository(PlatformInteraction)
    private readonly platformInteractionRepository: Repository<PlatformInteraction>,
    @InjectRepository(PlatformLead)
    private readonly platformLeadRepository: Repository<PlatformLead>,
    @InjectRepository(PlatformImportBatch)
    private readonly platformImportBatchRepository: Repository<PlatformImportBatch>,
    @InjectRepository(PlatformImportRecord)
    private readonly platformImportRecordRepository: Repository<PlatformImportRecord>,
    @InjectRepository(PlatformConnectorConfig)
    private readonly platformConnectorConfigRepository: Repository<PlatformConnectorConfig>,
    @InjectRepository(MemoryEntry)
    private readonly memoryEntryRepository: Repository<MemoryEntry>,
    @InjectRepository(AiRecommendation)
    private readonly aiRecommendationRepository: Repository<AiRecommendation>,
    private readonly engagementAttributionService: EngagementAttributionService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async createImportBatch(
    dto: CreatePlatformImportBatchDto,
    file: { originalname?: string; buffer?: Buffer } | undefined,
    currentUser: CurrentUser,
  ) {
    if (!file?.buffer || !file.originalname) {
      throw new BadRequestException('请上传待导入文件');
    }

    const sourceFormat = this.detectSourceFormat(file.originalname);
    const sourceFile = await this.persistImportFile(file.originalname, file.buffer);

    const batch = await this.platformImportBatchRepository.save(
      this.platformImportBatchRepository.create({
        sourcePlatform: dto.sourcePlatform,
        accountId: dto.accountId ?? null,
        importType: dto.importType,
        sourceFormat,
        sourceFile,
        fileName: file.originalname,
        connectorConfigId: dto.connectorConfigId ?? null,
        importStatus: 'processing',
        triggerLeadGeneration: dto.triggerLeadGeneration ?? false,
        triggerAttributionGeneration: dto.triggerAttributionGeneration ?? false,
        syncLeadMemories: dto.syncLeadMemories ?? false,
        importedBy: currentUser.id,
        startedAt: new Date(),
        remark: dto.remark ?? null,
      }),
    );

    const rows = this.parseImportFile(sourceFormat, file.buffer);
    let successCount = 0;
    let failedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const rawPayload = this.asRecord(rows[index]);
      try {
        const processed = await this.processImportRow(dto, batch, rawPayload, currentUser);
        await this.platformImportRecordRepository.save(
          this.platformImportRecordRepository.create({
            importBatchId: batch.id,
            sourcePlatform: batch.sourcePlatform,
            importType: batch.importType,
            sourceFile: batch.sourceFile,
            recordIndex: index + 1,
            sourceRecordRef: processed.sourceRecordRef,
            importStatus: 'success',
            targetTable: processed.targetTable,
            targetId: processed.targetId,
            rawPayload,
            normalizedPayload: processed.normalizedPayload,
          }),
        );
        successCount += 1;
        if (processed.created) {
          createdCount += 1;
        } else {
          updatedCount += 1;
        }
      } catch (error) {
        await this.platformImportRecordRepository.save(
          this.platformImportRecordRepository.create({
            importBatchId: batch.id,
            sourcePlatform: batch.sourcePlatform,
            importType: batch.importType,
            sourceFile: batch.sourceFile,
            recordIndex: index + 1,
            sourceRecordRef: this.extractString(rawPayload, ['id', 'recordId', 'leadRef', 'contentId']) ?? null,
            importStatus: 'failed',
            errorMessage: error instanceof Error ? error.message : '导入失败',
            rawPayload,
            normalizedPayload: null,
          }),
        );
        failedCount += 1;
      }
    }

    let downstream: Record<string, unknown> | null = null;
    if (dto.importType === 'interaction' && dto.triggerLeadGeneration) {
      const leadGeneration = await this.engagementAttributionService.generateLeadCandidates(
        {
          platform: dto.sourcePlatform,
          accountId: dto.accountId,
          forceRegenerate: true,
        },
        currentUser,
      );
      downstream = { ...(downstream ?? {}), leadGeneration };
    }

    if (dto.importType === 'interaction' && dto.triggerAttributionGeneration) {
      const attributionGeneration = await this.engagementAttributionService.generateAttributions(
        {
          platform: dto.sourcePlatform,
          accountId: dto.accountId,
          forceRegenerate: true,
        },
        currentUser,
      );
      downstream = { ...(downstream ?? {}), attributionGeneration };
    }

    batch.recordCount = rows.length;
    batch.successCount = successCount;
    batch.failedCount = failedCount;
    batch.importStatus = failedCount === 0 ? 'completed' : successCount === 0 ? 'failed' : 'partial';
    batch.finishedAt = new Date();
    batch.summaryJson = {
      createdCount,
      updatedCount,
      successCount,
      failedCount,
      sourceFormat,
      downstream,
    };
    const savedBatch = await this.platformImportBatchRepository.save(batch);

    await this.operationLogsService.create({
      module: 'engagement',
      targetId: savedBatch.id,
      action: 'create_platform_import_batch',
      operatorId: currentUser.id,
      detail: `创建平台导入批次 ${savedBatch.sourcePlatform}/${savedBatch.importType}`,
      detailJson: {
        sourcePlatform: savedBatch.sourcePlatform,
        importType: savedBatch.importType,
        recordCount: savedBatch.recordCount,
        successCount: savedBatch.successCount,
        failedCount: savedBatch.failedCount,
      },
    });

    return this.findImportBatchById(savedBatch.id);
  }

  async findImportBatches(query: QueryPlatformImportBatchesDto) {
    const { skip, take } = getPagination(query);
    const qb = this.platformImportBatchRepository
      .createQueryBuilder('batch')
      .leftJoinAndSelect('batch.importedByUser', 'importedByUser');

    if (query.sourcePlatform) {
      qb.andWhere('batch.source_platform = :sourcePlatform', { sourcePlatform: query.sourcePlatform });
    }
    if (query.importType) {
      qb.andWhere('batch.import_type = :importType', { importType: query.importType });
    }
    if (query.importStatus) {
      qb.andWhere('batch.import_status = :importStatus', { importStatus: query.importStatus });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        IMPORT_BATCH_SORT_COLUMNS[query.sortBy ?? 'createdAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async findImportBatchById(id: number) {
    const batch = await this.platformImportBatchRepository.findOne({
      where: { id },
      relations: ['importedByUser'],
    });
    if (!batch) {
      throw new NotFoundException('平台导入批次不存在');
    }

    const records = await this.platformImportRecordRepository.find({
      where: { importBatchId: id },
      order: { recordIndex: 'ASC' },
      take: 100,
    });

    return { ...batch, records };
  }

  async findImportRecords(query: QueryPlatformImportRecordsDto) {
    const { skip, take } = getPagination(query);
    const qb = this.platformImportRecordRepository
      .createQueryBuilder('record')
      .leftJoinAndSelect('record.importBatch', 'batch');

    if (query.importBatchId) {
      qb.andWhere('record.import_batch_id = :importBatchId', { importBatchId: query.importBatchId });
    }
    if (query.sourcePlatform) {
      qb.andWhere('record.source_platform = :sourcePlatform', { sourcePlatform: query.sourcePlatform });
    }
    if (query.importType) {
      qb.andWhere('record.import_type = :importType', { importType: query.importType });
    }
    if (query.importStatus) {
      qb.andWhere('record.import_status = :importStatus', { importStatus: query.importStatus });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        IMPORT_RECORD_SORT_COLUMNS[query.sortBy ?? 'recordIndex'],
        this.normalizeSortOrder(query.sortOrder, 'ASC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async findImportRecordById(id: number) {
    const record = await this.platformImportRecordRepository.findOne({
      where: { id },
      relations: ['importBatch'],
    });
    if (!record) {
      throw new NotFoundException('平台导入记录不存在');
    }
    return record;
  }

  async createPlatformLead(dto: CreatePlatformLeadDto, currentUser: CurrentUser) {
    const result = await this.upsertPlatformLead(dto, currentUser, true);
    return result.lead;
  }

  async findPlatformLeads(query: QueryPlatformLeadsDto) {
    const { skip, take } = getPagination(query);
    const qb = this.platformLeadRepository.createQueryBuilder('lead');

    if (query.platform) {
      qb.andWhere('lead.platform = :platform', { platform: query.platform });
    }
    if (query.accountId) {
      qb.andWhere('lead.account_id = :accountId', { accountId: query.accountId });
    }
    if (query.leadStatus) {
      qb.andWhere('lead.lead_status = :leadStatus', { leadStatus: query.leadStatus });
    }
    if (query.evidenceStatus) {
      qb.andWhere('lead.evidence_status = :evidenceStatus', { evidenceStatus: query.evidenceStatus });
    }
    if (query.campaignId) {
      qb.andWhere('lead.campaign_id = :campaignId', { campaignId: query.campaignId });
    }
    if (query.contentId) {
      qb.andWhere('lead.content_id = :contentId', { contentId: query.contentId });
    }
    if (query.subjectType) {
      qb.andWhere('lead.subject_type = :subjectType', { subjectType: query.subjectType });
    }
    if (query.merchantId) {
      qb.andWhere('lead.merchant_id = :merchantId', { merchantId: query.merchantId });
    }
    if (query.importBatchId) {
      qb.andWhere('lead.import_batch_id = :importBatchId', { importBatchId: query.importBatchId });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        PLATFORM_LEAD_SORT_COLUMNS[query.sortBy ?? 'updatedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async findPlatformLeadById(id: number) {
    const lead = await this.platformLeadRepository.findOne({ where: { id } });
    if (!lead) {
      throw new NotFoundException('平台线索不存在');
    }

    const memoryEntry =
      lead.linkedMemoryEntryId != null
        ? await this.memoryEntryRepository.findOne({ where: { id: lead.linkedMemoryEntryId } })
        : null;
    const recommendation =
      lead.linkedRecommendationId != null
        ? await this.aiRecommendationRepository.findOne({ where: { id: lead.linkedRecommendationId } })
        : null;

    return { ...lead, memoryEntry, recommendation };
  }

  async findConnectorConfigs(query: QueryPlatformConnectorConfigsDto) {
    const { skip, take } = getPagination(query);
    const qb = this.platformConnectorConfigRepository.createQueryBuilder('config');

    if (query.platform) {
      qb.andWhere('config.platform = :platform', { platform: query.platform });
    }
    if (query.status) {
      qb.andWhere('config.status = :status', { status: query.status });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        CONNECTOR_CONFIG_SORT_COLUMNS[query.sortBy ?? 'updatedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async createConnectorConfig(dto: CreatePlatformConnectorConfigDto, currentUser: CurrentUser) {
    const entity = this.platformConnectorConfigRepository.create({
      platform: dto.platform,
      accountId: dto.accountId,
      connectorCode: dto.connectorCode,
      connectorName: dto.connectorName,
      connectorType: dto.connectorType,
      authMode: dto.authMode ?? null,
      configJson: dto.configJson ?? null,
      status: dto.status,
      remark: dto.remark ?? null,
    });
    const saved = await this.platformConnectorConfigRepository.save(entity);
    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'create_platform_connector_config',
      operatorId: currentUser.id,
      detail: `创建连接器配置 ${saved.platform}:${saved.connectorCode}`,
      detailJson: {
        platform: saved.platform,
        accountId: saved.accountId,
        connectorCode: saved.connectorCode,
      },
    });
    return saved;
  }

  async updateConnectorConfig(
    id: number,
    dto: UpdatePlatformConnectorConfigDto,
    currentUser: CurrentUser,
  ) {
    const entity = await this.platformConnectorConfigRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException('连接器配置不存在');
    }

    if (dto.platform !== undefined) entity.platform = dto.platform;
    if (dto.accountId !== undefined) entity.accountId = dto.accountId;
    if (dto.connectorCode !== undefined) entity.connectorCode = dto.connectorCode;
    if (dto.connectorName !== undefined) entity.connectorName = dto.connectorName;
    if (dto.connectorType !== undefined) entity.connectorType = dto.connectorType;
    if (dto.authMode !== undefined) entity.authMode = dto.authMode ?? null;
    if (dto.configJson !== undefined) entity.configJson = dto.configJson ?? null;
    if (dto.status !== undefined) entity.status = dto.status;
    if (dto.remark !== undefined) entity.remark = dto.remark ?? null;

    const saved = await this.platformConnectorConfigRepository.save(entity);
    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'update_platform_connector_config',
      operatorId: currentUser.id,
      detail: `更新连接器配置 ${saved.platform}:${saved.connectorCode}`,
      detailJson: {
        platform: saved.platform,
        accountId: saved.accountId,
        connectorCode: saved.connectorCode,
      },
    });
    return saved;
  }

  private async processImportRow(
    dto: CreatePlatformImportBatchDto,
    batch: PlatformImportBatch,
    rawPayload: Record<string, unknown>,
    currentUser: CurrentUser,
  ): Promise<ProcessedImportRow> {
    switch (dto.importType) {
      case 'content':
        return this.upsertPlatformContentFromImport(dto, batch, rawPayload);
      case 'interaction':
        return this.upsertPlatformInteractionFromImport(dto, batch, rawPayload);
      case 'lead':
        return this.upsertPlatformLeadFromImport(dto, batch, rawPayload, currentUser);
      default:
        throw new BadRequestException(`不支持的导入类型：${dto.importType}`);
    }
  }

  private async upsertPlatformContentFromImport(
    dto: CreatePlatformImportBatchDto,
    batch: PlatformImportBatch,
    rawPayload: Record<string, unknown>,
  ): Promise<ProcessedImportRow> {
    const normalized = this.normalizePlatformContentRow(dto, rawPayload);
    const existing = await this.platformContentRepository.findOne({
      where: {
        platform: normalized.platform,
        accountId: normalized.accountId,
        contentId: normalized.contentId,
      },
    });

    const entity = existing ?? this.platformContentRepository.create();
    entity.platform = normalized.platform;
    entity.accountId = normalized.accountId;
    entity.contentId = normalized.contentId;
    entity.campaignId = normalized.campaignId;
    entity.title = normalized.title;
    entity.contentType = normalized.contentType;
    entity.tags = normalized.tags;
    entity.publishedAt = normalized.publishedAt;
    entity.status = normalized.status;
    entity.sourceFile = batch.sourceFile;
    entity.importBatchId = batch.id;
    entity.normalizedPayload = normalized.normalizedPayload;
    const saved = await this.platformContentRepository.save(entity);

    return {
      targetTable: 'platform_contents',
      targetId: String(saved.id),
      created: !existing,
      normalizedPayload: entity.normalizedPayload,
      sourceRecordRef: normalized.contentId,
    };
  }

  private async upsertPlatformInteractionFromImport(
    dto: CreatePlatformImportBatchDto,
    batch: PlatformImportBatch,
    rawPayload: Record<string, unknown>,
  ): Promise<ProcessedImportRow> {
    const normalized = this.normalizePlatformInteractionRow(dto, rawPayload);
    const existingQb = this.platformInteractionRepository
      .createQueryBuilder('interaction')
      .where('interaction.platform = :platform', { platform: normalized.platform })
      .andWhere('interaction.account_id = :accountId', { accountId: normalized.accountId })
      .andWhere('interaction.interaction_type = :interactionType', {
        interactionType: normalized.interactionType,
      })
      .andWhere('interaction.interaction_time = :interactionTime', {
        interactionTime: normalized.interactionTime,
      });

    if (normalized.contentId) {
      existingQb.andWhere('interaction.content_id = :contentId', { contentId: normalized.contentId });
    } else {
      existingQb.andWhere('interaction.content_id IS NULL');
    }

    if (normalized.sourceUserRef) {
      existingQb.andWhere('interaction.source_user_ref = :sourceUserRef', {
        sourceUserRef: normalized.sourceUserRef,
      });
    } else {
      existingQb.andWhere('interaction.source_user_ref IS NULL');
    }

    if (normalized.sourceSessionRef) {
      existingQb.andWhere('interaction.source_session_ref = :sourceSessionRef', {
        sourceSessionRef: normalized.sourceSessionRef,
      });
    } else {
      existingQb.andWhere('interaction.source_session_ref IS NULL');
    }

    if (normalized.sourceContactRef) {
      existingQb.andWhere('interaction.source_contact_ref = :sourceContactRef', {
        sourceContactRef: normalized.sourceContactRef,
      });
    } else {
      existingQb.andWhere('interaction.source_contact_ref IS NULL');
    }

    const existing = await existingQb.getOne();

    const entity = existing ?? this.platformInteractionRepository.create();
    entity.platform = normalized.platform;
    entity.accountId = normalized.accountId;
    entity.contentId = normalized.contentId;
    entity.interactionType = normalized.interactionType;
    entity.interactionValue = normalized.interactionValue;
    entity.interactionTime = normalized.interactionTime;
    entity.sourceUserRef = normalized.sourceUserRef;
    entity.sourceSessionRef = normalized.sourceSessionRef;
    entity.sourceContactRef = normalized.sourceContactRef;
    entity.sourceFile = batch.sourceFile;
    entity.importBatchId = batch.id;
    entity.normalizedPayload = normalized.normalizedPayload;
    const saved = await this.platformInteractionRepository.save(entity);

    return {
      targetTable: 'platform_interactions',
      targetId: String(saved.id),
      created: !existing,
      normalizedPayload: entity.normalizedPayload,
      sourceRecordRef:
        this.extractString(rawPayload, ['id', 'recordId', 'interactionRef']) ??
        `${normalized.interactionType}:${normalized.interactionTime.toISOString()}`,
    };
  }

  private async upsertPlatformLeadFromImport(
    dto: CreatePlatformImportBatchDto,
    batch: PlatformImportBatch,
    rawPayload: Record<string, unknown>,
    currentUser: CurrentUser,
  ): Promise<ProcessedImportRow> {
    const normalized = this.normalizePlatformLeadRow(dto, rawPayload);
    const result = await this.upsertPlatformLead(
      {
        ...normalized,
        sourceFile: batch.sourceFile,
        importBatchId: batch.id,
      },
      currentUser,
      batch.syncLeadMemories,
    );

    return {
      targetTable: 'platform_leads',
      targetId: String(result.lead.id),
      created: result.created,
      normalizedPayload: result.lead.normalizedPayload,
      sourceRecordRef: result.lead.leadRef,
    };
  }

  private async upsertPlatformLead(
    dto: CreatePlatformLeadDto,
    currentUser: CurrentUser,
    syncLeadMemories: boolean,
  ) {
    const existing = await this.platformLeadRepository.findOne({
      where: {
        platform: dto.platform,
        accountId: dto.accountId,
        leadRef: dto.leadRef,
      },
    });

    const entity = existing ?? this.platformLeadRepository.create();
    entity.platform = dto.platform;
    entity.accountId = dto.accountId;
    entity.leadRef = dto.leadRef;
    entity.campaignId = dto.campaignId ?? null;
    entity.contentId = dto.contentId ?? null;
    entity.interactionId = dto.interactionId ?? null;
    entity.leadType = dto.leadType ?? null;
    entity.leadStatus = dto.leadStatus;
    entity.leadValue = dto.leadValue ?? null;
    entity.sourceUserRef = dto.sourceUserRef ?? null;
    entity.sourceSessionRef = dto.sourceSessionRef ?? null;
    entity.sourceContactRef = dto.sourceContactRef ?? null;
    entity.subjectType = dto.subjectType ?? null;
    entity.subjectId = dto.subjectId ?? null;
    entity.merchantId = dto.merchantId ?? null;
    entity.employeeId = dto.employeeId ?? null;
    entity.customerId = dto.customerId ?? null;
    entity.linkedBusinessType = dto.linkedBusinessType ?? null;
    entity.linkedBusinessId = dto.linkedBusinessId ?? null;
    entity.attributionStatus = dto.leadStatus;
    entity.evidenceStatus = dto.evidenceStatus ?? 'uncertain';
    entity.confidenceScore = dto.confidenceScore ?? '0.0000';
    entity.ruleCode = dto.ruleCode ?? null;
    entity.matchedFields = dto.matchedFields ?? null;
    entity.sourceFile = dto.sourceFile ?? null;
    entity.importBatchId = dto.importBatchId ?? null;
    entity.remark = dto.remark ?? null;
    entity.normalizedPayload = dto.normalizedPayload ?? {};

    if (syncLeadMemories && entity.subjectType && entity.subjectId) {
      const linkedArtifacts = await this.syncLeadArtifacts(entity);
      entity.linkedMemoryEntryId = linkedArtifacts.memoryEntryId;
      entity.linkedRecommendationId = linkedArtifacts.recommendationId;
    }

    const saved = await this.platformLeadRepository.save(entity);

    if (!dto.importBatchId) {
      await this.operationLogsService.create({
        module: 'engagement',
        targetId: saved.id,
        action: existing ? 'update_platform_lead' : 'create_platform_lead',
        operatorId: currentUser.id,
        detail: `${existing ? '更新' : '创建'}平台线索 ${saved.platform}:${saved.leadRef}`,
        detailJson: {
          platform: saved.platform,
          accountId: saved.accountId,
          leadRef: saved.leadRef,
        },
      });
    }

    return { lead: saved, created: !existing };
  }

  private async syncLeadArtifacts(lead: PlatformLead) {
    let memoryEntryId = lead.linkedMemoryEntryId ?? null;
    let recommendationId = lead.linkedRecommendationId ?? null;

    if (!lead.subjectType || !lead.subjectId) {
      return { memoryEntryId, recommendationId };
    }

    const memoryPayload = {
      leadRef: lead.leadRef,
      platform: lead.platform,
      accountId: lead.accountId,
      campaignId: lead.campaignId,
      contentId: lead.contentId,
      interactionId: lead.interactionId,
      leadType: lead.leadType,
      leadStatus: lead.leadStatus,
      merchantId: lead.merchantId,
      employeeId: lead.employeeId,
      customerId: lead.customerId,
      linkedBusinessType: lead.linkedBusinessType,
      linkedBusinessId: lead.linkedBusinessId,
      sourceFile: lead.sourceFile,
      importBatchId: lead.importBatchId,
    };
    if (memoryEntryId) {
      const memory = await this.memoryEntryRepository.findOne({ where: { id: memoryEntryId } });
      if (memory) {
        memory.content = `平台线索导入：${lead.leadValue ?? lead.leadType ?? lead.leadRef}`;
        memory.evidenceStatus = lead.evidenceStatus;
        memory.confidenceScore = lead.confidenceScore;
        memory.normalizedPayload = memoryPayload;
        await this.memoryEntryRepository.save(memory);
      }
    } else {
      const created = await this.memoryEntryRepository.save(
        this.memoryEntryRepository.create({
          subjectType: lead.subjectType,
          subjectId: lead.subjectId,
          memoryType: 'platform_lead',
          content: `平台线索导入：${lead.leadValue ?? lead.leadType ?? lead.leadRef}`,
          sourceType: 'platform_lead',
          sourceId: lead.leadRef,
          evidenceStatus: lead.evidenceStatus,
          confidenceScore: lead.confidenceScore,
          isActive: true,
          normalizedPayload: memoryPayload,
        }),
      );
      memoryEntryId = created.id;
    }

    const recommendationPayload = {
      leadRef: lead.leadRef,
      platform: lead.platform,
      accountId: lead.accountId,
      campaignId: lead.campaignId,
      contentId: lead.contentId,
      interactionId: lead.interactionId,
      merchantId: lead.merchantId,
      employeeId: lead.employeeId,
      customerId: lead.customerId,
      linkedBusinessType: lead.linkedBusinessType,
      linkedBusinessId: lead.linkedBusinessId,
      sourceFile: lead.sourceFile,
      importBatchId: lead.importBatchId,
    };
    if (recommendationId) {
      const recommendation = await this.aiRecommendationRepository.findOne({
        where: { id: recommendationId },
      });
      if (recommendation) {
        recommendation.recommendationText = `建议跟进平台线索 ${lead.leadRef}，确认客户需求与归属。`;
        recommendation.recommendationReason = '该线索由平台导入产生，建议尽快人工核实并跟进。';
        recommendation.evidenceStatus = lead.evidenceStatus;
        recommendation.confidenceScore = lead.confidenceScore;
        recommendation.sourceContext = recommendationPayload;
        recommendation.status = 'active';
        await this.aiRecommendationRepository.save(recommendation);
      }
    } else {
      const created = await this.aiRecommendationRepository.save(
        this.aiRecommendationRepository.create({
          subjectType: lead.subjectType,
          subjectId: lead.subjectId,
          recommendationType: 'followup_suggestion',
          recommendationText: `建议跟进平台线索 ${lead.leadRef}，确认客户需求与归属。`,
          recommendationReason: '该线索由平台导入产生，建议尽快人工核实并跟进。',
          sourceContext: recommendationPayload,
          evidenceStatus: lead.evidenceStatus,
          confidenceScore: lead.confidenceScore,
          status: 'active',
        }),
      );
      recommendationId = created.id;
    }

    return { memoryEntryId, recommendationId };
  }

  private normalizePlatformContentRow(dto: CreatePlatformImportBatchDto, row: Record<string, unknown>) {
    const platform = this.extractString(row, ['platform', 'sourcePlatform']) ?? dto.sourcePlatform;
    const accountId = this.extractString(row, ['accountId', 'account_id']) ?? dto.accountId;
    const contentId = this.extractString(row, ['contentId', 'content_id']);
    const title = this.extractString(row, ['title']);
    const contentType = this.extractString(row, ['contentType', 'content_type']) ?? 'unknown';
    if (!accountId || !contentId || !title) {
      throw new BadRequestException('平台内容缺少 accountId / contentId / title');
    }

    return {
      platform,
      accountId,
      contentId,
      campaignId: this.extractString(row, ['campaignId', 'campaign_id']),
      title,
      contentType,
      tags: this.extractTags(row),
      publishedAt: this.parseDateValue(this.extractString(row, ['publishedAt', 'published_at'])),
      status: this.extractString(row, ['status']) ?? 'imported',
      normalizedPayload: row,
    };
  }

  private normalizePlatformInteractionRow(dto: CreatePlatformImportBatchDto, row: Record<string, unknown>) {
    const platform = this.extractString(row, ['platform', 'sourcePlatform']) ?? dto.sourcePlatform;
    const accountId = this.extractString(row, ['accountId', 'account_id']) ?? dto.accountId;
    const interactionType = this.extractString(row, ['interactionType', 'interaction_type']);
    const interactionTime = this.parseDateValue(
      this.extractString(row, ['interactionTime', 'interaction_time', 'occurredAt', 'occurred_at']),
    );
    if (!accountId || !interactionType || !interactionTime) {
      throw new BadRequestException('平台互动缺少 accountId / interactionType / interactionTime');
    }

    return {
      platform,
      accountId,
      contentId: this.extractString(row, ['contentId', 'content_id']),
      interactionType,
      interactionValue: this.extractString(row, ['interactionValue', 'interaction_value']),
      interactionTime,
      sourceUserRef: this.extractString(row, ['sourceUserRef', 'source_user_ref']),
      sourceSessionRef: this.extractString(row, ['sourceSessionRef', 'source_session_ref']),
      sourceContactRef: this.extractString(row, ['sourceContactRef', 'source_contact_ref', 'mobile', 'phone']),
      normalizedPayload: row,
    };
  }

  private normalizePlatformLeadRow(dto: CreatePlatformImportBatchDto, row: Record<string, unknown>): CreatePlatformLeadDto {
    const accountId = this.extractString(row, ['accountId', 'account_id']) ?? dto.accountId;
    const leadRef =
      this.extractString(row, ['leadRef', 'lead_ref', 'id', 'recordId']) ??
      `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    if (!accountId) {
      throw new BadRequestException('平台线索缺少 accountId');
    }

    const rawLeadStatus =
      this.extractString(row, ['leadStatus', 'lead_status', 'attributionStatus', 'attribution_status']) ?? 'unknown';
    const rawEvidenceStatus = this.extractString(row, ['evidenceStatus', 'evidence_status']) ?? 'uncertain';

    return {
      platform: this.extractString(row, ['platform', 'sourcePlatform']) ?? dto.sourcePlatform,
      accountId,
      leadRef,
      campaignId: this.extractString(row, ['campaignId', 'campaign_id']) ?? undefined,
      contentId: this.extractString(row, ['contentId', 'content_id']) ?? undefined,
      interactionId: this.extractNumber(row, ['interactionId', 'interaction_id']) ?? undefined,
      leadType: this.extractString(row, ['leadType', 'lead_type']) ?? undefined,
      leadStatus:
        rawLeadStatus === 'confirmed' || rawLeadStatus === 'inferred' ? rawLeadStatus : 'unknown',
      leadValue: this.extractString(row, ['leadValue', 'lead_value', 'content']) ?? undefined,
      sourceUserRef: this.extractString(row, ['sourceUserRef', 'source_user_ref']) ?? undefined,
      sourceSessionRef: this.extractString(row, ['sourceSessionRef', 'source_session_ref']) ?? undefined,
      sourceContactRef:
        this.extractString(row, ['sourceContactRef', 'source_contact_ref', 'mobile', 'phone']) ?? undefined,
      subjectType: this.extractString(row, ['subjectType', 'subject_type']) ?? undefined,
      subjectId: this.extractNumber(row, ['subjectId', 'subject_id']) ?? undefined,
      merchantId: this.extractNumber(row, ['merchantId', 'merchant_id']) ?? undefined,
      employeeId: this.extractNumber(row, ['employeeId', 'employee_id']) ?? undefined,
      customerId: this.extractNumber(row, ['customerId', 'customer_id']) ?? undefined,
      linkedBusinessType:
        this.extractString(row, ['linkedBusinessType', 'linked_business_type', 'businessType', 'business_type']) ??
        undefined,
      linkedBusinessId:
        this.extractString(row, ['linkedBusinessId', 'linked_business_id', 'businessId', 'business_id']) ?? undefined,
      evidenceStatus:
        rawEvidenceStatus === 'confirmed' || rawEvidenceStatus === 'inferred'
          ? rawEvidenceStatus
          : 'uncertain',
      confidenceScore:
        this.extractString(row, ['confidenceScore', 'confidence_score']) ??
        (this.extractNumber(row, ['confidenceScore', 'confidence_score']) != null
          ? String(this.extractNumber(row, ['confidenceScore', 'confidence_score']))
          : undefined),
      ruleCode: this.extractString(row, ['ruleCode', 'rule_code']) ?? undefined,
      matchedFields: this.asRecord(row.matchedFields ?? row.matched_fields),
      remark: this.extractString(row, ['remark']) ?? undefined,
      normalizedPayload: row,
    };
  }

  private parseImportFile(sourceFormat: SourceFormat, fileBuffer: Buffer) {
    if (sourceFormat === 'json') {
      const parsed = JSON.parse(fileBuffer.toString('utf8'));
      if (Array.isArray(parsed)) {
        return parsed.map((item) => this.asRecord(item));
      }
      if (Array.isArray(parsed?.records)) {
        return parsed.records.map((item: unknown) => this.asRecord(item));
      }
      throw new BadRequestException('JSON 文件必须是数组或包含 records 数组');
    }

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new BadRequestException('导入文件缺少可用工作表');
    }
    const firstSheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_json(firstSheet, { defval: null, raw: false }).map((item) => this.asRecord(item));
  }

  private detectSourceFormat(fileName: string): SourceFormat {
    const extension = extname(fileName).toLowerCase();
    if (extension === '.json') return 'json';
    if (extension === '.csv') return 'csv';
    if (extension === '.xlsx' || extension === '.xls') return 'xlsx';
    throw new BadRequestException('仅支持 CSV / Excel / JSON 导入');
  }

  private async persistImportFile(originalName: string, buffer: Buffer) {
    const importDir = resolve(process.cwd(), 'tmp', 'engagement-imports');
    await mkdir(importDir, { recursive: true });
    const safeName = originalName.replace(/[^\w.-]+/g, '_');
    const fileName = `${Date.now()}-${safeName}`;
    const filePath = resolve(importDir, fileName);
    await writeFile(filePath, buffer);
    return filePath;
  }

  private extractString(source: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = source[key];
      if (value === undefined || value === null || value === '') continue;
      return String(value).trim();
    }
    return null;
  }

  private extractNumber(source: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = source[key];
      if (value === undefined || value === null || value === '') continue;
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  private extractTags(source: Record<string, unknown>) {
    const rawValue = source.tags ?? source.tagList ?? source.tag_list;
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return null;
    }
    if (Array.isArray(rawValue)) {
      return rawValue.map((item) => String(item));
    }
    const text = String(rawValue);
    return text
      .split(/[;,，|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private parseDateValue(value: string | null) {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`无法解析日期字段：${value}`);
    }
    return parsed;
  }

  private asRecord(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {} as Record<string, unknown>;
    }
    return value as Record<string, unknown>;
  }

  private normalizeSortOrder(sortOrder: string | undefined, fallback: 'ASC' | 'DESC') {
    if (!sortOrder) return fallback;
    return sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  }
}
