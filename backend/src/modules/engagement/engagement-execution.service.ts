import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { buildPaginationResult, getPagination } from '../../common/utils/pagination.util';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { User } from '../users/entities/user.entity';
import { CloseExecutionTaskDto } from './dto/close-execution-task.dto';
import { ConfirmExecutionTaskDto } from './dto/confirm-execution-task.dto';
import { ConfirmExecutionTaskItemDto } from './dto/confirm-execution-task-item.dto';
import { CreateExecutionPlaybookDto } from './dto/create-execution-playbook.dto';
import { CreateExecutionResultDto } from './dto/create-execution-result.dto';
import { CreateExecutionTaskDto } from './dto/create-execution-task.dto';
import { QueryExecutionPlaybooksDto } from './dto/query-execution-playbooks.dto';
import { QueryExecutionResultsDto } from './dto/query-execution-results.dto';
import { QueryExecutionTaskItemsDto } from './dto/query-execution-task-items.dto';
import { QueryExecutionTasksDto } from './dto/query-execution-tasks.dto';
import { SkipExecutionTaskItemDto } from './dto/skip-execution-task-item.dto';
import { ToggleExecutionPlaybookDto } from './dto/toggle-execution-playbook.dto';
import { UpdateExecutionPlaybookDto } from './dto/update-execution-playbook.dto';
import { AiRecommendation } from './entities/ai-recommendation.entity';
import { ExecutionPlaybook } from './entities/execution-playbook.entity';
import { ExecutionResult } from './entities/execution-result.entity';
import { ExecutionTaskItem } from './entities/execution-task-item.entity';
import { ExecutionTask } from './entities/execution-task.entity';
import { FollowupFeedback } from './entities/followup-feedback.entity';
import { RecommendationRule } from './entities/recommendation-rule.entity';
import { ScriptTemplate } from './entities/script-template.entity';

const EXECUTION_PLAYBOOK_SORT_COLUMNS: Record<string, string> = {
  playbookCode: 'playbook.playbook_code',
  playbookName: 'playbook.playbook_name',
  scenarioCode: 'playbook.scenario_code',
  recommendationType: 'playbook.recommendation_type',
  updatedAt: 'playbook.updated_at',
  createdAt: 'playbook.created_at',
};

const EXECUTION_TASK_SORT_COLUMNS: Record<string, string> = {
  taskCode: 'task.task_code',
  taskName: 'task.task_name',
  scenarioCode: 'task.scenario_code',
  status: 'task.status',
  targetCount: 'task.target_count',
  updatedAt: 'task.updated_at',
  createdAt: 'task.created_at',
};

const EXECUTION_TASK_ITEM_SORT_COLUMNS: Record<string, string> = {
  taskId: 'item.task_id',
  status: 'item.status',
  subjectId: 'item.subject_id',
  merchantId: 'item.merchant_id',
  updatedAt: 'item.updated_at',
  createdAt: 'item.created_at',
};

const EXECUTION_RESULT_SORT_COLUMNS: Record<string, string> = {
  playbookId: 'task.playbook_id',
  taskId: 'result.task_id',
  subjectId: 'result.subject_id',
  executedAt: 'result.executed_at',
  createdAt: 'result.created_at',
};

type ExecutionAnalyticsBucket = {
  taskIds: Set<number>;
  taskCount: number;
  confirmedCount: number;
  executedCount: number;
  repliedCount: number;
  convertedCount: number;
  ignoredCount: number;
  responseMinutesTotal: number;
  responseMinutesCount: number;
  nonConversionReasons: Map<string, number>;
};

@Injectable()
export class EngagementExecutionService {
  constructor(
    @InjectRepository(ExecutionPlaybook)
    private readonly executionPlaybookRepository: Repository<ExecutionPlaybook>,
    @InjectRepository(ExecutionTask)
    private readonly executionTaskRepository: Repository<ExecutionTask>,
    @InjectRepository(ExecutionTaskItem)
    private readonly executionTaskItemRepository: Repository<ExecutionTaskItem>,
    @InjectRepository(ExecutionResult)
    private readonly executionResultRepository: Repository<ExecutionResult>,
    @InjectRepository(AiRecommendation)
    private readonly aiRecommendationRepository: Repository<AiRecommendation>,
    @InjectRepository(ScriptTemplate)
    private readonly scriptTemplateRepository: Repository<ScriptTemplate>,
    @InjectRepository(RecommendationRule)
    private readonly recommendationRuleRepository: Repository<RecommendationRule>,
    @InjectRepository(FollowupFeedback)
    private readonly followupFeedbackRepository: Repository<FollowupFeedback>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async findExecutionPlaybooks(query: QueryExecutionPlaybooksDto) {
    const { skip, take } = getPagination(query);
    const qb = this.executionPlaybookRepository.createQueryBuilder('playbook');

    if (query.scenarioCode) {
      qb.andWhere('playbook.scenario_code = :scenarioCode', { scenarioCode: query.scenarioCode });
    }
    if (query.recommendationType) {
      qb.andWhere('playbook.recommendation_type = :recommendationType', {
        recommendationType: query.recommendationType,
      });
    }
    if (query.businessDomain) {
      qb.andWhere('playbook.business_domain = :businessDomain', { businessDomain: query.businessDomain });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        EXECUTION_PLAYBOOK_SORT_COLUMNS[query.sortBy ?? 'updatedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list.map((item) => this.mapExecutionPlaybook(item)), total);
  }

  async createExecutionPlaybook(dto: CreateExecutionPlaybookDto, currentUser: CurrentUser) {
    await this.ensureUniquePlaybookCode(dto.playbookCode);
    if (dto.recommendationRuleId) {
      await this.findRecommendationRule(dto.recommendationRuleId);
    }
    if (dto.defaultScriptTemplateId) {
      await this.findScriptTemplate(dto.defaultScriptTemplateId);
    }

    const saved = await this.executionPlaybookRepository.save(
      this.executionPlaybookRepository.create({
        playbookCode: dto.playbookCode,
        playbookName: dto.playbookName,
        scenarioCode: dto.scenarioCode,
        scenarioName: dto.scenarioName,
        recommendationType: dto.recommendationType,
        targetSubjectType: dto.targetSubjectType ?? null,
        businessDomain: dto.businessDomain ?? null,
        merchantId: dto.merchantId ?? null,
        recommendationRuleId: dto.recommendationRuleId ?? null,
        defaultScriptTemplateId: dto.defaultScriptTemplateId ?? null,
        executionChannel: dto.executionChannel ?? 'manual_followup',
        description: dto.description ?? null,
        isActive: dto.isActive,
        normalizedPayload: dto.normalizedPayload ?? null,
        createdBy: currentUser.id,
      }),
    );

    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'create_execution_playbook',
      operatorId: currentUser.id,
      detail: `创建执行方案 ${saved.playbookCode}`,
      detailJson: this.mapExecutionPlaybook(saved),
    });

    return this.mapExecutionPlaybook(saved);
  }

  async updateExecutionPlaybook(id: number, dto: UpdateExecutionPlaybookDto, currentUser: CurrentUser) {
    const record = await this.findExecutionPlaybookEntity(id);
    const before = this.mapExecutionPlaybook(record);

    if (dto.playbookCode && dto.playbookCode !== record.playbookCode) {
      await this.ensureUniquePlaybookCode(dto.playbookCode, id);
    }
    if (dto.recommendationRuleId !== undefined && dto.recommendationRuleId !== null) {
      await this.findRecommendationRule(dto.recommendationRuleId);
    }
    if (dto.defaultScriptTemplateId !== undefined && dto.defaultScriptTemplateId !== null) {
      await this.findScriptTemplate(dto.defaultScriptTemplateId);
    }

    if (dto.playbookCode !== undefined) record.playbookCode = dto.playbookCode;
    if (dto.playbookName !== undefined) record.playbookName = dto.playbookName;
    if (dto.scenarioCode !== undefined) record.scenarioCode = dto.scenarioCode;
    if (dto.scenarioName !== undefined) record.scenarioName = dto.scenarioName;
    if (dto.recommendationType !== undefined) record.recommendationType = dto.recommendationType;
    if (dto.targetSubjectType !== undefined) record.targetSubjectType = dto.targetSubjectType ?? null;
    if (dto.businessDomain !== undefined) record.businessDomain = dto.businessDomain ?? null;
    if (dto.merchantId !== undefined) record.merchantId = dto.merchantId ?? null;
    if (dto.recommendationRuleId !== undefined) {
      record.recommendationRuleId = dto.recommendationRuleId ?? null;
    }
    if (dto.defaultScriptTemplateId !== undefined) {
      record.defaultScriptTemplateId = dto.defaultScriptTemplateId ?? null;
    }
    if (dto.executionChannel !== undefined) record.executionChannel = dto.executionChannel;
    if (dto.description !== undefined) record.description = dto.description ?? null;
    if (dto.isActive !== undefined) record.isActive = dto.isActive;
    if (dto.normalizedPayload !== undefined) record.normalizedPayload = dto.normalizedPayload ?? null;

    const saved = await this.executionPlaybookRepository.save(record);
    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'update_execution_playbook',
      operatorId: currentUser.id,
      detail: `更新执行方案 ${saved.playbookCode}`,
      detailJson: { before, after: this.mapExecutionPlaybook(saved) },
    });

    return this.mapExecutionPlaybook(saved);
  }

  async toggleExecutionPlaybook(id: number, dto: ToggleExecutionPlaybookDto, currentUser: CurrentUser) {
    const record = await this.findExecutionPlaybookEntity(id);
    const before = this.mapExecutionPlaybook(record);
    record.isActive = dto.isActive;
    const saved = await this.executionPlaybookRepository.save(record);

    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'toggle_execution_playbook',
      operatorId: currentUser.id,
      detail: `${saved.isActive ? '启用' : '停用'}执行方案 ${saved.playbookCode}`,
      detailJson: { before, after: this.mapExecutionPlaybook(saved) },
    });

    return this.mapExecutionPlaybook(saved);
  }

  async findExecutionTasks(query: QueryExecutionTasksDto, currentUser: CurrentUser) {
    const { skip, take } = getPagination(query);
    const qb = this.executionTaskRepository.createQueryBuilder('task');

    if (query.playbookId) {
      qb.andWhere('task.playbook_id = :playbookId', { playbookId: query.playbookId });
    }
    if (query.scenarioCode) {
      qb.andWhere('task.scenario_code = :scenarioCode', { scenarioCode: query.scenarioCode });
    }
    if (query.status) {
      qb.andWhere('task.status = :status', { status: query.status });
    }
    if (query.assignedTo) {
      qb.andWhere('task.assigned_to = :assignedTo', { assignedTo: query.assignedTo });
    }
    if (query.merchantId) {
      qb.andWhere('task.merchant_id = :merchantId', { merchantId: query.merchantId });
    }
    if (this.isOperator(currentUser)) {
      qb.andWhere('task.assigned_to = :currentUserId', { currentUserId: currentUser.id });
    }

    const total = await qb.getCount();
    const tasks = await qb
      .clone()
      .orderBy(
        EXECUTION_TASK_SORT_COLUMNS[query.sortBy ?? 'updatedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    if (!tasks.length) {
      return buildPaginationResult(query, [], total);
    }

    const playbookIds = Array.from(new Set(tasks.map((item) => item.playbookId)));
    const playbooks = playbookIds.length
      ? await this.executionPlaybookRepository.findBy({ id: In(playbookIds) })
      : [];
    const playbookNameMap = new Map(playbooks.map((item) => [item.id, item.playbookName]));

    const taskIds = tasks.map((item) => item.id);
    const itemCountRows = await this.executionTaskItemRepository
      .createQueryBuilder('item')
      .select('item.task_id', 'taskId')
      .addSelect('COUNT(1)', 'count')
      .where('item.task_id IN (:...taskIds)', { taskIds })
      .groupBy('item.task_id')
      .getRawMany();
    const resultCountRows = await this.executionResultRepository
      .createQueryBuilder('result')
      .select('result.task_id', 'taskId')
      .addSelect('COUNT(1)', 'count')
      .where('result.task_id IN (:...taskIds)', { taskIds })
      .groupBy('result.task_id')
      .getRawMany();

    const itemCountMap = new Map(itemCountRows.map((item) => [Number(item.taskId), Number(item.count)]));
    const resultCountMap = new Map(resultCountRows.map((item) => [Number(item.taskId), Number(item.count)]));

    const mapped = tasks.map((task) =>
      this.mapExecutionTask(task, {
        playbookName: playbookNameMap.get(task.playbookId) ?? null,
        itemCount: itemCountMap.get(task.id) ?? 0,
        resultCount: resultCountMap.get(task.id) ?? 0,
      }),
    );

    return buildPaginationResult(query, mapped, total);
  }

  async createExecutionTask(dto: CreateExecutionTaskDto, currentUser: CurrentUser) {
    const playbook = await this.findExecutionPlaybookEntity(dto.playbookId);
    if (!playbook.isActive) {
      throw new BadRequestException('当前执行方案未启用');
    }
    const selectedTemplateId = dto.scriptTemplateId ?? playbook.defaultScriptTemplateId ?? null;
    if (selectedTemplateId) {
      await this.findScriptTemplate(selectedTemplateId);
    }
    await this.ensureUniqueTaskCode(dto.taskCode);

    const recommendations = dto.recommendationIds?.length
      ? await this.loadRecommendationsByIds(dto.recommendationIds)
      : await this.autoSelectRecommendations(playbook, dto.maxItems ?? 10);

    if (!recommendations.length) {
      throw new BadRequestException('当前没有可用于生成执行任务的推荐对象');
    }

    const savedTask = await this.executionTaskRepository.save(
      this.executionTaskRepository.create({
        taskCode: dto.taskCode,
        taskName: dto.taskName,
        playbookId: playbook.id,
        scenarioCode: playbook.scenarioCode,
        scenarioName: playbook.scenarioName,
        recommendationType: playbook.recommendationType,
        status: 'draft',
        assignedTo: dto.assignedTo ?? null,
        merchantId: dto.merchantId ?? playbook.merchantId ?? this.resolveTaskMerchantId(recommendations),
        targetCount: recommendations.length,
        remark: dto.remark ?? null,
        normalizedPayload: {
          playbookSnapshot: this.mapExecutionPlaybook(playbook),
          source: dto.recommendationIds?.length ? 'manual_selection' : 'auto_selection',
          ...this.asRecord(dto.normalizedPayload),
        },
        createdBy: currentUser.id,
      }),
    );

    const items: ExecutionTaskItem[] = [];
    for (const recommendation of recommendations) {
      const item = await this.executionTaskItemRepository.save(
        this.executionTaskItemRepository.create({
          taskId: savedTask.id,
          recommendationId: recommendation.id,
          subjectType: recommendation.subjectType,
          subjectId: recommendation.subjectId,
          merchantId:
            this.extractNumber(recommendation.sourceContext, ['merchantId']) ??
            playbook.merchantId ??
            null,
          employeeId:
            recommendation.subjectType === 'employee'
              ? recommendation.subjectId
              : this.extractNumber(recommendation.sourceContext, ['employeeId']),
          businessType: this.extractString(recommendation.sourceContext, ['businessType']),
          businessId: this.extractString(recommendation.sourceContext, ['businessId']),
          scriptTemplateId: selectedTemplateId,
          evidenceStatus: recommendation.evidenceStatus,
          confidenceScore: recommendation.confidenceScore,
          matchedRule: recommendation.recommendationRuleId
            ? `recommendation_rule:${recommendation.recommendationRuleId}`
            : recommendation.ruleStrength ?? null,
          status: 'pending_confirmation',
          assignedTo: dto.assignedTo ?? null,
          normalizedPayload: {
            recommendationSnapshot: this.mapAiRecommendation(recommendation),
            playbookCode: playbook.playbookCode,
          },
        }),
      );
      items.push(item);
    }

    await this.operationLogsService.create({
      module: 'engagement',
      targetId: savedTask.id,
      action: 'create_execution_task',
      operatorId: currentUser.id,
      detail: `创建执行任务 ${savedTask.taskCode}`,
      detailJson: {
        task: this.mapExecutionTask(savedTask, {
          playbookName: playbook.playbookName,
          itemCount: items.length,
          resultCount: 0,
        }),
        recommendationIds: recommendations.map((item) => item.id),
      },
    });

    return this.findExecutionTaskById(savedTask.id, currentUser);
  }

  async findExecutionTaskById(id: number, currentUser: CurrentUser) {
    const task = await this.findExecutionTaskEntity(id);
    this.ensureTaskAccess(task, currentUser);
    const playbook = await this.executionPlaybookRepository.findOne({ where: { id: task.playbookId } });
    const items = await this.executionTaskItemRepository.find({
      where: { taskId: task.id },
      order: { id: 'ASC' },
    });
    const results = await this.executionResultRepository.find({
      where: { taskId: task.id },
      order: { executedAt: 'DESC', id: 'DESC' },
    });

    return {
      ...this.mapExecutionTask(task, {
        playbookName: playbook?.playbookName ?? null,
        itemCount: items.length,
        resultCount: results.length,
      }),
      items: items.map((item) => this.mapExecutionTaskItem(item)),
      results: results.slice(0, 10).map((item) => this.mapExecutionResult(item)),
      resultSummary: {
        total: results.length,
        replied: results.filter((item) => item.repliedFlag).length,
        converted: results.filter((item) => item.convertedFlag).length,
        nonConversionReasons: this.summarizeNonConversionReasons(results),
      },
    };
  }

  async confirmExecutionTask(id: number, dto: ConfirmExecutionTaskDto, currentUser: CurrentUser) {
    const task = await this.findExecutionTaskEntity(id);
    task.status = 'confirmed';
    task.confirmedBy = currentUser.id;
    task.confirmedAt = new Date();
    if (dto.remark !== undefined) {
      task.remark = dto.remark ?? null;
    }
    const saved = await this.executionTaskRepository.save(task);
    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'confirm_execution_task',
      operatorId: currentUser.id,
      detail: `确认执行任务 ${saved.taskCode}`,
      detailJson: this.mapExecutionTask(saved),
    });
    return this.findExecutionTaskById(saved.id, currentUser);
  }

  async closeExecutionTask(id: number, dto: CloseExecutionTaskDto, currentUser: CurrentUser) {
    const task = await this.findExecutionTaskEntity(id);
    task.status = 'closed';
    task.closedBy = currentUser.id;
    task.closedAt = new Date();
    if (dto.remark !== undefined) {
      task.remark = dto.remark ?? null;
    }
    const saved = await this.executionTaskRepository.save(task);
    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'close_execution_task',
      operatorId: currentUser.id,
      detail: `关闭执行任务 ${saved.taskCode}`,
      detailJson: this.mapExecutionTask(saved),
    });
    return this.findExecutionTaskById(saved.id, currentUser);
  }

  async findExecutionTaskItems(query: QueryExecutionTaskItemsDto, currentUser: CurrentUser) {
    const { skip, take } = getPagination(query);
    const qb = this.executionTaskItemRepository.createQueryBuilder('item');

    if (query.taskId) {
      qb.andWhere('item.task_id = :taskId', { taskId: query.taskId });
    }
    if (query.assignedTo) {
      qb.andWhere('item.assigned_to = :assignedTo', { assignedTo: query.assignedTo });
    }
    if (query.status) {
      qb.andWhere('item.status = :status', { status: query.status });
    }
    if (this.isOperator(currentUser)) {
      qb.andWhere('item.assigned_to = :currentUserId', { currentUserId: currentUser.id });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        EXECUTION_TASK_ITEM_SORT_COLUMNS[query.sortBy ?? 'updatedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list.map((item) => this.mapExecutionTaskItem(item)), total);
  }

  async confirmExecutionTaskItem(id: number, dto: ConfirmExecutionTaskItemDto, currentUser: CurrentUser) {
    const item = await this.findExecutionTaskItemEntity(id);
    const task = await this.findExecutionTaskEntity(item.taskId);
    if (dto.scriptTemplateId) {
      await this.findScriptTemplate(dto.scriptTemplateId);
      item.scriptTemplateId = dto.scriptTemplateId;
    }
    item.status = 'confirmed';
    item.confirmedBy = currentUser.id;
    item.confirmedAt = new Date();
    const saved = await this.executionTaskItemRepository.save(item);
    if (task.status === 'draft') {
      task.status = 'confirmed';
      task.confirmedBy = currentUser.id;
      task.confirmedAt = new Date();
      await this.executionTaskRepository.save(task);
    }

    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'confirm_execution_task_item',
      operatorId: currentUser.id,
      detail: `确认执行任务明细 ${saved.id}`,
      detailJson: this.mapExecutionTaskItem(saved),
    });

    return this.mapExecutionTaskItem(saved);
  }

  async skipExecutionTaskItem(id: number, dto: SkipExecutionTaskItemDto, currentUser: CurrentUser) {
    const item = await this.findExecutionTaskItemEntity(id);
    item.status = 'skipped';
    item.skippedBy = currentUser.id;
    item.skippedAt = new Date();
    item.skipReason = dto.skipReason ?? null;
    const saved = await this.executionTaskItemRepository.save(item);

    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'skip_execution_task_item',
      operatorId: currentUser.id,
      detail: `跳过执行任务明细 ${saved.id}`,
      detailJson: this.mapExecutionTaskItem(saved),
    });

    await this.refreshTaskStatus(saved.taskId);
    return this.mapExecutionTaskItem(saved);
  }

  async findExecutionResults(query: QueryExecutionResultsDto, currentUser: CurrentUser) {
    const { skip, take } = getPagination(query);
    const sortBy = query.sortBy ?? 'executedAt';
    const sortOrder = this.normalizeSortOrder(query.sortOrder, 'DESC');

    const rows = await this.buildExecutionResultsQuery(query, currentUser)
      .select('result.id', 'resultId')
      .addSelect('result.task_id', 'taskId')
      .addSelect('result.subject_id', 'subjectId')
      .addSelect('result.executed_at', 'executedAt')
      .addSelect('result.created_at', 'createdAt')
      .addSelect('task.playbook_id', 'playbookId')
      .getRawMany<{
        resultId: string | number;
        taskId: string | number | null;
        subjectId: string | number | null;
        executedAt: string | Date | null;
        createdAt: string | Date | null;
        playbookId: string | number | null;
      }>();

    const sortedRows = rows
      .slice()
      .sort((left, right) =>
        this.compareExecutionResultRows(left, right, sortBy, sortOrder),
      );

    const total = sortedRows.length;
    const pagedIds = sortedRows
      .slice(skip, skip + take)
      .map((item) => Number(item.resultId))
      .filter((item) => Number.isInteger(item) && item > 0);

    if (!pagedIds.length) {
      return buildPaginationResult(query, [], total);
    }

    const records = await this.executionResultRepository.findBy({ id: In(pagedIds) });
    const recordMap = new Map(records.map((item) => [item.id, item]));
    const ordered = pagedIds
      .map((id) => recordMap.get(id))
      .filter((item): item is ExecutionResult => Boolean(item));

    return buildPaginationResult(
      query,
      ordered.map((item) => this.mapExecutionResult(item)),
      total,
    );
  }

  async findExecutionResultSummary(query: QueryExecutionResultsDto, currentUser: CurrentUser) {
    const results = await this.buildExecutionResultsQuery(query, currentUser)
      .orderBy('result.executed_at', 'DESC')
      .getMany();

    const taskIds = [...new Set(results.map((item) => item.taskId))];
    const recommendationIds = [
      ...new Set(results.map((item) => item.recommendationId).filter((item): item is number => Boolean(item))),
    ];

    const [tasks, items, playbooks, templates, users, recommendations] = await Promise.all([
      taskIds.length ? this.executionTaskRepository.findBy({ id: In(taskIds) }) : Promise.resolve([]),
      taskIds.length ? this.executionTaskItemRepository.findBy({ taskId: In(taskIds) }) : Promise.resolve([]),
      this.loadExecutionPlaybooksForTasks(taskIds),
      this.loadScriptTemplatesForExecutionSummary(results, taskIds),
      this.loadUsersForExecutionSummary(results, taskIds),
      recommendationIds.length
        ? this.aiRecommendationRepository.findBy({ id: In(recommendationIds) })
        : Promise.resolve([]),
    ]);
    const recommendationRuleIds = [
      ...new Set(
        recommendations
          .map((item) => item.recommendationRuleId)
          .filter((item): item is number => Boolean(item)),
      ),
    ];
    const rules = recommendationRuleIds.length
      ? await this.recommendationRuleRepository.findBy({ id: In(recommendationRuleIds) })
      : [];

    const taskMap = new Map(tasks.map((item) => [item.id, item]));
    const itemMap = new Map(items.map((item) => [item.id, item]));
    const playbookMap = new Map(playbooks.map((item) => [item.id, item]));
    const templateMap = new Map(templates.map((item) => [item.id, item]));
    const userMap = new Map(users.map((item) => [item.id, item]));
    const recommendationMap = new Map(recommendations.map((item) => [item.id, item]));
    const ruleMap = new Map(rules.map((item) => [item.id, item]));

    const taskStats = this.aggregateExecutionStats(
      results,
      items,
      taskMap,
      itemMap,
      (result, task) => String(task?.playbookId ?? 'unassigned'),
    );
    const templateStats = this.aggregateExecutionStats(
      results,
      items,
      taskMap,
      itemMap,
      (result, _task, item) => String(result.scriptTemplateId ?? item?.scriptTemplateId ?? 'unassigned'),
    );
    const operatorStats = this.aggregateExecutionStats(
      results,
      items,
      taskMap,
      itemMap,
      (result) => String(result.executedBy ?? 'unassigned'),
    );

    const response = {
      filters: {
        playbookId: query.playbookId ?? null,
        scenarioCode: query.scenarioCode ?? null,
        taskId: query.taskId ?? null,
        taskItemId: query.taskItemId ?? null,
        executedBy: query.executedBy ?? null,
        merchantId: query.merchantId ?? null,
        resultStatus: query.resultStatus ?? null,
        batchCode: query.batchCode ?? null,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
      },
      overview: this.mapExecutionStats(taskStats.get('__overall__') ?? this.emptyExecutionStats()),
      byPlaybook: [...taskStats.entries()]
        .filter(([key]) => key !== '__overall__')
        .map(([key, stats]) => {
          const playbookId = Number(key);
          const playbook = Number.isFinite(playbookId) ? playbookMap.get(playbookId) ?? null : null;
          return {
            playbookId: playbook?.id ?? null,
            playbookCode: playbook?.playbookCode ?? null,
            playbookName: playbook?.playbookName ?? null,
            scenarioCode: playbook?.scenarioCode ?? null,
            scenarioName: playbook?.scenarioName ?? null,
            ...this.mapExecutionStats(stats),
          };
        })
        .sort((left, right) => right.executedCount - left.executedCount || right.taskCount - left.taskCount),
      byTemplate: [...templateStats.entries()]
        .filter(([key]) => key !== '__overall__')
        .map(([key, stats]) => {
          const templateId = Number(key);
          const template = Number.isFinite(templateId) ? templateMap.get(templateId) ?? null : null;
          return {
            scriptTemplateId: template?.id ?? null,
            templateCode: template?.templateCode ?? null,
            templateName: template?.templateName ?? null,
            templateGroup: template?.templateGroup ?? null,
            ...this.mapExecutionStats(stats),
          };
        })
        .sort(
          (left, right) =>
            right.conversionRate - left.conversionRate ||
            right.replyRate - left.replyRate ||
            right.executedCount - left.executedCount,
        ),
      byOperator: [...operatorStats.entries()]
        .filter(([key]) => key !== '__overall__')
        .map(([key, stats]) => {
          const operatorId = Number(key);
          const user = Number.isFinite(operatorId) ? userMap.get(operatorId) ?? null : null;
          return {
            operatorId: Number.isFinite(operatorId) ? operatorId : null,
            username: user?.username ?? null,
            realName: user?.realName ?? null,
            ...this.mapExecutionStats(stats),
          };
        })
        .sort((left, right) => right.executedCount - left.executedCount || right.convertedCount - left.convertedCount),
      topNonConversionReasons: this.mapReasonSummary(
        this.summarizeNonConversionReasons(results).slice(0, 10),
      ),
      ruleCalibration: this.buildRuleCalibrationSummary(
        results,
        items,
        taskMap,
        itemMap,
        recommendationMap,
        ruleMap,
        templateMap,
      ),
    };

    return response;
  }

  async createExecutionResult(dto: CreateExecutionResultDto, currentUser: CurrentUser) {
    const task = await this.findExecutionTaskEntity(dto.taskId);
    const item = await this.findExecutionTaskItemEntity(dto.taskItemId);
    if (item.taskId !== task.id) {
      throw new BadRequestException('执行结果与任务明细不匹配');
    }
    this.ensureTaskAccess(task, currentUser);
    if (this.isOperator(currentUser) && item.assignedTo && item.assignedTo !== currentUser.id) {
      throw new ForbiddenException('当前任务未分配给你');
    }
    if (!['confirmed', 'executed'].includes(item.status)) {
      throw new BadRequestException('当前任务明细尚未确认，暂不可录入执行结果');
    }

    const executedAt = dto.executedAt ? new Date(dto.executedAt) : new Date();

    let existing = await this.executionResultRepository.findOne({
      where: { taskItemId: item.id },
    });

    let feedback: FollowupFeedback | null = null;
    if (existing?.followupFeedbackId) {
      feedback = await this.followupFeedbackRepository.findOne({
        where: { id: existing.followupFeedbackId },
      });
    }
    if (!feedback) {
      feedback = this.followupFeedbackRepository.create({
        recommendationId: item.recommendationId,
        recommendationRuleId: this.resolveRecommendationRuleId(item),
        scriptTemplateId: item.scriptTemplateId,
        subjectType: item.subjectType,
        subjectId: item.subjectId,
        merchantId: item.merchantId,
        employeeId: task.assignedTo ?? currentUser.id,
        businessType: item.businessType,
        businessId: item.businessId,
        followedUpFlag: true,
        followupAt: executedAt,
        customerRepliedFlag: dto.repliedFlag,
        convertedFlag: dto.convertedFlag,
        nonConversionReason: dto.nonConversionReason ?? null,
        employeeRemark: dto.remark ?? null,
        feedbackStatus: dto.resultStatus ?? 'recorded',
        normalizedPayload: {
          sourceType: 'execution_result',
          taskId: task.id,
          taskCode: task.taskCode,
          taskItemId: item.id,
          ...this.asRecord(dto.normalizedPayload),
        },
        createdBy: currentUser.id,
      });
    } else {
      feedback.followedUpFlag = true;
      feedback.followupAt = executedAt;
      feedback.customerRepliedFlag = dto.repliedFlag;
      feedback.convertedFlag = dto.convertedFlag;
      feedback.nonConversionReason = dto.nonConversionReason ?? null;
      feedback.employeeRemark = dto.remark ?? null;
      feedback.feedbackStatus = dto.resultStatus ?? 'recorded';
      feedback.employeeId = task.assignedTo ?? currentUser.id;
      feedback.normalizedPayload = {
        ...this.asRecord(feedback.normalizedPayload),
        sourceType: 'execution_result',
        taskId: task.id,
        taskCode: task.taskCode,
        taskItemId: item.id,
        ...this.asRecord(dto.normalizedPayload),
      };
    }
    const savedFeedback = await this.followupFeedbackRepository.save(feedback);

    if (!existing) {
      existing = this.executionResultRepository.create({
        taskId: task.id,
        taskItemId: item.id,
      });
    }
    existing.recommendationId = dto.recommendationId ?? item.recommendationId ?? null;
    existing.followupFeedbackId = savedFeedback.id;
    existing.subjectType = item.subjectType;
    existing.subjectId = item.subjectId;
    existing.merchantId = item.merchantId;
    existing.employeeId = task.assignedTo ?? currentUser.id;
    existing.businessType = item.businessType;
    existing.businessId = item.businessId;
    existing.scriptTemplateId = item.scriptTemplateId;
    existing.executedAt = executedAt;
    existing.executedBy = currentUser.id;
    existing.repliedFlag = dto.repliedFlag;
    existing.convertedFlag = dto.convertedFlag;
    existing.nonConversionReason = dto.nonConversionReason ?? null;
    existing.resultStatus = dto.resultStatus ?? 'recorded';
    existing.remark = dto.remark ?? null;
    existing.normalizedPayload = {
      itemSnapshot: this.mapExecutionTaskItem(item),
      ...this.asRecord(dto.normalizedPayload),
    };

    const saved = await this.executionResultRepository.save(existing);
    item.status = 'executed';
    await this.executionTaskItemRepository.save(item);
    await this.refreshTaskStatus(task.id);

    await this.operationLogsService.create({
      module: 'engagement',
      targetId: saved.id,
      action: 'record_execution_result',
      operatorId: currentUser.id,
      detail: `记录执行结果 #${saved.id}`,
      detailJson: this.mapExecutionResult(saved),
    });

    return this.mapExecutionResult(saved);
  }

  async findExecutionResultById(id: number, currentUser: CurrentUser) {
    const result = await this.executionResultRepository.findOne({ where: { id } });
    if (!result) {
      throw new NotFoundException('执行结果不存在');
    }
    if (this.isOperator(currentUser) && result.executedBy !== currentUser.id) {
      throw new ForbiddenException('当前执行结果不属于你');
    }
    return this.mapExecutionResult(result);
  }

  private async refreshTaskStatus(taskId: number) {
    const task = await this.findExecutionTaskEntity(taskId);
    const items = await this.executionTaskItemRepository.find({ where: { taskId } });
    if (!items.length) {
      return;
    }
    const allDone = items.every((item) => ['executed', 'skipped'].includes(item.status));
    const anyExecuted = items.some((item) => item.status === 'executed');
    if (allDone && task.status !== 'closed') {
      task.status = 'completed';
    } else if (anyExecuted && task.status !== 'closed') {
      task.status = 'running';
    }
    await this.executionTaskRepository.save(task);
  }

  private buildExecutionResultsQuery(query: QueryExecutionResultsDto, currentUser: CurrentUser) {
    const qb = this.executionResultRepository
      .createQueryBuilder('result')
      .leftJoin(ExecutionTask, 'task', 'task.id = result.task_id');

    if (query.playbookId) {
      qb.andWhere('task.playbook_id = :playbookId', { playbookId: query.playbookId });
    }
    if (query.scenarioCode) {
      qb.andWhere('task.scenario_code = :scenarioCode', { scenarioCode: query.scenarioCode });
    }
    if (query.taskId) {
      qb.andWhere('result.task_id = :taskId', { taskId: query.taskId });
    }
    if (query.taskItemId) {
      qb.andWhere('result.task_item_id = :taskItemId', { taskItemId: query.taskItemId });
    }
    if (query.executedBy) {
      qb.andWhere('result.executed_by = :executedBy', { executedBy: query.executedBy });
    }
    if (query.merchantId) {
      qb.andWhere('COALESCE(result.merchant_id, task.merchant_id) = :merchantId', {
        merchantId: query.merchantId,
      });
    }
    if (query.resultStatus) {
      qb.andWhere('result.result_status = :resultStatus', { resultStatus: query.resultStatus });
    }
    if (query.dateFrom) {
      qb.andWhere('result.executed_at >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('result.executed_at <= :dateTo', { dateTo: query.dateTo });
    }
    if (query.batchCode) {
      qb.andWhere(
        `(
          JSON_UNQUOTE(JSON_EXTRACT(task.normalized_payload, '$.grayRunBatchCode')) = :batchCode
          OR JSON_UNQUOTE(JSON_EXTRACT(result.normalized_payload, '$.grayRunBatchCode')) = :batchCode
        )`,
        { batchCode: query.batchCode },
      );
    }
    if (this.isOperator(currentUser)) {
      qb.andWhere(
        '(result.executed_by = :currentUserId OR task.assigned_to = :currentUserId)',
        { currentUserId: currentUser.id },
      );
    }

    return qb;
  }

  private async loadExecutionPlaybooksForTasks(taskIds: number[]) {
    if (!taskIds.length) {
      return [];
    }
    const tasks = await this.executionTaskRepository.findBy({ id: In(taskIds) });
    const playbookIds = [...new Set(tasks.map((item) => item.playbookId))];
    if (!playbookIds.length) {
      return [];
    }
    return this.executionPlaybookRepository.findBy({ id: In(playbookIds) });
  }

  private async loadScriptTemplatesForExecutionSummary(results: ExecutionResult[], taskIds: number[]) {
    const items = taskIds.length ? await this.executionTaskItemRepository.findBy({ taskId: In(taskIds) }) : [];
    const templateIds = [
      ...new Set(
        [...results.map((item) => item.scriptTemplateId), ...items.map((item) => item.scriptTemplateId)].filter(
          (item): item is number => Boolean(item),
        ),
      ),
    ];
    if (!templateIds.length) {
      return [];
    }
    return this.scriptTemplateRepository.findBy({ id: In(templateIds) });
  }

  private async loadUsersForExecutionSummary(results: ExecutionResult[], taskIds: number[]) {
    const tasks = taskIds.length ? await this.executionTaskRepository.findBy({ id: In(taskIds) }) : [];
    const userIds = [
      ...new Set(
        [...results.map((item) => item.executedBy), ...tasks.map((item) => item.assignedTo)].filter(
          (item): item is number => Boolean(item),
        ),
      ),
    ];
    if (!userIds.length) {
      return [];
    }
    return this.userRepository.findBy({ id: In(userIds) });
  }

  private aggregateExecutionStats(
    results: ExecutionResult[],
    items: ExecutionTaskItem[],
    taskMap: Map<number, ExecutionTask>,
    itemMap: Map<number, ExecutionTaskItem>,
    resolveGroupKey: (
      result: ExecutionResult,
      task: ExecutionTask | undefined,
      item: ExecutionTaskItem | undefined,
    ) => string,
  ) {
    const groups = new Map<string, ExecutionAnalyticsBucket>();
    groups.set('__overall__', this.emptyExecutionStats());

    const upsert = (key: string) => {
      if (!groups.has(key)) {
        groups.set(key, this.emptyExecutionStats());
      }
      return groups.get(key)!;
    };

    const overallTaskIds = new Set<number>();
    const overallConfirmedItemIds = new Set<number>();

    for (const item of items) {
      const task = taskMap.get(item.taskId);
      const key = task ? resolveGroupKey(this.buildSyntheticResultForItem(item), task, item) : '__unassigned__';
      const stats = upsert(key);
      const overall = upsert('__overall__');

      if (task && !stats.taskIds.has(task.id)) {
        stats.taskIds.add(task.id);
      }
      if (task && !overallTaskIds.has(task.id)) {
        overallTaskIds.add(task.id);
      }

      if (['confirmed', 'executed'].includes(item.status)) {
        stats.confirmedCount += 1;
        if (!overallConfirmedItemIds.has(item.id)) {
          overallConfirmedItemIds.add(item.id);
          overall.confirmedCount += 1;
        }
      }
      if (item.status === 'skipped') {
        stats.ignoredCount += 1;
        overall.ignoredCount += 1;
      }
    }

    for (const result of results) {
      const task = taskMap.get(result.taskId);
      const item = itemMap.get(result.taskItemId);
      const key = resolveGroupKey(result, task, item);
      const stats = upsert(key);
      const overall = upsert('__overall__');
      const responseMinutes = this.resolveResponseMinutes(result, task, item);

      if (task && !stats.taskIds.has(task.id)) {
        stats.taskIds.add(task.id);
      }
      if (task && !overallTaskIds.has(task.id)) {
        overallTaskIds.add(task.id);
      }

      stats.executedCount += 1;
      overall.executedCount += 1;

      if (result.repliedFlag) {
        stats.repliedCount += 1;
        overall.repliedCount += 1;
      }
      if (result.convertedFlag) {
        stats.convertedCount += 1;
        overall.convertedCount += 1;
      }
      if (result.resultStatus === 'ignored') {
        stats.ignoredCount += 1;
        overall.ignoredCount += 1;
      }
      if (responseMinutes !== null) {
        stats.responseMinutesTotal += responseMinutes;
        stats.responseMinutesCount += 1;
        overall.responseMinutesTotal += responseMinutes;
        overall.responseMinutesCount += 1;
      }
      if (result.nonConversionReason) {
        stats.nonConversionReasons.set(
          result.nonConversionReason,
          (stats.nonConversionReasons.get(result.nonConversionReason) ?? 0) + 1,
        );
        overall.nonConversionReasons.set(
          result.nonConversionReason,
          (overall.nonConversionReasons.get(result.nonConversionReason) ?? 0) + 1,
        );
      }
    }

    upsert('__overall__').taskCount = overallTaskIds.size;
    for (const [key, stats] of groups.entries()) {
      if (key !== '__overall__') {
        stats.taskCount = stats.taskIds.size;
      }
    }

    return groups;
  }

  private buildRuleCalibrationSummary(
    results: ExecutionResult[],
    items: ExecutionTaskItem[],
    taskMap: Map<number, ExecutionTask>,
    itemMap: Map<number, ExecutionTaskItem>,
    recommendationMap: Map<number, AiRecommendation>,
    ruleMap: Map<number, RecommendationRule>,
    templateMap: Map<number, ScriptTemplate>,
  ) {
    const recommendationRuleIds = [
      ...new Set(
        results
          .map((item) => (item.recommendationId ? recommendationMap.get(item.recommendationId)?.recommendationRuleId ?? null : null))
          .filter((item): item is number => Boolean(item)),
      ),
    ];

    const keepRules: Array<{ ruleId: number; ruleCode: string; ruleName: string; reason: string }> = [];
    const adjustRules: Array<{ ruleId: number | null; ruleCode: string | null; ruleName: string | null; reason: string }> = [];
    const templateLeaderboard = this.aggregateExecutionStats(
      results,
      items,
      taskMap,
      itemMap,
      (result, _task, item) => String(result.scriptTemplateId ?? item?.scriptTemplateId ?? 'unassigned'),
    );

    for (const ruleId of recommendationRuleIds) {
      const rule = ruleMap.get(ruleId);
      if (!rule) {
        continue;
      }
      const relatedResults = results.filter(
        (item) =>
          (item.recommendationId
            ? recommendationMap.get(item.recommendationId)?.recommendationRuleId ?? null
            : null) === ruleId ||
          (itemMap.get(item.taskItemId)
            ? this.resolveRecommendationRuleId(itemMap.get(item.taskItemId) as ExecutionTaskItem)
            : null) === ruleId,
      );
      const converted = relatedResults.filter((item) => item.convertedFlag).length;
      const replied = relatedResults.filter((item) => item.repliedFlag).length;
      const replyRate = relatedResults.length ? replied / relatedResults.length : 0;
      const conversionRate = relatedResults.length ? converted / relatedResults.length : 0;

      if (rule.ruleStrength === 'strong' && conversionRate >= 0.4) {
        keepRules.push({
          ruleId: rule.id,
          ruleCode: rule.ruleCode,
          ruleName: rule.ruleName,
          reason: `当前回复率 ${(replyRate * 100).toFixed(1)}%，转化率 ${(conversionRate * 100).toFixed(1)}%，可继续保留`,
        });
      } else {
        adjustRules.push({
          ruleId: rule.id,
          ruleCode: rule.ruleCode,
          ruleName: rule.ruleName,
          reason: `当前回复率 ${(replyRate * 100).toFixed(1)}%，转化率 ${(conversionRate * 100).toFixed(1)}%，建议继续收紧条件或只保留人工观察`,
        });
      }
    }

    const templateStats = [...templateLeaderboard.entries()]
      .filter(([key]) => key !== '__overall__')
      .map(([key, stats]) => {
        const templateId = Number(key);
        const template = Number.isFinite(templateId) ? templateMap.get(templateId) ?? null : null;
        const mapped = this.mapExecutionStats(stats);
        return {
          scriptTemplateId: template?.id ?? null,
          templateCode: template?.templateCode ?? null,
          templateName: template?.templateName ?? null,
          templateGroup: template?.templateGroup ?? null,
          ...mapped,
        };
      })
      .sort(
        (left, right) =>
          right.conversionRate - left.conversionRate ||
          right.replyRate - left.replyRate ||
          right.executedCount - left.executedCount,
      );

    return {
      keepRules,
      adjustRules,
      bestTemplates: templateStats.slice(0, 3),
      templatesToAdjust: templateStats
        .filter((item) => item.executedCount > 0 && item.conversionRate <= 0.2)
        .slice(0, 3),
    };
  }

  private emptyExecutionStats(): ExecutionAnalyticsBucket {
    return {
      taskIds: new Set<number>(),
      taskCount: 0,
      confirmedCount: 0,
      executedCount: 0,
      repliedCount: 0,
      convertedCount: 0,
      ignoredCount: 0,
      responseMinutesTotal: 0,
      responseMinutesCount: 0,
      nonConversionReasons: new Map<string, number>(),
    };
  }

  private mapExecutionStats(stats: ExecutionAnalyticsBucket) {
    const executedCount = stats.executedCount;
    const replyRate = executedCount ? stats.repliedCount / executedCount : 0;
    const conversionRate = executedCount ? stats.convertedCount / executedCount : 0;
    const completionRate = stats.confirmedCount ? executedCount / stats.confirmedCount : 0;
    return {
      taskCount: stats.taskCount,
      confirmedCount: stats.confirmedCount,
      executedCount,
      repliedCount: stats.repliedCount,
      convertedCount: stats.convertedCount,
      ignoredCount: stats.ignoredCount,
      averageResponseMinutes: stats.responseMinutesCount
        ? Number((stats.responseMinutesTotal / stats.responseMinutesCount).toFixed(1))
        : 0,
      replyRate: Number(replyRate.toFixed(4)),
      conversionRate: Number(conversionRate.toFixed(4)),
      completionRate: Number(completionRate.toFixed(4)),
      topNonConversionReasons: this.mapReasonSummary(
        [...stats.nonConversionReasons.entries()]
          .map(([reason, count]) => ({ reason, count }))
          .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason))
          .slice(0, 5),
      ),
    };
  }

  private mapReasonSummary(items: Array<{ reason: string; count: number }>) {
    return items.map((item) => ({
      reason: item.reason,
      count: item.count,
    }));
  }

  private resolveResponseMinutes(
    result: ExecutionResult,
    task?: ExecutionTask,
    item?: ExecutionTaskItem,
  ) {
    const resultPayload = this.asRecord(result.normalizedPayload);
    const payloadValue = resultPayload.responseMinutes ?? resultPayload.responseTimeMinutes;
    if (payloadValue !== undefined && payloadValue !== null && payloadValue !== '') {
      const parsedPayload = Number(payloadValue);
      if (Number.isFinite(parsedPayload) && parsedPayload >= 0) {
        return parsedPayload;
      }
    }

    const baseTime = item?.confirmedAt ?? task?.confirmedAt ?? task?.createdAt ?? null;
    if (!baseTime || !result.executedAt) {
      return null;
    }
    const diff = (result.executedAt.getTime() - baseTime.getTime()) / 60000;
    return Number.isFinite(diff) ? Math.max(0, Number(diff.toFixed(1))) : null;
  }

  private buildSyntheticResultForItem(item: ExecutionTaskItem): ExecutionResult {
    return {
      id: 0,
      taskId: item.taskId,
      taskItemId: item.id,
      recommendationId: item.recommendationId,
      followupFeedbackId: null,
      subjectType: item.subjectType,
      subjectId: item.subjectId,
      merchantId: item.merchantId,
      employeeId: item.employeeId,
      businessType: item.businessType,
      businessId: item.businessId,
      scriptTemplateId: item.scriptTemplateId,
      executedAt: item.confirmedAt ?? item.createdAt,
      executedBy: item.assignedTo ?? 0,
      repliedFlag: false,
      convertedFlag: false,
      nonConversionReason: null,
      resultStatus: 'recorded',
      remark: null,
      normalizedPayload: item.normalizedPayload,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private async loadRecommendationsByIds(ids: number[]) {
    const records = await this.aiRecommendationRepository.findBy({ id: In(ids) });
    if (records.length !== ids.length) {
      throw new BadRequestException('部分推荐对象不存在');
    }
    return records;
  }

  private async autoSelectRecommendations(playbook: ExecutionPlaybook, maxItems: number) {
    const qb = this.aiRecommendationRepository.createQueryBuilder('recommendation');
    qb.andWhere('recommendation.status = :status', { status: 'active' });
    qb.andWhere('recommendation.recommendation_type = :recommendationType', {
      recommendationType: playbook.recommendationType,
    });
    if (playbook.targetSubjectType) {
      qb.andWhere('recommendation.subject_type = :subjectType', {
        subjectType: playbook.targetSubjectType,
      });
    }

    const filters = this.asRecord(playbook.normalizedPayload);
    const merchantId = this.extractNumber(filters, ['merchantId']) ?? playbook.merchantId ?? null;
    const businessType = this.extractString(filters, ['businessType']);

    if (merchantId) {
      qb.andWhere(
        "CAST(JSON_UNQUOTE(JSON_EXTRACT(recommendation.source_context, '$.merchantId')) AS UNSIGNED) = :merchantId",
        { merchantId },
      );
    }
    if (businessType) {
      qb.andWhere(
        "JSON_UNQUOTE(JSON_EXTRACT(recommendation.source_context, '$.businessType')) = :businessType",
        { businessType },
      );
    }

    return qb.orderBy('recommendation.created_at', 'DESC').limit(maxItems).getMany();
  }

  private ensureTaskAccess(task: ExecutionTask, currentUser: CurrentUser) {
    if (this.isOperator(currentUser) && task.assignedTo !== currentUser.id) {
      throw new ForbiddenException('当前任务未分配给你');
    }
  }

  private isOperator(currentUser: CurrentUser) {
    return currentUser.roleCodes.includes('operator') && !currentUser.roleCodes.includes('admin');
  }

  private normalizeSortOrder(sortOrder: string | undefined, fallback: 'ASC' | 'DESC') {
    return sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : fallback;
  }

  private compareExecutionResultRows(
    left: {
      resultId: string | number;
      taskId: string | number | null;
      subjectId: string | number | null;
      executedAt: string | Date | null;
      createdAt: string | Date | null;
      playbookId: string | number | null;
    },
    right: {
      resultId: string | number;
      taskId: string | number | null;
      subjectId: string | number | null;
      executedAt: string | Date | null;
      createdAt: string | Date | null;
      playbookId: string | number | null;
    },
    sortBy: QueryExecutionResultsDto['sortBy'],
    sortOrder: 'ASC' | 'DESC',
  ) {
    const leftValue = this.readExecutionResultSortValue(left, sortBy);
    const rightValue = this.readExecutionResultSortValue(right, sortBy);

    if (leftValue === rightValue) {
      const leftId = Number(left.resultId) || 0;
      const rightId = Number(right.resultId) || 0;
      return sortOrder === 'ASC' ? leftId - rightId : rightId - leftId;
    }

    if (sortOrder === 'ASC') {
      return leftValue > rightValue ? 1 : -1;
    }
    return leftValue < rightValue ? 1 : -1;
  }

  private readExecutionResultSortValue(
    row: {
      taskId: string | number | null;
      subjectId: string | number | null;
      executedAt: string | Date | null;
      createdAt: string | Date | null;
      playbookId: string | number | null;
    },
    sortBy: QueryExecutionResultsDto['sortBy'],
  ) {
    switch (sortBy) {
      case 'playbookId':
        return Number(row.playbookId ?? -1);
      case 'taskId':
        return Number(row.taskId ?? -1);
      case 'subjectId':
        return Number(row.subjectId ?? -1);
      case 'createdAt':
        return this.toTimeValue(row.createdAt);
      case 'executedAt':
      default:
        return this.toTimeValue(row.executedAt);
    }
  }

  private toTimeValue(value: string | Date | null) {
    if (!value) {
      return 0;
    }
    if (value instanceof Date) {
      return value.getTime();
    }
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private mapExecutionPlaybook(record: ExecutionPlaybook) {
    return {
      id: record.id,
      playbookCode: record.playbookCode,
      playbookName: record.playbookName,
      scenarioCode: record.scenarioCode,
      scenarioName: record.scenarioName,
      recommendationType: record.recommendationType,
      targetSubjectType: record.targetSubjectType,
      businessDomain: record.businessDomain,
      merchantId: record.merchantId,
      recommendationRuleId: record.recommendationRuleId,
      defaultScriptTemplateId: record.defaultScriptTemplateId,
      executionChannel: record.executionChannel,
      description: record.description,
      isActive: Boolean(record.isActive),
      normalizedPayload: record.normalizedPayload,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private mapExecutionTask(
    record: ExecutionTask,
    extra?: {
      playbookName?: string | null;
      itemCount?: number;
      resultCount?: number;
    },
  ) {
    return {
      id: record.id,
      taskCode: record.taskCode,
      taskName: record.taskName,
      playbookId: record.playbookId,
      playbookName: extra?.playbookName ?? null,
      scenarioCode: record.scenarioCode,
      scenarioName: record.scenarioName,
      recommendationType: record.recommendationType,
      status: record.status,
      assignedTo: record.assignedTo,
      merchantId: record.merchantId,
      targetCount: record.targetCount,
      itemCount: extra?.itemCount ?? null,
      resultCount: extra?.resultCount ?? null,
      confirmedBy: record.confirmedBy,
      confirmedAt: record.confirmedAt,
      closedBy: record.closedBy,
      closedAt: record.closedAt,
      remark: record.remark,
      normalizedPayload: record.normalizedPayload,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private mapExecutionTaskItem(record: ExecutionTaskItem) {
    return {
      id: record.id,
      taskId: record.taskId,
      recommendationId: record.recommendationId,
      subjectType: record.subjectType,
      subjectId: record.subjectId,
      merchantId: record.merchantId,
      employeeId: record.employeeId,
      businessType: record.businessType,
      businessId: record.businessId,
      scriptTemplateId: record.scriptTemplateId,
      evidenceStatus: record.evidenceStatus,
      confidenceScore: record.confidenceScore,
      matchedRule: record.matchedRule,
      status: record.status,
      assignedTo: record.assignedTo,
      confirmedBy: record.confirmedBy,
      confirmedAt: record.confirmedAt,
      skippedBy: record.skippedBy,
      skippedAt: record.skippedAt,
      skipReason: record.skipReason,
      normalizedPayload: record.normalizedPayload,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private mapExecutionResult(record: ExecutionResult) {
    return {
      id: record.id,
      taskId: record.taskId,
      taskItemId: record.taskItemId,
      recommendationId: record.recommendationId,
      followupFeedbackId: record.followupFeedbackId,
      subjectType: record.subjectType,
      subjectId: record.subjectId,
      merchantId: record.merchantId,
      employeeId: record.employeeId,
      businessType: record.businessType,
      businessId: record.businessId,
      scriptTemplateId: record.scriptTemplateId,
      executedAt: record.executedAt,
      executedBy: record.executedBy,
      repliedFlag: Boolean(record.repliedFlag),
      convertedFlag: Boolean(record.convertedFlag),
      nonConversionReason: record.nonConversionReason,
      resultStatus: record.resultStatus,
      remark: record.remark,
      normalizedPayload: record.normalizedPayload,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private mapAiRecommendation(record: AiRecommendation) {
    return {
      id: record.id,
      subjectType: record.subjectType,
      subjectId: record.subjectId,
      recommendationType: record.recommendationType,
      recommendationText: record.recommendationText,
      recommendationRuleId: record.recommendationRuleId,
      evidenceStatus: record.evidenceStatus,
      confidenceScore: record.confidenceScore,
      ruleStrength: record.ruleStrength,
      status: record.status,
      sourceContext: record.sourceContext,
    };
  }

  private summarizeNonConversionReasons(results: ExecutionResult[]) {
    const counter = new Map<string, number>();
    for (const result of results) {
      if (!result.nonConversionReason) {
        continue;
      }
      counter.set(result.nonConversionReason, (counter.get(result.nonConversionReason) ?? 0) + 1);
    }
    return Array.from(counter.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
  }

  private resolveTaskMerchantId(recommendations: AiRecommendation[]) {
    for (const record of recommendations) {
      const merchantId = this.extractNumber(record.sourceContext, ['merchantId']);
      if (merchantId) {
        return merchantId;
      }
    }
    return null;
  }

  private resolveRecommendationRuleId(item: ExecutionTaskItem) {
    if (!item.matchedRule?.startsWith('recommendation_rule:')) {
      return null;
    }
    const parsed = Number(item.matchedRule.replace('recommendation_rule:', ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  private extractString(payload: Record<string, unknown> | null | undefined, keys: string[]) {
    if (!payload) return null;
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
      if (typeof value === 'number') {
        return String(value);
      }
    }
    return null;
  }

  private extractNumber(payload: Record<string, unknown> | null | undefined, keys: string[]) {
    const value = this.extractString(payload, keys);
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private async findExecutionPlaybookEntity(id: number) {
    const record = await this.executionPlaybookRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('执行方案不存在');
    }
    return record;
  }

  private async findExecutionTaskEntity(id: number) {
    const record = await this.executionTaskRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('执行任务不存在');
    }
    return record;
  }

  private async findExecutionTaskItemEntity(id: number) {
    const record = await this.executionTaskItemRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('执行任务明细不存在');
    }
    return record;
  }

  private async findRecommendationRule(id: number) {
    const record = await this.recommendationRuleRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('推荐规则不存在');
    }
    return record;
  }

  private async findScriptTemplate(id: number) {
    const record = await this.scriptTemplateRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('话术模板不存在');
    }
    return record;
  }

  private async ensureUniquePlaybookCode(playbookCode: string, excludeId?: number) {
    const existing = await this.executionPlaybookRepository.findOne({ where: { playbookCode } });
    if (existing && existing.id !== excludeId) {
      throw new BadRequestException(`执行方案编码 ${playbookCode} 已存在`);
    }
  }

  private async ensureUniqueTaskCode(taskCode: string, excludeId?: number) {
    const existing = await this.executionTaskRepository.findOne({ where: { taskCode } });
    if (existing && existing.id !== excludeId) {
      throw new BadRequestException(`执行任务编码 ${taskCode} 已存在`);
    }
  }
}
