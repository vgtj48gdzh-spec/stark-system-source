import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PayrollTrialRunStatus } from '../../../shared/enums/payroll-trial-run-status.enum';
import { PayrollTrialItem } from './payroll-trial-item.entity';
import { PayrollTrialItemDetail } from './payroll-trial-item-detail.entity';

@Entity('payroll_trial_runs')
export class PayrollTrialRun {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'period_key', type: 'varchar', length: 20 })
  periodKey!: string;

  @Column({ name: 'batch_no', type: 'varchar', length: 100 })
  batchNo!: string;

  @Column({ name: 'force_regenerate', type: 'tinyint', width: 1, default: 0 })
  forceRegenerate!: boolean;

  @Column({ name: 'run_status', type: 'enum', enum: PayrollTrialRunStatus })
  runStatus!: PayrollTrialRunStatus;

  @Column({ name: 'source_summary_count', type: 'int', default: 0 })
  sourceSummaryCount!: number;

  @Column({ name: 'source_event_count', type: 'int', default: 0 })
  sourceEventCount!: number;

  @Column({ name: 'created_item_count', type: 'int', default: 0 })
  createdItemCount!: number;

  @Column({ name: 'updated_item_count', type: 'int', default: 0 })
  updatedItemCount!: number;

  @Column({ name: 'processed_item_count', type: 'int', default: 0 })
  processedItemCount!: number;

  @Column({ name: 'error_message', type: 'varchar', length: 1000, nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'normalized_payload', type: 'json' })
  normalizedPayload!: Record<string, unknown>;

  @Column({ name: 'started_at', type: 'datetime' })
  startedAt!: Date;

  @Column({ name: 'finished_at', type: 'datetime', nullable: true })
  finishedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => PayrollTrialItem, (item) => item.payrollTrialRun)
  items!: PayrollTrialItem[];

  @OneToMany(() => PayrollTrialItemDetail, (detail) => detail.payrollTrialRun)
  details!: PayrollTrialItemDetail[];
}
