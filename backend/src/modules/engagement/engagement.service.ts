import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { buildPaginationResult, getPagination } from '../../common/utils/pagination.util';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { CreateAiRecommendationDto } from './dto/create-ai-recommendation.dto';
import { CreateInteractionLinkDto } from './dto/create-interaction-link.dto';
import { CreateMemoryEntryDto } from './dto/create-memory-entry.dto';
import { CreatePlatformContentDto } from './dto/create-platform-content.dto';
import { CreatePlatformInteractionDto } from './dto/create-platform-interaction.dto';
import { DeactivateMemoryEntryDto } from './dto/deactivate-memory-entry.dto';
import { QueryAiRecommendationsDto } from './dto/query-ai-recommendations.dto';
import { QueryInteractionLinksDto } from './dto/query-interaction-links.dto';
import { QueryMemoryEntriesDto } from './dto/query-memory-entries.dto';
import { QueryPlatformContentsDto } from './dto/query-platform-contents.dto';
import { QueryPlatformInteractionsDto } from './dto/query-platform-interactions.dto';
import { UpdateMemoryEntryDto } from './dto/update-memory-entry.dto';
import { AiRecommendation } from './entities/ai-recommendation.entity';
import { InteractionLink } from './entities/interaction-link.entity';
import { MemoryEntry } from './entities/memory-entry.entity';
import { PlatformContent } from './entities/platform-content.entity';
import { PlatformInteraction } from './entities/platform-interaction.entity';

const PLATFORM_CONTENT_SORT_COLUMNS: Record<string, string> = {
  platform: 'content.platform',
  accountId: 'content.account_id',
  campaignId: 'content.campaign_id',
  contentType: 'content.content_type',
  status: 'content.status',
  publishedAt: 'content.published_at',
  createdAt: 'content.created_at',
  updatedAt: 'content.updated_at',
};

const PLATFORM_INTERACTION_SORT_COLUMNS: Record<string, string> = {
  platform: 'interaction.platform',
  accountId: 'interaction.account_id',
  contentId: 'interaction.content_id',
  interactionType: 'interaction.interaction_type',
  interactionTime: 'interaction.interaction_time',
  createdAt: 'interaction.created_at',
  updatedAt: 'interaction.updated_at',
};

const MEMORY_ENTRY_SORT_COLUMNS: Record<string, string> = {
  subjectType: 'memory.subject_type',
  subjectId: 'memory.subject_id',
  memoryType: 'memory.memory_type',
  evidenceStatus: 'memory.evidence_status',
  expiresAt: 'memory.expires_at',
  createdAt: 'memory.created_at',
  updatedAt: 'memory.updated_at',
};

const INTERACTION_LINK_SORT_COLUMNS: Record<string, string> = {
  interactionId: 'link.interactionId',
  linkedSubjectType: 'link.linkedSubjectType',
  linkedSubjectId: 'link.linkedSubjectId',
  linkedBusinessType: 'link.linkedBusinessType',
  attributionStatus: 'link.attributionStatus',
  createdAt: 'link.createdAt',
  updatedAt: 'link.updatedAt',
};

const AI_RECOMMENDATION_SORT_COLUMNS: Record<string, string> = {
  subjectType: 'recommendation.subject_type',
  subjectId: 'recommendation.subject_id',
  recommendationType: 'recommendation.recommendation_type',
  status: 'recommendation.status',
  evidenceStatus: 'recommendation.evidence_status',
  createdAt: 'recommendation.created_at',
  updatedAt: 'recommendation.updated_at',
};

@Injectable()
export class EngagementService {
  constructor(
    @InjectRepository(PlatformContent)
    private readonly platformContentRepository: Repository<PlatformContent>,
    @InjectRepository(PlatformInteraction)
    private readonly platformInteractionRepository: Repository<PlatformInteraction>,
    @InjectRepository(MemoryEntry)
    private readonly memoryEntryRepository: Repository<MemoryEntry>,
    @InjectRepository(InteractionLink)
    private readonly interactionLinkRepository: Repository<InteractionLink>,
    @InjectRepository(AiRecommendation)
    private readonly aiRecommendationRepository: Repository<AiRecommendation>,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async createPlatformContent(dto: CreatePlatformContentDto, currentUser: CurrentUser) {
    const entity = this.platformContentRepository.create({
      platform: dto.platform,
      accountId: dto.accountId,
      contentId: dto.contentId,
      campaignId: dto.campaignId ?? null,
      title: dto.title,
      contentType: dto.contentType,
      tags: dto.tags ?? null,
      publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
      status: dto.status,
      normalizedPayload: dto.normalizedPayload ?? {},
    });
    const saved = await this.platformContentRepository.save(entity);
    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'create_platform_content',
      operatorId: currentUser.id,
      detail: `创建平台内容 ${saved.platform}:${saved.contentId}`,
      detailJson: {
        platform: saved.platform,
        accountId: saved.accountId,
        contentId: saved.contentId,
      },
    });
    return saved;
  }

  async findPlatformContents(query: QueryPlatformContentsDto) {
    const { skip, take } = getPagination(query);
    const qb = this.platformContentRepository.createQueryBuilder('content');

    if (query.platform) {
      qb.andWhere('content.platform = :platform', { platform: query.platform });
    }
    if (query.accountId) {
      qb.andWhere('content.account_id = :accountId', { accountId: query.accountId });
    }
    if (query.campaignId) {
      qb.andWhere('content.campaign_id = :campaignId', { campaignId: query.campaignId });
    }
    if (query.contentType) {
      qb.andWhere('content.content_type = :contentType', { contentType: query.contentType });
    }
    if (query.importBatchId) {
      qb.andWhere('content.import_batch_id = :importBatchId', { importBatchId: query.importBatchId });
    }
    if (query.sourceFile) {
      qb.andWhere('content.source_file LIKE :sourceFile', { sourceFile: `%${query.sourceFile}%` });
    }
    if (query.status) {
      qb.andWhere('content.status = :status', { status: query.status });
    }
    if (query.dateFrom) {
      qb.andWhere('content.published_at >= :dateFrom', { dateFrom: new Date(query.dateFrom) });
    }
    if (query.dateTo) {
      qb.andWhere('content.published_at <= :dateTo', { dateTo: new Date(query.dateTo) });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        PLATFORM_CONTENT_SORT_COLUMNS[query.sortBy ?? 'publishedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async findPlatformContentById(id: number) {
    const record = await this.platformContentRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('平台内容不存在');
    }
    return record;
  }

  async createPlatformInteraction(dto: CreatePlatformInteractionDto, currentUser: CurrentUser) {
    const entity = this.platformInteractionRepository.create({
      platform: dto.platform,
      accountId: dto.accountId,
      contentId: dto.contentId ?? null,
      interactionType: dto.interactionType,
      interactionValue: dto.interactionValue ?? null,
      interactionTime: new Date(dto.interactionTime),
      sourceUserRef: dto.sourceUserRef ?? null,
      sourceSessionRef: dto.sourceSessionRef ?? null,
      sourceContactRef: dto.sourceContactRef ?? null,
      normalizedPayload: dto.normalizedPayload ?? {},
    });
    const saved = await this.platformInteractionRepository.save(entity);
    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'create_platform_interaction',
      operatorId: currentUser.id,
      detail: `创建平台互动 ${saved.platform}:${saved.interactionType}`,
      detailJson: {
        platform: saved.platform,
        accountId: saved.accountId,
        interactionType: saved.interactionType,
      },
    });
    return saved;
  }

  async findPlatformInteractions(query: QueryPlatformInteractionsDto) {
    const { skip, take } = getPagination(query);
    const qb = this.platformInteractionRepository.createQueryBuilder('interaction');

    if (query.platform) {
      qb.andWhere('interaction.platform = :platform', { platform: query.platform });
    }
    if (query.accountId) {
      qb.andWhere('interaction.account_id = :accountId', { accountId: query.accountId });
    }
    if (query.contentId) {
      qb.andWhere('interaction.content_id = :contentId', { contentId: query.contentId });
    }
    if (query.interactionType) {
      qb.andWhere('interaction.interaction_type = :interactionType', {
        interactionType: query.interactionType,
      });
    }
    if (query.sourceUserRef) {
      qb.andWhere('interaction.source_user_ref = :sourceUserRef', {
        sourceUserRef: query.sourceUserRef,
      });
    }
    if (query.sourceContactRef) {
      qb.andWhere('interaction.source_contact_ref = :sourceContactRef', {
        sourceContactRef: query.sourceContactRef,
      });
    }
    if (query.dateFrom) {
      qb.andWhere('interaction.interaction_time >= :dateFrom', {
        dateFrom: new Date(query.dateFrom),
      });
    }
    if (query.dateTo) {
      qb.andWhere('interaction.interaction_time <= :dateTo', {
        dateTo: new Date(query.dateTo),
      });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        PLATFORM_INTERACTION_SORT_COLUMNS[query.sortBy ?? 'interactionTime'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async findPlatformInteractionById(id: number) {
    const record = await this.platformInteractionRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('平台互动不存在');
    }
    return record;
  }

  async createMemoryEntry(dto: CreateMemoryEntryDto, currentUser: CurrentUser) {
    const entity = this.memoryEntryRepository.create({
      subjectType: dto.subjectType,
      subjectId: dto.subjectId,
      memoryType: dto.memoryType,
      content: dto.content,
      sourceType: dto.sourceType,
      sourceId: dto.sourceId ?? null,
      evidenceStatus: dto.evidenceStatus,
      confidenceScore: dto.confidenceScore.toFixed(4),
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      isActive: dto.isActive ?? true,
      normalizedPayload: dto.normalizedPayload ?? {},
    });
    const saved = await this.memoryEntryRepository.save(entity);
    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'create_memory_entry',
      operatorId: currentUser.id,
      detail: `创建记忆条目 ${saved.subjectType}:${saved.subjectId}`,
      detailJson: {
        subjectType: saved.subjectType,
        subjectId: saved.subjectId,
        memoryType: saved.memoryType,
        evidenceStatus: saved.evidenceStatus,
      },
    });
    return saved;
  }

  async findMemoryEntries(query: QueryMemoryEntriesDto) {
    const { skip, take } = getPagination(query);
    const qb = this.memoryEntryRepository.createQueryBuilder('memory');

    if (query.subjectType) {
      qb.andWhere('memory.subject_type = :subjectType', { subjectType: query.subjectType });
    }
    if (query.subjectId) {
      qb.andWhere('memory.subject_id = :subjectId', { subjectId: query.subjectId });
    }
    if (query.memoryType) {
      qb.andWhere('memory.memory_type = :memoryType', { memoryType: query.memoryType });
    }
    if (query.evidenceStatus) {
      qb.andWhere('memory.evidence_status = :evidenceStatus', {
        evidenceStatus: query.evidenceStatus,
      });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('memory.is_active = :isActive', { isActive: query.isActive });
    }
    if (query.dateFrom) {
      qb.andWhere('memory.created_at >= :dateFrom', { dateFrom: new Date(query.dateFrom) });
    }
    if (query.dateTo) {
      qb.andWhere('memory.created_at <= :dateTo', { dateTo: new Date(query.dateTo) });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        MEMORY_ENTRY_SORT_COLUMNS[query.sortBy ?? 'createdAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async findMemoryEntryById(id: number) {
    const record = await this.memoryEntryRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('记忆条目不存在');
    }
    return record;
  }

  async updateMemoryEntry(id: number, dto: UpdateMemoryEntryDto, currentUser: CurrentUser) {
    const record = await this.findMemoryEntryById(id);
    const before = {
      memoryType: record.memoryType,
      content: record.content,
      evidenceStatus: record.evidenceStatus,
      confidenceScore: record.confidenceScore,
      expiresAt: record.expiresAt,
      isActive: record.isActive,
    };

    if (dto.memoryType !== undefined) record.memoryType = dto.memoryType;
    if (dto.content !== undefined) record.content = dto.content;
    if (dto.sourceType !== undefined) record.sourceType = dto.sourceType;
    if (dto.sourceId !== undefined) record.sourceId = dto.sourceId ?? null;
    if (dto.evidenceStatus !== undefined) record.evidenceStatus = dto.evidenceStatus;
    if (dto.confidenceScore !== undefined) {
      record.confidenceScore = dto.confidenceScore.toFixed(4);
    }
    if (dto.expiresAt !== undefined) {
      record.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }
    if (dto.isActive !== undefined) record.isActive = dto.isActive;
    if (dto.normalizedPayload !== undefined) {
      record.normalizedPayload = dto.normalizedPayload;
    }

    const saved = await this.memoryEntryRepository.save(record);
    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'update_memory_entry',
      operatorId: currentUser.id,
      detail: `更新记忆条目 ${saved.subjectType}:${saved.subjectId}`,
      detailJson: {
        before,
        after: {
          memoryType: saved.memoryType,
          content: saved.content,
          evidenceStatus: saved.evidenceStatus,
          confidenceScore: saved.confidenceScore,
          expiresAt: saved.expiresAt,
          isActive: saved.isActive,
        },
      },
    });
    return saved;
  }

  async deactivateMemoryEntry(id: number, dto: DeactivateMemoryEntryDto, currentUser: CurrentUser) {
    const record = await this.findMemoryEntryById(id);
    record.isActive = false;
    record.normalizedPayload = {
      ...(record.normalizedPayload ?? {}),
      deactivatedReason: dto.reason ?? null,
      deactivatedBy: currentUser.id,
      deactivatedAt: new Date().toISOString(),
    };
    const saved = await this.memoryEntryRepository.save(record);
    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'deactivate_memory_entry',
      operatorId: currentUser.id,
      detail: `停用记忆条目 ${saved.subjectType}:${saved.subjectId}`,
      detailJson: {
        reason: dto.reason ?? null,
        subjectType: saved.subjectType,
        subjectId: saved.subjectId,
      },
    });
    return saved;
  }

  async createInteractionLink(dto: CreateInteractionLinkDto, currentUser: CurrentUser) {
    await this.findPlatformInteractionById(dto.interactionId);
    const entity = this.interactionLinkRepository.create({
      interactionId: dto.interactionId,
      linkedSubjectType: dto.linkedSubjectType,
      linkedSubjectId: dto.linkedSubjectId,
      linkedBusinessType: dto.linkedBusinessType ?? null,
      linkedBusinessId: dto.linkedBusinessId ?? null,
      attributionStatus: dto.attributionStatus,
      attributionConfidence: dto.attributionConfidence.toFixed(4),
      remark: dto.remark ?? null,
    });
    const saved = await this.interactionLinkRepository.save(entity);
    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'create_interaction_link',
      operatorId: currentUser.id,
      detail: `创建互动关联 ${saved.interactionId}`,
      detailJson: {
        interactionId: saved.interactionId,
        linkedSubjectType: saved.linkedSubjectType,
        linkedSubjectId: saved.linkedSubjectId,
        linkedBusinessType: saved.linkedBusinessType,
        linkedBusinessId: saved.linkedBusinessId,
      },
    });
    return saved;
  }

  async findInteractionLinks(query: QueryInteractionLinksDto) {
    const { skip, take } = getPagination(query);
    const qb = this.interactionLinkRepository.createQueryBuilder('link');

    if (query.interactionId) {
      qb.andWhere('link.interaction_id = :interactionId', { interactionId: query.interactionId });
    }
    if (query.linkedSubjectType) {
      qb.andWhere('link.linked_subject_type = :linkedSubjectType', {
        linkedSubjectType: query.linkedSubjectType,
      });
    }
    if (query.linkedSubjectId) {
      qb.andWhere('link.linked_subject_id = :linkedSubjectId', {
        linkedSubjectId: query.linkedSubjectId,
      });
    }
    if (query.linkedBusinessType) {
      qb.andWhere('link.linked_business_type = :linkedBusinessType', {
        linkedBusinessType: query.linkedBusinessType,
      });
    }
    if (query.linkedBusinessId) {
      qb.andWhere('link.linked_business_id = :linkedBusinessId', {
        linkedBusinessId: query.linkedBusinessId,
      });
    }
    if (query.attributionStatus) {
      qb.andWhere('link.attribution_status = :attributionStatus', {
        attributionStatus: query.attributionStatus,
      });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .leftJoinAndSelect('link.interaction', 'interaction')
      .orderBy(
        INTERACTION_LINK_SORT_COLUMNS[query.sortBy ?? 'createdAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async createAiRecommendation(dto: CreateAiRecommendationDto, currentUser: CurrentUser) {
    const entity = this.aiRecommendationRepository.create({
      subjectType: dto.subjectType,
      subjectId: dto.subjectId,
      recommendationType: dto.recommendationType,
      recommendationText: dto.recommendationText,
      recommendationReason: dto.recommendationReason ?? null,
      recommendationRuleId: dto.recommendationRuleId ?? null,
      matchedMemoryEntryId: dto.matchedMemoryEntryId ?? null,
      matchedInteractionId: dto.matchedInteractionId ?? null,
      sourceContext: dto.sourceContext ?? {},
      evidenceStatus: dto.evidenceStatus,
      confidenceScore: dto.confidenceScore.toFixed(4),
      ruleStrength: dto.ruleStrength ?? null,
      status: dto.status,
    });
    const saved = await this.aiRecommendationRepository.save(entity);
    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'create_ai_recommendation',
      operatorId: currentUser.id,
      detail: `创建AI推荐 ${saved.recommendationType}`,
      detailJson: {
        subjectType: saved.subjectType,
        subjectId: saved.subjectId,
        recommendationType: saved.recommendationType,
        evidenceStatus: saved.evidenceStatus,
      },
    });
    return saved;
  }

  async findAiRecommendations(query: QueryAiRecommendationsDto) {
    const { skip, take } = getPagination(query);
    const qb = this.aiRecommendationRepository.createQueryBuilder('recommendation');

    if (query.subjectType) {
      qb.andWhere('recommendation.subject_type = :subjectType', {
        subjectType: query.subjectType,
      });
    }
    if (query.subjectId) {
      qb.andWhere('recommendation.subject_id = :subjectId', {
        subjectId: query.subjectId,
      });
    }
    if (query.recommendationType) {
      qb.andWhere('recommendation.recommendation_type = :recommendationType', {
        recommendationType: query.recommendationType,
      });
    }
    if (query.status) {
      qb.andWhere('recommendation.status = :status', { status: query.status });
    }
    if (query.evidenceStatus) {
      qb.andWhere('recommendation.evidence_status = :evidenceStatus', {
        evidenceStatus: query.evidenceStatus,
      });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        AI_RECOMMENDATION_SORT_COLUMNS[query.sortBy ?? 'createdAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async findAiRecommendationById(id: number) {
    const record = await this.aiRecommendationRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('AI推荐不存在');
    }
    return record;
  }

  private normalizeSortOrder(sortOrder: string | undefined, fallback: 'ASC' | 'DESC') {
    if (!sortOrder) {
      return fallback;
    }
    return sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  }
}
