import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('recommendation_rules')
export class RecommendationRule {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'rule_code', type: 'varchar', length: 100 })
  ruleCode!: string;

  @Column({ name: 'rule_name', type: 'varchar', length: 120 })
  ruleName!: string;

  @Column({ name: 'recommendation_type', type: 'varchar', length: 50 })
  recommendationType!: string;

  @Column({ name: 'subject_type', type: 'varchar', length: 30, nullable: true })
  subjectType!: string | null;

  @Column({ name: 'business_domain', type: 'varchar', length: 50, nullable: true })
  businessDomain!: string | null;

  @Column({ name: 'trigger_memory_type', type: 'varchar', length: 50, nullable: true })
  triggerMemoryType!: string | null;

  @Column({ name: 'trigger_interaction_type', type: 'varchar', length: 50, nullable: true })
  triggerInteractionType!: string | null;

  @Column({ name: 'evidence_status', type: 'varchar', length: 20 })
  evidenceStatus!: string;

  @Column({ name: 'confidence_score', type: 'decimal', precision: 5, scale: 4, default: '0.0000' })
  confidenceScore!: string;

  @Column({ name: 'rule_strength', type: 'varchar', length: 20, default: 'weak' })
  ruleStrength!: string;

  @Column({ name: 'match_conditions', type: 'json', nullable: true })
  matchConditions!: Record<string, unknown> | null;

  @Column({ name: 'recommendation_template', type: 'text', nullable: true })
  recommendationTemplate!: string | null;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
