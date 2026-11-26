import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('performance_summary_manual_decisions')
export class PerformanceSummaryManualDecision {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'source_summary_id', type: 'int' })
  sourceSummaryId!: number;

  @Column({ name: 'action_type', type: 'varchar', length: 50 })
  actionType!: string;

  @Column({ name: 'source_system', type: 'varchar', length: 50, nullable: true })
  sourceSystem!: string | null;

  @Column({ name: 'source_table', type: 'varchar', length: 100, nullable: true })
  sourceTable!: string | null;

  @Column({ name: 'source_id', type: 'varchar', length: 100, nullable: true })
  sourceId!: string | null;

  @Column({ name: 'original_matched_customer_id', type: 'varchar', length: 100, nullable: true })
  originalMatchedCustomerId!: string | null;

  @Column({ name: 'final_matched_customer_id', type: 'varchar', length: 100, nullable: true })
  finalMatchedCustomerId!: string | null;

  @Column({ name: 'original_classification', type: 'varchar', length: 64, nullable: true })
  originalClassification!: string | null;

  @Column({ name: 'final_classification', type: 'varchar', length: 64, nullable: true })
  finalClassification!: string | null;

  @Column({ name: 'original_binding_status', type: 'varchar', length: 32, nullable: true })
  originalBindingStatus!: string | null;

  @Column({ name: 'final_binding_status', type: 'varchar', length: 32, nullable: true })
  finalBindingStatus!: string | null;

  @Column({ name: 'operator_id', type: 'int' })
  operatorId!: number;

  @Column({ name: 'operator_name', type: 'varchar', length: 120, nullable: true })
  operatorName!: string | null;

  @CreateDateColumn({ name: 'operated_at' })
  operatedAt!: Date;

  @Column({ name: 'reason_code', type: 'varchar', length: 100, nullable: true })
  reasonCode!: string | null;

  @Column({ type: 'varchar', length: 500 })
  remark!: string;

  @Column({ name: 'affect_performance_flag', type: 'boolean', default: false })
  affectPerformanceFlag!: boolean;

  @Column({ name: 'affect_b_card_flag', type: 'boolean', default: false })
  affectBCardFlag!: boolean;

  @Column({ name: 'normalized_payload', type: 'json', nullable: true })
  normalizedPayload!: Record<string, unknown> | null;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'operator_id' })
  operator!: User;
}
