import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PayrollTrialDetailType } from '../../../shared/enums/payroll-trial-detail-type.enum';
import { RewardSummaryDomain } from '../../../shared/enums/reward-summary-domain.enum';
import { Employee } from '../../performance/entities/employee.entity';
import { PayrollTrialItem } from './payroll-trial-item.entity';
import { PayrollTrialRun } from './payroll-trial-run.entity';

@Entity('payroll_trial_item_details')
export class PayrollTrialItemDetail {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'payroll_trial_item_id', type: 'int' })
  payrollTrialItemId!: number;

  @Column({ name: 'payroll_trial_run_id', type: 'int' })
  payrollTrialRunId!: number;

  @Column({ name: 'detail_type', type: 'enum', enum: PayrollTrialDetailType })
  detailType!: PayrollTrialDetailType;

  @Column({ name: 'source_system', type: 'varchar', length: 50 })
  sourceSystem!: string;

  @Column({ name: 'source_table', type: 'varchar', length: 100 })
  sourceTable!: string;

  @Column({ name: 'source_id', type: 'varchar', length: 100 })
  sourceId!: string;

  @Column({ name: 'source_order_no', type: 'varchar', length: 100, nullable: true })
  sourceOrderNo!: string | null;

  @Column({ name: 'source_record_id', type: 'int', nullable: true })
  sourceRecordId!: number | null;

  @Column({ name: 'employee_id', type: 'int', nullable: true })
  employeeId!: number | null;

  @Column({ name: 'period_key', type: 'varchar', length: 20 })
  periodKey!: string;

  @Column({ name: 'summary_domain', type: 'enum', enum: RewardSummaryDomain })
  summaryDomain!: RewardSummaryDomain;

  @Column({ name: 'amount_standard', type: 'decimal', precision: 18, scale: 2, nullable: true })
  amountStandard!: string | null;

  @Column({ name: 'quantity_standard', type: 'decimal', precision: 18, scale: 2, nullable: true })
  quantityStandard!: string | null;

  @Column({ name: 'reward_points', type: 'decimal', precision: 18, scale: 2, default: '0.00' })
  rewardPoints!: string;

  @Column({ name: 'reward_amount', type: 'decimal', precision: 18, scale: 2, default: '0.00' })
  rewardAmount!: string;

  @Column({ name: 'calculated_amount', type: 'decimal', precision: 18, scale: 2, default: '0.00' })
  calculatedAmount!: string;

  @Column({ name: 'pending_flag', type: 'tinyint', width: 1, default: 0 })
  pendingFlag!: boolean;

  @Column({ name: 'ignored_flag', type: 'tinyint', width: 1, default: 0 })
  ignoredFlag!: boolean;

  @Column({ name: 'included_flag', type: 'tinyint', width: 1, default: 0 })
  includedFlag!: boolean;

  @Column({ name: 'included_reason', type: 'varchar', length: 500, nullable: true })
  includedReason!: string | null;

  @Column({ name: 'excluded_reason', type: 'varchar', length: 500, nullable: true })
  excludedReason!: string | null;

  @Column({ name: 'matched_rule', type: 'varchar', length: 100, nullable: true })
  matchedRule!: string | null;

  @Column({ name: 'rule_strength', type: 'varchar', length: 20, nullable: true })
  ruleStrength!: string | null;

  @Column({ name: 'evidence_status', type: 'varchar', length: 20, nullable: true })
  evidenceStatus!: string | null;

  @Column({ name: 'occurred_at', type: 'datetime' })
  occurredAt!: Date;

  @Column({ name: 'normalized_payload', type: 'json' })
  normalizedPayload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => PayrollTrialItem, (item) => item.details)
  @JoinColumn({ name: 'payroll_trial_item_id' })
  payrollTrialItem!: PayrollTrialItem;

  @ManyToOne(() => PayrollTrialRun, (run) => run.details)
  @JoinColumn({ name: 'payroll_trial_run_id' })
  payrollTrialRun!: PayrollTrialRun;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee | null;
}
