import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { buildPaginationResult, getPagination } from '../../common/utils/pagination.util';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { CreateFollowupFeedbackDto } from './dto/create-followup-feedback.dto';
import { CreateRecommendationRuleDto } from './dto/create-recommendation-rule.dto';
import { CreateScriptExperimentDto } from './dto/create-script-experiment.dto';
import { CreateScriptTemplateDto } from './dto/create-script-template.dto';
import { QueryFollowupFeedbackDto } from './dto/query-followup-feedback.dto';
import { QueryRecommendationRulesDto } from './dto/query-recommendation-rules.dto';
import { QueryScriptExperimentsDto } from './dto/query-script-experiments.dto';
import { QueryScriptTemplatesDto } from './dto/query-script-templates.dto';
import { ToggleRecommendationRuleDto } from './dto/toggle-recommendation-rule.dto';
import { ToggleScriptTemplateDto } from './dto/toggle-script-template.dto';
import { UpdateRecommendationRuleDto } from './dto/update-recommendation-rule.dto';
import { UpdateScriptTemplateDto } from './dto/update-script-template.dto';
import { AiRecommendation } from './entities/ai-recommendation.entity';
import { FollowupFeedback } from './entities/followup-feedback.entity';
import { RecommendationRule } from './entities/recommendation-rule.entity';
import { ScriptExperimentResult } from './entities/script-experiment-result.entity';
import { ScriptExperiment } from './entities/script-experiment.entity';
import { ScriptTemplate } from './entities/script-template.entity';

const RECOMMENDATION_RULE_SORT_COLUMNS: Record<string, string> = {
  ruleCode: 'rule.rule_code',
  ruleName: 'rule.rule_name',
  recommendationType: 'rule.recommendation_type',
  subjectType: 'rule.subject_type',
  businessDomain: 'rule.business_domain',
  isActive: 'rule.is_active',
  updatedAt: 'rule.updated_at',
  createdAt: 'rule.created_at',
};

const SCRIPT_TEMPLATE_SORT_COLUMNS: Record<string, string> = {
  templateCode: 'template.template_code',
  templateName: 'template.template_name',
  templateGroup: 'template.template_group',
  recommendationType: 'template.recommendation_type',
  isActive: 'template.is_active',
  updatedAt: 'template.updated_at',
  createdAt: 'template.created_at',
};

const SCRIPT_EXPERIMENT_SORT_COLUMNS: Record<string, string> = {
  experimentCode: 'experiment.experiment_code',
  experimentName: 'experiment.experiment_name',
  experimentType: 'experiment.experiment_type',
  recommendationType: 'experiment.recommendation_type',
  status: 'experiment.status',
  templateCount: 'experiment.template_count',
  updatedAt: 'experiment.updated_at',
  createdAt: 'experiment.created_at',
};

const FOLLOWUP_FEEDBACK_SORT_COLUMNS: Record<string, string> = {
  scriptExperimentId: 'feedback.script_experiment_id',
  scriptTemplateId: 'feedback.script_template_id',
  subjectType: 'feedback.subject_type',
  subjectId: 'feedback.subject_id',
  feedbackStatus: 'feedback.feedback_status',
  followupAt: 'feedback.followup_at',
  createdAt: 'feedback.created_at',
  updatedAt: 'feedback.updated_at',
};

@Injectable()
export class EngagementOptimizationService {
  constructor(
    @InjectRepository(RecommendationRule)
    private readonly recommendationRuleRepository: Repository<RecommendationRule>,
    @InjectRepository(ScriptTemplate)
    private readonly scriptTemplateRepository: Repository<ScriptTemplate>,
    @InjectRepository(ScriptExperiment)
    private readonly scriptExperimentRepository: Repository<ScriptExperiment>,
    @InjectRepository(ScriptExperimentResult)
    private readonly scriptExperimentResultRepository: Repository<ScriptExperimentResult>,
    @InjectRepository(FollowupFeedback)
    private readonly followupFeedbackRepository: Repository<FollowupFeedback>,
    @InjectRepository(AiRecommendation)
    private readonly aiRecommendationRepository: Repository<AiRecommendation>,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async findRecommendationRules(query: QueryRecommendationRulesDto) {
    const { skip, take } = getPagination(query);
    const qb = this.recommendationRuleRepository.createQueryBuilder('rule');

    if (query.recommendationType) {
      qb.andWhere('rule.recommendation_type = :recommendationType', {
        recommendationType: query.recommendationType,
      });
    }
    if (query.subjectType) {
      qb.andWhere('rule.subject_type = :subjectType', { subjectType: query.subjectType });
    }
    if (query.businessDomain) {
      qb.andWhere('rule.business_domain = :businessDomain', {
        businessDomain: query.businessDomain,
      });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('rule.is_active = :isActive', { isActive: query.isActive });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        RECOMMENDATION_RULE_SORT_COLUMNS[query.sortBy ?? 'updatedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async createRecommendationRule(dto: CreateRecommendationRuleDto, currentUser: CurrentUser) {
    await this.ensureUniqueRecommendationRuleCode(dto.ruleCode);
    const saved = await this.recommendationRuleRepository.save(
      this.recommendationRuleRepository.create({
        ruleCode: dto.ruleCode,
        ruleName: dto.ruleName,
        recommendationType: dto.recommendationType,
        subjectType: dto.subjectType ?? null,
        businessDomain: dto.businessDomain ?? null,
        triggerMemoryType: dto.triggerMemoryType ?? null,
        triggerInteractionType: dto.triggerInteractionType ?? null,
        evidenceStatus: dto.evidenceStatus,
        confidenceScore: dto.confidenceScore.toFixed(4),
        ruleStrength: dto.ruleStrength,
        matchConditions: dto.matchConditions ?? null,
        recommendationTemplate: dto.recommendationTemplate ?? null,
        isActive: dto.isActive,
        remark: dto.remark ?? null,
      }),
    );

    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'create_recommendation_rule',
      operatorId: currentUser.id,
      detail: `创建推荐规则 ${saved.ruleCode}`,
      detailJson: this.mapRecommendationRule(saved),
    });

    return this.mapRecommendationRule(saved);
  }

  async updateRecommendationRule(id: number, dto: UpdateRecommendationRuleDto, currentUser: CurrentUser) {
    const record = await this.findRecommendationRuleEntity(id);
    const before = this.mapRecommendationRule(record);

    if (dto.ruleCode && dto.ruleCode !== record.ruleCode) {
      await this.ensureUniqueRecommendationRuleCode(dto.ruleCode, id);
    }

    if (dto.ruleCode !== undefined) record.ruleCode = dto.ruleCode;
    if (dto.ruleName !== undefined) record.ruleName = dto.ruleName;
    if (dto.recommendationType !== undefined) record.recommendationType = dto.recommendationType;
    if (dto.subjectType !== undefined) record.subjectType = dto.subjectType ?? null;
    if (dto.businessDomain !== undefined) record.businessDomain = dto.businessDomain ?? null;
    if (dto.triggerMemoryType !== undefined) record.triggerMemoryType = dto.triggerMemoryType ?? null;
    if (dto.triggerInteractionType !== undefined) record.triggerInteractionType = dto.triggerInteractionType ?? null;
    if (dto.evidenceStatus !== undefined) record.evidenceStatus = dto.evidenceStatus;
    if (dto.confidenceScore !== undefined) record.confidenceScore = dto.confidenceScore.toFixed(4);
    if (dto.ruleStrength !== undefined) record.ruleStrength = dto.ruleStrength;
    if (dto.matchConditions !== undefined) record.matchConditions = dto.matchConditions ?? null;
    if (dto.recommendationTemplate !== undefined) record.recommendationTemplate = dto.recommendationTemplate ?? null;
    if (dto.isActive !== undefined) record.isActive = dto.isActive;
    if (dto.remark !== undefined) record.remark = dto.remark ?? null;

    const saved = await this.recommendationRuleRepository.save(record);
    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'update_recommendation_rule',
      operatorId: currentUser.id,
      detail: `更新推荐规则 ${saved.ruleCode}`,
      detailJson: { before, after: this.mapRecommendationRule(saved) },
    });

    return this.mapRecommendationRule(saved);
  }

  async toggleRecommendationRule(id: number, dto: ToggleRecommendationRuleDto, currentUser: CurrentUser) {
    const record = await this.findRecommendationRuleEntity(id);
    const before = this.mapRecommendationRule(record);
    record.isActive = dto.isActive;
    const saved = await this.recommendationRuleRepository.save(record);

    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'toggle_recommendation_rule',
      operatorId: currentUser.id,
      detail: `${saved.isActive ? '启用' : '停用'}推荐规则 ${saved.ruleCode}`,
      detailJson: { before, after: this.mapRecommendationRule(saved) },
    });

    return this.mapRecommendationRule(saved);
  }

  async findScriptTemplates(query: QueryScriptTemplatesDto) {
    const { skip, take } = getPagination(query);
    const qb = this.scriptTemplateRepository.createQueryBuilder('template');

    if (query.templateGroup) {
      qb.andWhere('template.template_group = :templateGroup', { templateGroup: query.templateGroup });
    }
    if (query.recommendationType) {
      qb.andWhere('template.recommendation_type = :recommendationType', {
        recommendationType: query.recommendationType,
      });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('template.is_active = :isActive', { isActive: query.isActive });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        SCRIPT_TEMPLATE_SORT_COLUMNS[query.sortBy ?? 'updatedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async createScriptTemplate(dto: CreateScriptTemplateDto, currentUser: CurrentUser) {
    await this.ensureUniqueScriptTemplateCode(dto.templateCode);
    const saved = await this.scriptTemplateRepository.save(
      this.scriptTemplateRepository.create({
        templateCode: dto.templateCode,
        templateName: dto.templateName,
        templateGroup: dto.templateGroup,
        recommendationType: dto.recommendationType ?? null,
        channel: dto.channel ?? null,
        openingText: dto.openingText ?? null,
        scriptContent: dto.scriptContent,
        closingText: dto.closingText ?? null,
        isActive: dto.isActive,
        remark: dto.remark ?? null,
        normalizedPayload: dto.normalizedPayload ?? null,
      }),
    );

    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'create_script_template',
      operatorId: currentUser.id,
      detail: `创建话术模板 ${saved.templateCode}`,
      detailJson: this.mapScriptTemplate(saved),
    });

    return this.mapScriptTemplate(saved);
  }

  async updateScriptTemplate(id: number, dto: UpdateScriptTemplateDto, currentUser: CurrentUser) {
    const record = await this.findScriptTemplateEntity(id);
    const before = this.mapScriptTemplate(record);

    if (dto.templateCode && dto.templateCode !== record.templateCode) {
      await this.ensureUniqueScriptTemplateCode(dto.templateCode, id);
    }

    if (dto.templateCode !== undefined) record.templateCode = dto.templateCode;
    if (dto.templateName !== undefined) record.templateName = dto.templateName;
    if (dto.templateGroup !== undefined) record.templateGroup = dto.templateGroup;
    if (dto.recommendationType !== undefined) record.recommendationType = dto.recommendationType ?? null;
    if (dto.channel !== undefined) record.channel = dto.channel ?? null;
    if (dto.openingText !== undefined) record.openingText = dto.openingText ?? null;
    if (dto.scriptContent !== undefined) record.scriptContent = dto.scriptContent;
    if (dto.closingText !== undefined) record.closingText = dto.closingText ?? null;
    if (dto.isActive !== undefined) record.isActive = dto.isActive;
    if (dto.remark !== undefined) record.remark = dto.remark ?? null;
    if (dto.normalizedPayload !== undefined) record.normalizedPayload = dto.normalizedPayload ?? null;

    const saved = await this.scriptTemplateRepository.save(record);
    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'update_script_template',
      operatorId: currentUser.id,
      detail: `更新话术模板 ${saved.templateCode}`,
      detailJson: { before, after: this.mapScriptTemplate(saved) },
    });

    return this.mapScriptTemplate(saved);
  }

  async toggleScriptTemplate(id: number, dto: ToggleScriptTemplateDto, currentUser: CurrentUser) {
    const record = await this.findScriptTemplateEntity(id);
    const before = this.mapScriptTemplate(record);
    record.isActive = dto.isActive;
    const saved = await this.scriptTemplateRepository.save(record);

    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'toggle_script_template',
      operatorId: currentUser.id,
      detail: `${saved.isActive ? '启用' : '停用'}话术模板 ${saved.templateCode}`,
      detailJson: { before, after: this.mapScriptTemplate(saved) },
    });

    return this.mapScriptTemplate(saved);
  }

  async findScriptExperiments(query: QueryScriptExperimentsDto) {
    const { skip, take } = getPagination(query);
    const qb = this.scriptExperimentRepository.createQueryBuilder('experiment');

    if (query.experimentType) {
      qb.andWhere('experiment.experiment_type = :experimentType', { experimentType: query.experimentType });
    }
    if (query.recommendationType) {
      qb.andWhere('experiment.recommendation_type = :recommendationType', {
        recommendationType: query.recommendationType,
      });
    }
    if (query.status) {
      qb.andWhere('experiment.status = :status', { status: query.status });
    }
    if (query.businessDomain) {
      qb.andWhere('experiment.business_domain = :businessDomain', {
        businessDomain: query.businessDomain,
      });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        SCRIPT_EXPERIMENT_SORT_COLUMNS[query.sortBy ?? 'updatedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    const resultsMap = await this.loadExperimentResultsMap(list.map((item) => item.id));
    return buildPaginationResult(
      query,
      list.map((item) => this.mapScriptExperiment(item, resultsMap.get(item.id) ?? [])),
      total,
    );
  }

  async createScriptExperiment(dto: CreateScriptExperimentDto, currentUser: CurrentUser) {
    await this.ensureUniqueScriptExperimentCode(dto.experimentCode);
    const templateIds = [...new Set(dto.templateIds)];
    const templates = await this.scriptTemplateRepository.find({
      where: { id: In(templateIds) },
    });
    if (templates.length !== templateIds.length) {
      throw new BadRequestException('存在不存在的话术模板，无法创建实验');
    }

    const saved = await this.scriptExperimentRepository.save(
      this.scriptExperimentRepository.create({
        experimentCode: dto.experimentCode,
        experimentName: dto.experimentName,
        experimentType: dto.experimentType,
        recommendationType: dto.recommendationType ?? null,
        subjectType: dto.subjectType ?? null,
        businessDomain: dto.businessDomain ?? null,
        status: dto.status,
        hypothesis: dto.hypothesis ?? null,
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
        templateCount: templateIds.length,
        remark: dto.remark ?? null,
        normalizedPayload: { ...(dto.normalizedPayload ?? {}), templateIds },
        createdBy: currentUser.id,
      }),
    );

    await this.scriptExperimentResultRepository.save(
      templateIds.map((templateId) =>
        this.scriptExperimentResultRepository.create({
          scriptExperimentId: saved.id,
          scriptTemplateId: templateId,
          summaryJson: {
            templateId,
            templateName: templates.find((item) => item.id === templateId)?.templateName ?? null,
          },
        }),
      ),
    );

    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'create_script_experiment',
      operatorId: currentUser.id,
      detail: `创建话术实验 ${saved.experimentCode}`,
      detailJson: {
        experimentCode: saved.experimentCode,
        templateIds,
      },
    });

    return this.findScriptExperimentById(saved.id);
  }

  async findScriptExperimentById(id: number) {
    const record = await this.scriptExperimentRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('话术实验不存在');
    }

    const results = await this.loadExperimentResultDetails(id);
    const recentFeedback = await this.followupFeedbackRepository.find({
      where: { scriptExperimentId: id },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    return {
      ...this.mapScriptExperiment(record, results),
      results,
      recentFeedback: recentFeedback.map((item) => this.mapFollowupFeedback(item)),
    };
  }

  async findFollowupFeedback(query: QueryFollowupFeedbackDto) {
    const { skip, take } = getPagination(query);
    const qb = this.followupFeedbackRepository.createQueryBuilder('feedback');

    if (query.scriptExperimentId) {
      qb.andWhere('feedback.script_experiment_id = :scriptExperimentId', {
        scriptExperimentId: query.scriptExperimentId,
      });
    }
    if (query.scriptTemplateId) {
      qb.andWhere('feedback.script_template_id = :scriptTemplateId', {
        scriptTemplateId: query.scriptTemplateId,
      });
    }
    if (query.subjectType) {
      qb.andWhere('feedback.subject_type = :subjectType', { subjectType: query.subjectType });
    }
    if (query.subjectId) {
      qb.andWhere('feedback.subject_id = :subjectId', { subjectId: query.subjectId });
    }
    if (query.feedbackStatus) {
      qb.andWhere('feedback.feedback_status = :feedbackStatus', {
        feedbackStatus: query.feedbackStatus,
      });
    }
    if (query.convertedFlag !== undefined) {
      qb.andWhere('feedback.converted_flag = :convertedFlag', { convertedFlag: query.convertedFlag });
    }
    if (query.followedUpFlag !== undefined) {
      qb.andWhere('feedback.followed_up_flag = :followedUpFlag', {
        followedUpFlag: query.followedUpFlag,
      });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        FOLLOWUP_FEEDBACK_SORT_COLUMNS[query.sortBy ?? 'createdAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list.map((item) => this.mapFollowupFeedback(item)), total);
  }

  async findFollowupFeedbackById(id: number) {
    const record = await this.followupFeedbackRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('跟进反馈不存在');
    }
    return this.mapFollowupFeedback(record);
  }

  async createFollowupFeedback(dto: CreateFollowupFeedbackDto, currentUser: CurrentUser) {
    if (dto.recommendationId) {
      await this.ensureAiRecommendationExists(dto.recommendationId);
    }
    if (dto.recommendationRuleId) {
      await this.findRecommendationRuleEntity(dto.recommendationRuleId);
    }
    if (dto.scriptTemplateId) {
      await this.findScriptTemplateEntity(dto.scriptTemplateId);
    }

    let experimentResultId: number | null = null;
    if (dto.scriptExperimentId && dto.scriptTemplateId) {
      const result = await this.ensureExperimentResult(dto.scriptExperimentId, dto.scriptTemplateId);
      experimentResultId = result.id;
    }

    const saved = await this.followupFeedbackRepository.save(
      this.followupFeedbackRepository.create({
        recommendationId: dto.recommendationId ?? null,
        recommendationRuleId: dto.recommendationRuleId ?? null,
        scriptTemplateId: dto.scriptTemplateId ?? null,
        scriptExperimentId: dto.scriptExperimentId ?? null,
        scriptExperimentResultId: experimentResultId,
        subjectType: dto.subjectType,
        subjectId: dto.subjectId,
        merchantId: dto.merchantId ?? null,
        employeeId: dto.employeeId ?? null,
        businessType: dto.businessType ?? null,
        businessId: dto.businessId ?? null,
        followedUpFlag: dto.followedUpFlag,
        followupAt: dto.followupAt ? new Date(dto.followupAt) : null,
        customerRepliedFlag: dto.customerRepliedFlag,
        convertedFlag: dto.convertedFlag,
        nonConversionReason: dto.nonConversionReason ?? null,
        employeeRemark: dto.employeeRemark ?? null,
        feedbackStatus: dto.feedbackStatus ?? 'recorded',
        normalizedPayload: dto.normalizedPayload ?? null,
        createdBy: currentUser.id,
      }),
    );

    if (saved.scriptExperimentId && saved.scriptTemplateId) {
      await this.recalculateExperimentResult(saved.scriptExperimentId, saved.scriptTemplateId);
    }

    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'create_followup_feedback',
      operatorId: currentUser.id,
      detail: `创建跟进反馈 ${saved.subjectType}:${saved.subjectId}`,
      detailJson: this.mapFollowupFeedback(saved),
    });

    return this.findFollowupFeedbackById(saved.id);
  }

  private async ensureUniqueRecommendationRuleCode(ruleCode: string, ignoreId?: number) {
    const existing = await this.recommendationRuleRepository.findOne({ where: { ruleCode } });
    if (existing && existing.id !== ignoreId) {
      throw new BadRequestException('推荐规则编码已存在');
    }
  }

  private async ensureUniqueScriptTemplateCode(templateCode: string, ignoreId?: number) {
    const existing = await this.scriptTemplateRepository.findOne({ where: { templateCode } });
    if (existing && existing.id !== ignoreId) {
      throw new BadRequestException('话术模板编码已存在');
    }
  }

  private async ensureUniqueScriptExperimentCode(experimentCode: string) {
    const existing = await this.scriptExperimentRepository.findOne({ where: { experimentCode } });
    if (existing) {
      throw new BadRequestException('话术实验编码已存在');
    }
  }

  private async findRecommendationRuleEntity(id: number) {
    const record = await this.recommendationRuleRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('推荐规则不存在');
    }
    return record;
  }

  private async findScriptTemplateEntity(id: number) {
    const record = await this.scriptTemplateRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('话术模板不存在');
    }
    return record;
  }

  private async ensureAiRecommendationExists(id: number) {
    const record = await this.aiRecommendationRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('AI推荐不存在');
    }
    return record;
  }

  private async ensureExperimentResult(scriptExperimentId: number, scriptTemplateId: number) {
    const experiment = await this.scriptExperimentRepository.findOne({ where: { id: scriptExperimentId } });
    if (!experiment) {
      throw new NotFoundException('话术实验不存在');
    }
    const template = await this.findScriptTemplateEntity(scriptTemplateId);

    let result = await this.scriptExperimentResultRepository.findOne({
      where: { scriptExperimentId, scriptTemplateId },
    });
    if (!result) {
      result = await this.scriptExperimentResultRepository.save(
        this.scriptExperimentResultRepository.create({
          scriptExperimentId,
          scriptTemplateId,
          summaryJson: {
            templateId: scriptTemplateId,
            templateName: template.templateName,
            experimentCode: experiment.experimentCode,
          },
        }),
      );
    }
    return result;
  }

  private async recalculateExperimentResult(scriptExperimentId: number, scriptTemplateId: number) {
    const result = await this.ensureExperimentResult(scriptExperimentId, scriptTemplateId);
    const feedbackRows = await this.followupFeedbackRepository.find({
      where: { scriptExperimentId, scriptTemplateId },
    });

    const sampleCount = feedbackRows.length;
    const followedUpCount = feedbackRows.filter((item) => item.followedUpFlag).length;
    const repliedCount = feedbackRows.filter((item) => item.customerRepliedFlag).length;
    const convertedCount = feedbackRows.filter((item) => item.convertedFlag).length;
    const ignoredCount = feedbackRows.filter((item) => item.feedbackStatus === 'ignored').length;
    const nonConversionReasonMap = new Map<string, number>();
    const feedbackStatusBreakdown = feedbackRows.reduce<Record<string, number>>((accumulator, item) => {
      accumulator[item.feedbackStatus] = (accumulator[item.feedbackStatus] ?? 0) + 1;
      return accumulator;
    }, {});

    for (const item of feedbackRows) {
      if (item.convertedFlag) {
        continue;
      }
      const reason = item.nonConversionReason?.trim();
      if (!reason) {
        continue;
      }
      nonConversionReasonMap.set(reason, (nonConversionReasonMap.get(reason) ?? 0) + 1);
    }

    const latestFeedbackAt = feedbackRows
      .map((item) => item.followupAt ?? item.createdAt)
      .sort((left, right) => right.getTime() - left.getTime())[0];

    result.sampleCount = sampleCount;
    result.followedUpCount = followedUpCount;
    result.repliedCount = repliedCount;
    result.convertedCount = convertedCount;
    result.ignoredCount = ignoredCount;
    result.replyRate = sampleCount ? (repliedCount / sampleCount).toFixed(4) : '0.0000';
    result.conversionRate = sampleCount ? (convertedCount / sampleCount).toFixed(4) : '0.0000';
    result.summaryJson = {
      ...(result.summaryJson ?? {}),
      latestFeedbackAt: latestFeedbackAt?.toISOString() ?? null,
      deliveredCount: followedUpCount,
      feedbackStatusBreakdown,
      nonConversionReasons: [...nonConversionReasonMap.entries()].map(([reason, count]) => ({
        reason,
        count,
      })),
    };
    await this.scriptExperimentResultRepository.save(result);
  }

  private async loadExperimentResultsMap(experimentIds: number[]) {
    const map = new Map<number, Array<ReturnType<EngagementOptimizationService['mapScriptExperimentResult']>>>();
    if (!experimentIds.length) return map;

    const results = await this.scriptExperimentResultRepository
      .createQueryBuilder('result')
      .leftJoinAndSelect('result.scriptTemplate', 'template')
      .where('result.script_experiment_id IN (:...experimentIds)', { experimentIds })
      .orderBy('result.id', 'ASC')
      .getMany();

    for (const result of results) {
      const current = map.get(result.scriptExperimentId) ?? [];
      current.push(this.mapScriptExperimentResult(result));
      map.set(result.scriptExperimentId, current);
    }
    return map;
  }

  private async loadExperimentResultDetails(scriptExperimentId: number) {
    const results = await this.scriptExperimentResultRepository
      .createQueryBuilder('result')
      .leftJoinAndSelect('result.scriptTemplate', 'template')
      .where('result.script_experiment_id = :scriptExperimentId', { scriptExperimentId })
      .orderBy('result.id', 'ASC')
      .getMany();

    return results.map((item) => this.mapScriptExperimentResult(item));
  }

  private mapRecommendationRule(record: RecommendationRule) {
    return {
      id: record.id,
      ruleCode: record.ruleCode,
      ruleName: record.ruleName,
      recommendationType: record.recommendationType,
      subjectType: record.subjectType,
      businessDomain: record.businessDomain,
      triggerMemoryType: record.triggerMemoryType,
      triggerInteractionType: record.triggerInteractionType,
      evidenceStatus: record.evidenceStatus,
      confidenceScore: record.confidenceScore,
      ruleStrength: record.ruleStrength,
      matchConditions: record.matchConditions,
      recommendationTemplate: record.recommendationTemplate,
      isActive: record.isActive,
      remark: record.remark,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private mapScriptTemplate(record: ScriptTemplate) {
    return {
      id: record.id,
      templateCode: record.templateCode,
      templateName: record.templateName,
      templateGroup: record.templateGroup,
      recommendationType: record.recommendationType,
      channel: record.channel,
      openingText: record.openingText,
      scriptContent: record.scriptContent,
      closingText: record.closingText,
      isActive: record.isActive,
      remark: record.remark,
      normalizedPayload: record.normalizedPayload,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private mapScriptExperiment(
    record: ScriptExperiment,
    results: Array<ReturnType<EngagementOptimizationService['mapScriptExperimentResult']>>,
  ) {
    const scenarioCode =
      record.normalizedPayload && typeof record.normalizedPayload['scenarioCode'] === 'string'
        ? (record.normalizedPayload['scenarioCode'] as string)
        : null;
    const scenarioName =
      record.normalizedPayload && typeof record.normalizedPayload['scenarioName'] === 'string'
        ? (record.normalizedPayload['scenarioName'] as string)
        : null;

    return {
      id: record.id,
      experimentCode: record.experimentCode,
      experimentName: record.experimentName,
      experimentType: record.experimentType,
      recommendationType: record.recommendationType,
      subjectType: record.subjectType,
      businessDomain: record.businessDomain,
      status: record.status,
      hypothesis: record.hypothesis,
      startAt: record.startAt,
      endAt: record.endAt,
      templateCount: record.templateCount,
      remark: record.remark,
      normalizedPayload: record.normalizedPayload,
      scenarioCode,
      scenarioName,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      results,
    };
  }

  private mapScriptExperimentResult(record: ScriptExperimentResult) {
    return {
      id: record.id,
      scriptExperimentId: record.scriptExperimentId,
      scriptTemplateId: record.scriptTemplateId,
      templateCode: record.scriptTemplate?.templateCode ?? null,
      templateName: record.scriptTemplate?.templateName ?? null,
      templateGroup: record.scriptTemplate?.templateGroup ?? null,
      sampleCount: record.sampleCount,
      followedUpCount: record.followedUpCount,
      repliedCount: record.repliedCount,
      convertedCount: record.convertedCount,
      ignoredCount: record.ignoredCount,
      replyRate: record.replyRate,
      conversionRate: record.conversionRate,
      summaryJson: record.summaryJson,
      nonConversionReasons:
        record.summaryJson && Array.isArray(record.summaryJson['nonConversionReasons'])
          ? record.summaryJson['nonConversionReasons']
          : [],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private mapFollowupFeedback(record: FollowupFeedback) {
    return {
      id: record.id,
      recommendationId: record.recommendationId,
      recommendationRuleId: record.recommendationRuleId,
      scriptTemplateId: record.scriptTemplateId,
      scriptExperimentId: record.scriptExperimentId,
      scriptExperimentResultId: record.scriptExperimentResultId,
      subjectType: record.subjectType,
      subjectId: record.subjectId,
      merchantId: record.merchantId,
      employeeId: record.employeeId,
      businessType: record.businessType,
      businessId: record.businessId,
      followedUpFlag: record.followedUpFlag,
      followupAt: record.followupAt,
      customerRepliedFlag: record.customerRepliedFlag,
      convertedFlag: record.convertedFlag,
      nonConversionReason: record.nonConversionReason,
      employeeRemark: record.employeeRemark,
      feedbackStatus: record.feedbackStatus,
      normalizedPayload: record.normalizedPayload,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private normalizeSortOrder(sortOrder: string | undefined, fallback: 'ASC' | 'DESC') {
    if (!sortOrder) return fallback;
    return sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  }
}
