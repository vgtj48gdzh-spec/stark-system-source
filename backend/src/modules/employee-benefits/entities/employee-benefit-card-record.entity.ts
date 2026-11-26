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
import { Employee } from '../../performance/entities/employee.entity';
import { EmployeeBenefitNotification } from './employee-benefit-notification.entity';
import { EmployeeBenefitIssueItem } from './employee-benefit-issue-item.entity';

@Entity('employee_benefit_card_records')
export class EmployeeBenefitCardRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'issue_item_id', type: 'int' })
  issueItemId!: number;

  @Column({ name: 'employee_id', type: 'int' })
  employeeId!: number;

  @Column({ name: 'card_category', type: 'varchar', length: 30, default: 'employee_benefit' })
  cardCategory!: string;

  @Column({ name: 'amount_total', type: 'decimal', precision: 18, scale: 2, default: '0.00' })
  amountTotal!: string;

  @Column({
    name: 'amount_remaining',
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: '0.00',
  })
  amountRemaining!: string;

  @Column({
    name: 'amount_consumed',
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: '0.00',
  })
  amountConsumed!: string;

  @Column({ name: 'effective_at', type: 'datetime' })
  effectiveAt!: Date;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt!: Date;

  @Column({ name: 'validity_days', type: 'int', default: 180 })
  validityDays!: number;

  @Column({ name: 'consumption_priority', type: 'int', default: 0 })
  consumptionPriority!: number;

  @Column({ name: 'source_system', type: 'varchar', length: 50, nullable: true })
  sourceSystem!: string | null;

  @Column({ name: 'source_table', type: 'varchar', length: 100, nullable: true })
  sourceTable!: string | null;

  @Column({ name: 'source_id', type: 'varchar', length: 100, nullable: true })
  sourceId!: string | null;

  @Column({ name: 'source_order_no', type: 'varchar', length: 100, nullable: true })
  sourceOrderNo!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @Column({ name: 'normalized_payload', type: 'json' })
  normalizedPayload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => EmployeeBenefitIssueItem, (issueItem) => issueItem.cardRecords, {
    nullable: false,
  })
  @JoinColumn({ name: 'issue_item_id' })
  issueItem!: EmployeeBenefitIssueItem;

  @ManyToOne(() => Employee, { nullable: false })
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @OneToMany(() => EmployeeBenefitNotification, (notification) => notification.cardRecord)
  notifications!: EmployeeBenefitNotification[];
}
