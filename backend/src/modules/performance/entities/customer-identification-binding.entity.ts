import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('customer_identification_bindings')
export class CustomerIdentificationBinding {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'source_system', type: 'varchar', length: 50 })
  sourceSystem!: string;

  @Column({ name: 'source_table', type: 'varchar', length: 100 })
  sourceTable!: string;

  @Column({ name: 'source_id', type: 'varchar', length: 100 })
  sourceId!: string;

  @Column({ name: 'source_customer_name', type: 'varchar', length: 120, nullable: true })
  sourceCustomerName!: string | null;

  @Column({ name: 'source_customer_mobile', type: 'varchar', length: 20, nullable: true })
  sourceCustomerMobile!: string | null;

  @Column({ name: 'source_car_plate', type: 'varchar', length: 30, nullable: true })
  sourceCarPlate!: string | null;

  @Column({ name: 'matched_customer_id', type: 'varchar', length: 100, nullable: true })
  matchedCustomerId!: string | null;

  @Column({ name: 'matched_customer_name', type: 'varchar', length: 120, nullable: true })
  matchedCustomerName!: string | null;

  @Column({ name: 'matched_customer_mobile', type: 'varchar', length: 20, nullable: true })
  matchedCustomerMobile!: string | null;

  @Column({ name: 'binding_status', type: 'varchar', length: 32, default: 'manual_pending' })
  bindingStatus!: string;

  @Column({ name: 'binding_confidence', type: 'decimal', precision: 5, scale: 4, nullable: true })
  bindingConfidence!: string | null;

  @Column({ name: 'bound_by', type: 'int', nullable: true })
  boundBy!: number | null;

  @Column({ name: 'bound_at', type: 'datetime', nullable: true })
  boundAt!: Date | null;

  @Column({ name: 'binding_remark', type: 'varchar', length: 500, nullable: true })
  bindingRemark!: string | null;

  @Column({ name: 'performance_ready_flag', type: 'boolean', default: false })
  performanceReadyFlag!: boolean;

  @Column({ name: 'performance_block_reason', type: 'varchar', length: 100, nullable: true })
  performanceBlockReason!: string | null;

  @Column({ name: 'performance_decision_reason', type: 'varchar', length: 500, nullable: true })
  performanceDecisionReason!: string | null;

  @Column({ name: 'task_execution_count', type: 'int', nullable: true })
  taskExecutionCount!: number | null;

  @Column({ name: 'task_on_time_count', type: 'int', nullable: true })
  taskOnTimeCount!: number | null;

  @Column({ name: 'task_confirmed_count', type: 'int', nullable: true })
  taskConfirmedCount!: number | null;

  @Column({ name: 'task_reward_eligible_flag', type: 'boolean', nullable: true })
  taskRewardEligibleFlag!: boolean | null;

  @Column({ name: 'ai_task_score', type: 'decimal', precision: 10, scale: 2, nullable: true })
  aiTaskScore!: string | null;

  @Column({ name: 'ai_task_remark', type: 'varchar', length: 500, nullable: true })
  aiTaskRemark!: string | null;

  @Column({ name: 'normalized_payload', type: 'json', nullable: true })
  normalizedPayload!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'bound_by' })
  boundByUser!: User | null;
}
