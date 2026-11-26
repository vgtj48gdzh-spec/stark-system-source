import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PerformancePeriodStatus } from '../../../shared/enums/performance-period-status.enum';
import { PerformancePeriodType } from '../../../shared/enums/performance-period-type.enum';
import { PerformanceSummary } from './performance-summary.entity';

@Entity('performance_periods')
export class PerformancePeriod {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    name: 'period_type',
    type: 'enum',
    enum: PerformancePeriodType,
    default: PerformancePeriodType.MONTHLY,
  })
  periodType!: PerformancePeriodType;

  @Column({ name: 'period_key', type: 'varchar', length: 20 })
  periodKey!: string;

  @Column({ name: 'period_start', type: 'date' })
  periodStart!: string;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd!: string;

  @Column({
    type: 'enum',
    enum: PerformancePeriodStatus,
    default: PerformancePeriodStatus.OPEN,
  })
  status!: PerformancePeriodStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => PerformanceSummary, (summary) => summary.performancePeriod)
  summaries!: PerformanceSummary[];
}
