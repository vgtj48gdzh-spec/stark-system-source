import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import {
  BusinessCompanyRef,
  BusinessScopeGrant,
  BusinessSector,
  BusinessStore,
  CompanySectorAssignment,
  StoreSectorAssignment,
} from '../business-foundation/entities/business-foundation.entities';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { Employee } from '../performance/entities/employee.entity';
import {
  AddGroupMemberDto,
  CalculateGroupTargetDto,
  CreateCompensationProfileDto,
  CreateGroupTargetPolicyDto,
  CreateOrganizationGroupDto,
  CreatePayrollCalendarRuleDto,
  EndGroupMemberDto,
  GroupHiringImpactPreviewDto,
  GroupTargetCalculationInputPreviewDto,
  MarginalTargetPreviewDto,
  QueryOrganizationGroupsDto,
} from './dto/group-operations.dto';
import { GroupOperationsAccessPolicy } from './group-operations.access-policy';
import {
  GroupOperationsCalculator,
  MONEY_ROUNDING_MODE,
} from './group-operations.calculator';
import { GroupOperationsInvariants } from './group-operations.invariants';
import {
  CompensationProfile,
  GroupMember,
  GroupTarget,
  GroupTargetPolicyVersion,
  LaborCostSnapshot,
  OrganizationGroup,
  PayrollCalendarRuleVersion,
} from './entities/group-operations.entities';

type GroupOperationsWritePermission =
  | 'gov1.group.write'
  | 'gov1.compensation.write'
  | 'gov1.target.write';

interface OrganizationWriteScope {
  companyRef: string;
  businessSectorRef: string | null;
  storeRef: string | null;
}

interface PreparedCompensationProfileSegment {
  profile: CompensationProfile;
  clippedEffectiveFrom: string;
  clippedEffectiveTo: string;
  payrollDayCapacity: number;
  activePayrollDays: number;
  payrollDates: string[];
  payrollDateSetHash: string;
  proratedLaborCostCents: string;
}

@Injectable()
export class GroupOperationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async listGroups(query: QueryOrganizationGroupsDto, currentUser: CurrentUser) {
    const qb = this.dataSource.getRepository(OrganizationGroup).createQueryBuilder('group');
    if (query.companyRef) qb.andWhere('group.company_ref = :companyRef', query);
    if (query.businessSectorRef) {
      qb.andWhere('group.business_sector_ref = :businessSectorRef', query);
    }
    if (query.storeRef) qb.andWhere('group.store_ref = :storeRef', query);
    if (query.status) qb.andWhere('group.status = :status', query);
    const groups = await qb.orderBy('group.group_code', 'ASC').take(500).getMany();

    const visible: OrganizationGroup[] = [];
    for (const group of groups) {
      if (await this.canReadGroup(group, currentUser)) visible.push(group);
    }
    return visible;
  }

  async getGroup(id: number, currentUser: CurrentUser) {
    const group = await this.loadGroup(id);
    await this.assertGroupRead(group, currentUser);
    const members = await this.dataSource.getRepository(GroupMember).find({
      where: { groupId: group.id },
      order: { effectiveFrom: 'ASC', id: 'ASC' },
    });
    return { group, members };
  }

  async createGroup(dto: CreateOrganizationGroupDto, currentUser: CurrentUser) {
    this.assertManagementWrite(currentUser);
    this.assertCommandMetadata(dto);
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OrganizationGroup);
      const replay = await repo.findOne({ where: { idempotencyKey: dto.idempotencyKey.trim() } });
      if (replay) {
        await this.assertOrganizationWriteScopes(
          currentUser,
          [this.groupWriteScope(replay)],
          'gov1.group.write',
          manager,
        );
        GroupOperationsInvariants.assertReplayFingerprint(
          replay.requestFingerprint,
          this.organizationGroupCommandPayload(dto),
          '小组创建',
        );
        return replay;
      }

      await this.assertOrganizationWriteScopes(
        currentUser,
        [
          {
            companyRef: dto.companyRef.trim(),
            businessSectorRef: dto.businessSectorRef?.trim() || null,
            storeRef: dto.storeRef?.trim() || null,
          },
        ],
        'gov1.group.write',
        manager,
      );

      const groupCode = dto.groupCode.trim().toLowerCase();
      if (await repo.findOne({ where: { groupCode } })) {
        throw new ConflictException('小组编码已存在');
      }
      this.assertDateRange(dto.establishedAt, null);
      await this.assertOrganizationScope(
        {
          companyRef: dto.companyRef.trim(),
          businessSectorRef: dto.businessSectorRef?.trim(),
          storeRef: dto.storeRef?.trim(),
        },
        dto.establishedAt.slice(0, 10),
        manager,
      );
      await this.assertEmployeesExist(
        [dto.leaderEmployeeId, dto.businessOwnerEmployeeId].filter(
          (value): value is number => Boolean(value),
        ),
        manager,
      );

      const record = await repo.save(
        repo.create({
          groupCode,
          groupName: dto.groupName.trim(),
          companyRef: dto.companyRef.trim(),
          businessSectorRef: dto.businessSectorRef?.trim() || null,
          storeRef: dto.storeRef?.trim() || null,
          leaderEmployeeId: dto.leaderEmployeeId ?? null,
          businessOwnerEmployeeId: dto.businessOwnerEmployeeId ?? null,
          establishedAt: dto.establishedAt.slice(0, 10),
          closedAt: null,
          status: 'active',
          safetyFactorPolicyVersionId: dto.safetyFactorPolicyVersionId.trim(),
          rampUpPolicyVersionId: dto.rampUpPolicyVersionId.trim(),
          changeReason: dto.reason.trim(),
          sourceChannel: dto.sourceChannel.trim(),
          correlationId: dto.correlationId.trim(),
          idempotencyKey: dto.idempotencyKey.trim(),
          requestFingerprint: GroupOperationsInvariants.payloadFingerprint(
            this.organizationGroupCommandPayload(dto),
          ),
          version: 1,
          createdBy: currentUser.id,
          approvedBy: currentUser.id,
        }),
      );
      await this.audit(record.id, 'organization_group.create', currentUser, dto, manager, {
        groupCode: record.groupCode,
        companyRef: record.companyRef,
        businessSectorRef: record.businessSectorRef,
        storeRef: record.storeRef,
      });
      return record;
    });
  }

  async addMember(groupId: number, dto: AddGroupMemberDto, currentUser: CurrentUser) {
    this.assertManagementWrite(currentUser);
    this.assertCommandMetadata(dto);
    return this.dataSource.transaction(async (manager) => {
      const group = await this.loadGroup(groupId, manager, true);
      await this.assertOrganizationWriteScopes(
        currentUser,
        [this.groupWriteScope(group)],
        'gov1.group.write',
        manager,
      );
      const repo = manager.getRepository(GroupMember);
      const replay = await repo.findOne({ where: { idempotencyKey: dto.idempotencyKey.trim() } });
      if (replay) {
        if (replay.groupId !== groupId) {
          const persistedGroup = await this.loadGroup(replay.groupId, manager, true);
          await this.assertOrganizationWriteScopes(
            currentUser,
            [this.groupWriteScope(persistedGroup)],
            'gov1.group.write',
            manager,
          );
        }
        GroupOperationsInvariants.assertReplayFingerprint(
          replay.createRequestFingerprint,
          this.groupMemberCommandPayload(groupId, dto),
          '成员关系创建',
        );
        return replay;
      }
      if (group.status !== 'active') throw new BadRequestException('已关闭小组不能新增成员');
      this.assertDateRange(dto.effectiveFrom, dto.effectiveTo ?? null);
      const newFrom = dto.effectiveFrom.slice(0, 10);
      if (newFrom < group.establishedAt) {
        throw new BadRequestException(
          '[membership_before_group_established] 成员生效日不得早于小组成立日',
        );
      }
      if (dto.responsibilityWeightBps !== undefined) {
        GroupOperationsCalculator.assertBasisPoints(
          dto.responsibilityWeightBps,
          'responsibilityWeightBps',
          true,
        );
      }
      await this.lockActiveEmployees([dto.employeeId], manager);
      const newTo = dto.effectiveTo?.slice(0, 10) ?? '9999-12-31';
      const overlap = await repo
        .createQueryBuilder('member')
        .setLock('pessimistic_write')
        .where('member.employee_id = :employeeId', { employeeId: dto.employeeId })
        .andWhere('member.is_primary = 1')
        .andWhere('member.effective_from <= :newTo', { newTo })
        .andWhere('(member.effective_to IS NULL OR member.effective_to >= :newFrom)', { newFrom })
        .getOne();
      if (overlap) {
        throw new ConflictException(
          '[primary_group_overlap] 同一员工同一自然日只能有一个主小组，必须先结束原关系',
        );
      }

      const record = await repo.save(
        repo.create({
          groupId,
          employeeId: dto.employeeId,
          jobLevel: dto.jobLevel,
          roleCode: dto.roleCode.trim().toLowerCase(),
          isPrimary: true,
          effectiveFrom: newFrom,
          effectiveTo: dto.effectiveTo?.slice(0, 10) ?? null,
          responsibilityWeightBps: dto.responsibilityWeightBps ?? null,
          costAllocationBps: 10_000,
          changeReason: dto.reason.trim(),
          sourceChannel: dto.sourceChannel.trim(),
          correlationId: dto.correlationId.trim(),
          idempotencyKey: dto.idempotencyKey.trim(),
          lastCommandIdempotencyKey: dto.idempotencyKey.trim(),
          createRequestFingerprint: GroupOperationsInvariants.payloadFingerprint(
            this.groupMemberCommandPayload(groupId, dto),
          ),
          lastCommandFingerprint: GroupOperationsInvariants.payloadFingerprint(
            this.groupMemberCommandPayload(groupId, dto),
          ),
          version: 1,
          createdBy: currentUser.id,
          approvedBy: currentUser.id,
        }),
      );
      await this.markGroupTargetsForRecalculation(
        groupId,
        record.effectiveFrom,
        record.effectiveTo,
        currentUser,
        dto,
        manager,
        '[member_added] 小组成员发生新增或转入',
      );
      await this.audit(record.id, 'group_member.add', currentUser, dto, manager, {
        groupId,
        employeeId: record.employeeId,
        jobLevel: record.jobLevel,
        effectiveFrom: record.effectiveFrom,
        effectiveTo: record.effectiveTo,
      });
      return record;
    });
  }

  async endMember(memberId: number, dto: EndGroupMemberDto, currentUser: CurrentUser) {
    this.assertManagementWrite(currentUser);
    this.assertCommandMetadata(dto);
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(GroupMember);
      const initial = await repo.findOne({ where: { id: memberId } });
      if (!initial) throw new NotFoundException('小组成员关系不存在');
      const group = await this.loadGroup(initial.groupId, manager, true);
      await this.assertOrganizationWriteScopes(
        currentUser,
        [this.groupWriteScope(group)],
        'gov1.group.write',
        manager,
      );
      const record = await repo.findOne({
        where: { id: memberId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!record) throw new NotFoundException('小组成员关系不存在');
      if (record.lastCommandIdempotencyKey === dto.idempotencyKey.trim()) {
        GroupOperationsInvariants.assertReplayFingerprint(
          record.lastCommandFingerprint,
          this.endMemberCommandPayload(memberId, dto),
          '成员关系结束',
        );
        return record;
      }
      if (record.effectiveTo) {
        throw new ConflictException(
          '[membership_already_ended] 已结束的成员关系不得原地改写结束日',
        );
      }
      this.assertDateRange(record.effectiveFrom, dto.effectiveTo);
      const before = { effectiveTo: record.effectiveTo, version: record.version };
      record.effectiveTo = dto.effectiveTo.slice(0, 10);
      record.changeReason = dto.reason.trim();
      record.sourceChannel = dto.sourceChannel.trim();
      record.correlationId = dto.correlationId.trim();
      record.lastCommandIdempotencyKey = dto.idempotencyKey.trim();
      record.lastCommandFingerprint = GroupOperationsInvariants.payloadFingerprint(
        this.endMemberCommandPayload(memberId, dto),
      );
      record.version += 1;
      const saved = await repo.save(record);
      await this.markGroupTargetsForRecalculation(
        saved.groupId,
        dto.effectiveTo.slice(0, 10),
        null,
        currentUser,
        dto,
        manager,
        '[member_ended] 小组成员关系结束日期发生变化',
      );
      await this.audit(saved.id, 'group_member.end', currentUser, dto, manager, {
        before,
        after: { effectiveTo: saved.effectiveTo, version: saved.version },
      });
      return saved;
    });
  }

  async createCompensationProfile(
    employeeId: number,
    dto: CreateCompensationProfileDto,
    currentUser: CurrentUser,
  ) {
    this.assertManagementWrite(currentUser);
    this.assertCommandMetadata(dto);
    return this.dataSource.transaction(async (manager) => {
      this.assertDateRange(dto.effectiveFrom, dto.effectiveTo ?? null);
      const cashOffset = GroupOperationsCalculator.parseSignedCents(
        dto.benefitCashOffsetCents,
        'benefitCashOffsetCents',
      );
      GroupOperationsInvariants.assertCny(dto.currency);
      GroupOperationsInvariants.assertBenefitCashOffsetDisabled(
        cashOffset.toString(),
        dto.benefitRuleVersionId,
      );
      const fullyLoadedLaborCostCents = GroupOperationsCalculator.fullyLoadedLaborCost(dto);
      const effectiveFrom = dto.effectiveFrom.slice(0, 10);
      const effectiveTo = dto.effectiveTo?.slice(0, 10) ?? null;
      const repo = manager.getRepository(CompensationProfile);
      const replay = await repo.findOne({ where: { idempotencyKey: dto.idempotencyKey.trim() } });
      if (replay) {
        const replayAffectedTo = await this.compensationReplayAffectedTo(replay, manager);
        await this.assertCompensationWriteScope(
          replay.employeeId,
          replay.effectiveFrom,
          replayAffectedTo,
          currentUser,
          manager,
        );
        GroupOperationsInvariants.assertReplayFingerprint(
          replay.requestFingerprint,
          this.compensationProfileCommandPayload(employeeId, dto, fullyLoadedLaborCostCents),
          '工资结构创建',
        );
        return replay;
      }
      await this.lockActiveEmployees([employeeId], manager);

      const profiles = await repo
        .createQueryBuilder('profile')
        .setLock('pessimistic_write')
        .where('profile.employee_id = :employeeId', { employeeId })
        .orderBy('profile.version', 'DESC')
        .getMany();
      const openLatest = profiles.find(
        (profile) => profile.status === 'approved' && !profile.effectiveTo,
      );
      const openProfileWillBeTruncated = Boolean(
        openLatest && effectiveFrom > openLatest.effectiveFrom,
      );
      await this.assertCompensationWriteScope(
        employeeId,
        effectiveFrom,
        openProfileWillBeTruncated ? null : effectiveTo,
        currentUser,
        manager,
      );
      let openProfileTruncated = false;
      if (openLatest && effectiveFrom > openLatest.effectiveFrom) {
        const previous = {
          effectiveTo: openLatest.effectiveTo,
          status: openLatest.status,
        };
        openLatest.effectiveTo = this.previousDate(effectiveFrom);
        openLatest.status = 'superseded';
        await repo.save(openLatest);
        openProfileTruncated = true;
        await this.audit(
          openLatest.id,
          'compensation_profile.supersede',
          currentUser,
          dto,
          manager,
          {
            employeeId,
            previous,
            next: { effectiveTo: openLatest.effectiveTo, status: openLatest.status },
            supersededByEffectiveFrom: effectiveFrom,
          },
        );
      }
      if (
        profiles.some(
          (profile) =>
            profile.id !== openLatest?.id &&
            GroupOperationsAccessPolicy.dateRangesOverlap(
              profile.effectiveFrom,
              profile.effectiveTo,
              effectiveFrom,
              effectiveTo,
            ),
        ) ||
        (openLatest && effectiveFrom <= openLatest.effectiveFrom)
      ) {
        throw new ConflictException(
          '[compensation_profile_overlap] 工资结构版本生效期不得重叠；请先结束原版本',
        );
      }
      const version = (profiles[0]?.version ?? 0) + 1;
      const record = await repo.save(
        repo.create({
          employeeId,
          baseGuaranteeCents: dto.baseGuaranteeCents,
          positionPerformanceBudgetCents: dto.positionPerformanceBudgetCents,
          employerSocialCostCents: dto.employerSocialCostCents,
          fixedBenefitCostCents: dto.fixedBenefitCostCents,
          benefitCashOffsetCents: dto.benefitCashOffsetCents,
          otherFixedEmploymentCostCents: dto.otherFixedEmploymentCostCents,
          fullyLoadedLaborCostCents,
          currency: dto.currency,
          effectiveFrom,
          effectiveTo,
          benefitRuleVersionId: dto.benefitRuleVersionId?.trim() || null,
          status: 'approved',
          version,
          changeReason: dto.reason.trim(),
          sourceChannel: dto.sourceChannel.trim(),
          correlationId: dto.correlationId.trim(),
          idempotencyKey: dto.idempotencyKey.trim(),
          requestFingerprint: GroupOperationsInvariants.payloadFingerprint(
            this.compensationProfileCommandPayload(employeeId, dto, fullyLoadedLaborCostCents),
          ),
          createdBy: currentUser.id,
          approvedBy: currentUser.id,
        }),
      );
      await this.markEmployeeTargetsForRecalculation(
        employeeId,
        effectiveFrom,
        openProfileTruncated ? null : effectiveTo,
        currentUser,
        dto,
        manager,
      );
      await this.audit(record.id, 'compensation_profile.create', currentUser, dto, manager, {
        employeeId,
        version,
        effectiveFrom,
        effectiveTo,
        recalculationEffectiveTo: openProfileTruncated ? null : effectiveTo,
        fullyLoadedLaborCostCents,
      });
      return record;
    });
  }

  async createGroupTargetPolicy(
    groupId: number,
    dto: CreateGroupTargetPolicyDto,
    currentUser: CurrentUser,
  ) {
    this.assertManagementWrite(currentUser);
    this.assertCommandMetadata(dto);
    GroupOperationsCalculator.assertBasisPoints(
      dto.safetyFactorBps,
      'safetyFactorBps',
      true,
      100_000,
    );
    GroupOperationsCalculator.assertBasisPoints(dto.rampFactorBps, 'rampFactorBps', true);
    GroupOperationsCalculator.assertPayrollDays(0, dto.standardPayrollDays);
    GroupOperationsInvariants.assertCny(dto.currency);

    return this.dataSource.transaction(async (manager) => {
      const group = await this.loadGroup(groupId, manager, true);
      await this.assertOrganizationWriteScopes(
        currentUser,
        [this.groupWriteScope(group)],
        'gov1.target.write',
        manager,
      );
      const repo = manager.getRepository(GroupTargetPolicyVersion);
      const replay = await repo.findOne({ where: { idempotencyKey: dto.idempotencyKey.trim() } });
      if (replay) {
        let replayGroup = group;
        if (replay.groupId !== groupId) {
          const persistedGroup = await this.loadGroup(replay.groupId, manager, true);
          replayGroup = persistedGroup;
          await this.assertOrganizationWriteScopes(
            currentUser,
            [this.groupWriteScope(persistedGroup)],
            'gov1.target.write',
            manager,
          );
        }
        GroupOperationsInvariants.assertReplayFingerprint(
          replay.requestFingerprint,
          this.targetPolicyCommandPayload(groupId, dto),
          '目标政策发布',
        );
        const replayCalendar = await this.loadPayrollCalendarAuthority(
          replayGroup,
          replay.settlementPeriod,
          replay.calendarRuleVersionId,
          manager,
          true,
        );
        this.assertTargetPolicyCalendarBinding(replay, replayCalendar.rule);
        return replay;
      }
      const { periodStart, periodEnd } = this.periodBounds(dto.settlementPeriod);
      if (
        group.establishedAt > periodEnd ||
        (group.closedAt !== null && group.closedAt < periodStart)
      ) {
        throw new BadRequestException(
          '[group_period_inactive] 不得为小组有效经营期之外的月份发布目标政策',
        );
      }
      if (
        dto.safetyFactorPolicyVersionId.trim() !== group.safetyFactorPolicyVersionId ||
        dto.rampUpPolicyVersionId.trim() !== group.rampUpPolicyVersionId
      ) {
        throw new ConflictException(
          '[group_policy_family_mismatch] 当期政策必须绑定小组已批准的安全系数与爬坡政策族',
        );
      }
      const calendar = await this.loadPayrollCalendarAuthority(
        group,
        dto.settlementPeriod,
        dto.calendarRuleVersionId.trim(),
        manager,
        true,
      );
      if (dto.standardPayrollDays !== calendar.rule.standardPayrollDays) {
        throw new BadRequestException(
          '[target_policy_calendar_days_mismatch] 目标政策标准计薪天数必须等于权威日历日期数量',
        );
      }
      const duplicateVersion = await repo.findOne({
        where: { policyVersionId: dto.policyVersionId.trim() },
      });
      if (duplicateVersion) {
        throw new ConflictException('[target_policy_version_duplicate] 目标政策版本编号已存在');
      }

      const policies = await repo
        .createQueryBuilder('policy')
        .setLock('pessimistic_write')
        .where('policy.group_id = :groupId', { groupId })
        .andWhere('policy.settlement_period = :settlementPeriod', {
          settlementPeriod: dto.settlementPeriod,
        })
        .orderBy('policy.version', 'DESC')
        .getMany();
      const current = policies.find((policy) => policy.status === 'approved');
      if (current) {
        current.status = 'superseded';
        await repo.save(current);
        await this.audit(current.id, 'group_target_policy.supersede', currentUser, dto, manager, {
          groupId,
          settlementPeriod: dto.settlementPeriod,
          policyVersionId: current.policyVersionId,
          version: current.version,
        });
      }
      const version = (policies[0]?.version ?? 0) + 1;
      const record = await repo.save(
        repo.create({
          groupId,
          settlementPeriod: dto.settlementPeriod,
          policyVersionId: dto.policyVersionId.trim(),
          safetyFactorBps: dto.safetyFactorBps,
          rampFactorBps: dto.rampFactorBps,
          standardPayrollDays: dto.standardPayrollDays,
          safetyFactorPolicyVersionId: dto.safetyFactorPolicyVersionId.trim(),
          rampUpPolicyVersionId: dto.rampUpPolicyVersionId.trim(),
          calendarRuleVersionId: dto.calendarRuleVersionId.trim(),
          payrollCalendarRuleId: calendar.rule.id,
          payrollDateSetHash: calendar.rule.payrollDateSetHash,
          currency: 'CNY',
          status: 'approved',
          version,
          changeReason: dto.reason.trim(),
          sourceChannel: dto.sourceChannel.trim(),
          correlationId: dto.correlationId.trim(),
          idempotencyKey: dto.idempotencyKey.trim(),
          requestFingerprint: GroupOperationsInvariants.payloadFingerprint(
            this.targetPolicyCommandPayload(groupId, dto),
          ),
          createdBy: currentUser.id,
          approvedBy: currentUser.id,
        }),
      );
      await this.markGroupTargetsForRecalculation(
        groupId,
        periodStart,
        periodEnd,
        currentUser,
        dto,
        manager,
        '[target_policy_changed] 小组当期目标政策发生批准版本变更',
      );
      await this.audit(record.id, 'group_target_policy.publish', currentUser, dto, manager, {
        groupId,
        settlementPeriod: record.settlementPeriod,
        policyVersionId: record.policyVersionId,
        version: record.version,
        safetyFactorBps: record.safetyFactorBps,
        rampFactorBps: record.rampFactorBps,
        standardPayrollDays: record.standardPayrollDays,
        payrollCalendarRuleId: record.payrollCalendarRuleId,
        payrollDateSetHash: record.payrollDateSetHash,
        currency: record.currency,
      });
      return record;
    });
  }

  async createPayrollCalendarRule(
    dto: CreatePayrollCalendarRuleDto,
    currentUser: CurrentUser,
  ) {
    this.assertManagementWrite(currentUser);
    this.assertCommandMetadata(dto);
    const payrollDates = GroupOperationsInvariants.normalizePayrollDates(
      dto.settlementPeriod,
      dto.payrollDates,
    );
    const payrollDateSetHash = GroupOperationsInvariants.payrollDateSetHash(
      dto.settlementPeriod,
      payrollDates,
    );
    const commandPayload = GroupOperationsInvariants.payrollCalendarRuleCommandPayload(dto);
    const companyRef = dto.companyRef.trim();

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PayrollCalendarRuleVersion);
      const replay = await repo.findOne({ where: { idempotencyKey: dto.idempotencyKey.trim() } });
      if (replay) {
        await this.assertOrganizationWriteScopes(
          currentUser,
          [
            { companyRef, businessSectorRef: null, storeRef: null },
            {
              companyRef: replay.companyRef,
              businessSectorRef: null,
              storeRef: null,
            },
          ],
          'gov1.target.write',
          manager,
        );
        if (
          replay.companyRef !== companyRef ||
          replay.settlementPeriod !== dto.settlementPeriod ||
          replay.calendarRuleVersionId !== dto.calendarRuleVersionId.trim()
        ) {
          throw new ConflictException(
            '[idempotency_resource_mismatch] 幂等键已绑定其他公司、周期或日历版本',
          );
        }
        GroupOperationsInvariants.assertReplayFingerprint(
          replay.requestFingerprint,
          commandPayload,
          '计薪日历规则发布',
        );
        GroupOperationsInvariants.assertPayrollCalendarIntegrity(
          replay.settlementPeriod,
          replay.payrollDatesJson,
          replay.standardPayrollDays,
          replay.payrollDateSetHash,
        );
        if (replay.payrollDateSetHash !== payrollDateSetHash) {
          throw new ConflictException(
            '[payroll_calendar_replay_hash_mismatch] 幂等重放的日期集合哈希与请求不一致',
          );
        }
        return replay;
      }

      await this.assertOrganizationWriteScopes(
        currentUser,
        [{ companyRef, businessSectorRef: null, storeRef: null }],
        'gov1.target.write',
        manager,
      );
      const { periodStart } = this.periodBounds(dto.settlementPeriod);
      await this.assertOrganizationScope(
        { companyRef, businessSectorRef: undefined, storeRef: undefined },
        periodStart,
        manager,
      );
      const duplicate = await repo.findOne({
        where: {
          companyRef,
          settlementPeriod: dto.settlementPeriod,
          calendarRuleVersionId: dto.calendarRuleVersionId.trim(),
        },
      });
      if (duplicate) {
        throw new ConflictException(
          '[payroll_calendar_version_duplicate] 公司当期计薪日历规则版本已存在',
        );
      }
      const priorVersions = await repo
        .createQueryBuilder('calendar')
        .setLock('pessimistic_write')
        .where('calendar.company_ref = :companyRef', { companyRef })
        .andWhere('calendar.settlement_period = :settlementPeriod', {
          settlementPeriod: dto.settlementPeriod,
        })
        .orderBy('calendar.version', 'DESC')
        .getMany();
      const record = await repo.save(
        repo.create({
          companyRef,
          settlementPeriod: dto.settlementPeriod,
          calendarRuleVersionId: dto.calendarRuleVersionId.trim(),
          payrollDatesJson: payrollDates,
          payrollDateSetHash,
          standardPayrollDays: payrollDates.length,
          status: 'approved',
          version: (priorVersions[0]?.version ?? 0) + 1,
          changeReason: dto.reason.trim(),
          sourceChannel: dto.sourceChannel.trim(),
          correlationId: dto.correlationId.trim(),
          idempotencyKey: dto.idempotencyKey.trim(),
          requestFingerprint: GroupOperationsInvariants.payloadFingerprint(commandPayload),
          createdBy: currentUser.id,
          approvedBy: currentUser.id,
        }),
      );
      await this.audit(record.id, 'payroll_calendar_rule.publish', currentUser, dto, manager, {
        companyRef,
        settlementPeriod: record.settlementPeriod,
        calendarRuleVersionId: record.calendarRuleVersionId,
        standardPayrollDays: record.standardPayrollDays,
        payrollDateSetHash: record.payrollDateSetHash,
      });
      return record;
    });
  }

  async listCompensationProfiles(employeeId: number, currentUser: CurrentUser) {
    await this.assertEmployeesExist([employeeId], this.dataSource.manager);
    await this.assertCompensationProfileRead(employeeId, currentUser);
    return this.dataSource.getRepository(CompensationProfile).find({
      where: { employeeId },
      order: { version: 'DESC' },
    });
  }

  async listGroupTargetPolicies(
    groupId: number,
    settlementPeriod: string,
    currentUser: CurrentUser,
  ) {
    this.periodBounds(settlementPeriod);
    const group = await this.loadGroup(groupId);
    await this.assertGroupRead(group, currentUser);
    return this.dataSource.getRepository(GroupTargetPolicyVersion).find({
      where: { groupId, settlementPeriod },
      order: { version: 'DESC', id: 'DESC' },
    });
  }

  async listPayrollCalendarRules(
    groupId: number,
    settlementPeriod: string,
    currentUser: CurrentUser,
  ) {
    this.periodBounds(settlementPeriod);
    const group = await this.loadGroup(groupId);
    await this.assertGroupRead(group, currentUser);
    return this.dataSource.getRepository(PayrollCalendarRuleVersion).find({
      where: { companyRef: group.companyRef, settlementPeriod },
      order: { version: 'DESC', id: 'DESC' },
    });
  }

  async previewGroupTargetCalculationInput(
    groupId: number,
    settlementPeriod: string,
    dto: GroupTargetCalculationInputPreviewDto,
    currentUser: CurrentUser,
  ) {
    const { periodStart, periodEnd } = this.periodBounds(settlementPeriod);
    return this.dataSource.transaction(async (manager) => {
      const group = await this.loadGroup(groupId, manager);
      await this.assertGroupRead(group, currentUser);
      await this.assertGroupTargetInputCostRead(group, currentUser, manager);
      const policy = await manager.getRepository(GroupTargetPolicyVersion).findOne({
        where: {
          groupId,
          settlementPeriod,
          policyVersionId: dto.targetPolicyVersionId.trim(),
          status: 'approved',
        },
        lock: { mode: 'pessimistic_read' },
      });
      if (!policy) {
        throw new BadRequestException(
          '[target_policy_not_approved] 小组当期目标政策不存在、已被替代或尚未批准',
        );
      }
      if (
        policy.safetyFactorPolicyVersionId !== group.safetyFactorPolicyVersionId ||
        policy.rampUpPolicyVersionId !== group.rampUpPolicyVersionId
      ) {
        throw new ConflictException(
          '[target_policy_group_mismatch] 已批准目标政策与小组当前政策族不一致',
        );
      }
      const payrollCalendar = await this.loadPayrollCalendarAuthority(
        group,
        settlementPeriod,
        policy.calendarRuleVersionId,
        manager,
        true,
      );
      this.assertTargetPolicyCalendarBinding(policy, payrollCalendar.rule);
      GroupOperationsInvariants.assertCny(policy.currency);

      const common = {
        status: 'calculation_blocked' as 'calculation_blocked' | 'ready',
        formalPayrollEffect: false,
        groupId,
        settlementPeriod,
        targetPolicyVersionId: policy.policyVersionId,
        targetPolicyId: policy.id,
        payrollCalendarRuleId: payrollCalendar.rule.id,
        calendarRuleVersionId: payrollCalendar.rule.calendarRuleVersionId,
        payrollDateSetHash: payrollCalendar.rule.payrollDateSetHash,
        standardPayrollDays: policy.standardPayrollDays,
        safetyFactorBps: policy.safetyFactorBps,
        rampFactorBps: policy.rampFactorBps,
        currency: policy.currency,
        roundingMode: MONEY_ROUNDING_MODE,
      };
      if (
        group.establishedAt > periodEnd ||
        (group.closedAt !== null && group.closedAt < periodStart)
      ) {
        return {
          ...common,
          blockers: ['[group_period_inactive] 小组在该结算周期不处于有效经营期'],
          members: [],
          calculationInput: null,
        };
      }

      const activePeriodStart =
        group.establishedAt > periodStart ? group.establishedAt : periodStart;
      const activePeriodEnd =
        group.closedAt !== null && group.closedAt < periodEnd ? group.closedAt : periodEnd;
      const memberships = await manager
        .getRepository(GroupMember)
        .createQueryBuilder('member')
        .setLock('pessimistic_read')
        .where('member.group_id = :groupId', { groupId })
        .andWhere('member.is_primary = 1')
        .andWhere('member.effective_from <= :activePeriodEnd', { activePeriodEnd })
        .andWhere('(member.effective_to IS NULL OR member.effective_to >= :activePeriodStart)', {
          activePeriodStart,
        })
        .orderBy('member.employee_id', 'ASC')
        .addOrderBy('member.id', 'ASC')
        .getMany();
      if (!memberships.length) {
        return {
          ...common,
          blockers: ['[group_members_missing] 当期没有有效主小组成员'],
          members: [],
          calculationInput: null,
        };
      }

      const employeeIds = [...new Set(memberships.map((member) => member.employeeId))].sort(
        (left, right) => left - right,
      );
      await this.assertEmployeesExist(employeeIds, manager);
      const blockers: string[] = [];
      const calculationMembers: CalculateGroupTargetDto['members'] = [];
      const previewMembers: Array<Record<string, unknown>> = [];
      const currentGroupDays = new Map<number, number>();

      for (const member of memberships) {
        const activePayrollDays = GroupOperationsInvariants.membershipPayrollDayCapacity(
          member.effectiveFrom,
          member.effectiveTo,
          activePeriodStart,
          activePeriodEnd,
          payrollCalendar.payrollDates,
        );
        currentGroupDays.set(
          member.employeeId,
          (currentGroupDays.get(member.employeeId) ?? 0) + activePayrollDays,
        );
        const memberActiveFrom =
          member.effectiveFrom > activePeriodStart ? member.effectiveFrom : activePeriodStart;
        const memberActiveTo =
          member.effectiveTo && member.effectiveTo < activePeriodEnd
            ? member.effectiveTo
            : activePeriodEnd;
        const profiles = await manager
          .getRepository(CompensationProfile)
          .createQueryBuilder('profile')
          .setLock('pessimistic_read')
          .where('profile.employee_id = :employeeId', { employeeId: member.employeeId })
          .andWhere('profile.status IN (:...statuses)', { statuses: ['approved', 'superseded'] })
          .andWhere('profile.effective_from <= :memberActiveTo', { memberActiveTo })
          .andWhere('(profile.effective_to IS NULL OR profile.effective_to >= :memberActiveFrom)', {
            memberActiveFrom,
          })
          .orderBy('profile.effective_from', 'ASC')
          .addOrderBy('profile.version', 'ASC')
          .addOrderBy('profile.id', 'ASC')
          .getMany();
        try {
          const resolved = GroupOperationsInvariants.resolveCompensationProfilePayrollDays(
            GroupOperationsInvariants.compensationProfileCoverage(
              profiles,
              memberActiveFrom,
              memberActiveTo,
              payrollCalendar.payrollDates,
            ),
            undefined,
            activePayrollDays,
          );
          const profileSegments = resolved.map((segment) => {
            const profile = segment.profile;
            const recomputedFullyLoadedCost = GroupOperationsCalculator.fullyLoadedLaborCost({
              baseGuaranteeCents: profile.baseGuaranteeCents,
              positionPerformanceBudgetCents: profile.positionPerformanceBudgetCents,
              employerSocialCostCents: profile.employerSocialCostCents,
              fixedBenefitCostCents: profile.fixedBenefitCostCents,
              otherFixedEmploymentCostCents: profile.otherFixedEmploymentCostCents,
            });
            if (recomputedFullyLoadedCost !== profile.fullyLoadedLaborCostCents) {
              throw new BadRequestException(
                `[compensation_profile_integrity_failed] 员工 ${member.employeeId} 工资结构 ${profile.id} 汇总与明细不一致`,
              );
            }
            if (profile.currency !== policy.currency) {
              throw new BadRequestException(
                `[currency_mismatch] 员工 ${member.employeeId} 工资结构 ${profile.id} 币种与小组目标政策币种不一致`,
              );
            }
            GroupOperationsInvariants.assertCny(profile.currency);
            GroupOperationsInvariants.assertBenefitCashOffsetDisabled(
              profile.benefitCashOffsetCents,
              profile.benefitRuleVersionId,
            );
            const proratedLaborCostCents = GroupOperationsCalculator.proratedLaborCost(
              profile.fullyLoadedLaborCostCents,
              segment.activePayrollDays,
              policy.standardPayrollDays,
            );
            return {
              compensationProfileId: profile.id,
              profileVersion: profile.version,
              effectiveFrom: segment.clippedEffectiveFrom,
              effectiveTo: segment.clippedEffectiveTo,
              activePayrollDays: segment.activePayrollDays,
              fullyLoadedLaborCostCents: profile.fullyLoadedLaborCostCents,
              proratedLaborCostCents,
            };
          });
          const proratedLaborCostCents = GroupOperationsCalculator.sumCents(
            profileSegments.map((segment) => segment.proratedLaborCostCents),
          );
          const allocatedLaborCostCents = GroupOperationsCalculator.allocateLaborCost(
            proratedLaborCostCents,
            member.costAllocationBps,
          );
          calculationMembers.push({
            groupMemberId: member.id,
            employeeId: member.employeeId,
            activePayrollDays,
            profileSegments: profileSegments.map((segment) => ({
              compensationProfileId: segment.compensationProfileId,
              activePayrollDays: segment.activePayrollDays,
            })),
          });
          previewMembers.push({
            groupMemberId: member.id,
            employeeId: member.employeeId,
            jobLevel: member.jobLevel,
            roleCode: member.roleCode,
            effectiveFrom: member.effectiveFrom,
            effectiveTo: member.effectiveTo,
            activePayrollDays,
            costAllocationBps: member.costAllocationBps,
            proratedLaborCostCents,
            allocatedLaborCostCents,
            profileSegments,
          });
        } catch (error) {
          blockers.push(
            error instanceof Error
              ? `[employee_${member.employeeId}] ${error.message}`
              : `[compensation_profile_invalid] 员工 ${member.employeeId} 工资结构无效`,
          );
        }
      }

      const otherGroupDays = await this.loadOtherGroupPayrollDays(
        manager,
        groupId,
        settlementPeriod,
        employeeIds,
        policy,
      );
      for (const employeeId of employeeIds) {
        try {
          GroupOperationsInvariants.assertEmployeePayrollDays(
            employeeId,
            currentGroupDays.get(employeeId) ?? 0,
            otherGroupDays.get(employeeId) ?? 0,
            policy.standardPayrollDays,
          );
        } catch (error) {
          blockers.push(
            error instanceof Error ? error.message : '[employee_payroll_days_overallocated]',
          );
        }
      }
      if (blockers.length) {
        return {
          ...common,
          blockers,
          members: previewMembers,
          calculationInput: null,
        };
      }

      const groupFixedLaborCostCents = GroupOperationsCalculator.sumCents(
        previewMembers.map((member) => String(member.allocatedLaborCostCents)),
      );
      const breakEvenTargetCents = GroupOperationsCalculator.groupBreakEvenTarget({
        groupFixedLaborCostCents,
        safetyFactorBps: policy.safetyFactorBps,
        rampFactorBps: policy.rampFactorBps,
      });
      try {
        GroupOperationsInvariants.assertPositiveCalculatedTarget(
          groupFixedLaborCostCents,
          breakEvenTargetCents,
        );
      } catch (error) {
        return {
          ...common,
          blockers: [
            error instanceof Error ? error.message : '[zero_target_calculation_blocked]',
          ],
          members: previewMembers,
          calculationInput: null,
        };
      }
      const calculationInput = {
        settlementPeriod,
        targetPolicyVersionId: policy.policyVersionId,
        members: calculationMembers,
      };
      return {
        ...common,
        status: 'ready' as const,
        blockers: [],
        groupFixedLaborCostCents,
        breakEvenTargetCents,
        members: previewMembers,
        calculationInput,
        previewFingerprint: GroupOperationsInvariants.payloadFingerprint(calculationInput),
      };
    });
  }

  previewMarginalTarget(dto: MarginalTargetPreviewDto) {
    const fullyLoadedLaborCostCents = GroupOperationsCalculator.fullyLoadedLaborCost(dto);
    const marginalTargetCents = GroupOperationsCalculator.marginalTarget(
      fullyLoadedLaborCostCents,
      dto.safetyFactorBps,
      dto.rampFactorBps,
    );
    return {
      fullyLoadedLaborCostCents,
      safetyFactorBps: dto.safetyFactorBps,
      rampFactorBps: dto.rampFactorBps,
      marginalTargetCents,
      currency: 'CNY',
      roundingMode: MONEY_ROUNDING_MODE,
      status: 'preview',
      formalPayrollEffect: false,
    };
  }

  async previewGroupHiringImpact(
    groupId: number,
    settlementPeriod: string,
    dto: GroupHiringImpactPreviewDto,
    currentUser: CurrentUser,
  ) {
    this.periodBounds(settlementPeriod);
    const group = await this.loadGroup(groupId);
    await this.assertGroupRead(group, currentUser);
    const target = await this.dataSource.getRepository(GroupTarget).findOne({
      where: { groupId, settlementPeriod },
      order: { calculationVersion: 'DESC' },
    });
    if (!target) throw new NotFoundException('该小组当期尚无目标快照');
    if (target.calculationStatus !== 'calculated') {
      throw new BadRequestException(
        `[group_target_blocked] 当前目标不可用于增员测算：${target.blockedReason ?? '目标未完成计算'}`,
      );
    }
    GroupOperationsInvariants.assertCny(target.currency);
    const addedFullyLoadedLaborCostCents = GroupOperationsCalculator.fullyLoadedLaborCost(dto);
    const marginalTargetCents = GroupOperationsCalculator.marginalTarget(
      addedFullyLoadedLaborCostCents,
      target.safetyFactorBps,
      target.rampFactorBps,
    );
    return {
      groupId,
      settlementPeriod,
      targetCalculationVersion: target.calculationVersion,
      currentBreakEvenTargetCents: target.breakEvenTargetCents,
      addedFullyLoadedLaborCostCents,
      marginalTargetCents,
      projectedBreakEvenTargetCents: GroupOperationsCalculator.sumCents([
        target.breakEvenTargetCents,
        marginalTargetCents,
      ]),
      safetyFactorBps: target.safetyFactorBps,
      rampFactorBps: target.rampFactorBps,
      safetyFactorPolicyVersionId: target.safetyFactorPolicyVersionId,
      rampUpPolicyVersionId: target.rampUpPolicyVersionId,
      currency: target.currency,
      roundingMode: MONEY_ROUNDING_MODE,
      status: 'preview',
      formalPayrollEffect: false,
    };
  }

  async calculateGroupTarget(
    groupId: number,
    dto: CalculateGroupTargetDto,
    currentUser: CurrentUser,
  ) {
    this.assertManagementWrite(currentUser);
    this.assertCommandMetadata(dto);
    return this.dataSource.transaction(async (manager) => {
      const group = await this.loadGroup(groupId, manager, true);
      await this.assertOrganizationWriteScopes(
        currentUser,
        [this.groupWriteScope(group)],
        'gov1.target.write',
        manager,
      );
      const targetRepo = manager.getRepository(GroupTarget);
      const commandPayload = GroupOperationsInvariants.targetCommandPayload(groupId, dto);
      const replay = await targetRepo.findOne({
        where: { idempotencyKey: dto.idempotencyKey.trim() },
      });
      if (replay) {
        if (replay.groupId !== groupId) {
          const persistedGroup = await this.loadGroup(replay.groupId, manager, true);
          await this.assertOrganizationWriteScopes(
            currentUser,
            [this.groupWriteScope(persistedGroup)],
            'gov1.target.write',
            manager,
          );
          throw new ConflictException(
            '[idempotency_resource_mismatch] 幂等键已绑定其他经营小组目标',
          );
        }
        GroupOperationsInvariants.assertReplayFingerprint(
          replay.requestFingerprint,
          commandPayload,
          '小组目标计算',
        );
        const snapshots = await manager.getRepository(LaborCostSnapshot).find({
          where: {
            groupId: replay.groupId,
            settlementPeriod: replay.settlementPeriod,
            calculationVersion: replay.calculationVersion,
          },
          order: { groupMemberId: 'ASC' },
        });
        return { target: replay, snapshots };
      }

      const { periodStart, periodEnd } = this.periodBounds(dto.settlementPeriod);
      const policy = await manager.getRepository(GroupTargetPolicyVersion).findOne({
        where: {
          groupId,
          settlementPeriod: dto.settlementPeriod,
          policyVersionId: dto.targetPolicyVersionId.trim(),
          status: 'approved',
        },
        lock: { mode: 'pessimistic_read' },
      });
      if (!policy) {
        throw new BadRequestException(
          '[target_policy_not_approved] 小组当期目标政策不存在、已被替代或尚未批准',
        );
      }
      if (
        policy.safetyFactorPolicyVersionId !== group.safetyFactorPolicyVersionId ||
        policy.rampUpPolicyVersionId !== group.rampUpPolicyVersionId
      ) {
        throw new ConflictException(
          '[target_policy_group_mismatch] 已批准目标政策与小组当前政策族不一致',
        );
      }
      const payrollCalendar = await this.loadPayrollCalendarAuthority(
        group,
        dto.settlementPeriod,
        policy.calendarRuleVersionId,
        manager,
        true,
      );
      this.assertTargetPolicyCalendarBinding(policy, payrollCalendar.rule);
      const payrollDates = payrollCalendar.payrollDates;
      GroupOperationsInvariants.assertCny(policy.currency);
      GroupOperationsCalculator.assertPayrollDays(0, policy.standardPayrollDays);
      if (
        group.establishedAt > periodEnd ||
        (group.closedAt !== null && group.closedAt < periodStart)
      ) {
        return this.saveBlockedTarget(
          group,
          dto,
          currentUser,
          '[group_period_inactive] 小组在该结算周期不处于有效经营期',
          manager,
          policy,
        );
      }
      const activePeriodStart =
        group.establishedAt > periodStart ? group.establishedAt : periodStart;
      const activePeriodEnd =
        group.closedAt !== null && group.closedAt < periodEnd ? group.closedAt : periodEnd;
      const memberships = await manager
        .getRepository(GroupMember)
        .createQueryBuilder('member')
        .where('member.group_id = :groupId', { groupId })
        .andWhere('member.is_primary = 1')
        .andWhere('member.effective_from <= :activePeriodEnd', { activePeriodEnd })
        .andWhere('(member.effective_to IS NULL OR member.effective_to >= :activePeriodStart)', {
          activePeriodStart,
        })
        .orderBy('member.employee_id', 'ASC')
        .getMany();
      if (!memberships.length) {
        return this.saveBlockedTarget(
          group,
          dto,
          currentUser,
          '[group_members_missing] 当期没有有效主小组成员',
          manager,
          policy,
        );
      }

      const latest = await targetRepo.findOne({
        where: { groupId, settlementPeriod: dto.settlementPeriod },
        order: { calculationVersion: 'DESC' },
      });
      if (latest?.calculationStatus === 'locked') {
        throw new ConflictException(
          '[group_target_locked] 已冻结小组目标不得重算；后续只能建立关联调整记录',
        );
      }
      const calculationVersion = (latest?.calculationVersion ?? 0) + 1;
      const membershipById = new Map(memberships.map((member) => [member.id, member]));
      const inputDays = new Map<number, number>();
      const inputMembers = new Map(dto.members.map((member) => [member.groupMemberId, member]));
      for (const item of dto.members) {
        if (inputDays.has(item.groupMemberId)) {
          throw new BadRequestException('[member_days_duplicate] 同一成员关系段有效天数只能提交一次');
        }
        const member = membershipById.get(item.groupMemberId);
        if (!member || member.employeeId !== item.employeeId) {
          throw new BadRequestException(
            '[member_days_scope_mismatch] 成员关系段、员工和小组有效期必须精确对应',
          );
        }
        const capacity = GroupOperationsInvariants.membershipPayrollDayCapacity(
          member.effectiveFrom,
          member.effectiveTo,
          activePeriodStart,
          activePeriodEnd,
          payrollDates,
        );
        if (
          !Number.isInteger(item.activePayrollDays) ||
          item.activePayrollDays < 0 ||
          item.activePayrollDays !== capacity
        ) {
          return this.saveBlockedTarget(
            group,
            dto,
            currentUser,
            `[active_payroll_days_calendar_mismatch] 员工 ${item.employeeId} 的成员关系段 ${item.groupMemberId} 有效计薪天数必须等于权威日历派生值 ${capacity}`,
            manager,
            policy,
            calculationVersion,
          );
        }
        inputDays.set(item.groupMemberId, item.activePayrollDays);
      }
      if (
        inputDays.size !== membershipById.size ||
        [...inputDays.keys()].some((groupMemberId) => !membershipById.has(groupMemberId))
      ) {
        throw new BadRequestException(
          '[member_days_scope_mismatch] 有效天数必须与当期每个有效主小组成员关系段一一对应',
        );
      }

      const employeeIds = [...new Set(memberships.map((member) => member.employeeId))].sort(
        (left, right) => left - right,
      );
      await this.lockActiveEmployees(employeeIds, manager);
      const currentGroupDays = new Map<number, number>();
      for (const member of memberships) {
        currentGroupDays.set(
          member.employeeId,
          (currentGroupDays.get(member.employeeId) ?? 0) + inputDays.get(member.id)!,
        );
      }
      const otherGroupDays = await this.loadOtherGroupPayrollDays(
        manager,
        groupId,
        dto.settlementPeriod,
        employeeIds,
        policy,
      );
      for (const employeeId of employeeIds) {
        try {
          GroupOperationsInvariants.assertEmployeePayrollDays(
            employeeId,
            currentGroupDays.get(employeeId) ?? 0,
            otherGroupDays.get(employeeId) ?? 0,
            policy.standardPayrollDays,
          );
        } catch (error) {
          return this.saveBlockedTarget(
            group,
            dto,
            currentUser,
            error instanceof Error ? error.message : '[employee_payroll_days_overallocated]',
            manager,
            policy,
            calculationVersion,
          );
        }
      }

      const snapshotRepo = manager.getRepository(LaborCostSnapshot);
      const prepared: Array<{
        member: GroupMember;
        primaryProfile: CompensationProfile;
        profileSegments: PreparedCompensationProfileSegment[];
        activePayrollDays: number;
        proratedLaborCostCents: string;
        allocatedLaborCostCents: string;
      }> = [];
      for (const member of memberships) {
        const memberActiveFrom =
          member.effectiveFrom > activePeriodStart ? member.effectiveFrom : activePeriodStart;
        const memberActiveTo =
          member.effectiveTo && member.effectiveTo < activePeriodEnd
            ? member.effectiveTo
            : activePeriodEnd;
        const profiles = await manager
          .getRepository(CompensationProfile)
          .createQueryBuilder('profile')
          .setLock('pessimistic_read')
          .where('profile.employee_id = :employeeId', { employeeId: member.employeeId })
          .andWhere('profile.status IN (:...statuses)', { statuses: ['approved', 'superseded'] })
          .andWhere('profile.effective_from <= :memberActiveTo', { memberActiveTo })
          .andWhere('(profile.effective_to IS NULL OR profile.effective_to >= :memberActiveFrom)', {
            memberActiveFrom,
          })
          .orderBy('profile.effective_from', 'ASC')
          .addOrderBy('profile.version', 'ASC')
          .addOrderBy('profile.id', 'ASC')
          .getMany();
        let profileSegments: PreparedCompensationProfileSegment[];
        try {
          const coverage = GroupOperationsInvariants.compensationProfileCoverage(
            profiles,
            memberActiveFrom,
            memberActiveTo,
            payrollDates,
          );
          profileSegments = GroupOperationsInvariants.resolveCompensationProfilePayrollDays(
            coverage,
            inputMembers.get(member.id)?.profileSegments,
            inputDays.get(member.id)!,
          ).map((segment) => {
            const segmentPayrollDates = payrollDates.filter(
              (date) =>
                date >= segment.clippedEffectiveFrom && date <= segment.clippedEffectiveTo,
            );
            return {
              ...segment,
              payrollDates: segmentPayrollDates,
              payrollDateSetHash: GroupOperationsInvariants.payloadFingerprint({
                settlementPeriod: dto.settlementPeriod,
                payrollDates: segmentPayrollDates,
              }),
              proratedLaborCostCents: GroupOperationsCalculator.proratedLaborCost(
                segment.profile.fullyLoadedLaborCostCents,
                segment.activePayrollDays,
                policy.standardPayrollDays,
              ),
            };
          });
        } catch (error) {
          return this.saveBlockedTarget(
            group,
            dto,
            currentUser,
            error instanceof Error
              ? `[employee_${member.employeeId}] ${error.message}`
              : `[compensation_profile_invalid] 员工 ${member.employeeId} 工资结构无效`,
            manager,
            policy,
            calculationVersion,
          );
        }
        for (const segment of profileSegments) {
          const profile = segment.profile;
          const recomputedFullyLoadedCost = GroupOperationsCalculator.fullyLoadedLaborCost({
            baseGuaranteeCents: profile.baseGuaranteeCents,
            positionPerformanceBudgetCents: profile.positionPerformanceBudgetCents,
            employerSocialCostCents: profile.employerSocialCostCents,
            fixedBenefitCostCents: profile.fixedBenefitCostCents,
            otherFixedEmploymentCostCents: profile.otherFixedEmploymentCostCents,
          });
          if (recomputedFullyLoadedCost !== profile.fullyLoadedLaborCostCents) {
            return this.saveBlockedTarget(
              group,
              dto,
              currentUser,
              `[compensation_profile_integrity_failed] 员工 ${member.employeeId} 工资结构 ${profile.id} 汇总与明细不一致`,
              manager,
              policy,
              calculationVersion,
            );
          }
          if (profile.currency !== policy.currency) {
            return this.saveBlockedTarget(
              group,
              dto,
              currentUser,
              `[currency_mismatch] 员工 ${member.employeeId} 工资结构 ${profile.id} 币种与小组目标政策币种不一致`,
              manager,
              policy,
              calculationVersion,
            );
          }
          try {
            GroupOperationsInvariants.assertCny(profile.currency);
            GroupOperationsInvariants.assertBenefitCashOffsetDisabled(
              profile.benefitCashOffsetCents,
              profile.benefitRuleVersionId,
            );
          } catch (error) {
            return this.saveBlockedTarget(
              group,
              dto,
              currentUser,
              error instanceof Error ? error.message : '[compensation_profile_policy_invalid]',
              manager,
              policy,
              calculationVersion,
            );
          }
        }
        const activePayrollDays = inputDays.get(member.id)!;
        const proratedLaborCostCents = GroupOperationsCalculator.sumCents(
          profileSegments.map((segment) => segment.proratedLaborCostCents),
        );
        const allocatedLaborCostCents = GroupOperationsCalculator.allocateLaborCost(
          proratedLaborCostCents,
          member.costAllocationBps,
        );
        prepared.push({
          member,
          primaryProfile: profileSegments[profileSegments.length - 1].profile,
          profileSegments,
          activePayrollDays,
          proratedLaborCostCents,
          allocatedLaborCostCents,
        });
      }

      const groupFixedLaborCostCents = GroupOperationsCalculator.sumCents(
        prepared.map((item) => item.allocatedLaborCostCents),
      );
      const breakEvenTargetCents = GroupOperationsCalculator.groupBreakEvenTarget({
        groupFixedLaborCostCents,
        safetyFactorBps: policy.safetyFactorBps,
        rampFactorBps: policy.rampFactorBps,
      });
      try {
        GroupOperationsInvariants.assertPositiveCalculatedTarget(
          groupFixedLaborCostCents,
          breakEvenTargetCents,
        );
      } catch (error) {
        return this.saveBlockedTarget(
          group,
          dto,
          currentUser,
          error instanceof Error ? error.message : '[zero_target_calculation_blocked]',
          manager,
          policy,
          calculationVersion,
        );
      }

      const snapshots: LaborCostSnapshot[] = [];
      for (const item of prepared) {
        const {
          member,
          primaryProfile,
          profileSegments,
          activePayrollDays,
          proratedLaborCostCents,
          allocatedLaborCostCents,
        } = item;
        snapshots.push(
          await snapshotRepo.save(
            snapshotRepo.create({
              groupId,
              employeeId: member.employeeId,
              groupMemberId: member.id,
              compensationProfileId: primaryProfile.id,
              settlementPeriod: dto.settlementPeriod,
              calculationVersion,
              jobLevelSnapshot: member.jobLevel,
              roleCodeSnapshot: member.roleCode,
              activePayrollDays,
              standardPayrollDays: policy.standardPayrollDays,
              calendarRuleVersionId: policy.calendarRuleVersionId,
              currency: policy.currency,
              costAllocationBps: member.costAllocationBps,
              baseGuaranteeCents: primaryProfile.baseGuaranteeCents,
              positionPerformanceBudgetCents:
                primaryProfile.positionPerformanceBudgetCents,
              employerSocialCostCents: primaryProfile.employerSocialCostCents,
              fixedBenefitCostCents: primaryProfile.fixedBenefitCostCents,
              benefitCashOffsetCents: primaryProfile.benefitCashOffsetCents,
              otherFixedEmploymentCostCents:
                primaryProfile.otherFixedEmploymentCostCents,
              fullyLoadedLaborCostCents: primaryProfile.fullyLoadedLaborCostCents,
              proratedLaborCostCents,
              allocatedLaborCostCents,
              roundingMode: MONEY_ROUNDING_MODE,
              profileSnapshotJson: {
                calculationMode:
                  profileSegments.length === 1
                    ? 'single_compensation_profile'
                    : 'segmented_compensation_profiles',
                primaryCompensationProfileId: primaryProfile.id,
                componentsArePrimaryProfileCompatibilitySnapshot: true,
                profileId: primaryProfile.id,
                profileVersion: primaryProfile.version,
                currency: primaryProfile.currency,
                effectiveFrom: primaryProfile.effectiveFrom,
                effectiveTo: primaryProfile.effectiveTo,
                benefitRuleVersionId: primaryProfile.benefitRuleVersionId,
                payrollCalendarRuleId: payrollCalendar.rule.id,
                calendarRuleVersionId: payrollCalendar.rule.calendarRuleVersionId,
                payrollDateSetHash: payrollCalendar.rule.payrollDateSetHash,
                payrollDates,
                profileSegments: profileSegments.map((segment) => ({
                  compensationProfileId: segment.profile.id,
                  profileVersion: segment.profile.version,
                  profileStatus: segment.profile.status,
                  currency: segment.profile.currency,
                  effectiveFrom: segment.profile.effectiveFrom,
                  effectiveTo: segment.profile.effectiveTo,
                  clippedEffectiveFrom: segment.clippedEffectiveFrom,
                  clippedEffectiveTo: segment.clippedEffectiveTo,
                  payrollDayCapacity: segment.payrollDayCapacity,
                  activePayrollDays: segment.activePayrollDays,
                  payrollDates: segment.payrollDates,
                  payrollDateSetHash: segment.payrollDateSetHash,
                  baseGuaranteeCents: segment.profile.baseGuaranteeCents,
                  positionPerformanceBudgetCents:
                    segment.profile.positionPerformanceBudgetCents,
                  employerSocialCostCents: segment.profile.employerSocialCostCents,
                  fixedBenefitCostCents: segment.profile.fixedBenefitCostCents,
                  benefitCashOffsetCents: segment.profile.benefitCashOffsetCents,
                  otherFixedEmploymentCostCents:
                    segment.profile.otherFixedEmploymentCostCents,
                  fullyLoadedLaborCostCents: segment.profile.fullyLoadedLaborCostCents,
                  proratedLaborCostCents: segment.proratedLaborCostCents,
                  benefitRuleVersionId: segment.profile.benefitRuleVersionId,
                })),
              },
              snapshotStatus: 'calculated',
              sourceChannel: dto.sourceChannel.trim(),
              correlationId: dto.correlationId.trim(),
              idempotencyKey: this.derivedIdempotencyKey(
                dto.idempotencyKey,
                `labor:${member.id}:${calculationVersion}`,
              ),
              createdBy: currentUser.id,
              lockedAt: null,
            }),
          ),
        );
      }

      const target = await targetRepo.save(
        targetRepo.create({
          groupId,
          settlementPeriod: dto.settlementPeriod,
          calculationVersion,
          targetPolicyId: policy.id,
          groupFixedLaborCostCents,
          safetyFactorBps: policy.safetyFactorBps,
          rampFactorBps: policy.rampFactorBps,
          standardPayrollDays: policy.standardPayrollDays,
          currency: policy.currency,
          breakEvenTargetCents,
          marginalTargetChangeCents: '0',
          memberSnapshotCount: snapshots.length,
          laborCostSnapshotIds: snapshots.map((snapshot) => snapshot.id),
          calculationInputJson: this.targetCalculationInput(groupId, dto, policy),
          calculationStatus: 'calculated',
          blockedReason: null,
          safetyFactorPolicyVersionId: policy.safetyFactorPolicyVersionId,
          rampUpPolicyVersionId: policy.rampUpPolicyVersionId,
          calendarRuleVersionId: policy.calendarRuleVersionId,
          roundingMode: MONEY_ROUNDING_MODE,
          sourceChannel: dto.sourceChannel.trim(),
          correlationId: dto.correlationId.trim(),
          idempotencyKey: dto.idempotencyKey.trim(),
          requestFingerprint: GroupOperationsInvariants.payloadFingerprint(
            commandPayload,
          ),
          createdBy: currentUser.id,
          approvedBy: currentUser.id,
          lockedAt: null,
        }),
      );
      await this.audit(target.id, 'group_target.calculate', currentUser, dto, manager, {
        groupId,
        settlementPeriod: dto.settlementPeriod,
        calculationVersion,
        groupFixedLaborCostCents,
        breakEvenTargetCents,
        memberSnapshotCount: snapshots.length,
        targetPolicyId: policy.id,
        targetPolicyVersionId: policy.policyVersionId,
        payrollCalendarRuleId: payrollCalendar.rule.id,
        calendarRuleVersionId: payrollCalendar.rule.calendarRuleVersionId,
        payrollDateSetHash: payrollCalendar.rule.payrollDateSetHash,
      });
      return { target, snapshots };
    });
  }

  async getLatestGroupTarget(groupId: number, settlementPeriod: string, currentUser: CurrentUser) {
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(settlementPeriod)) {
      throw new BadRequestException('结算周期格式必须为 YYYY-MM');
    }
    const group = await this.loadGroup(groupId);
    await this.assertGroupRead(group, currentUser);
    const target = await this.dataSource.getRepository(GroupTarget).findOne({
      where: { groupId, settlementPeriod },
      order: { calculationVersion: 'DESC' },
    });
    if (!target) throw new NotFoundException('该小组当期尚无目标快照');
    return target;
  }

  private async saveBlockedTarget(
    group: OrganizationGroup,
    dto: CalculateGroupTargetDto,
    currentUser: CurrentUser,
    blockedReason: string,
    manager: EntityManager,
    policy: GroupTargetPolicyVersion,
    knownVersion?: number,
  ) {
    const repo = manager.getRepository(GroupTarget);
    const latest = knownVersion
      ? null
      : await repo.findOne({
          where: { groupId: group.id, settlementPeriod: dto.settlementPeriod },
          order: { calculationVersion: 'DESC' },
        });
    if (latest?.calculationStatus === 'locked') {
      throw new ConflictException(
        '[group_target_locked] 已冻结小组目标不得重算；后续只能建立关联调整记录',
      );
    }
    const calculationVersion = knownVersion ?? (latest?.calculationVersion ?? 0) + 1;
    const target = await repo.save(
      repo.create({
        groupId: group.id,
        settlementPeriod: dto.settlementPeriod,
        calculationVersion,
        targetPolicyId: policy.id,
        groupFixedLaborCostCents: '0',
        safetyFactorBps: policy.safetyFactorBps,
        rampFactorBps: policy.rampFactorBps,
        standardPayrollDays: policy.standardPayrollDays,
        currency: policy.currency,
        breakEvenTargetCents: '0',
        marginalTargetChangeCents: '0',
        memberSnapshotCount: 0,
        laborCostSnapshotIds: [],
        calculationInputJson: this.targetCalculationInput(group.id, dto, policy),
        calculationStatus: 'calculation_blocked',
        blockedReason,
        safetyFactorPolicyVersionId: policy.safetyFactorPolicyVersionId,
        rampUpPolicyVersionId: policy.rampUpPolicyVersionId,
        calendarRuleVersionId: policy.calendarRuleVersionId,
        roundingMode: MONEY_ROUNDING_MODE,
        sourceChannel: dto.sourceChannel.trim(),
        correlationId: dto.correlationId.trim(),
        idempotencyKey: dto.idempotencyKey.trim(),
        requestFingerprint: GroupOperationsInvariants.payloadFingerprint(
          GroupOperationsInvariants.targetCommandPayload(group.id, dto),
        ),
        createdBy: currentUser.id,
        approvedBy: currentUser.id,
        lockedAt: null,
      }),
    );
    await this.audit(target.id, 'group_target.calculation_blocked', currentUser, dto, manager, {
      groupId: group.id,
      settlementPeriod: dto.settlementPeriod,
      calculationVersion,
      blockedReason,
      targetPolicyId: policy.id,
      targetPolicyVersionId: policy.policyVersionId,
    });
    return { target, snapshots: [] as LaborCostSnapshot[] };
  }

  private async loadGroup(id: number, manager = this.dataSource.manager, lock = false) {
    const repo = manager.getRepository(OrganizationGroup);
    const group = lock
      ? await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } })
      : await repo.findOne({ where: { id } });
    if (!group) throw new NotFoundException('经营小组不存在');
    return group;
  }

  private async assertOrganizationScope(
    dto: Pick<CreateOrganizationGroupDto, 'companyRef' | 'businessSectorRef' | 'storeRef'>,
    effectiveDate: string,
    manager: EntityManager,
  ) {
    const company = await manager.getRepository(BusinessCompanyRef).findOne({
      where: { companyRef: dto.companyRef, status: 'active' },
    });
    if (!company || !this.isEffectiveOn(company.validFrom, company.validUntil, effectiveDate)) {
      throw new BadRequestException('[company_scope_invalid] 公司引用不存在或不在有效期');
    }
    if (dto.storeRef && !dto.businessSectorRef) {
      throw new BadRequestException('[store_sector_required] 门店小组必须指定业务板块');
    }
    if (!dto.businessSectorRef) return;
    const sector = await manager.getRepository(BusinessSector).findOne({
      where: { businessSectorRef: dto.businessSectorRef, status: 'active' },
    });
    const companySector = await manager.getRepository(CompanySectorAssignment).findOne({
      where: {
        companyRef: dto.companyRef,
        businessSectorRef: dto.businessSectorRef,
        status: 'active',
      },
    });
    if (
      !sector ||
      !companySector ||
      !this.isEffectiveOn(companySector.validFrom, companySector.validUntil, effectiveDate)
    ) {
      throw new BadRequestException('[sector_scope_invalid] 业务板块未获公司有效授权');
    }
    if (!dto.storeRef) return;
    const store = await manager.getRepository(BusinessStore).findOne({
      where: { storeRef: dto.storeRef, status: 'active' },
    });
    const storeSector = await manager.getRepository(StoreSectorAssignment).findOne({
      where: {
        storeRef: dto.storeRef,
        businessSectorRef: dto.businessSectorRef,
        status: 'active',
      },
    });
    if (
      !store ||
      store.companyRef !== dto.companyRef ||
      !this.isEffectiveOn(store.validFrom, store.validUntil, effectiveDate) ||
      !storeSector ||
      !this.isEffectiveOn(storeSector.validFrom, storeSector.validUntil, effectiveDate)
    ) {
      throw new BadRequestException('[store_scope_invalid] 门店不属于该公司/板块有效范围');
    }
  }

  private async assertEmployeesExist(employeeIds: number[], manager: EntityManager) {
    for (const employeeId of [...new Set(employeeIds)]) {
      const employee = await manager.getRepository(Employee).findOne({
        where: { id: employeeId, status: 1 },
      });
      if (!employee) throw new BadRequestException(`员工 ${employeeId} 不存在或已停用`);
    }
  }

  private async lockActiveEmployees(employeeIds: number[], manager: EntityManager) {
    const uniqueIds = [...new Set(employeeIds)].sort((left, right) => left - right);
    const employees = await manager
      .getRepository(Employee)
      .createQueryBuilder('employee')
      .setLock('pessimistic_write')
      .where('employee.id IN (:...employeeIds)', { employeeIds: uniqueIds })
      .andWhere('employee.status = 1')
      .orderBy('employee.id', 'ASC')
      .getMany();
    if (employees.length !== uniqueIds.length) {
      const found = new Set(employees.map((employee) => employee.id));
      const missing = uniqueIds.find((employeeId) => !found.has(employeeId));
      throw new BadRequestException(`员工 ${missing ?? 'unknown'} 不存在或已停用`);
    }
    return employees;
  }

  private async assertGroupRead(group: OrganizationGroup, currentUser: CurrentUser) {
    if (!(await this.canReadGroup(group, currentUser))) {
      throw new ForbiddenException('[group_scope_denied] 当前用户无权查看该小组经营数据');
    }
  }

  private async canReadGroup(group: OrganizationGroup, currentUser: CurrentUser) {
    const employee = await this.dataSource.getRepository(Employee).findOne({
      where: { linkedUserId: currentUser.id, status: 1 },
    });
    const now = new Date().toISOString().slice(0, 10);
    const activeMembers = await this.dataSource
      .getRepository(GroupMember)
      .createQueryBuilder('member')
      .where('member.group_id = :groupId', { groupId: group.id })
      .andWhere('member.effective_from <= :now', { now })
      .andWhere('(member.effective_to IS NULL OR member.effective_to >= :now)', { now })
      .getMany();
    const grants = employee
      ? await this.dataSource.getRepository(BusinessScopeGrant).find({
          where: { userId: currentUser.id, employeeId: employee.id, companyRef: group.companyRef, status: 'active' },
        })
      : [];
    const effectiveGrants = grants.filter(
      (grant) =>
        this.isEffectiveOn(grant.validFrom, grant.validUntil, now) &&
        (grant.permissions.includes('*') || grant.permissions.includes('gov1.group.read')) &&
        (!grant.businessSectorRef || grant.businessSectorRef === group.businessSectorRef) &&
        (!grant.storeRef || grant.storeRef === group.storeRef) &&
        !grant.customerRef,
    );
    return GroupOperationsAccessPolicy.canReadAggregate(currentUser, {
      leaderEmployeeId: group.leaderEmployeeId,
      businessOwnerEmployeeId: group.businessOwnerEmployeeId,
      linkedEmployeeId: employee?.id ?? null,
      activeMemberEmployeeIds: activeMembers.map((member) => member.employeeId),
      scopeGranted: effectiveGrants.some((grant) => grant.effect === 'allow'),
      scopeDenied: effectiveGrants.some((grant) => grant.effect === 'deny'),
    });
  }

  private async assertCompensationProfileRead(
    targetEmployeeId: number,
    currentUser: CurrentUser,
  ): Promise<void> {
    const employeeRepo = this.dataSource.getRepository(Employee);
    const linkedEmployee = await employeeRepo.findOne({
      where: { linkedUserId: currentUser.id, status: 1 },
    });
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const targetMemberships = await this.dataSource
      .getRepository(GroupMember)
      .createQueryBuilder('member')
      .where('member.employee_id = :targetEmployeeId', { targetEmployeeId })
      .andWhere('member.effective_from <= :today', { today })
      .andWhere('(member.effective_to IS NULL OR member.effective_to >= :today)', { today })
      .orderBy('member.group_id', 'ASC')
      .getMany();
    const targetGroupIds = [...new Set(targetMemberships.map((member) => member.groupId))];
    const targetGroups = targetGroupIds.length
      ? await this.dataSource.getRepository(OrganizationGroup).find({
          where: { id: In(targetGroupIds) },
          order: { id: 'ASC' },
        })
      : [];
    const leadsTargetGroup = Boolean(
      linkedEmployee &&
        targetGroups.some(
          (group) =>
            group.leaderEmployeeId === linkedEmployee.id ||
            group.businessOwnerEmployeeId === linkedEmployee.id,
        ),
    );

    const grants =
      linkedEmployee && targetGroups.length
        ? await this.dataSource.getRepository(BusinessScopeGrant).find({
            where: {
              userId: currentUser.id,
              employeeId: linkedEmployee.id,
              companyRef: In([...new Set(targetGroups.map((group) => group.companyRef))]),
              status: 'active',
            },
            order: { id: 'ASC' },
          })
        : [];
    const matchingGrants = grants.filter((grant) => {
      if (!this.isGrantEffectiveAt(grant.validFrom, grant.validUntil, now)) return false;
      if (
        !grant.permissions.includes('*') &&
        !grant.permissions.includes('gov1.compensation.read')
      ) {
        return false;
      }
      if (grant.customerRef) return false;
      return targetGroups.some(
        (group) =>
          group.companyRef === grant.companyRef &&
          (!grant.businessSectorRef || grant.businessSectorRef === group.businessSectorRef) &&
          (!grant.storeRef || grant.storeRef === group.storeRef),
      );
    });
    if (
      !GroupOperationsAccessPolicy.canReadCompensationProfiles(currentUser, {
        linkedEmployeeId: linkedEmployee?.id ?? null,
        targetEmployeeId,
        leadsTargetGroup,
        scopeGranted: matchingGrants.some((grant) => grant.effect === 'allow'),
        scopeDenied: matchingGrants.some((grant) => grant.effect === 'deny'),
      })
    ) {
      throw new ForbiddenException(
        '[compensation_scope_denied] 当前用户无权查看该员工工资结构',
      );
    }
  }

  private async assertGroupTargetInputCostRead(
    group: OrganizationGroup,
    currentUser: CurrentUser,
    manager: EntityManager,
  ): Promise<void> {
    const linkedEmployee = await manager.getRepository(Employee).findOne({
      where: { linkedUserId: currentUser.id, status: 1 },
      lock: { mode: 'pessimistic_read' },
    });
    const now = new Date();
    const grants = linkedEmployee
      ? await manager.getRepository(BusinessScopeGrant).find({
          where: {
            userId: currentUser.id,
            employeeId: linkedEmployee.id,
            companyRef: group.companyRef,
            status: 'active',
          },
          order: { id: 'ASC' },
          lock: { mode: 'pessimistic_read' },
        })
      : [];
    const matchingGrants = grants.filter(
      (grant) =>
        this.isGrantEffectiveAt(grant.validFrom, grant.validUntil, now) &&
        (grant.permissions.includes('*') ||
          grant.permissions.includes('gov1.compensation.read')) &&
        (!grant.businessSectorRef || grant.businessSectorRef === group.businessSectorRef) &&
        (!grant.storeRef || grant.storeRef === group.storeRef) &&
        !grant.customerRef,
    );
    if (
      !GroupOperationsAccessPolicy.canReadTargetInputCosts(currentUser, {
        leaderEmployeeId: group.leaderEmployeeId,
        businessOwnerEmployeeId: group.businessOwnerEmployeeId,
        linkedEmployeeId: linkedEmployee?.id ?? null,
        scopeGranted: matchingGrants.some((grant) => grant.effect === 'allow'),
        scopeDenied: matchingGrants.some((grant) => grant.effect === 'deny'),
      })
    ) {
      throw new ForbiddenException(
        '[target_input_cost_scope_denied] 当前用户无权查看该小组逐员工工资成本输入',
      );
    }
  }

  private async loadOtherGroupPayrollDays(
    manager: EntityManager,
    currentGroupId: number,
    settlementPeriod: string,
    employeeIds: number[],
    policy: GroupTargetPolicyVersion,
  ): Promise<Map<number, number>> {
    const targets = await manager
      .getRepository(GroupTarget)
      .createQueryBuilder('target')
      .setLock('pessimistic_read')
      .where('target.settlement_period = :settlementPeriod', { settlementPeriod })
      .andWhere('target.group_id <> :currentGroupId', { currentGroupId })
      .orderBy('target.group_id', 'ASC')
      .addOrderBy('target.calculation_version', 'DESC')
      .getMany();
    const latestByGroup = new Map<number, GroupTarget>();
    for (const target of targets) {
      if (!latestByGroup.has(target.groupId)) latestByGroup.set(target.groupId, target);
    }
    const activeTargets = [...latestByGroup.values()].filter(
      (target) => target.calculationStatus === 'calculated' || target.calculationStatus === 'locked',
    );
    const snapshotIds = [
      ...new Set(activeTargets.flatMap((target) => target.laborCostSnapshotIds)),
    ];
    if (!snapshotIds.length) return new Map();
    const snapshots = await manager.getRepository(LaborCostSnapshot).find({
      where: { id: In(snapshotIds), employeeId: In(employeeIds) },
      order: { employeeId: 'ASC', id: 'ASC' },
    });
    const relevantSnapshotIds = new Set(snapshots.map((snapshot) => snapshot.id));
    const relevantTargets = activeTargets.filter((target) =>
      target.laborCostSnapshotIds.some((snapshotId) => relevantSnapshotIds.has(snapshotId)),
    );
    for (const target of relevantTargets) {
      if (
        target.standardPayrollDays !== policy.standardPayrollDays ||
        target.calendarRuleVersionId !== policy.calendarRuleVersionId ||
        this.frozenPayrollDateSetHash(target.calculationInputJson) !==
          policy.payrollDateSetHash ||
        target.currency !== policy.currency
      ) {
        throw new ConflictException(
          '[cross_group_calendar_policy_mismatch] 只有存在共同员工的同期小组目标才能参与日历规则、日期集合哈希、标准天数和币种一致性校验',
        );
      }
    }
    const days = new Map<number, number>();
    for (const snapshot of snapshots) {
      if (
        snapshot.standardPayrollDays !== policy.standardPayrollDays ||
        snapshot.calendarRuleVersionId !== policy.calendarRuleVersionId ||
        this.frozenPayrollDateSetHash(snapshot.profileSnapshotJson) !==
          policy.payrollDateSetHash ||
        snapshot.currency !== policy.currency
      ) {
        throw new ConflictException(
          '[cross_group_snapshot_policy_mismatch] 跨组人工成本快照的日历规则、日期集合哈希、标准天数或币种不一致',
        );
      }
      days.set(
        snapshot.employeeId,
        (days.get(snapshot.employeeId) ?? 0) + snapshot.activePayrollDays,
      );
    }
    return days;
  }

  private frozenPayrollDateSetHash(snapshot: Record<string, unknown>): string | null {
    const direct = snapshot.payrollDateSetHash;
    if (typeof direct === 'string' && /^[a-f0-9]{64}$/.test(direct)) return direct;
    const policy = snapshot.policy;
    if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return null;
    const nested = (policy as Record<string, unknown>).payrollDateSetHash;
    return typeof nested === 'string' && /^[a-f0-9]{64}$/.test(nested) ? nested : null;
  }

  private async markEmployeeTargetsForRecalculation(
    employeeId: number,
    effectiveFrom: string,
    effectiveTo: string | null,
    currentUser: CurrentUser,
    command: { reason: string; sourceChannel: string; correlationId: string; idempotencyKey: string },
    manager: EntityManager,
  ) {
    const memberships = await manager.getRepository(GroupMember).find({
      where: { employeeId, isPrimary: true },
      order: { groupId: 'ASC', effectiveFrom: 'ASC', id: 'ASC' },
    });
    for (const membership of memberships) {
      if (
        !GroupOperationsAccessPolicy.dateRangesOverlap(
          membership.effectiveFrom,
          membership.effectiveTo,
          effectiveFrom,
          effectiveTo,
        )
      ) {
        continue;
      }
      const overlapFrom =
        membership.effectiveFrom > effectiveFrom ? membership.effectiveFrom : effectiveFrom;
      const overlapTo = this.earlierNullableDate(membership.effectiveTo, effectiveTo);
      await this.markGroupTargetsForRecalculation(
        membership.groupId,
        overlapFrom,
        overlapTo,
        currentUser,
        command,
        manager,
        '[compensation_profile_changed] 员工完全人工成本结构发生生效变更',
      );
    }
  }

  private async markGroupTargetsForRecalculation(
    groupId: number,
    affectedFrom: string,
    affectedTo: string | null,
    currentUser: CurrentUser,
    command: { reason: string; sourceChannel: string; correlationId: string; idempotencyKey: string },
    manager: EntityManager,
    triggerReason: string,
  ) {
    this.assertDateRange(affectedFrom, affectedTo);
    const repo = manager.getRepository(GroupTarget);
    const targets = await repo.find({
      where: { groupId },
      order: { settlementPeriod: 'ASC', calculationVersion: 'DESC' },
    });
    const latestByPeriod = new Map<string, GroupTarget>();
    for (const target of targets) {
      if (!latestByPeriod.has(target.settlementPeriod)) {
        latestByPeriod.set(target.settlementPeriod, target);
      }
    }
    for (const target of latestByPeriod.values()) {
      const { periodStart, periodEnd } = this.periodBounds(target.settlementPeriod);
      if (
        !GroupOperationsAccessPolicy.dateRangesOverlap(
          periodStart,
          periodEnd,
          affectedFrom,
          affectedTo,
        )
      ) {
        continue;
      }
      if (
        target.calculationStatus !== 'calculated' ||
        target.lockedAt != null
      ) {
        continue;
      }
      target.calculationStatus = 'recalculation_required';
      target.blockedReason = `[target_inputs_changed] ${triggerReason}`;
      const saved = await repo.save(target);
      await this.audit(
        saved.id,
        'group_target.recalculation_required',
        currentUser,
        command,
        manager,
        {
          groupId,
          settlementPeriod: saved.settlementPeriod,
          calculationVersion: saved.calculationVersion,
          affectedFrom,
          affectedTo,
          triggerReason,
          lockedHistoryChanged: false,
        },
      );
    }
  }

  private groupWriteScope(group: OrganizationGroup): OrganizationWriteScope {
    return {
      companyRef: group.companyRef,
      businessSectorRef: group.businessSectorRef,
      storeRef: group.storeRef,
    };
  }

  private async loadPayrollCalendarAuthority(
    group: OrganizationGroup,
    settlementPeriod: string,
    calendarRuleVersionId: string,
    manager: EntityManager,
    lock = false,
  ): Promise<{ rule: PayrollCalendarRuleVersion; payrollDates: string[] }> {
    const where = {
      companyRef: group.companyRef,
      settlementPeriod,
      calendarRuleVersionId,
      status: 'approved' as const,
    };
    const repo = manager.getRepository(PayrollCalendarRuleVersion);
    const rule = lock
      ? await repo.findOne({ where, lock: { mode: 'pessimistic_read' } })
      : await repo.findOne({ where });
    if (!rule) {
      throw new BadRequestException(
        '[payroll_calendar_authority_missing] 未找到公司当期已批准的权威计薪日历规则',
      );
    }
    const payrollDates = GroupOperationsInvariants.assertPayrollCalendarIntegrity(
      rule.settlementPeriod,
      rule.payrollDatesJson,
      rule.standardPayrollDays,
      rule.payrollDateSetHash,
    );
    return { rule, payrollDates };
  }

  private assertTargetPolicyCalendarBinding(
    policy: GroupTargetPolicyVersion,
    rule: PayrollCalendarRuleVersion,
  ): void {
    if (
      policy.payrollCalendarRuleId !== rule.id ||
      policy.payrollDateSetHash !== rule.payrollDateSetHash ||
      policy.calendarRuleVersionId !== rule.calendarRuleVersionId ||
      policy.settlementPeriod !== rule.settlementPeriod ||
      policy.standardPayrollDays !== rule.standardPayrollDays
    ) {
      throw new ConflictException(
        '[target_policy_calendar_binding_invalid] 目标政策未精确绑定权威计薪日历及日期哈希',
      );
    }
  }

  private async compensationReplayAffectedTo(
    replay: CompensationProfile,
    manager: EntityManager,
  ): Promise<string | null> {
    if (replay.effectiveTo === null) return null;
    const predecessorEffectiveTo = this.previousDate(replay.effectiveFrom);
    const profiles = await manager.getRepository(CompensationProfile).find({
      where: { employeeId: replay.employeeId },
      order: { version: 'ASC', id: 'ASC' },
    });
    const truncatedOpenPredecessor = profiles.some(
      (profile) =>
        profile.id !== replay.id &&
        profile.version < replay.version &&
        profile.status === 'superseded' &&
        profile.effectiveFrom < replay.effectiveFrom &&
        profile.effectiveTo === predecessorEffectiveTo,
    );
    return truncatedOpenPredecessor ? null : replay.effectiveTo;
  }

  private async assertCompensationWriteScope(
    employeeId: number,
    effectiveFrom: string,
    effectiveTo: string | null,
    currentUser: CurrentUser,
    manager: EntityManager,
  ): Promise<void> {
    const memberships = await manager
      .getRepository(GroupMember)
      .createQueryBuilder('member')
      .where('member.employee_id = :employeeId', { employeeId })
      .andWhere('member.is_primary = 1')
      .andWhere('member.effective_from <= :effectiveTo', {
        effectiveTo: effectiveTo ?? '9999-12-31',
      })
      .andWhere('(member.effective_to IS NULL OR member.effective_to >= :effectiveFrom)', {
        effectiveFrom,
      })
      .orderBy('member.group_id', 'ASC')
      .addOrderBy('member.effective_from', 'ASC')
      .getMany();
    if (!memberships.length) {
      throw new ForbiddenException(
        '[compensation_scope_unresolved] 员工工资结构生效区间没有可用于授权判断的主小组归属',
      );
    }
    const groupIds = [...new Set(memberships.map((membership) => membership.groupId))];
    const groups = await manager.getRepository(OrganizationGroup).find({
      where: { id: In(groupIds) },
      order: { id: 'ASC' },
    });
    if (groups.length !== groupIds.length) {
      throw new ForbiddenException(
        '[compensation_scope_unresolved] 员工工资结构关联的小组范围不完整',
      );
    }
    await this.assertOrganizationWriteScopes(
      currentUser,
      groups.map((group) => this.groupWriteScope(group)),
      'gov1.compensation.write',
      manager,
    );
  }

  private async assertOrganizationWriteScopes(
    currentUser: CurrentUser,
    scopes: OrganizationWriteScope[],
    permission: GroupOperationsWritePermission,
    manager: EntityManager,
  ): Promise<void> {
    const uniqueScopes = [
      ...new Map(
        scopes.map((scope) => [
          `${scope.companyRef}\u0000${scope.businessSectorRef ?? ''}\u0000${scope.storeRef ?? ''}`,
          scope,
        ]),
      ).values(),
    ];
    if (!uniqueScopes.length) {
      throw new ForbiddenException('[business_scope_missing] 写入命令缺少可授权的组织范围');
    }
    const linkedEmployee = await manager.getRepository(Employee).findOne({
      where: { linkedUserId: currentUser.id, status: 1 },
    });
    if (!linkedEmployee) {
      throw new ForbiddenException(
        '[actor_binding_missing] 组织与工资写入必须绑定有效员工身份',
      );
    }
    const grants = await manager.getRepository(BusinessScopeGrant).find({
      where: {
        userId: currentUser.id,
        employeeId: linkedEmployee.id,
        companyRef: In([...new Set(uniqueScopes.map((scope) => scope.companyRef))]),
        status: 'active',
      },
      order: { id: 'ASC' },
    });
    const now = new Date();
    for (const scope of uniqueScopes) {
      const matchingGrants = grants.filter(
        (grant) =>
          grant.companyRef === scope.companyRef &&
          !grant.customerRef &&
          grant.validFrom <= now &&
          (!grant.validUntil || grant.validUntil >= now) &&
          Array.isArray(grant.permissions) &&
          (grant.permissions.includes('*') || grant.permissions.includes(permission)) &&
          (!grant.businessSectorRef || grant.businessSectorRef === scope.businessSectorRef) &&
          (!grant.storeRef || grant.storeRef === scope.storeRef),
      );
      const scopeGranted = matchingGrants.some((grant) => grant.effect === 'allow');
      const scopeDenied = matchingGrants.some((grant) => grant.effect === 'deny');
      if (scopeDenied) {
        throw new ForbiddenException(
          `[business_scope_denied] 当前人员被明确禁止在 ${scope.companyRef}/${scope.businessSectorRef ?? '*'}/${scope.storeRef ?? '*'} 执行 ${permission}`,
        );
      }
      if (
        !GroupOperationsAccessPolicy.canManageScope(currentUser, {
          scopeGranted,
          scopeDenied,
        })
      ) {
        throw new ForbiddenException(
          `[business_scope_missing] 当前人员未获 ${scope.companyRef}/${scope.businessSectorRef ?? '*'}/${scope.storeRef ?? '*'} 的 ${permission} 授权`,
        );
      }
    }
  }

  private assertManagementWrite(currentUser: CurrentUser) {
    if (!GroupOperationsAccessPolicy.canManage(currentUser)) {
      throw new ForbiddenException(
        '[group_operations_write_denied] 仅经授权的管理角色可变更组织和工资规则',
      );
    }
    if (currentUser.identitySource !== 'trusted_proxy') {
      throw new ForbiddenException(
        '[formal_actor_identity_required] 组织与工资规则写入必须绑定可信代理注入的正式人员身份',
      );
    }
  }

  private assertCommandMetadata(command: {
    reason: string;
    sourceChannel: string;
    correlationId: string;
    idempotencyKey: string;
  }) {
    if (!command.reason?.trim() || command.reason.trim().length > 500) {
      throw new BadRequestException('[command_reason_invalid] 写命令必须提供有效原因');
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{1,49}$/.test(command.sourceChannel?.trim())) {
      throw new BadRequestException('[source_channel_invalid] 写命令来源渠道格式无效');
    }
    const commandKeyPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/;
    if (!commandKeyPattern.test(command.correlationId?.trim())) {
      throw new BadRequestException('[correlation_id_invalid] 关联标识格式无效');
    }
    if (!commandKeyPattern.test(command.idempotencyKey?.trim())) {
      throw new BadRequestException('[idempotency_key_invalid] 幂等键格式无效');
    }
  }

  private assertDateRange(effectiveFrom: string, effectiveTo: string | null) {
    const from = this.normalizeDate(effectiveFrom, 'effectiveFrom');
    const to = effectiveTo ? this.normalizeDate(effectiveTo, 'effectiveTo') : null;
    if (to && to < from) throw new BadRequestException('结束日期不得早于开始日期');
  }

  private normalizeDate(value: string, field: string) {
    const date = value?.slice(0, 10) ?? '';
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) throw new BadRequestException(`[${field}_invalid] 日期格式必须为 YYYY-MM-DD`);
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const normalized = new Date(Date.UTC(year, month - 1, day));
    if (
      year < 2000 ||
      year > 2099 ||
      normalized.getUTCFullYear() !== year ||
      normalized.getUTCMonth() !== month - 1 ||
      normalized.getUTCDate() !== day
    ) {
      throw new BadRequestException(`[${field}_invalid] 日期不是有效的 2000-2099 日历日期`);
    }
    return date;
  }

  private isEffectiveOn(validFrom: Date, validUntil: Date | null, date: string) {
    const from = validFrom.toISOString().slice(0, 10);
    const until = validUntil?.toISOString().slice(0, 10) ?? null;
    return from <= date && (!until || until >= date);
  }

  private isGrantEffectiveAt(validFrom: Date, validUntil: Date | null, instant: Date) {
    const instantMs = instant.getTime();
    return (
      validFrom.getTime() <= instantMs &&
      (!validUntil || validUntil.getTime() >= instantMs)
    );
  }

  private periodBounds(period: string) {
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)) {
      throw new BadRequestException('结算周期格式必须为 YYYY-MM');
    }
    const [year, month] = period.split('-').map(Number);
    const periodStart = `${period}-01`;
    const periodEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    return { periodStart, periodEnd };
  }

  private previousDate(date: string) {
    const value = new Date(`${date}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() - 1);
    return value.toISOString().slice(0, 10);
  }

  private earlierNullableDate(left: string | null, right: string | null) {
    if (left === null) return right;
    if (right === null) return left;
    return left < right ? left : right;
  }

  private derivedIdempotencyKey(source: string, suffix: string) {
    return createHash('sha256').update(`${source}|${suffix}`).digest('hex');
  }

  private organizationGroupCommandPayload(dto: CreateOrganizationGroupDto) {
    return {
      groupCode: dto.groupCode.trim().toLowerCase(),
      groupName: dto.groupName.trim(),
      companyRef: dto.companyRef.trim(),
      businessSectorRef: dto.businessSectorRef?.trim() || null,
      storeRef: dto.storeRef?.trim() || null,
      leaderEmployeeId: dto.leaderEmployeeId ?? null,
      businessOwnerEmployeeId: dto.businessOwnerEmployeeId ?? null,
      establishedAt: dto.establishedAt.slice(0, 10),
      safetyFactorPolicyVersionId: dto.safetyFactorPolicyVersionId.trim(),
      rampUpPolicyVersionId: dto.rampUpPolicyVersionId.trim(),
      reason: dto.reason.trim(),
      sourceChannel: dto.sourceChannel.trim(),
      correlationId: dto.correlationId.trim(),
    };
  }

  private groupMemberCommandPayload(groupId: number, dto: AddGroupMemberDto) {
    return {
      groupId,
      employeeId: dto.employeeId,
      jobLevel: dto.jobLevel,
      roleCode: dto.roleCode.trim().toLowerCase(),
      isPrimary: true,
      effectiveFrom: dto.effectiveFrom.slice(0, 10),
      effectiveTo: dto.effectiveTo?.slice(0, 10) ?? null,
      responsibilityWeightBps: dto.responsibilityWeightBps ?? null,
      costAllocationBps: 10_000,
      reason: dto.reason.trim(),
      sourceChannel: dto.sourceChannel.trim(),
      correlationId: dto.correlationId.trim(),
    };
  }

  private endMemberCommandPayload(memberId: number, dto: EndGroupMemberDto) {
    return {
      memberId,
      effectiveTo: dto.effectiveTo.slice(0, 10),
      reason: dto.reason.trim(),
      sourceChannel: dto.sourceChannel.trim(),
      correlationId: dto.correlationId.trim(),
    };
  }

  private compensationProfileCommandPayload(
    employeeId: number,
    dto: CreateCompensationProfileDto,
    fullyLoadedLaborCostCents: string,
  ) {
    return {
      employeeId,
      baseGuaranteeCents: dto.baseGuaranteeCents,
      positionPerformanceBudgetCents: dto.positionPerformanceBudgetCents,
      employerSocialCostCents: dto.employerSocialCostCents,
      fixedBenefitCostCents: dto.fixedBenefitCostCents,
      benefitCashOffsetCents: dto.benefitCashOffsetCents,
      otherFixedEmploymentCostCents: dto.otherFixedEmploymentCostCents,
      fullyLoadedLaborCostCents,
      currency: dto.currency,
      effectiveFrom: dto.effectiveFrom.slice(0, 10),
      effectiveTo: dto.effectiveTo?.slice(0, 10) ?? null,
      benefitRuleVersionId: dto.benefitRuleVersionId?.trim() || null,
      reason: dto.reason.trim(),
      sourceChannel: dto.sourceChannel.trim(),
      correlationId: dto.correlationId.trim(),
    };
  }

  private targetPolicyCommandPayload(groupId: number, dto: CreateGroupTargetPolicyDto) {
    return {
      groupId,
      ...GroupOperationsInvariants.targetPolicyCommandPayload(dto),
    };
  }

  private targetCalculationInput(
    groupId: number,
    dto: CalculateGroupTargetDto,
    policy: GroupTargetPolicyVersion,
  ) {
    return {
      command: GroupOperationsInvariants.targetCommandPayload(groupId, dto),
      policy: {
        id: policy.id,
        policyVersionId: policy.policyVersionId,
        version: policy.version,
        settlementPeriod: policy.settlementPeriod,
        safetyFactorBps: policy.safetyFactorBps,
        rampFactorBps: policy.rampFactorBps,
        standardPayrollDays: policy.standardPayrollDays,
        safetyFactorPolicyVersionId: policy.safetyFactorPolicyVersionId,
        rampUpPolicyVersionId: policy.rampUpPolicyVersionId,
        calendarRuleVersionId: policy.calendarRuleVersionId,
        payrollCalendarRuleId: policy.payrollCalendarRuleId,
        payrollDateSetHash: policy.payrollDateSetHash,
        currency: policy.currency,
      },
    };
  }

  private async audit(
    targetId: number,
    action: string,
    currentUser: CurrentUser,
    command: { reason: string; sourceChannel: string; correlationId: string; idempotencyKey: string },
    manager: EntityManager,
    detail: Record<string, unknown>,
  ) {
    await this.operationLogsService.create(
      {
        module: 'group_operations',
        targetId,
        action,
        operatorId: currentUser.id,
        detail: command.reason.trim(),
        detailJson: {
          ...detail,
          reason: command.reason.trim(),
          sourceChannel: command.sourceChannel.trim(),
          correlationId: command.correlationId.trim(),
          idempotencyKey: command.idempotencyKey.trim(),
          actorIdentitySource: currentUser.identitySource ?? null,
        },
      },
      manager,
    );
  }
}
