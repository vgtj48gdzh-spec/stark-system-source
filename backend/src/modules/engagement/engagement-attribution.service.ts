import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { buildPaginationResult, getPagination } from '../../common/utils/pagination.util';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { Employee } from '../performance/entities/employee.entity';
import { ConfirmAttributionDto } from './dto/confirm-attribution.dto';
import { GenerateAttributionsDto } from './dto/generate-attributions.dto';
import { GenerateLeadCandidatesDto } from './dto/generate-lead-candidates.dto';
import { QueryAttributionResultsDto } from './dto/query-attribution-results.dto';
import { QueryFollowupSuggestionsDto } from './dto/query-followup-suggestions.dto';
import { QueryLeadCandidatesDto } from './dto/query-lead-candidates.dto';
import { QueryProfileSnapshotsDto } from './dto/query-profile-snapshots.dto';
import { ReassignAttributionDto } from './dto/reassign-attribution.dto';
import { RejectAttributionDto } from './dto/reject-attribution.dto';
import { AiRecommendation } from './entities/ai-recommendation.entity';
import { AttributionResult } from './entities/attribution-result.entity';
import { AttributionRule } from './entities/attribution-rule.entity';
import { InteractionLink } from './entities/interaction-link.entity';
import { LeadCandidate } from './entities/lead-candidate.entity';
import { MemoryEntry } from './entities/memory-entry.entity';
import { PlatformContent } from './entities/platform-content.entity';
import { PlatformInteraction } from './entities/platform-interaction.entity';
import { ProfileSnapshot } from './entities/profile-snapshot.entity';

const LEAD_CANDIDATE_SORT_COLUMNS: Record<string, string> = {
  platform: 'candidate.platform',
  candidateType: 'candidate.candidateType',
  status: 'candidate.status',
  evidenceStatus: 'candidate.evidenceStatus',
  confidenceScore: 'candidate.confidenceScore',
  createdAt: 'candidate.createdAt',
  updatedAt: 'candidate.updatedAt',
};

const ATTRIBUTION_RESULT_SORT_COLUMNS: Record<string, string> = {
  attributionStatus: 'result.attributionStatus',
  evidenceStatus: 'result.evidenceStatus',
  confidenceScore: 'result.confidenceScore',
  merchantId: 'result.merchantId',
  employeeId: 'result.employeeId',
  handledAt: 'result.handledAt',
  createdAt: 'result.createdAt',
  updatedAt: 'result.updatedAt',
};

const PROFILE_SNAPSHOT_SORT_COLUMNS: Record<string, string> = {
  displayName: 'snapshot.displayName',
  mobile: 'snapshot.mobile',
  interactionCount: 'snapshot.interactionCount',
  memoryCount: 'snapshot.memoryCount',
  attributedBusinessCount: 'snapshot.attributedBusinessCount',
  latestInteractionAt: 'snapshot.latestInteractionAt',
  updatedAt: 'snapshot.updatedAt',
};

const FOLLOWUP_SUGGESTION_SORT_COLUMNS: Record<string, string> = {
  subjectType: 'recommendation.subjectType',
  subjectId: 'recommendation.subjectId',
  evidenceStatus: 'recommendation.evidenceStatus',
  status: 'recommendation.status',
  createdAt: 'recommendation.createdAt',
  updatedAt: 'recommendation.updatedAt',
};

type GeneratedAttribution = {
  attributedSubjectType: string | null;
  attributedSubjectId: number | null;
  merchantId: number | null;
  employeeId: number | null;
  attributedBusinessType: string | null;
  attributedBusinessId: string | null;
  attributionStatus: 'confirmed' | 'inferred' | 'unknown';
  evidenceStatus: 'confirmed' | 'inferred' | 'uncertain';
  confidenceScore: string;
  ruleCode: string | null;
  matchedFields: Record<string, unknown>;
  remark: string | null;
  normalizedPayload: Record<string, unknown>;
};

@Injectable()
export class EngagementAttributionService {
  constructor(
    @InjectRepository(PlatformInteraction)
    private readonly platformInteractionRepository: Repository<PlatformInteraction>,
    @InjectRepository(PlatformContent)
    private readonly platformContentRepository: Repository<PlatformContent>,
    @InjectRepository(MemoryEntry)
    private readonly memoryEntryRepository: Repository<MemoryEntry>,
    @InjectRepository(InteractionLink)
    private readonly interactionLinkRepository: Repository<InteractionLink>,
    @InjectRepository(AiRecommendation)
    private readonly aiRecommendationRepository: Repository<AiRecommendation>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(LeadCandidate)
    private readonly leadCandidateRepository: Repository<LeadCandidate>,
    @InjectRepository(AttributionRule)
    private readonly attributionRuleRepository: Repository<AttributionRule>,
    @InjectRepository(AttributionResult)
    private readonly attributionResultRepository: Repository<AttributionResult>,
    @InjectRepository(ProfileSnapshot)
    private readonly profileSnapshotRepository: Repository<ProfileSnapshot>,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async generateLeadCandidates(dto: GenerateLeadCandidatesDto, currentUser: CurrentUser) {
    const interactions = await this.loadInteractionsForGeneration(dto);
    let created = 0;
    let updated = 0;

    for (const interaction of interactions) {
      const payload = this.asRecord(interaction.normalizedPayload);
      const content = await this.findPlatformContent(interaction.platform, interaction.contentId);
      const contentPayload = this.asRecord(content?.normalizedPayload);
      const merchantId =
        this.extractNumber(payload, ['merchantId', 'merchant_id']) ??
        this.extractNumber(contentPayload, ['merchantId', 'merchant_id']);
      const employeeId = this.extractNumber(payload, ['employeeId', 'employee_id']);
      const subjectType = this.extractString(payload, ['subjectType', 'subject_type']);
      const subjectId = this.extractNumber(payload, [
        'subjectId',
        'subject_id',
        'customerId',
        'customer_id',
      ]);
      const businessLink = this.detectBusinessLink(payload);
      const candidateRef =
        interaction.sourceContactRef ??
        interaction.sourceUserRef ??
        interaction.sourceSessionRef ??
        null;
      const candidateType =
        subjectType ??
        (employeeId ? 'employee' : candidateRef ? 'customer' : merchantId ? 'merchant' : 'unknown');
      const matchedFields: Record<string, unknown> = {
        sourceContactRef: interaction.sourceContactRef,
        sourceUserRef: interaction.sourceUserRef,
        sourceSessionRef: interaction.sourceSessionRef,
        merchantId,
        employeeId,
        linkedSubjectType: subjectType,
        linkedSubjectId: subjectId,
        linkedBusinessType: businessLink.type,
        linkedBusinessId: businessLink.id,
      };

      const existing = await this.leadCandidateRepository.findOne({
        where: { interactionId: interaction.id },
      });
      if (existing && !dto.forceRegenerate) {
        continue;
      }

      const entity =
        existing ?? this.leadCandidateRepository.create({ interactionId: interaction.id });
      entity.platform = interaction.platform;
      entity.accountId = interaction.accountId;
      entity.contentId = interaction.contentId;
      entity.campaignId =
        this.extractString(payload, ['campaignId', 'campaign_id']) ?? content?.campaignId ?? null;
      entity.candidateType = candidateType;
      entity.candidateRef = candidateRef;
      entity.merchantId = merchantId;
      entity.employeeId = employeeId;
      entity.linkedSubjectType = subjectType;
      entity.linkedSubjectId = subjectId;
      entity.linkedBusinessType = businessLink.type;
      entity.linkedBusinessId = businessLink.id;
      entity.status = 'pending';
      entity.evidenceStatus = subjectType || merchantId || employeeId ? 'inferred' : 'uncertain';
      entity.confidenceScore = this.formatScore(subjectType || merchantId || employeeId ? 0.72 : 0.4);
      entity.ruleCode =
        subjectType || employeeId
          ? 'payload_employee_match'
          : merchantId
            ? 'payload_merchant_match'
            : null;
      entity.matchedFields = matchedFields;
      entity.remark = candidateType === 'unknown' ? '缺少可直接归因的强证据' : null;
      entity.normalizedPayload = {
        interactionPayload: payload,
        contentPayload,
      };

      await this.leadCandidateRepository.save(entity);
      if (existing) {
        updated += 1;
      } else {
        created += 1;
      }
    }

    await this.operationLogsService.create({
      module: 'engagement',
      targetId: 0,
      action: 'generate_lead_candidates',
      operatorId: currentUser.id,
      detail: `生成线索候选 ${interactions.length} 条`,
      detailJson: {
        processed: interactions.length,
        created,
        updated,
        forceRegenerate: dto.forceRegenerate ?? false,
      },
    });

    return {
      processed: interactions.length,
      created,
      updated,
      forceRegenerate: dto.forceRegenerate ?? false,
    };
  }

  async findLeadCandidates(query: QueryLeadCandidatesDto) {
    const { skip, take } = getPagination(query);
    const qb = this.leadCandidateRepository.createQueryBuilder('candidate');

    if (query.platform) {
      qb.andWhere('candidate.platform = :platform', { platform: query.platform });
    }
    if (query.candidateType) {
      qb.andWhere('candidate.candidate_type = :candidateType', { candidateType: query.candidateType });
    }
    if (query.status) {
      qb.andWhere('candidate.status = :status', { status: query.status });
    }
    if (query.evidenceStatus) {
      qb.andWhere('candidate.evidence_status = :evidenceStatus', {
        evidenceStatus: query.evidenceStatus,
      });
    }
    if (query.hasMerchant === 'true') {
      qb.andWhere('candidate.merchant_id IS NOT NULL');
    }
    if (query.hasMerchant === 'false') {
      qb.andWhere('candidate.merchant_id IS NULL');
    }
    if (query.hasEmployee === 'true') {
      qb.andWhere('candidate.employee_id IS NOT NULL');
    }
    if (query.hasEmployee === 'false') {
      qb.andWhere('candidate.employee_id IS NULL');
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .leftJoinAndSelect('candidate.interaction', 'interaction')
      .orderBy(
        LEAD_CANDIDATE_SORT_COLUMNS[query.sortBy ?? 'createdAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async findLeadCandidateById(id: number) {
    const record = await this.leadCandidateRepository.findOne({
      where: { id },
      relations: ['interaction'],
    });
    if (!record) {
      throw new NotFoundException('线索候选不存在');
    }
    return record;
  }

  async generateAttributions(dto: GenerateAttributionsDto, currentUser: CurrentUser) {
    const candidates = await this.loadLeadCandidatesForGeneration(dto);
    const rules = await this.attributionRuleRepository.find({ where: { isActive: true } });
    const employees = await this.employeeRepository.find();
    let created = 0;
    let updated = 0;

    for (const candidate of candidates) {
      const interaction =
        candidate.interaction ?? (await this.requireInteraction(candidate.interactionId));
      const existing = await this.attributionResultRepository.findOne({
        where: { interactionId: interaction.id },
      });
      if (existing && !dto.forceRegenerate) {
        continue;
      }

      const generated = await this.resolveAttribution(candidate, interaction, rules, employees);
      const entity =
        existing ?? this.attributionResultRepository.create({ interactionId: interaction.id });
      entity.leadCandidateId = candidate.id;
      entity.attributedSubjectType = generated.attributedSubjectType;
      entity.attributedSubjectId = generated.attributedSubjectId;
      entity.merchantId = generated.merchantId;
      entity.employeeId = generated.employeeId;
      entity.attributedBusinessType = generated.attributedBusinessType;
      entity.attributedBusinessId = generated.attributedBusinessId;
      entity.attributionStatus = generated.attributionStatus;
      entity.evidenceStatus = generated.evidenceStatus;
      entity.confidenceScore = generated.confidenceScore;
      entity.ruleCode = generated.ruleCode;
      entity.matchedFields = generated.matchedFields;
      entity.remark = generated.remark;
      entity.normalizedPayload = generated.normalizedPayload;
      entity.handledBy = existing?.handledBy ?? null;
      entity.handledAt = existing?.handledAt ?? null;
      entity.handlingAction = existing?.handlingAction ?? null;
      const saved = await this.attributionResultRepository.save(entity);

      candidate.status = generated.attributionStatus === 'unknown' ? 'pending' : 'processed';
      candidate.evidenceStatus = generated.evidenceStatus;
      candidate.confidenceScore = generated.confidenceScore;
      candidate.ruleCode = generated.ruleCode;
      candidate.linkedSubjectType = generated.attributedSubjectType;
      candidate.linkedSubjectId = generated.attributedSubjectId;
      candidate.linkedBusinessType = generated.attributedBusinessType;
      candidate.linkedBusinessId = generated.attributedBusinessId;
      candidate.merchantId = generated.merchantId;
      candidate.employeeId = generated.employeeId;
      candidate.matchedFields = generated.matchedFields;
      candidate.remark = generated.remark;
      await this.leadCandidateRepository.save(candidate);

      if (generated.attributedSubjectType && generated.attributedSubjectId) {
        await this.upsertInteractionLink(saved);
        await this.refreshProfileSnapshot(generated.attributedSubjectType, generated.attributedSubjectId, {
          merchantId: generated.merchantId,
          employeeId: generated.employeeId,
          displayName: this.extractDisplayName(saved.normalizedPayload),
          mobile: this.extractMobile(saved.matchedFields),
        });
      }

      await this.ensureFollowupSuggestion(interaction, saved);

      if (existing) {
        updated += 1;
      } else {
        created += 1;
      }
    }

    await this.operationLogsService.create({
      module: 'engagement',
      targetId: 0,
      action: 'generate_attributions',
      operatorId: currentUser.id,
      detail: `生成归因结果 ${candidates.length} 条`,
      detailJson: {
        processed: candidates.length,
        created,
        updated,
        forceRegenerate: dto.forceRegenerate ?? false,
      },
    });

    return {
      processed: candidates.length,
      created,
      updated,
      forceRegenerate: dto.forceRegenerate ?? false,
    };
  }

  async findAttributions(query: QueryAttributionResultsDto) {
    const { skip, take } = getPagination(query);
    const qb = this.attributionResultRepository.createQueryBuilder('result');

    if (query.attributionStatus) {
      qb.andWhere('result.attribution_status = :attributionStatus', {
        attributionStatus: query.attributionStatus,
      });
    }
    if (query.evidenceStatus) {
      qb.andWhere('result.evidence_status = :evidenceStatus', {
        evidenceStatus: query.evidenceStatus,
      });
    }
    if (query.attributedSubjectType) {
      qb.andWhere('result.attributed_subject_type = :attributedSubjectType', {
        attributedSubjectType: query.attributedSubjectType,
      });
    }
    if (query.attributedBusinessType) {
      qb.andWhere('result.attributed_business_type = :attributedBusinessType', {
        attributedBusinessType: query.attributedBusinessType,
      });
    }
    if (query.hasMerchant === 'true') {
      qb.andWhere('result.merchant_id IS NOT NULL');
    }
    if (query.hasMerchant === 'false') {
      qb.andWhere('result.merchant_id IS NULL');
    }
    if (query.hasEmployee === 'true') {
      qb.andWhere('result.employee_id IS NOT NULL');
    }
    if (query.hasEmployee === 'false') {
      qb.andWhere('result.employee_id IS NULL');
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .leftJoinAndSelect('result.interaction', 'interaction')
      .leftJoinAndSelect('result.leadCandidate', 'candidate')
      .orderBy(
        ATTRIBUTION_RESULT_SORT_COLUMNS[query.sortBy ?? 'createdAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async findAttributionById(id: number) {
    const record = await this.attributionResultRepository.findOne({
      where: { id },
      relations: ['interaction', 'leadCandidate'],
    });
    if (!record) {
      throw new NotFoundException('归因结果不存在');
    }
    return record;
  }

  async confirmAttribution(id: number, dto: ConfirmAttributionDto, currentUser: CurrentUser) {
    const record = await this.findAttributionById(id);
    if (dto.attributedSubjectType !== undefined) record.attributedSubjectType = dto.attributedSubjectType;
    if (dto.attributedSubjectId !== undefined) record.attributedSubjectId = dto.attributedSubjectId;
    if (dto.merchantId !== undefined) record.merchantId = dto.merchantId;
    if (dto.employeeId !== undefined) record.employeeId = dto.employeeId;
    if (dto.attributedBusinessType !== undefined) record.attributedBusinessType = dto.attributedBusinessType;
    if (dto.attributedBusinessId !== undefined) record.attributedBusinessId = dto.attributedBusinessId;
    if (dto.matchedFields !== undefined) record.matchedFields = dto.matchedFields;
    record.attributionStatus = 'confirmed';
    record.evidenceStatus = 'confirmed';
    record.confidenceScore = this.formatScore(1);
    record.ruleCode = 'manual_override';
    record.handledBy = currentUser.id;
    record.handledAt = new Date();
    record.handlingAction = 'confirm';
    record.remark = dto.remark?.trim() || record.remark;
    record.normalizedPayload = {
      ...(record.normalizedPayload ?? {}),
      manualConfirmedAt: new Date().toISOString(),
    };
    const saved = await this.attributionResultRepository.save(record);
    await this.syncLeadCandidateFromAttribution(saved);
    await this.upsertInteractionLink(saved);
    if (saved.attributedSubjectType && saved.attributedSubjectId) {
      await this.refreshProfileSnapshot(saved.attributedSubjectType, saved.attributedSubjectId, {
        merchantId: saved.merchantId,
        employeeId: saved.employeeId,
        displayName: this.extractDisplayName(saved.normalizedPayload),
        mobile: this.extractMobile(saved.matchedFields),
      });
    }
    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'confirm_attribution',
      operatorId: currentUser.id,
      detail: `确认归因 ${saved.id}`,
      detailJson: {
        attributionId: saved.id,
        attributedSubjectType: saved.attributedSubjectType,
        attributedSubjectId: saved.attributedSubjectId,
        merchantId: saved.merchantId,
        employeeId: saved.employeeId,
      },
    });
    return saved;
  }

  async rejectAttribution(id: number, dto: RejectAttributionDto, currentUser: CurrentUser) {
    const record = await this.findAttributionById(id);
    record.attributionStatus = 'unknown';
    record.evidenceStatus = 'uncertain';
    record.confidenceScore = this.formatScore(0);
    record.handledBy = currentUser.id;
    record.handledAt = new Date();
    record.handlingAction = 'reject';
    record.remark = dto.remark?.trim() || '已人工拒绝当前归因';
    const saved = await this.attributionResultRepository.save(record);
    await this.syncLeadCandidateFromAttribution(saved);
    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'reject_attribution',
      operatorId: currentUser.id,
      detail: `拒绝归因 ${saved.id}`,
      detailJson: { attributionId: saved.id, remark: saved.remark },
    });
    return saved;
  }

  async reassignAttribution(id: number, dto: ReassignAttributionDto, currentUser: CurrentUser) {
    const record = await this.findAttributionById(id);
    if (dto.attributedSubjectType !== undefined) record.attributedSubjectType = dto.attributedSubjectType;
    if (dto.attributedSubjectId !== undefined) record.attributedSubjectId = dto.attributedSubjectId;
    if (dto.merchantId !== undefined) record.merchantId = dto.merchantId;
    if (dto.employeeId !== undefined) record.employeeId = dto.employeeId;
    if (dto.attributedBusinessType !== undefined) record.attributedBusinessType = dto.attributedBusinessType;
    if (dto.attributedBusinessId !== undefined) record.attributedBusinessId = dto.attributedBusinessId;
    if (dto.attributionStatus !== undefined) record.attributionStatus = dto.attributionStatus;
    if (dto.evidenceStatus !== undefined) record.evidenceStatus = dto.evidenceStatus;
    if (dto.matchedFields !== undefined) record.matchedFields = dto.matchedFields;
    record.ruleCode = 'manual_override';
    record.confidenceScore = this.formatScore(
      record.attributionStatus === 'confirmed' ? 1 : record.attributionStatus === 'inferred' ? 0.82 : 0.2,
    );
    record.handledBy = currentUser.id;
    record.handledAt = new Date();
    record.handlingAction = 'reassign';
    record.remark = dto.remark?.trim() || record.remark;
    const saved = await this.attributionResultRepository.save(record);
    await this.syncLeadCandidateFromAttribution(saved);
    await this.upsertInteractionLink(saved);
    if (saved.attributedSubjectType && saved.attributedSubjectId) {
      await this.refreshProfileSnapshot(saved.attributedSubjectType, saved.attributedSubjectId, {
        merchantId: saved.merchantId,
        employeeId: saved.employeeId,
        displayName: this.extractDisplayName(saved.normalizedPayload),
        mobile: this.extractMobile(saved.matchedFields),
      });
    }
    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'reassign_attribution',
      operatorId: currentUser.id,
      detail: `改归属 ${saved.id}`,
      detailJson: {
        attributionId: saved.id,
        attributedSubjectType: saved.attributedSubjectType,
        attributedSubjectId: saved.attributedSubjectId,
        merchantId: saved.merchantId,
        employeeId: saved.employeeId,
      },
    });
    return saved;
  }

  async findCustomerProfiles(query: QueryProfileSnapshotsDto) {
    return this.findProfilesBySubjectType('customer', query);
  }

  async findCustomerProfileById(id: number) {
    return this.findProfileBySubjectTypeAndId('customer', id);
  }

  async findEmployeeProfiles(query: QueryProfileSnapshotsDto) {
    return this.findProfilesBySubjectType('employee', query);
  }

  async findEmployeeProfileById(id: number) {
    return this.findProfileBySubjectTypeAndId('employee', id);
  }

  async findFollowupSuggestions(query: QueryFollowupSuggestionsDto) {
    const { skip, take } = getPagination(query);
    const qb = this.aiRecommendationRepository.createQueryBuilder('recommendation');
    qb.andWhere('recommendation.recommendation_type = :recommendationType', {
      recommendationType: 'followup_suggestion',
    });

    if (query.subjectType) {
      qb.andWhere('recommendation.subject_type = :subjectType', { subjectType: query.subjectType });
    }
    if (query.subjectId) {
      qb.andWhere('recommendation.subject_id = :subjectId', { subjectId: query.subjectId });
    }
    if (query.evidenceStatus) {
      qb.andWhere('recommendation.evidence_status = :evidenceStatus', {
        evidenceStatus: query.evidenceStatus,
      });
    }
    if (query.status) {
      qb.andWhere('recommendation.status = :status', { status: query.status });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        FOLLOWUP_SUGGESTION_SORT_COLUMNS[query.sortBy ?? 'createdAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async findFollowupSuggestionById(id: number) {
    const record = await this.aiRecommendationRepository.findOne({
      where: { id, recommendationType: 'followup_suggestion' },
    });
    if (!record) {
      throw new NotFoundException('跟进建议不存在');
    }
    return record;
  }

  private async findProfilesBySubjectType(subjectType: 'customer' | 'employee', query: QueryProfileSnapshotsDto) {
    const { skip, take } = getPagination(query);
    const qb = this.profileSnapshotRepository.createQueryBuilder('snapshot');
    qb.andWhere('snapshot.subject_type = :subjectType', { subjectType });

    if (query.displayName) {
      qb.andWhere('snapshot.display_name LIKE :displayName', { displayName: `%${query.displayName}%` });
    }
    if (query.mobile) {
      qb.andWhere('snapshot.mobile LIKE :mobile', { mobile: `%${query.mobile}%` });
    }
    if (query.status) {
      qb.andWhere('snapshot.status = :status', { status: query.status });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        PROFILE_SNAPSHOT_SORT_COLUMNS[query.sortBy ?? 'updatedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  private async findProfileBySubjectTypeAndId(subjectType: 'customer' | 'employee', subjectId: number) {
    const snapshot = await this.profileSnapshotRepository.findOne({ where: { subjectType, subjectId } });
    if (!snapshot) {
      throw new NotFoundException('画像摘要不存在');
    }

    const memories = await this.memoryEntryRepository.find({
      where: { subjectType, subjectId },
      order: { createdAt: 'DESC' },
      take: 10,
    });
    const attributions = await this.attributionResultRepository.find({
      where: { attributedSubjectType: subjectType, attributedSubjectId: subjectId },
      order: { updatedAt: 'DESC' },
      take: 10,
    });
    const followupSuggestions = await this.aiRecommendationRepository.find({
      where: { subjectType, subjectId, recommendationType: 'followup_suggestion' },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return { snapshot, memories, attributions, followupSuggestions };
  }

  private async loadInteractionsForGeneration(dto: GenerateLeadCandidatesDto) {
    const qb = this.platformInteractionRepository.createQueryBuilder('interaction');
    if (dto.platform) qb.andWhere('interaction.platform = :platform', { platform: dto.platform });
    if (dto.accountId) qb.andWhere('interaction.account_id = :accountId', { accountId: dto.accountId });
    if (dto.dateFrom) qb.andWhere('interaction.interaction_time >= :dateFrom', { dateFrom: new Date(dto.dateFrom) });
    if (dto.dateTo) qb.andWhere('interaction.interaction_time <= :dateTo', { dateTo: new Date(dto.dateTo) });
    return qb.orderBy('interaction.interaction_time', 'DESC').getMany();
  }

  private async loadLeadCandidatesForGeneration(dto: GenerateAttributionsDto) {
    const qb = this.leadCandidateRepository
      .createQueryBuilder('candidate')
      .leftJoinAndSelect('candidate.interaction', 'interaction');
    if (dto.platform) qb.andWhere('candidate.platform = :platform', { platform: dto.platform });
    if (dto.accountId) qb.andWhere('candidate.account_id = :accountId', { accountId: dto.accountId });
    if (dto.candidateType) qb.andWhere('candidate.candidate_type = :candidateType', { candidateType: dto.candidateType });
    if (dto.dateFrom) qb.andWhere('interaction.interaction_time >= :dateFrom', { dateFrom: new Date(dto.dateFrom) });
    if (dto.dateTo) qb.andWhere('interaction.interaction_time <= :dateTo', { dateTo: new Date(dto.dateTo) });
    return qb.orderBy('interaction.interaction_time', 'DESC').getMany();
  }

  private async resolveAttribution(
    candidate: LeadCandidate,
    interaction: PlatformInteraction,
    rules: AttributionRule[],
    employees: Employee[],
  ): Promise<GeneratedAttribution> {
    const payload = this.asRecord(interaction.normalizedPayload);
    const content = await this.findPlatformContent(interaction.platform, interaction.contentId);
    const contentPayload = this.asRecord(content?.normalizedPayload);
    const existingLink = await this.interactionLinkRepository.findOne({
      where: { interactionId: interaction.id },
      order: { createdAt: 'DESC' },
    });
    const businessLink = this.detectBusinessLink(payload);
    const businessType = candidate.linkedBusinessType ?? businessLink.type;
    const businessId = candidate.linkedBusinessId ?? businessLink.id;
    const merchantIdFromPayload =
      candidate.merchantId ??
      this.extractNumber(payload, ['merchantId', 'merchant_id']) ??
      this.extractNumber(contentPayload, ['merchantId', 'merchant_id']);
    const employeeIdFromPayload =
      candidate.employeeId ?? this.extractNumber(payload, ['employeeId', 'employee_id']);
    const customerIdFromPayload = this.extractNumber(payload, [
      'customerId',
      'customer_id',
      'subjectId',
      'subject_id',
    ]);
    const matchedFields: Record<string, unknown> = {
      ...(this.asRecord(candidate.matchedFields)),
      sourceContactRef: interaction.sourceContactRef,
      sourceUserRef: interaction.sourceUserRef,
      sourceSessionRef: interaction.sourceSessionRef,
      merchantIdFromPayload,
      employeeIdFromPayload,
      customerIdFromPayload,
    };

    if (existingLink && existingLink.attributionStatus === 'confirmed') {
      return {
        attributedSubjectType: existingLink.linkedSubjectType,
        attributedSubjectId: existingLink.linkedSubjectId,
        merchantId: merchantIdFromPayload,
        employeeId: existingLink.linkedSubjectType === 'employee' ? existingLink.linkedSubjectId : employeeIdFromPayload,
        attributedBusinessType: existingLink.linkedBusinessType,
        attributedBusinessId: existingLink.linkedBusinessId,
        attributionStatus: 'confirmed',
        evidenceStatus: 'confirmed',
        confidenceScore: this.formatScore(1),
        ruleCode: 'manual_override',
        matchedFields,
        remark: '沿用既有人工确认关联',
        normalizedPayload: { interactionPayload: payload, contentPayload, existingLinkId: existingLink.id },
      };
    }

    const employeeByMobile = interaction.sourceContactRef
      ? employees.find((employee) => employee.mobile && employee.mobile === interaction.sourceContactRef)
      : undefined;
    if (employeeByMobile) {
      return {
        attributedSubjectType: 'employee',
        attributedSubjectId: employeeByMobile.id,
        merchantId: merchantIdFromPayload,
        employeeId: employeeByMobile.id,
        attributedBusinessType: businessType,
        attributedBusinessId: businessId,
        attributionStatus: 'inferred',
        evidenceStatus: this.normalizeEvidenceStatus(
          this.findRule(rules, 'employee_mobile_match')?.evidenceStatus,
        ),
        confidenceScore: this.findRule(rules, 'employee_mobile_match')?.confidenceScore ?? this.formatScore(0.82),
        ruleCode: 'employee_mobile_match',
        matchedFields: { ...matchedFields, employeeMobile: employeeByMobile.mobile, employeeName: employeeByMobile.name },
        remark: '通过平台联系方式匹配到员工手机号',
        normalizedPayload: { interactionPayload: payload, contentPayload, employeeId: employeeByMobile.id },
      };
    }

    const employeeByUserRef = interaction.sourceUserRef
      ? employees.find((employee) => String(employee.linkedUserId ?? '') === interaction.sourceUserRef)
      : undefined;
    if (employeeByUserRef) {
      return {
        attributedSubjectType: 'employee',
        attributedSubjectId: employeeByUserRef.id,
        merchantId: merchantIdFromPayload,
        employeeId: employeeByUserRef.id,
        attributedBusinessType: businessType,
        attributedBusinessId: businessId,
        attributionStatus: 'inferred',
        evidenceStatus: this.normalizeEvidenceStatus(
          this.findRule(rules, 'employee_user_ref_match')?.evidenceStatus,
        ),
        confidenceScore: this.findRule(rules, 'employee_user_ref_match')?.confidenceScore ?? this.formatScore(0.86),
        ruleCode: 'employee_user_ref_match',
        matchedFields: { ...matchedFields, employeeLinkedUserId: employeeByUserRef.linkedUserId, employeeName: employeeByUserRef.name },
        remark: '通过平台用户引用匹配到员工绑定用户',
        normalizedPayload: { interactionPayload: payload, contentPayload, employeeId: employeeByUserRef.id },
      };
    }

    if (customerIdFromPayload) {
      return {
        attributedSubjectType: 'customer',
        attributedSubjectId: customerIdFromPayload,
        merchantId: merchantIdFromPayload,
        employeeId: employeeIdFromPayload,
        attributedBusinessType: businessType,
        attributedBusinessId: businessId,
        attributionStatus: 'inferred',
        evidenceStatus: this.normalizeEvidenceStatus(
          this.findRule(rules, 'payload_customer_match')?.evidenceStatus,
        ),
        confidenceScore: this.findRule(rules, 'payload_customer_match')?.confidenceScore ?? this.formatScore(0.72),
        ruleCode: 'payload_customer_match',
        matchedFields,
        remark: '互动负载中已携带客户标识',
        normalizedPayload: { interactionPayload: payload, contentPayload },
      };
    }

    if (employeeIdFromPayload) {
      return {
        attributedSubjectType: 'employee',
        attributedSubjectId: employeeIdFromPayload,
        merchantId: merchantIdFromPayload,
        employeeId: employeeIdFromPayload,
        attributedBusinessType: businessType,
        attributedBusinessId: businessId,
        attributionStatus: 'inferred',
        evidenceStatus: this.normalizeEvidenceStatus(
          this.findRule(rules, 'payload_employee_match')?.evidenceStatus,
        ),
        confidenceScore: this.findRule(rules, 'payload_employee_match')?.confidenceScore ?? this.formatScore(0.78),
        ruleCode: 'payload_employee_match',
        matchedFields,
        remark: '互动负载中已携带员工标识',
        normalizedPayload: { interactionPayload: payload, contentPayload },
      };
    }

    if (merchantIdFromPayload) {
      return {
        attributedSubjectType: null,
        attributedSubjectId: null,
        merchantId: merchantIdFromPayload,
        employeeId: employeeIdFromPayload,
        attributedBusinessType: businessType,
        attributedBusinessId: businessId,
        attributionStatus: 'inferred',
        evidenceStatus: this.normalizeEvidenceStatus(
          this.findRule(rules, 'payload_merchant_match')?.evidenceStatus,
        ),
        confidenceScore: this.findRule(rules, 'payload_merchant_match')?.confidenceScore ?? this.formatScore(0.76),
        ruleCode: content ? 'content_campaign_match' : 'payload_merchant_match',
        matchedFields,
        remark: content ? '通过内容活动上下文推断商户归因' : '互动负载中已携带商户标识',
        normalizedPayload: { interactionPayload: payload, contentPayload },
      };
    }

    return {
      attributedSubjectType: null,
      attributedSubjectId: null,
      merchantId: null,
      employeeId: null,
      attributedBusinessType: businessType,
      attributedBusinessId: businessId,
      attributionStatus: 'unknown',
      evidenceStatus: 'uncertain',
      confidenceScore: this.formatScore(0.2),
      ruleCode: null,
      matchedFields,
      remark: '当前仅识别到平台基础引用，需人工确认客户、员工或业务归属',
      normalizedPayload: { interactionPayload: payload, contentPayload },
    };
  }

  private async upsertInteractionLink(record: AttributionResult) {
    if (!record.attributedSubjectType || !record.attributedSubjectId) return;
    const existing = await this.interactionLinkRepository.findOne({
      where: { interactionId: record.interactionId },
      order: { createdAt: 'DESC' },
    });
    const entity = existing ?? this.interactionLinkRepository.create({ interactionId: record.interactionId });
    entity.linkedSubjectType = record.attributedSubjectType;
    entity.linkedSubjectId = record.attributedSubjectId;
    entity.linkedBusinessType = record.attributedBusinessType;
    entity.linkedBusinessId = record.attributedBusinessId;
    entity.attributionStatus = record.attributionStatus;
    entity.attributionConfidence = record.confidenceScore;
    entity.remark = record.remark;
    await this.interactionLinkRepository.save(entity);
  }

  private async ensureFollowupSuggestion(interaction: PlatformInteraction, record: AttributionResult) {
    const subjectType = record.attributedSubjectType ?? (record.employeeId ? 'employee' : null);
    const subjectId = record.attributedSubjectId ?? record.employeeId ?? null;
    if (!subjectType || !subjectId) return;

    const existing = await this.aiRecommendationRepository.find({
      where: { subjectType, subjectId, recommendationType: 'followup_suggestion', status: 'active' },
      order: { createdAt: 'DESC' },
      take: 10,
    });
    const existsForInteraction = existing.some((item) => {
      const sourceContext = this.asRecord(item.sourceContext);
      return Number(sourceContext.interactionId ?? 0) === interaction.id;
    });
    if (existsForInteraction) return;

    const recommendationText =
      record.attributionStatus === 'unknown'
        ? '建议人工确认该平台互动的客户或业务归属，并尽快补充关键联系信息。'
        : '建议基于本次互动线索安排人工跟进，并记录客户反馈与下一步动作。';
    const recommendationReason =
      record.attributionStatus === 'unknown'
        ? '当前归因仍为未知，互动已进入待处理状态。'
        : `当前归因为 ${record.attributionStatus}，可结合互动时间和来源字段继续跟进。`;

    await this.aiRecommendationRepository.save(
      this.aiRecommendationRepository.create({
        subjectType,
        subjectId,
        recommendationType: 'followup_suggestion',
        recommendationText,
        recommendationReason,
        sourceContext: {
          interactionId: interaction.id,
          attributionResultId: record.id,
          interactionType: interaction.interactionType,
          sourceContactRef: interaction.sourceContactRef,
          sourceUserRef: interaction.sourceUserRef,
          merchantId: record.merchantId,
          employeeId: record.employeeId,
        },
        evidenceStatus: record.evidenceStatus,
        confidenceScore: record.confidenceScore,
        status: 'active',
      }),
    );
  }

  private async refreshProfileSnapshot(
    subjectType: string,
    subjectId: number,
    context: {
      merchantId?: number | null;
      employeeId?: number | null;
      displayName?: string | null;
      mobile?: string | null;
    } = {},
  ) {
    const interactionCount = await this.attributionResultRepository.count({
      where: { attributedSubjectType: subjectType, attributedSubjectId: subjectId },
    });
    const memoryCount = await this.memoryEntryRepository.count({
      where: { subjectType, subjectId },
    });
    const attributedBusinessCount = await this.attributionResultRepository.count({
      where: { attributedSubjectType: subjectType, attributedSubjectId: subjectId },
    });
    const latestAttribution = await this.attributionResultRepository.findOne({
      where: { attributedSubjectType: subjectType, attributedSubjectId: subjectId },
      order: { updatedAt: 'DESC' },
      relations: ['interaction'],
    });
    const latestInteractionAt = latestAttribution?.interaction?.interactionTime ?? null;
    const existing = await this.profileSnapshotRepository.findOne({ where: { subjectType, subjectId } });

    let displayName = context.displayName ?? null;
    let mobile = context.mobile ?? null;
    let employeeId = context.employeeId ?? null;
    if (subjectType === 'employee') {
      const employee = await this.employeeRepository.findOne({ where: { id: subjectId } });
      displayName = employee?.name ?? displayName ?? `员工#${subjectId}`;
      mobile = employee?.mobile ?? mobile;
      employeeId = employee?.id ?? employeeId;
    }
    if (subjectType === 'customer') {
      displayName = displayName ?? `客户#${subjectId}`;
    }

    const entity = existing ?? this.profileSnapshotRepository.create({ subjectType, subjectId });
    entity.displayName = displayName;
    entity.mobile = mobile;
    entity.merchantId = context.merchantId ?? existing?.merchantId ?? null;
    entity.employeeId = employeeId ?? existing?.employeeId ?? null;
    entity.latestInteractionAt = latestInteractionAt;
    entity.latestAttributionAt = latestAttribution?.updatedAt ?? null;
    entity.interactionCount = interactionCount;
    entity.memoryCount = memoryCount;
    entity.attributedBusinessCount = attributedBusinessCount;
    entity.status = 'active';
    entity.summaryJson = {
      latestAttributionStatus: latestAttribution?.attributionStatus ?? null,
      latestRuleCode: latestAttribution?.ruleCode ?? null,
      latestBusinessType: latestAttribution?.attributedBusinessType ?? null,
      merchantId: entity.merchantId,
      employeeId: entity.employeeId,
    };
    entity.normalizedPayload = { subjectType, subjectId };
    await this.profileSnapshotRepository.save(entity);
  }

  private async syncLeadCandidateFromAttribution(record: AttributionResult) {
    if (!record.leadCandidateId) return;
    const candidate = await this.leadCandidateRepository.findOne({ where: { id: record.leadCandidateId } });
    if (!candidate) return;
    candidate.status = record.attributionStatus === 'unknown' ? 'pending' : 'processed';
    candidate.evidenceStatus = record.evidenceStatus;
    candidate.confidenceScore = record.confidenceScore;
    candidate.ruleCode = record.ruleCode;
    candidate.linkedSubjectType = record.attributedSubjectType;
    candidate.linkedSubjectId = record.attributedSubjectId;
    candidate.linkedBusinessType = record.attributedBusinessType;
    candidate.linkedBusinessId = record.attributedBusinessId;
    candidate.merchantId = record.merchantId;
    candidate.employeeId = record.employeeId;
    candidate.remark = record.remark;
    candidate.matchedFields = record.matchedFields;
    await this.leadCandidateRepository.save(candidate);
  }

  private async requireInteraction(interactionId: number) {
    const interaction = await this.platformInteractionRepository.findOne({ where: { id: interactionId } });
    if (!interaction) throw new NotFoundException('平台互动不存在');
    return interaction;
  }

  private async findPlatformContent(platform: string, contentId: string | null) {
    if (!contentId) return null;
    return this.platformContentRepository.findOne({ where: { platform, contentId } });
  }

  private findRule(rules: AttributionRule[], ruleCode: string) {
    return rules.find((rule) => rule.ruleCode === ruleCode && rule.isActive);
  }

  private detectBusinessLink(payload: Record<string, unknown>) {
    const linkMap: Array<{ keys: string[]; type: string }> = [
      { keys: ['orderId', 'order_id'], type: 'order' },
      { keys: ['workOrderId', 'work_order_id'], type: 'work_order' },
      { keys: ['goodsGroupOrderId', 'goods_group_order_id'], type: 'goods_group_order' },
      { keys: ['shoppingCardId', 'shopping_card_id'], type: 'shopping_card' },
      { keys: ['userShoppingCardId', 'user_shopping_card_id'], type: 'user_shopping_card' },
    ];
    for (const item of linkMap) {
      const value = this.extractString(payload, item.keys);
      if (value) return { type: item.type, id: value };
    }
    return { type: null, id: null };
  }

  private extractNumber(source: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = source[key];
      if (value === null || value === undefined || value === '') continue;
      const numberValue = Number(value);
      if (Number.isFinite(numberValue)) return numberValue;
    }
    return null;
  }

  private extractString(source: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = source[key];
      if (value === null || value === undefined || value === '') continue;
      return String(value);
    }
    return null;
  }

  private extractDisplayName(source: Record<string, unknown>) {
    return this.extractString(this.asRecord(source), ['displayName', 'display_name', 'name', 'nickname']);
  }

  private extractMobile(source: Record<string, unknown>) {
    return this.extractString(this.asRecord(source), ['mobile', 'phone', 'sourceContactRef']);
  }

  private asRecord(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {} as Record<string, unknown>;
    }
    return value as Record<string, unknown>;
  }

  private formatScore(value: number) {
    return value.toFixed(4);
  }

  private normalizeEvidenceStatus(value?: string | null): 'confirmed' | 'inferred' | 'uncertain' {
    if (value === 'confirmed') return 'confirmed';
    if (value === 'inferred') return 'inferred';
    return 'uncertain';
  }

  private normalizeSortOrder(sortOrder: string | undefined, fallback: 'ASC' | 'DESC') {
    if (!sortOrder) return fallback;
    return sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  }
}
