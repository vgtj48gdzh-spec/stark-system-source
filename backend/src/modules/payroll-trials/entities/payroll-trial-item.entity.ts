import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RewardSummaryDomain } from '../../../shared/enums/reward-summary-domain.enum';
import { Employee } from '../../performance/entities/employee.entity';
import { User } from '../../users/entities/user.entity';
import { PayrollTrialRun } from './payroll-trial-run.entity';
import { PayrollTrialItemDetail } from './payroll-trial-item-detail.entity';

@Entity('payroll_trial_items')
export class PayrollTrialItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'trial_key', type: 'varchar', length: 255 })
  trialKey!: string;

  @Column({ name: 'payroll_trial_run_id', type: 'int' })
  payrollTrialRunId!: number;

  @Column({ name: 'employee_id', type: 'int', nullable: true })
  employeeId!: number | null;

  @Column({ name: 'period_key', type: 'varchar', length: 20 })
  periodKey!: string;

  @Column({ name: 'summary_domain', type: 'enum', enum: RewardSummaryDomain })
  summaryDomain!: RewardSummaryDomain;

  @Column({ name: 'source_summary_count', type: 'int', default: 0 })
  sourceSummaryCount!: number;

  @Column({ name: 'source_event_count', type: 'int', default: 0 })
  sourceEventCount!: number;

  @Column({ name: 'reward_amount_total', type: 'decimal', precision: 18, scale: 2, default: '0.00' })
  rewardAmountTotal!: string;

  @Column({ name: 'reward_points_total', type: 'decimal', precision: 18, scale: 2, default: '0.00' })
  rewardPointsTotal!: string;

  @Column({ name: 'pending_count', type: 'int', default: 0 })
  pendingCount!: number;

  @Column({ name: 'ignored_count', type: 'int', default: 0 })
  ignoredCount!: number;

  @Column({ name: 'calculated_total', type: 'decimal', precision: 18, scale: 2, default: '0.00' })
  calculatedTotal!: string;

  @Column({ name: 'confirmed_flag', type: 'tinyint', width: 1, default: 0 })
  confirmedFlag!: boolean;

  @Column({ name: 'confirmed_by', type: 'int', nullable: true })
  confirmedBy!: number | null;

  @Column({ name: 'confirmed_at', type: 'datetime', nullable: true })
  confirmedAt!: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'normalized_payload', type: 'json' })
  normalizedPayload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => PayrollTrialRun, (run) => run.items)
  @JoinColumn({ name: 'payroll_trial_run_id' })
  payrollTrialRun!: PayrollTrialRun;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'confirmed_by' })
  confirmedByUser!: User | null;

  @OneToMany(() => PayrollTrialItemDetail, (detail) => detail.payrollTrialItem)
  details!: PayrollTrialItemDetail[];
}
