import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { addMoney, normalizeMoney, normalizeQuantity } from '../../common/utils/decimal.util';
import { buildPaginationResult, getPagination } from '../../common/utils/pagination.util';
import { AiRecommendation } from '../engagement/entities/ai-recommendation.entity';
import { MemoryEntry } from '../engagement/entities/memory-entry.entity';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { Employee } from '../performance/entities/employee.entity';
import { ConfirmEmployeeBenefitIssueDto } from './dto/confirm-employee-benefit-issue.dto';
import { CreateEmployeeBenefitIssueDto } from './dto/create-employee-benefit-issue.dto';
import { IssueEmployeeBenefitIssueDto } from './dto/issue-employee-benefit-issue.dto';
import { QueryEmployeeBenefitExpiringDto } from './dto/query-employee-benefit-expiring.dto';
import { QueryEmployeeBenefitIssuesDto } from './dto/query-employee-benefit-issues.dto';
import { QueryEmployeeBenefitLedgerDto } from './dto/query-employee-benefit-ledger.dto';
import { QueryEmployeeBenefitNotificationsDto } from './dto/query-employee-benefit-notifications.dto';
import { EmployeeBenefitCardRecord } from './entities/employee-benefit-card-record.entity';
import { EmployeeBenefitFundLink } from './entities/employee-benefit-fund-link.entity';
import { EmployeeBenefitIssueItem } from './entities/employee-benefit-issue-item.entity';
import { EmployeeBenefitIssue } from './entities/employee-benefit-issue.entity';
import { EmployeeBenefitNotification } from './entities/employee-benefit-notification.entity';

type NotificationType =
  | 'benefit_issued'
  | 'benefit_balance_changed'
  | 'benefit_expiring_30d'
  | 'benefit_expiring_15d'
  | 'benefit_expiring_7d'
  | 'benefit_expiring_3d'
  | 'benefit_expiring_1d'
  | 'benefit_expired';

const ISSUE_SORT_COLUMNS: Record<string, string> = {
  issueNo: 'issue.issueNo',
  employeeId: 'issue.employeeId',
  periodKey: 'issue.periodKey',
  status: 'issue.status',
  issuedAt: 'issue.issuedAt',
  createdAt: 'issue.createdAt',
};

const LEDGER_SORT_COLUMNS: Record<string, string> = {
  effectiveAt: 'record.effectiveAt',
  expiresAt: 'record.expiresAt',
  amountRemaining: 'record.amountRemaining',
  createdAt: 'record.createdAt',
};

const NOTIFICATION_SORT_COLUMNS: Record<string, string> = {
  notifyAt: 'notification.notifyAt',
  createdAt: 'notification.createdAt',
  notificationType: 'notification.notificationType',
};

const EXPIRING_THRESHOLDS = [30, 15, 7, 3, 1];

@Injectable()
export class EmployeeBenefitsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(MemoryEntry)
    private readonly memoryEntryRepository: Repository<MemoryEntry>,
    @InjectRepository(AiRecommendation)
    private readonly aiRecommendationRepository: Repository<AiRecommendation>,
    @InjectRepository(EmployeeBenefitIssue)
    private readonly issueRepository: Repository<EmployeeBenefitIssue>,
    @InjectRepository(EmployeeBenefitIssueItem)
    private readonly issueItemRepository: Repository<EmployeeBenefitIssueItem>,
    @InjectRepository(EmployeeBenefitCardRecord)
    private readonly cardRecordRepository: Repository<EmployeeBenefitCardRecord>,
    @InjectRepository(EmployeeBenefitFundLink)
    private readonly fundLinkRepository: Repository<EmployeeBenefitFundLink>,
    @InjectRepository(EmployeeBenefitNotification)
    private readonly notificationRepository: Repository<EmployeeBenefitNotification>,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async createIssue(dto: CreateEmployeeBenefitIssueDto, currentUser: CurrentUser) {
    const employee = await this.requireEmployee(dto.employeeId);
    const issueNo = this.generateIssueNo(dto.periodKey, dto.employeeId);
    const totals = this.calculateIssueTotals(dto);

    const issue = this.issueRepository.create({
      issueNo,
      employeeId: dto.employeeId,
      periodKey: dto.periodKey.trim(),
      issueType: dto.issueType?.trim() || 'monthly_benefit',
      status: 'draft',
      totalAmount: totals.totalAmount,
      totalItemCount: totals.totalItemCount,
      confirmedFlag: false,
      remark: dto.remark?.trim() || null,
      normalizedPayload: dto.normalizedPayload ?? {},
    });
    const savedIssue = await this.issueRepository.save(issue);

    for (const item of dto.items) {
      await this.issueItemRepository.save(
        this.issueItemRepository.create({
          issueId: savedIssue.id,
          itemType: item.itemType.trim(),
          itemName: item.itemName.trim(),
          amountStandard: normalizeMoney(item.amountStandard),
          quantityStandard: normalizeQuantity(item.quantityStandard ?? 1),
          validityDays: item.validityDays ?? 180,
          effectiveAt: item.effectiveAt ? new Date(item.effectiveAt) : null,
          expiresAt: null,
          sourceSystem: item.sourceSystem?.trim() || null,
          sourceTable: item.sourceTable?.trim() || null,
          sourceId: item.sourceId?.trim() || null,
          sourceOrderNo: item.sourceOrderNo?.trim() || null,
          remark: item.remark?.trim() || null,
          normalizedPayload: item.normalizedPayload ?? {},
        }),
      );
    }

    await this.operationLogsService.create({
      module: 'employee_benefit',
      targetId: savedIssue.id,
      action: 'create_employee_benefit_issue',
      operatorId: currentUser.id,
      detail: `创建员工福利发放单 ${issueNo}`,
      detailJson: {
        issueNo,
        employeeId: employee.id,
        periodKey: savedIssue.periodKey,
        totalAmount: savedIssue.totalAmount,
        totalItemCount: savedIssue.totalItemCount,
      },
    });

    return this.findIssueById(savedIssue.id);
  }

  async findIssues(query: QueryEmployeeBenefitIssuesDto) {
    const { skip, take } = getPagination(query);
    const qb = this.issueRepository
      .createQueryBuilder('issue')
      .leftJoinAndSelect('issue.employee', 'employee');

    if (query.employeeId) {
      qb.andWhere('issue.employee_id = :employeeId', { employeeId: query.employeeId });
    }
    if (query.periodKey) {
      qb.andWhere('issue.period_key = :periodKey', { periodKey: query.periodKey.trim() });
    }
    if (query.status) {
      qb.andWhere('issue.status = :status', { status: query.status });
    }
    if (query.confirmedFlag !== undefined) {
      qb.andWhere('issue.confirmed_flag = :confirmedFlag', { confirmedFlag: query.confirmedFlag });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        ISSUE_SORT_COLUMNS[query.sortBy ?? 'createdAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(
      query,
      list.map((issue) => this.serializeIssue(issue)),
      total,
    );
  }

  async findIssueById(id: number) {
    const issue = await this.issueRepository.findOne({
      where: { id },
      relations: {
        employee: true,
        items: true,
        fundLinks: true,
      },
    });
    if (!issue) {
      throw new NotFoundException('员工福利发放单不存在');
    }

    const issueItemIds = issue.items.map((item) => item.id);
    const cardRecords =
      issueItemIds.length > 0
        ? await this.cardRecordRepository.find({
            where: issueItemIds.map((issueItemId) => ({ issueItemId })),
          })
        : [];

    return {
      ...this.serializeIssue(issue),
      items: issue.items,
      fundLinks: issue.fundLinks,
      cardRecords,
    };
  }

  async confirmIssue(id: number, dto: ConfirmEmployeeBenefitIssueDto, currentUser: CurrentUser) {
    const issue = await this.requireIssue(id);
    if (issue.status === 'issued') {
      throw new BadRequestException('已发放的福利单不能再次确认');
    }

    issue.confirmedFlag = true;
    issue.confirmedBy = currentUser.id;
    issue.confirmedAt = new Date();
    issue.status = 'confirmed';
    if (dto.remark !== undefined) {
      issue.remark = dto.remark?.trim() || null;
    }
    const saved = await this.issueRepository.save(issue);

    await this.operationLogsService.create({
      module: 'employee_benefit',
      targetId: saved.id,
      action: 'confirm_employee_benefit_issue',
      operatorId: currentUser.id,
      detail: `确认员工福利发放单 ${saved.issueNo}`,
      detailJson: {
        issueNo: saved.issueNo,
        employeeId: saved.employeeId,
        confirmedFlag: true,
      },
    });

    return this.findIssueById(saved.id);
  }

  async issueBenefit(id: number, dto: IssueEmployeeBenefitIssueDto, currentUser: CurrentUser) {
    const issue = await this.issueRepository.findOne({
      where: { id },
      relations: {
        employee: true,
        items: true,
      },
    });
    if (!issue) {
      throw new NotFoundException('员工福利发放单不存在');
    }
    if (!issue.confirmedFlag) {
      throw new BadRequestException('请先确认员工福利发放单');
    }
    if (issue.status === 'issued') {
      return this.findIssueById(issue.id);
    }

    const issuedAt = dto.issueAt ? new Date(dto.issueAt) : new Date();
    const defaultEffectiveAt = dto.effectiveAt ? new Date(dto.effectiveAt) : issuedAt;

    await this.dataSource.transaction(async (manager) => {
      const issueRepo = manager.getRepository(EmployeeBenefitIssue);
      const cardRecordRepo = manager.getRepository(EmployeeBenefitCardRecord);
      const fundLinkRepo = manager.getRepository(EmployeeBenefitFundLink);
      const notificationRepo = manager.getRepository(EmployeeBenefitNotification);
      const memoryRepo = manager.getRepository(MemoryEntry);

      let priority = 1;
      const items = issue.items
        .slice()
        .sort((left, right) => {
          const leftDate = this.resolveItemExpiry(left, defaultEffectiveAt).expiresAt.getTime();
          const rightDate = this.resolveItemExpiry(right, defaultEffectiveAt).expiresAt.getTime();
          return leftDate - rightDate;
        });

      for (const item of items) {
        const { effectiveAt, expiresAt } = this.resolveItemExpiry(item, defaultEffectiveAt);
        const cardRecord = await cardRecordRepo.save(
          cardRecordRepo.create({
            issueItemId: item.id,
            employeeId: issue.employeeId,
            cardCategory: 'employee_benefit',
            amountTotal: normalizeMoney(item.amountStandard),
            amountRemaining: normalizeMoney(item.amountStandard),
            amountConsumed: '0.00',
            effectiveAt,
            expiresAt,
            validityDays: item.validityDays,
            consumptionPriority: priority++,
            sourceSystem: item.sourceSystem,
            sourceTable: item.sourceTable,
            sourceId: item.sourceId,
            sourceOrderNo: item.sourceOrderNo,
            status: 'active',
            normalizedPayload: {
              ...(item.normalizedPayload ?? {}),
              issueNo: issue.issueNo,
              periodKey: issue.periodKey,
              latestConsumptionSummary: '暂无消费记录',
            },
          }),
        );

        await fundLinkRepo.save(
          fundLinkRepo.create({
            issueId: issue.id,
            issueItemId: item.id,
            employeeId: issue.employeeId,
            fundLinkType: 'payroll_transfer',
            amountStandard: normalizeMoney(item.amountStandard),
            linkedPeriodKey: issue.periodKey,
            linkedSummaryType: 'payroll_trial',
            linkedSummaryId: null,
            sourceSystem: item.sourceSystem,
            sourceTable: item.sourceTable,
            sourceId: item.sourceId,
            sourceOrderNo: item.sourceOrderNo,
            status: 'linked',
            remark: dto.remark?.trim() || null,
            normalizedPayload: {
              issueNo: issue.issueNo,
              itemName: item.itemName,
            },
          }),
        );

        await this.ensureNotification(
          notificationRepo,
          {
            employeeId: issue.employeeId,
            cardRecordId: cardRecord.id,
            notificationType: 'benefit_issued',
            amountStandard: cardRecord.amountTotal,
            balanceAmount: cardRecord.amountRemaining,
            expiringAmount: null,
            expiredAmount: null,
            latestConsumptionSummary: '暂无消费记录',
            notifyAt: this.startOfDay(issuedAt),
            sourceSystem: item.sourceSystem,
            sourceTable: item.sourceTable,
            sourceId: item.sourceId,
            sourceOrderNo: item.sourceOrderNo,
            normalizedPayload: {
              issueNo: issue.issueNo,
              itemName: item.itemName,
            },
          },
          '福利已到账',
          `本次到账 ${cardRecord.amountTotal} 元，当前剩余 ${cardRecord.amountRemaining} 元。`,
        );

        await this.ensureNotification(
          notificationRepo,
          {
            employeeId: issue.employeeId,
            cardRecordId: cardRecord.id,
            notificationType: 'benefit_balance_changed',
            amountStandard: cardRecord.amountTotal,
            balanceAmount: cardRecord.amountRemaining,
            expiringAmount: null,
            expiredAmount: null,
            latestConsumptionSummary: '暂无消费记录',
            notifyAt: this.startOfDay(issuedAt),
            sourceSystem: item.sourceSystem,
            sourceTable: item.sourceTable,
            sourceId: item.sourceId,
            sourceOrderNo: item.sourceOrderNo,
            normalizedPayload: {
              issueNo: issue.issueNo,
              itemName: item.itemName,
              balanceChanged: true,
            },
          },
          '福利余额更新',
          `福利余额更新后为 ${cardRecord.amountRemaining} 元。`,
        );

        await memoryRepo.save(
          memoryRepo.create({
            subjectType: 'employee',
            subjectId: issue.employeeId,
            memoryType: 'employee_benefit_issued',
            content: `员工福利已发放：${item.itemName}，到账 ${cardRecord.amountTotal} 元，有效期至 ${expiresAt.toISOString().slice(0, 10)}。`,
            sourceType: 'employee_benefit',
            sourceId: String(cardRecord.id),
            evidenceStatus: 'confirmed',
            confidenceScore: '1.0000',
            expiresAt,
            isActive: true,
            normalizedPayload: {
              issueNo: issue.issueNo,
              periodKey: issue.periodKey,
              itemName: item.itemName,
              amountTotal: cardRecord.amountTotal,
              effectiveAt: effectiveAt.toISOString(),
              expiresAt: expiresAt.toISOString(),
            },
          }),
        );
      }

      issue.status = 'issued';
      issue.issuedBy = currentUser.id;
      issue.issuedAt = issuedAt;
      if (dto.remark !== undefined) {
        issue.remark = dto.remark?.trim() || null;
      }
      await issueRepo.save(issue);
    });

    await this.operationLogsService.create({
      module: 'employee_benefit',
      targetId: issue.id,
      action: 'issue_employee_benefit_issue',
      operatorId: currentUser.id,
      detail: `发放员工福利 ${issue.issueNo}`,
      detailJson: {
        issueNo: issue.issueNo,
        employeeId: issue.employeeId,
        issuedAt: issuedAt.toISOString(),
      },
    });

    return this.findIssueById(issue.id);
  }

  async getAccountSummary(employeeId: number) {
    const employee = await this.requireEmployee(employeeId);
    await this.ensureLifecycleNotifications(employeeId);
    const records = await this.cardRecordRepository.find({
      where: { employeeId },
      order: { expiresAt: 'ASC', id: 'ASC' },
    });

    const totalAmount = records.reduce((sum, record) => addMoney(sum, record.amountTotal), '0.00');
    const remainingAmount = records.reduce(
      (sum, record) => addMoney(sum, record.amountRemaining),
      '0.00',
    );
    const consumedAmount = records.reduce(
      (sum, record) => addMoney(sum, record.amountConsumed),
      '0.00',
    );
    const expiringAmount = records
      .filter((record) => {
        const days = this.daysUntil(record.expiresAt);
        return days >= 0 && days <= 30 && record.status !== 'expired';
      })
      .reduce((sum, record) => addMoney(sum, record.amountRemaining), '0.00');
    const expiredAmount = records
      .filter((record) => record.status === 'expired')
      .reduce((sum, record) => addMoney(sum, record.amountRemaining), '0.00');

    const latestNotification = await this.notificationRepository.findOne({
      where: { employeeId },
      order: { notifyAt: 'DESC', id: 'DESC' },
    });

    return {
      employeeId: employee.id,
      employeeName: employee.name,
      mobile: employee.mobile,
      cardRecordCount: records.length,
      totalAmount,
      remainingAmount,
      consumedAmount,
      expiringAmount,
      expiredAmount,
      latestNotification,
      latestConsumptionRecord: null,
    };
  }

  async getAccountLedger(employeeId: number, query: QueryEmployeeBenefitLedgerDto) {
    await this.requireEmployee(employeeId);
    await this.ensureLifecycleNotifications(employeeId);
    const { skip, take } = getPagination(query);
    const qb = this.cardRecordRepository
      .createQueryBuilder('record')
      .leftJoinAndSelect('record.issueItem', 'item')
      .leftJoinAndSelect('item.issue', 'issue')
      .where('record.employee_id = :employeeId', { employeeId });

    if (query.status) {
      qb.andWhere('record.status = :status', { status: query.status });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        LEDGER_SORT_COLUMNS[query.sortBy ?? 'expiresAt'],
        this.normalizeSortOrder(query.sortOrder, 'ASC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(
      query,
      list.map((record) => ({
        ...record,
        issueNo: record.issueItem?.issue?.issueNo ?? null,
        itemName: record.issueItem?.itemName ?? null,
        daysToExpire: this.daysUntil(record.expiresAt),
      })),
      total,
    );
  }

  async getAccountExpiring(employeeId: number, query: QueryEmployeeBenefitExpiringDto) {
    await this.requireEmployee(employeeId);
    await this.ensureLifecycleNotifications(employeeId);
    const days = query.days ?? 30;
    const includeExpired = query.includeExpired ?? false;
    const { skip, take } = getPagination(query);

    const records = await this.cardRecordRepository.find({
      where: { employeeId },
      relations: {
        issueItem: {
          issue: true,
        },
      },
      order: { expiresAt: 'ASC', id: 'ASC' },
    });

    const filtered = records
      .map((record) => ({
        ...record,
        issueNo: record.issueItem?.issue?.issueNo ?? null,
        itemName: record.issueItem?.itemName ?? null,
        daysToExpire: this.daysUntil(record.expiresAt),
      }))
      .filter((record) => {
        if (record.daysToExpire < 0) {
          return includeExpired;
        }
        return record.daysToExpire <= days;
      });

    return {
      list: filtered.slice(skip, skip + take),
      total: filtered.length,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      totalPages: Math.ceil(filtered.length / (query.pageSize ?? 10)) || 1,
    };
  }

  async findNotifications(query: QueryEmployeeBenefitNotificationsDto) {
    if (query.employeeId) {
      await this.ensureLifecycleNotifications(query.employeeId);
    }
    const { skip, take } = getPagination(query);
    const qb = this.notificationRepository
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.employee', 'employee')
      .leftJoinAndSelect('notification.cardRecord', 'cardRecord');

    if (query.employeeId) {
      qb.andWhere('notification.employee_id = :employeeId', { employeeId: query.employeeId });
    }
    if (query.notificationType) {
      qb.andWhere('notification.notification_type = :notificationType', {
        notificationType: query.notificationType,
      });
    }
    if (query.readFlag !== undefined) {
      qb.andWhere('notification.read_flag = :readFlag', { readFlag: query.readFlag });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        NOTIFICATION_SORT_COLUMNS[query.sortBy ?? 'notifyAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async markNotificationRead(id: number, currentUser: CurrentUser) {
    const record = await this.notificationRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('福利通知不存在');
    }
    record.readFlag = true;
    record.readAt = new Date();
    const saved = await this.notificationRepository.save(record);

    await this.operationLogsService.create({
      module: 'employee_benefit',
      targetId: saved.id,
      action: 'read_employee_benefit_notification',
      operatorId: currentUser.id,
      detail: `已读福利通知 ${saved.id}`,
      detailJson: {
        notificationType: saved.notificationType,
        employeeId: saved.employeeId,
      },
    });

    return saved;
  }

  async getAiContext(employeeId: number) {
    const summary = await this.getAccountSummary(employeeId);
    const expiring = await this.getAccountExpiring(employeeId, {
      page: 1,
      pageSize: 20,
      days: 30,
      includeExpired: true,
    });
    const notifications = await this.findNotifications({
      employeeId,
      page: 1,
      pageSize: 20,
      sortBy: 'notifyAt',
      sortOrder: 'desc',
    });
    const memories = await this.memoryEntryRepository.find({
      where: {
        subjectType: 'employee',
        subjectId: employeeId,
        sourceType: 'employee_benefit',
      },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 20,
    });
    const recommendations = await this.aiRecommendationRepository.find({
      where: {
        subjectType: 'employee',
        subjectId: employeeId,
      },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 20,
    });

    return {
      employeeId,
      accountSummary: summary,
      expiringItems: expiring.list,
      notifications: notifications.list,
      memories,
      recommendations,
    };
  }

  private async requireEmployee(employeeId: number) {
    const employee = await this.employeeRepository.findOne({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException('员工不存在');
    }
    return employee;
  }

  private async requireIssue(id: number) {
    const issue = await this.issueRepository.findOne({ where: { id } });
    if (!issue) {
      throw new NotFoundException('员工福利发放单不存在');
    }
    return issue;
  }

  private calculateIssueTotals(dto: CreateEmployeeBenefitIssueDto) {
    return {
      totalAmount: dto.items.reduce(
        (sum, item) => addMoney(sum, normalizeMoney(item.amountStandard)),
        '0.00',
      ),
      totalItemCount: dto.items.length,
    };
  }

  private generateIssueNo(periodKey: string, employeeId: number) {
    const normalizedPeriod = periodKey.replace(/[^0-9]/g, '') || '000000';
    return `EBI-${normalizedPeriod}-${employeeId}-${Date.now()}`;
  }

  private serializeIssue(issue: EmployeeBenefitIssue) {
    return {
      id: issue.id,
      issueNo: issue.issueNo,
      employeeId: issue.employeeId,
      employeeName: issue.employee?.name ?? null,
      periodKey: issue.periodKey,
      issueType: issue.issueType,
      status: issue.status,
      totalAmount: normalizeMoney(issue.totalAmount),
      totalItemCount: issue.totalItemCount,
      confirmedFlag: issue.confirmedFlag,
      confirmedBy: issue.confirmedBy,
      confirmedAt: issue.confirmedAt,
      issuedBy: issue.issuedBy,
      issuedAt: issue.issuedAt,
      remark: issue.remark,
      normalizedPayload: issue.normalizedPayload,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    };
  }

  private resolveItemExpiry(item: EmployeeBenefitIssueItem, defaultEffectiveAt: Date) {
    const effectiveAt = item.effectiveAt ? new Date(item.effectiveAt) : new Date(defaultEffectiveAt);
    const expiresAt = item.expiresAt
      ? new Date(item.expiresAt)
      : this.addDays(this.startOfDay(effectiveAt), item.validityDays);
    return { effectiveAt, expiresAt };
  }

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  private daysUntil(date: Date) {
    const today = this.startOfDay(new Date());
    const target = this.startOfDay(date);
    return Math.floor((target.getTime() - today.getTime()) / 86400000);
  }

  private async ensureNotification(
    notificationRepo: Repository<EmployeeBenefitNotification>,
    payload: {
      employeeId: number;
      cardRecordId: number;
      notificationType: NotificationType;
      amountStandard: string | null;
      balanceAmount: string | null;
      expiringAmount: string | null;
      expiredAmount: string | null;
      latestConsumptionSummary: string | null;
      notifyAt: Date;
      sourceSystem: string | null;
      sourceTable: string | null;
      sourceId: string | null;
      sourceOrderNo: string | null;
      normalizedPayload: Record<string, unknown>;
    },
    title: string,
    content: string,
  ) {
    const existing = await notificationRepo.findOne({
      where: {
        cardRecordId: payload.cardRecordId,
        notificationType: payload.notificationType,
        notifyAt: payload.notifyAt,
      },
    });
    if (existing) {
      return existing;
    }

    return notificationRepo.save(
      notificationRepo.create({
        employeeId: payload.employeeId,
        cardRecordId: payload.cardRecordId,
        notificationType: payload.notificationType,
        title,
        content,
        amountStandard: payload.amountStandard,
        balanceAmount: payload.balanceAmount,
        expiringAmount: payload.expiringAmount,
        expiredAmount: payload.expiredAmount,
        latestConsumptionSummary: payload.latestConsumptionSummary,
        notifyAt: payload.notifyAt,
        readFlag: false,
        sourceSystem: payload.sourceSystem,
        sourceTable: payload.sourceTable,
        sourceId: payload.sourceId,
        sourceOrderNo: payload.sourceOrderNo,
        normalizedPayload: payload.normalizedPayload,
      }),
    );
  }

  private async ensureLifecycleNotifications(employeeId?: number) {
    const where = employeeId ? { employeeId } : {};
    const records = await this.cardRecordRepository.find({
      where,
      order: { expiresAt: 'ASC', id: 'ASC' },
    });
    if (records.length === 0) {
      return;
    }

    const notificationRepo = this.notificationRepository;
    const memoryRepo = this.memoryEntryRepository;

    for (const record of records) {
      const daysToExpire = this.daysUntil(record.expiresAt);
      const shouldExpire = daysToExpire < 0 && record.status !== 'expired';
      if (shouldExpire) {
        record.status = 'expired';
        await this.cardRecordRepository.save(record);
      }

      if (record.status === 'expired') {
        await this.ensureNotification(
          notificationRepo,
          {
            employeeId: record.employeeId,
            cardRecordId: record.id,
            notificationType: 'benefit_expired',
            amountStandard: null,
            balanceAmount: record.amountRemaining,
            expiringAmount: null,
            expiredAmount: record.amountRemaining,
            latestConsumptionSummary:
              (record.normalizedPayload?.latestConsumptionSummary as string | undefined) ?? '暂无消费记录',
            notifyAt: this.startOfDay(new Date()),
            sourceSystem: record.sourceSystem,
            sourceTable: record.sourceTable,
            sourceId: record.sourceId,
            sourceOrderNo: record.sourceOrderNo,
            normalizedPayload: {
              status: 'expired',
            },
          },
          '福利已过期',
          `已有 ${record.amountRemaining} 元福利余额过期，请及时关注后续发放。`,
        );
        await this.createLifecycleMemory(
          memoryRepo,
          record.employeeId,
          record.id,
          'employee_benefit_expired',
          `员工福利已过期，过期金额 ${record.amountRemaining} 元。`,
        );
        continue;
      }

      if (!EXPIRING_THRESHOLDS.includes(daysToExpire)) {
        continue;
      }

      const notificationType = `benefit_expiring_${daysToExpire}d` as NotificationType;
      await this.ensureNotification(
        notificationRepo,
        {
          employeeId: record.employeeId,
          cardRecordId: record.id,
          notificationType,
          amountStandard: null,
          balanceAmount: record.amountRemaining,
          expiringAmount: record.amountRemaining,
          expiredAmount: null,
          latestConsumptionSummary:
            (record.normalizedPayload?.latestConsumptionSummary as string | undefined) ?? '暂无消费记录',
          notifyAt: this.startOfDay(new Date()),
          sourceSystem: record.sourceSystem,
          sourceTable: record.sourceTable,
          sourceId: record.sourceId,
          sourceOrderNo: record.sourceOrderNo,
          normalizedPayload: {
            daysToExpire,
          },
        },
        `福利 ${daysToExpire} 天后到期`,
        `当前有 ${record.amountRemaining} 元福利将在 ${daysToExpire} 天后到期，请尽快使用。`,
      );
      await this.createLifecycleMemory(
        memoryRepo,
        record.employeeId,
        record.id,
        'employee_benefit_expiring',
        `员工福利将在 ${daysToExpire} 天后到期，临期金额 ${record.amountRemaining} 元。`,
      );
    }
  }

  private async createLifecycleMemory(
    memoryRepo: Repository<MemoryEntry>,
    employeeId: number,
    recordId: number,
    memoryType: string,
    content: string,
  ) {
    const existing = await memoryRepo.findOne({
      where: {
        subjectType: 'employee',
        subjectId: employeeId,
        sourceType: 'employee_benefit',
        sourceId: String(recordId),
        memoryType,
      },
    });
    if (existing) {
      return existing;
    }

    return memoryRepo.save(
      memoryRepo.create({
        subjectType: 'employee',
        subjectId: employeeId,
        memoryType,
        content,
        sourceType: 'employee_benefit',
        sourceId: String(recordId),
        evidenceStatus: 'confirmed',
        confidenceScore: '1.0000',
        expiresAt: null,
        isActive: true,
        normalizedPayload: {},
      }),
    );
  }

  private normalizeSortOrder(sortOrder: string | undefined, fallback: 'ASC' | 'DESC') {
    if (!sortOrder) {
      return fallback;
    }
    return sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  }
}
