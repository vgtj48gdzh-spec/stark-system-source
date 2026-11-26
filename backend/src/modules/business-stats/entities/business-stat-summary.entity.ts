import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RewardSummaryDomain } from '../../../shared/enums/reward-summary-domain.enum';
import { User } from '../../users/entities/user.entity';
import { Employee } from '../../performance/entities/employee.entity';

@Entity('business_stat_summaries')
export class BusinessStatSummary {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'summary_key', type: 'varchar', length: 255 })
  summaryKey!: string;

  @Column({ name: 'summary_domain', type: 'enum', enum: RewardSummaryDomain })
  summaryDomain!: RewardSummaryDomain;

  @Column({ name: 'period_key', type: 'varchar', length: 20 })
  periodKey!: string;

  @Column({ name: 'merchant_id', type: 'int', nullable: true })
  merchantId!: number | null;

  @Column({ name: 'store_id', type: 'int', nullable: true })
  storeId!: number | null;

  @Column({ name: 'responsible_employee_id', type: 'int', nullable: true })
  responsibleEmployeeId!: number | null;

  @Column({ name: 'customer_id', type: 'varchar', length: 100, nullable: true })
  customerId!: string | null;

  @Column({ name: 'tag_count', type: 'int', default: 0 })
  tagCount!: number;

  @Column({ name: 'reward_event_count', type: 'int', default: 0 })
  rewardEventCount!: number;

  @Column({ name: 'confirmed_reward_event_count', type: 'int', default: 0 })
  confirmedRewardEventCount!: number;

  @Column({ name: 'pending_reward_event_count', type: 'int', default: 0 })
  pendingRewardEventCount!: number;

  @Column({ name: 'amount_total', type: 'decimal', precision: 18, scale: 2, default: '0.00' })
  amountTotal!: string;

  @Column({ name: 'quantity_total', type: 'decimal', precision: 18, scale: 2, default: '0.00' })
  quantityTotal!: string;

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

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'responsible_employee_id' })
  responsibleEmployee!: Employee | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'confirmed_by' })
  confirmedByUser!: User | null;
}
