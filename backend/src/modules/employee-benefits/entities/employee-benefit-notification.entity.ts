import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Employee } from '../../performance/entities/employee.entity';
import { EmployeeBenefitCardRecord } from './employee-benefit-card-record.entity';

@Entity('employee_benefit_notifications')
export class EmployeeBenefitNotification {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'employee_id', type: 'int' })
  employeeId!: number;

  @Column({ name: 'card_record_id', type: 'int' })
  cardRecordId!: number;

  @Column({ name: 'notification_type', type: 'varchar', length: 30 })
  notificationType!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'amount_standard', type: 'decimal', precision: 18, scale: 2, nullable: true })
  amountStandard!: string | null;

  @Column({ name: 'balance_amount', type: 'decimal', precision: 18, scale: 2, nullable: true })
  balanceAmount!: string | null;

  @Column({ name: 'expiring_amount', type: 'decimal', precision: 18, scale: 2, nullable: true })
  expiringAmount!: string | null;

  @Column({ name: 'expired_amount', type: 'decimal', precision: 18, scale: 2, nullable: true })
  expiredAmount!: string | null;

  @Column({ name: 'latest_consumption_summary', type: 'varchar', length: 500, nullable: true })
  latestConsumptionSummary!: string | null;

  @Column({ name: 'notify_at', type: 'datetime' })
  notifyAt!: Date;

  @Column({ name: 'read_flag', type: 'tinyint', width: 1, default: 0 })
  readFlag!: boolean;

  @Column({ name: 'read_at', type: 'datetime', nullable: true })
  readAt!: Date | null;

  @Column({ name: 'source_system', type: 'varchar', length: 50, nullable: true })
  sourceSystem!: string | null;

  @Column({ name: 'source_table', type: 'varchar', length: 100, nullable: true })
  sourceTable!: string | null;

  @Column({ name: 'source_id', type: 'varchar', length: 100, nullable: true })
  sourceId!: string | null;

  @Column({ name: 'source_order_no', type: 'varchar', length: 100, nullable: true })
  sourceOrderNo!: string | null;

  @Column({ name: 'normalized_payload', type: 'json' })
  normalizedPayload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Employee, { nullable: false })
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @ManyToOne(() => EmployeeBenefitCardRecord, (cardRecord) => cardRecord.notifications, {
    nullable: false,
  })
  @JoinColumn({ name: 'card_record_id' })
  cardRecord!: EmployeeBenefitCardRecord;
}
