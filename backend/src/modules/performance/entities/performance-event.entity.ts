import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PerformanceEventSourceDomain } from '../../../shared/enums/performance-event-source-domain.enum';
import { PerformanceHandlingAction } from '../../../shared/enums/performance-handling-action.enum';
import { User } from '../../users/entities/user.entity';
import { Employee } from './employee.entity';
import { PerformanceEventClassification } from './performance-event-classification.entity';

@Entity('performance_events')
export class PerformanceEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'employee_id', type: 'int', nullable: true })
  employeeId!: number | null;

  @Column({
    name: 'source_domain',
    type: 'enum',
    enum: PerformanceEventSourceDomain,
  })
  sourceDomain!: PerformanceEventSourceDomain;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType!: string;

  @Column({ name: 'source_system', type: 'varchar', length: 50 })
  sourceSystem!: string;

  @Column({ name: 'source_table', type: 'varchar', length: 100 })
  sourceTable!: string;

  @Column({ name: 'source_id', type: 'varchar', length: 100 })
  sourceId!: string;

  @Column({ name: 'source_order_no', type: 'varchar', length: 100, nullable: true })
  sourceOrderNo!: string | null;

  @Column({ name: 'amount_standard', type: 'decimal', precision: 18, scale: 2, nullable: true })
  amountStandard!: string | null;

  @Column({
    name: 'quantity_standard',
    type: 'decimal',
    precision: 18,
    scale: 2,
    nullable: true,
  })
  quantityStandard!: string | null;

  @Column({ name: 'occurred_at', type: 'datetime' })
  occurredAt!: Date;

  @Column({ name: 'period_key', type: 'varchar', length: 20 })
  periodKey!: string;

  @Column({ name: 'confirmed_flag', type: 'boolean', default: false })
  confirmedFlag!: boolean;

  @Column({ name: 'ignored_flag', type: 'boolean', default: false })
  ignoredFlag!: boolean;

  @Column({ name: 'handled_by', type: 'int', nullable: true })
  handledBy!: number | null;

  @Column({ name: 'handled_at', type: 'datetime', nullable: true })
  handledAt!: Date | null;

  @Column({
    name: 'handling_action',
    type: 'enum',
    enum: PerformanceHandlingAction,
    nullable: true,
  })
  handlingAction!: PerformanceHandlingAction | null;

  @Column({ name: 'handling_remark', type: 'varchar', length: 500, nullable: true })
  handlingRemark!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'normalized_payload', type: 'json' })
  normalizedPayload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Employee, (employee) => employee.performanceEvents, { nullable: true })
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'handled_by' })
  handledByUser!: User | null;

  @OneToOne(() => PerformanceEventClassification, (classification) => classification.performanceEvent)
  classification!: PerformanceEventClassification | null;
}
