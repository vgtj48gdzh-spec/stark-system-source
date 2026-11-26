import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('ai_recommendations')
export class AiRecommendation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'subject_type', type: 'varchar', length: 30 })
  subjectType!: string;

  @Column({ name: 'subject_id', type: 'int' })
  subjectId!: number;

  @Column({ name: 'recommendation_type', type: 'varchar', length: 50 })
  recommendationType!: string;

  @Column({ name: 'recommendation_text', type: 'text' })
  recommendationText!: string;

  @Column({ name: 'recommendation_reason', type: 'text', nullable: true })
  recommendationReason!: string | null;

  @Column({ name: 'recommendation_rule_id', type: 'int', nullable: true })
  recommendationRuleId!: number | null;

  @Column({ name: 'matched_memory_entry_id', type: 'int', nullable: true })
  matchedMemoryEntryId!: number | null;

  @Column({ name: 'matched_interaction_id', type: 'int', nullable: true })
  matchedInteractionId!: number | null;

  @Column({ name: 'source_context', type: 'json' })
  sourceContext!: Record<string, unknown>;

  @Column({ name: 'evidence_status', type: 'varchar', length: 20 })
  evidenceStatus!: string;

  @Column({ name: 'confidence_score', type: 'decimal', precision: 5, scale: 4, default: '0.0000' })
  confidenceScore!: string;

  @Column({ name: 'rule_strength', type: 'varchar', length: 20, nullable: true })
  ruleStrength!: string | null;

  @Column({ type: 'varchar', length: 30 })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
