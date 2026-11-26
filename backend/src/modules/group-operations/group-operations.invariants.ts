import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  CalculateGroupTargetDto,
  CompensationProfilePayrollDaysDto,
  CreateGroupTargetPolicyDto,
  CreatePayrollCalendarRuleDto,
} from './dto/group-operations.dto';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface CompensationProfileCoverageInput {
  id: number;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface CompensationProfileCoverageSegment<T extends CompensationProfileCoverageInput> {
  profile: T;
  clippedEffectiveFrom: string;
  clippedEffectiveTo: string;
  payrollDayCapacity: number;
  activePayrollDays: number;
}

export class GroupOperationsInvariants {
  static assertReplayPayload(
    actual: Record<string, unknown>,
    expected: Record<string, unknown>,
    subject: string,
  ): void {
    if (this.canonicalJson(actual) !== this.canonicalJson(expected)) {
      throw new ConflictException(
        `[idempotency_payload_mismatch] 幂等键对应不同${subject}请求载荷`,
      );
    }
  }

  static payloadFingerprint(payload: Record<string, unknown>): string {
    return createHash('sha256').update(this.canonicalJson(payload), 'utf8').digest('hex');
  }

  static assertReplayFingerprint(
    actualFingerprint: string,
    expectedPayload: Record<string, unknown>,
    subject: string,
  ): void {
    if (
      !/^[a-f0-9]{64}$/.test(actualFingerprint) ||
      actualFingerprint !== this.payloadFingerprint(expectedPayload)
    ) {
      throw new ConflictException(
        `[idempotency_payload_mismatch] 幂等键对应不同${subject}请求载荷`,
      );
    }
  }

  static targetCommandPayload(
    groupId: number,
    dto: CalculateGroupTargetDto,
  ): Record<string, unknown> {
    return {
      groupId,
      settlementPeriod: dto.settlementPeriod,
      targetPolicyVersionId: dto.targetPolicyVersionId.trim(),
      reason: dto.reason.trim(),
      sourceChannel: dto.sourceChannel.trim(),
      correlationId: dto.correlationId.trim(),
      members: dto.members
        .map((member) => {
          const canonicalMember: {
            groupMemberId: number;
            employeeId: number;
            activePayrollDays: number;
            profileSegments?: Array<{
              compensationProfileId: number;
              activePayrollDays: number;
            }>;
          } = {
            groupMemberId: member.groupMemberId,
            employeeId: member.employeeId,
            activePayrollDays: member.activePayrollDays,
          };
          // Keep omitted segments absent so pre-segmentation idempotency fingerprints remain valid.
          if (member.profileSegments !== undefined) {
            canonicalMember.profileSegments = member.profileSegments
              .map((segment) => ({
                compensationProfileId: segment.compensationProfileId,
                activePayrollDays: segment.activePayrollDays,
              }))
              .sort(
                (left, right) =>
                  left.compensationProfileId - right.compensationProfileId,
              );
          }
          return canonicalMember;
        })
        .sort(
          (left, right) =>
            left.groupMemberId - right.groupMemberId || left.employeeId - right.employeeId,
        ),
    };
  }

  static targetPolicyCommandPayload(dto: CreateGroupTargetPolicyDto): Record<string, unknown> {
    return {
      settlementPeriod: dto.settlementPeriod,
      policyVersionId: dto.policyVersionId.trim(),
      safetyFactorBps: dto.safetyFactorBps,
      rampFactorBps: dto.rampFactorBps,
      standardPayrollDays: dto.standardPayrollDays,
      safetyFactorPolicyVersionId: dto.safetyFactorPolicyVersionId.trim(),
      rampUpPolicyVersionId: dto.rampUpPolicyVersionId.trim(),
      calendarRuleVersionId: dto.calendarRuleVersionId.trim(),
      currency: dto.currency,
      reason: dto.reason.trim(),
      sourceChannel: dto.sourceChannel.trim(),
      correlationId: dto.correlationId.trim(),
    };
  }

  static payrollCalendarRuleCommandPayload(
    dto: CreatePayrollCalendarRuleDto,
  ): Record<string, unknown> {
    return {
      companyRef: dto.companyRef.trim(),
      settlementPeriod: dto.settlementPeriod,
      calendarRuleVersionId: dto.calendarRuleVersionId.trim(),
      payrollDates: this.normalizePayrollDates(dto.settlementPeriod, dto.payrollDates),
      reason: dto.reason.trim(),
      sourceChannel: dto.sourceChannel.trim(),
      correlationId: dto.correlationId.trim(),
    };
  }

  static normalizePayrollDates(settlementPeriod: string, payrollDates: string[]): string[] {
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(settlementPeriod)) {
      throw new BadRequestException('[payroll_calendar_period_invalid] 计薪日历周期必须为 YYYY-MM');
    }
    if (!Array.isArray(payrollDates) || payrollDates.length < 1 || payrollDates.length > 31) {
      throw new BadRequestException('[payroll_calendar_dates_invalid] 计薪日期必须包含 1 至 31 个日期');
    }
    const normalized = payrollDates.map((value) => String(value).trim()).sort();
    if (new Set(normalized).size !== normalized.length) {
      throw new BadRequestException('[payroll_calendar_dates_duplicate] 计薪日期不得重复');
    }
    for (const date of normalized) {
      const parsed = new Date(`${date}T00:00:00.000Z`);
      if (
        !/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date) ||
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== date ||
        !date.startsWith(`${settlementPeriod}-`)
      ) {
        throw new BadRequestException(
          `[payroll_calendar_date_out_of_period] 日期 ${date} 不是当期有效计薪日`,
        );
      }
    }
    return normalized;
  }

  static payrollDateSetHash(settlementPeriod: string, payrollDates: string[]): string {
    return this.payloadFingerprint({
      settlementPeriod,
      payrollDates: this.normalizePayrollDates(settlementPeriod, payrollDates),
    });
  }

  static assertPayrollCalendarIntegrity(
    settlementPeriod: string,
    payrollDates: string[],
    standardPayrollDays: number,
    expectedHash: string,
  ): string[] {
    const normalized = this.normalizePayrollDates(settlementPeriod, payrollDates);
    if (
      !Number.isInteger(standardPayrollDays) ||
      standardPayrollDays <= 0 ||
      normalized.length !== standardPayrollDays
    ) {
      throw new BadRequestException(
        '[payroll_calendar_standard_days_mismatch] 标准计薪天数必须等于权威计薪日期数量',
      );
    }
    if (
      !/^[a-f0-9]{64}$/.test(expectedHash) ||
      this.payrollDateSetHash(settlementPeriod, normalized) !== expectedHash
    ) {
      throw new BadRequestException(
        '[payroll_calendar_integrity_failed] 计薪日期集合与冻结哈希不一致',
      );
    }
    return normalized;
  }

  static assertCny(currency: string): asserts currency is 'CNY' {
    if (currency !== 'CNY') {
      throw new BadRequestException(
        '[currency_not_supported] GOV1-S1 仅允许 CNY，禁止跨币种按整数分直接汇总',
      );
    }
  }

  static assertBenefitCashOffsetDisabled(
    benefitCashOffsetCents: string,
    benefitRuleVersionId?: string | null,
  ): void {
    if (benefitCashOffsetCents !== '0' || benefitRuleVersionId?.trim()) {
      throw new BadRequestException(
        '[benefit_cash_offset_not_enabled] GOV1-S1 尚未接入可核验福利规则权威，现金福利抵扣必须为 0 且不得伪装规则版本',
      );
    }
  }

  static membershipPayrollDayCapacity(
    effectiveFrom: string,
    effectiveTo: string | null,
    periodStart: string,
    periodEnd: string,
    payrollDates: string[],
  ): number {
    const activeFrom = effectiveFrom > periodStart ? effectiveFrom : periodStart;
    const activeTo = effectiveTo && effectiveTo < periodEnd ? effectiveTo : periodEnd;
    if (activeTo < activeFrom) return 0;
    return payrollDates.filter((date) => date >= activeFrom && date <= activeTo).length;
  }

  static assertEmployeePayrollDays(
    employeeId: number,
    currentGroupDays: number,
    otherGroupDays: number,
    standardPayrollDays: number,
  ): void {
    if (
      !Number.isInteger(currentGroupDays) ||
      !Number.isInteger(otherGroupDays) ||
      currentGroupDays < 0 ||
      otherGroupDays < 0 ||
      currentGroupDays + otherGroupDays > standardPayrollDays
    ) {
      throw new BadRequestException(
        `[employee_payroll_days_overallocated] 员工 ${employeeId} 当月跨组有效计薪天数超过标准计薪天数`,
      );
    }
  }

  static assertPositiveCalculatedTarget(
    groupFixedLaborCostCents: string,
    breakEvenTargetCents: string,
  ): void {
    if (BigInt(groupFixedLaborCostCents) <= 0n || BigInt(breakEvenTargetCents) <= 0n) {
      throw new BadRequestException(
        '[zero_target_calculation_blocked] 人工成本或经营保底为零时不得生成 calculated 目标',
      );
    }
  }

  static compensationProfileCoverage<T extends CompensationProfileCoverageInput>(
    profiles: T[],
    activeFrom: string,
    activeTo: string,
    payrollDates: string[],
  ): Array<Omit<CompensationProfileCoverageSegment<T>, 'activePayrollDays'>> {
    if (activeTo < activeFrom) {
      throw new BadRequestException('[compensation_profile_period_invalid] 工资结构覆盖区间无效');
    }
    const overlapping = profiles
      .filter(
        (profile) =>
          profile.effectiveFrom <= activeTo &&
          (profile.effectiveTo === null || profile.effectiveTo >= activeFrom),
      )
      .sort(
        (left, right) =>
          left.effectiveFrom.localeCompare(right.effectiveFrom) ||
          (left.effectiveTo ?? '9999-12-31').localeCompare(
            right.effectiveTo ?? '9999-12-31',
          ) ||
          left.id - right.id,
      );
    if (!overlapping.length) {
      throw new BadRequestException('[compensation_profile_missing] 未找到有效工资结构');
    }
    const result: Array<Omit<CompensationProfileCoverageSegment<T>, 'activePayrollDays'>> = [];
    let expectedFrom = activeFrom;
    for (const profile of overlapping) {
      const clippedEffectiveFrom =
        profile.effectiveFrom > activeFrom ? profile.effectiveFrom : activeFrom;
      const profileEnd = profile.effectiveTo ?? activeTo;
      const clippedEffectiveTo = profileEnd < activeTo ? profileEnd : activeTo;
      if (clippedEffectiveFrom > expectedFrom) {
        throw new BadRequestException(
          `[compensation_profile_gap] 工资结构在 ${expectedFrom} 至 ${this.previousDate(clippedEffectiveFrom)} 存在空档`,
        );
      }
      if (clippedEffectiveFrom < expectedFrom) {
        throw new BadRequestException(
          `[compensation_profile_overlap] 工资结构 ${profile.id} 与前一版本存在重叠`,
        );
      }
      result.push({
        profile,
        clippedEffectiveFrom,
        clippedEffectiveTo,
        payrollDayCapacity: this.membershipPayrollDayCapacity(
          clippedEffectiveFrom,
          clippedEffectiveTo,
          clippedEffectiveFrom,
          clippedEffectiveTo,
          payrollDates,
        ),
      });
      expectedFrom = this.nextDate(clippedEffectiveTo);
    }
    if (expectedFrom <= activeTo) {
      throw new BadRequestException(
        `[compensation_profile_gap] 工资结构在 ${expectedFrom} 至 ${activeTo} 存在空档`,
      );
    }
    return result;
  }

  static resolveCompensationProfilePayrollDays<T extends CompensationProfileCoverageInput>(
    coverage: Array<Omit<CompensationProfileCoverageSegment<T>, 'activePayrollDays'>>,
    submitted: CompensationProfilePayrollDaysDto[] | undefined,
    memberActivePayrollDays: number,
  ): CompensationProfileCoverageSegment<T>[] {
    if (!coverage.length) {
      throw new BadRequestException('[compensation_profile_missing] 未找到有效工资结构');
    }
    if (!Number.isInteger(memberActivePayrollDays) || memberActivePayrollDays < 0) {
      throw new BadRequestException('[active_payroll_days_invalid] 有效计薪天数必须是非负整数');
    }
    const authoritativeTotal = coverage.reduce(
      (sum, segment) => sum + segment.payrollDayCapacity,
      0,
    );
    if (authoritativeTotal !== memberActivePayrollDays) {
      throw new BadRequestException(
        '[active_payroll_days_calendar_mismatch] 成员计薪天数必须等于权威日历与生效区间的交集',
      );
    }
    if (submitted === undefined) {
      return coverage.map((segment) => ({
        ...segment,
        activePayrollDays: segment.payrollDayCapacity,
      }));
    }
    if (!submitted.length) {
      throw new BadRequestException('[compensation_profile_days_scope_mismatch] 分段声明不得为空');
    }
    const submittedByProfile = new Map<number, number>();
    for (const segment of submitted) {
      if (submittedByProfile.has(segment.compensationProfileId)) {
        throw new BadRequestException(
          '[compensation_profile_days_duplicate] 同一工资结构只能提交一次计薪天数',
        );
      }
      if (!Number.isInteger(segment.activePayrollDays) || segment.activePayrollDays < 0) {
        throw new BadRequestException(
          '[compensation_profile_days_invalid] 工资结构计薪天数必须是非负整数',
        );
      }
      submittedByProfile.set(segment.compensationProfileId, segment.activePayrollDays);
    }
    const coverageIds = new Set(coverage.map((segment) => segment.profile.id));
    if (
      submittedByProfile.size !== coverage.length ||
      [...submittedByProfile.keys()].some((profileId) => !coverageIds.has(profileId))
    ) {
      throw new BadRequestException(
        '[compensation_profile_days_scope_mismatch] 工资结构计薪天数必须与有效结构一一对应',
      );
    }
    const resolved = coverage.map((segment) => {
      const activePayrollDays = submittedByProfile.get(segment.profile.id)!;
      if (activePayrollDays !== segment.payrollDayCapacity) {
        throw new BadRequestException(
          `[compensation_profile_days_calendar_mismatch] 工资结构 ${segment.profile.id} 计薪天数必须等于权威日历派生值 ${segment.payrollDayCapacity}`,
        );
      }
      return { ...segment, activePayrollDays };
    });
    return resolved;
  }

  private static nextDate(date: string): string {
    const value = new Date(`${date}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + 1);
    return value.toISOString().slice(0, 10);
  }

  private static previousDate(date: string): string {
    const value = new Date(`${date}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() - 1);
    return value.toISOString().slice(0, 10);
  }

  private static canonicalJson(value: unknown): string {
    return JSON.stringify(this.canonicalize(value));
  }

  private static canonicalize(value: unknown): JsonValue {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new BadRequestException('请求载荷包含非有限数字');
      return value;
    }
    if (Array.isArray(value)) return value.map((item) => this.canonicalize(item));
    if (typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, nested]) => [key, this.canonicalize(nested)]),
      );
    }
    throw new BadRequestException('请求载荷包含不支持的值类型');
  }
}
