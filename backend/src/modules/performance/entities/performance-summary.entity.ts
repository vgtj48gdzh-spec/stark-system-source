import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PerformanceEventSourceDomain } from '../../../shared/enums/performance-event-source-domain.enum';
import { Employee } from './employee.entity';
import { PerformancePeriod } from './performance-period.entity';

@Entity('performance_summaries')
export class PerformanceSummary {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'performance_period_id', type: 'int' })
  performancePeriodId!: number;

  @Column({ name: 'employee_id', type: 'int' })
  employeeId!: number;

  @Column({
    name: 'source_domain',
    type: 'enum',
    enum: PerformanceEventSourceDomain,
  })
  sourceDomain!: PerformanceEventSourceDomain;

  @Column({ name: 'event_count', type: 'int', default: 0 })
  eventCount!: number;

  @Column({ name: 'confirmed_event_count', type: 'int', default: 0 })
  confirmedEventCount!: number;

  @Column({ name: 'pending_event_count', type: 'int', default: 0 })
  pendingEventCount!: number;

  @Column({ name: 'amount_total', type: 'decimal', precision: 18, scale: 2, default: '0.00' })
  amountTotal!: string;

  @Column({ name: 'quantity_total', type: 'decimal', precision: 18, scale: 2, default: '0.00' })
  quantityTotal!: string;

  @Column({ name: 'normalized_payload', type: 'json' })
  normalizedPayload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => PerformancePeriod, (performancePeriod) => performancePeriod.summaries)
  @JoinColumn({ name: 'performance_period_id' })
  performancePeriod!: PerformancePeriod;

  @ManyToOne(() => Employee, (employee) => employee.performanceSummaries)
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;
}
