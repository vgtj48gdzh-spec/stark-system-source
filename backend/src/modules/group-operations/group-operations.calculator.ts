import { BadRequestException } from '@nestjs/common';

export const BASIS_POINTS_SCALE = 10_000n;
export const MONEY_ROUNDING_MODE = 'HALF_UP' as const;
const MYSQL_SIGNED_BIGINT_MAX = 9_223_372_036_854_775_807n;

export interface LaborCostComponents {
  baseGuaranteeCents: string;
  positionPerformanceBudgetCents: string;
  employerSocialCostCents: string;
  fixedBenefitCostCents: string;
  otherFixedEmploymentCostCents: string;
}

export interface GroupTargetCalculationInput {
  groupFixedLaborCostCents: string;
  safetyFactorBps: number;
  rampFactorBps: number;
}

export type GroupOperatingStatus =
  | 'excellent'
  | 'achieved'
  | 'warning'
  | 'severe_warning'
  | 'business_failure';

export interface GroupAchievementResult {
  achievementRateBps: string;
  operatingStatus: GroupOperatingStatus;
  excessMarginCents: string;
  rewardGateOpen: boolean;
}

export class GroupOperationsCalculator {
  static fullyLoadedLaborCost(components: LaborCostComponents): string {
    const values = [
      this.parseNonNegativeCents(components.baseGuaranteeCents, 'baseGuaranteeCents'),
      this.parseNonNegativeCents(
        components.positionPerformanceBudgetCents,
        'positionPerformanceBudgetCents',
      ),
      this.parseNonNegativeCents(components.employerSocialCostCents, 'employerSocialCostCents'),
      this.parseNonNegativeCents(components.fixedBenefitCostCents, 'fixedBenefitCostCents'),
      this.parseNonNegativeCents(
        components.otherFixedEmploymentCostCents,
        'otherFixedEmploymentCostCents',
      ),
    ];
    return this.assertDatabaseRange(
      values.reduce((sum, value) => sum + value, 0n),
      'fullyLoadedLaborCostCents',
    ).toString();
  }

  static proratedLaborCost(
    fullyLoadedLaborCostCents: string,
    activePayrollDays: number,
    standardPayrollDays: number,
  ): string {
    const fullCost = this.parseNonNegativeCents(
      fullyLoadedLaborCostCents,
      'fullyLoadedLaborCostCents',
    );
    this.assertPayrollDays(activePayrollDays, standardPayrollDays);
    return this.assertDatabaseRange(
      this.divideHalfUp(fullCost * BigInt(activePayrollDays), BigInt(standardPayrollDays)),
      'proratedLaborCostCents',
    ).toString();
  }

  static allocateLaborCost(proratedLaborCostCents: string, allocationBps: number): string {
    const cost = this.parseNonNegativeCents(proratedLaborCostCents, 'proratedLaborCostCents');
    this.assertBasisPoints(allocationBps, 'allocationBps', false);
    return this.assertDatabaseRange(
      this.divideHalfUp(cost * BigInt(allocationBps), BASIS_POINTS_SCALE),
      'allocatedLaborCostCents',
    ).toString();
  }

  static groupBreakEvenTarget(input: GroupTargetCalculationInput): string {
    const cost = this.parseNonNegativeCents(
      input.groupFixedLaborCostCents,
      'groupFixedLaborCostCents',
    );
    this.assertBasisPoints(input.safetyFactorBps, 'safetyFactorBps', true, 100_000);
    this.assertBasisPoints(input.rampFactorBps, 'rampFactorBps', true);

    return this.assertDatabaseRange(
      this.divideHalfUp(
        cost * BigInt(input.safetyFactorBps) * BigInt(input.rampFactorBps),
        BASIS_POINTS_SCALE * BASIS_POINTS_SCALE,
      ),
      'breakEvenTargetCents',
    ).toString();
  }

  static marginalTarget(
    fullyLoadedLaborCostCents: string,
    safetyFactorBps: number,
    rampFactorBps = 10_000,
  ): string {
    return this.groupBreakEvenTarget({
      groupFixedLaborCostCents: fullyLoadedLaborCostCents,
      safetyFactorBps,
      rampFactorBps,
    });
  }

  static groupAchievement(
    validContributionMarginCents: string,
    breakEvenTargetCents: string,
  ): GroupAchievementResult {
    const margin = this.parseSignedCents(
      validContributionMarginCents,
      'validContributionMarginCents',
    );
    const target = this.parseNonNegativeCents(
      breakEvenTargetCents,
      'breakEvenTargetCents',
    );
    if (target === 0n) {
      throw new BadRequestException(
        '[break_even_target_zero] 经营保底为 0 时完成率必须保持计算阻断',
      );
    }

    const achievementRateBps = this.divideSignedHalfAwayFromZero(
      margin * BASIS_POINTS_SCALE,
      target,
    );
    const operatingStatus: GroupOperatingStatus =
      achievementRateBps >= 12_000n
        ? 'excellent'
        : achievementRateBps >= 10_000n
          ? 'achieved'
          : achievementRateBps >= 8_000n
            ? 'warning'
            : achievementRateBps >= 5_000n
              ? 'severe_warning'
              : 'business_failure';

    return {
      achievementRateBps: achievementRateBps.toString(),
      operatingStatus,
      excessMarginCents: (margin > target ? margin - target : 0n).toString(),
      rewardGateOpen: achievementRateBps >= 10_000n,
    };
  }

  static sumCents(values: string[]): string {
    return this.assertDatabaseRange(
      values
      .map((value, index) => this.parseNonNegativeCents(value, `values[${index}]`))
        .reduce((sum, value) => sum + value, 0n),
      'summedCents',
    ).toString();
  }

  static assertPayrollDays(activePayrollDays: number, standardPayrollDays: number): void {
    if (!Number.isInteger(standardPayrollDays) || standardPayrollDays <= 0) {
      throw new BadRequestException(
        '[standard_payroll_days_invalid] 标准计薪天数必须是大于 0 的整数',
      );
    }
    if (
      !Number.isInteger(activePayrollDays) ||
      activePayrollDays < 0 ||
      activePayrollDays > standardPayrollDays
    ) {
      throw new BadRequestException(
        '[active_payroll_days_invalid] 有效计薪天数必须在 0 到标准计薪天数之间',
      );
    }
  }

  static assertBasisPoints(
    value: number,
    field: string,
    requirePositive: boolean,
    maximum = 10_000,
  ): void {
    const minimum = requirePositive ? 1 : 0;
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new BadRequestException(
        `[${field}_invalid] ${field} 必须是 ${minimum} 到 ${maximum} 的整数基点`,
      );
    }
  }

  static parseNonNegativeCents(value: string, field: string): bigint {
    if (!/^(0|[1-9]\d*)$/.test(value)) {
      throw new BadRequestException(
        `[${field}_invalid] ${field} 必须是非负整数分字符串，禁止浮点金额`,
      );
    }
    return this.assertDatabaseRange(BigInt(value), field);
  }

  static parseSignedCents(value: string, field: string): bigint {
    if (!/^-?(0|[1-9]\d*)$/.test(value) || value === '-0') {
      throw new BadRequestException(
        `[${field}_invalid] ${field} 必须是整数分字符串，禁止浮点金额`,
      );
    }
    const parsed = BigInt(value);
    if (parsed < -MYSQL_SIGNED_BIGINT_MAX || parsed > MYSQL_SIGNED_BIGINT_MAX) {
      throw new BadRequestException(`[${field}_out_of_range] ${field} 超出数据库整数金额范围`);
    }
    return parsed;
  }

  private static assertDatabaseRange(value: bigint, field: string): bigint {
    if (value < 0n || value > MYSQL_SIGNED_BIGINT_MAX) {
      throw new BadRequestException(`[${field}_out_of_range] ${field} 超出数据库整数金额范围`);
    }
    return value;
  }

  private static divideHalfUp(numerator: bigint, denominator: bigint): bigint {
    if (denominator <= 0n) {
      throw new BadRequestException('[division_denominator_invalid] 计算分母必须大于 0');
    }
    const quotient = numerator / denominator;
    const remainder = numerator % denominator;
    return remainder * 2n >= denominator ? quotient + 1n : quotient;
  }

  private static divideSignedHalfAwayFromZero(
    numerator: bigint,
    denominator: bigint,
  ): bigint {
    if (denominator <= 0n) {
      throw new BadRequestException('[division_denominator_invalid] 计算分母必须大于 0');
    }
    const quotient = numerator / denominator;
    const remainder = numerator % denominator;
    if (
      remainder === 0n ||
      (remainder < 0n ? -remainder : remainder) * 2n < denominator
    ) {
      return quotient;
    }
    return quotient + (numerator < 0n ? -1n : 1n);
  }
}
