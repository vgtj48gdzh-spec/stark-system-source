import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('attribution_rules')
export class AttributionRule {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'rule_code', type: 'varchar', length: 50 })
  ruleCode!: string;

  @Column({ name: 'rule_name', type: 'varchar', length: 100 })
  ruleName!: string;

  @Column({ name: 'rule_type', type: 'varchar', length: 30 })
  ruleType!: string;

  @Column({ name: 'match_field', type: 'varchar', length: 50 })
  matchField!: string;

  @Column({ name: 'match_pattern', type: 'varchar', length: 255, nullable: true })
  matchPattern!: string | null;

  @Column({ name: 'target_type', type: 'varchar', length: 30 })
  targetType!: string;

  @Column({ name: 'target_business_type', type: 'varchar', length: 50, nullable: true })
  targetBusinessType!: string | null;

  @Column({ name: 'confidence_score', type: 'decimal', precision: 5, scale: 4, default: '0.0000' })
  confidenceScore!: string;

  @Column({ name: 'evidence_status', type: 'varchar', length: 20 })
  evidenceStatus!: string;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'normalized_payload', type: 'json' })
  normalizedPayload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
