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
import { PerformanceEvent } from './performance-event.entity';
import { PerformanceRule } from './performance-rule.entity';

@Entity('performance_event_classifications')
export class PerformanceEventClassification {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'performance_event_id', type: 'int' })
  performanceEventId!: number;

  @Column({ name: 'performance_rule_id', type: 'int', nullable: true })
  performanceRuleId!: number | null;

  @Column({ name: 'classification_key', type: 'varchar', length: 100, nullable: true })
  classificationKey!: string | null;

  @Column({ name: 'include_in_performance', type: 'boolean', default: false })
  includeInPerformance!: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: '1.00' })
  weight!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: '1.00' })
  coefficient!: string;

  @Column({ name: 'requires_manual_confirmation', type: 'boolean', default: false })
  requiresManualConfirmation!: boolean;

  @Column({ name: 'rule_matched_flag', type: 'boolean', default: false })
  ruleMatchedFlag!: boolean;

  @Column({ name: 'normalized_payload', type: 'json' })
  normalizedPayload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToOne(() => PerformanceEvent, (event) => event.classification)
  @JoinColumn({ name: 'performance_event_id' })
  performanceEvent!: PerformanceEvent;

  @ManyToOne(() => PerformanceRule, (rule) => rule.eventClassifications, { nullable: true })
  @JoinColumn({ name: 'performance_rule_id' })
  performanceRule!: PerformanceRule | null;
}
