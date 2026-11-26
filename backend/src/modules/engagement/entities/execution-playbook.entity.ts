import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('execution_playbooks')
export class ExecutionPlaybook {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'playbook_code', type: 'varchar', length: 100 })
  playbookCode!: string;

  @Column({ name: 'playbook_name', type: 'varchar', length: 120 })
  playbookName!: string;

  @Column({ name: 'scenario_code', type: 'varchar', length: 50 })
  scenarioCode!: string;

  @Column({ name: 'scenario_name', type: 'varchar', length: 80 })
  scenarioName!: string;

  @Column({ name: 'recommendation_type', type: 'varchar', length: 50 })
  recommendationType!: string;

  @Column({ name: 'target_subject_type', type: 'varchar', length: 30, nullable: true })
  targetSubjectType!: string | null;

  @Column({ name: 'business_domain', type: 'varchar', length: 50, nullable: true })
  businessDomain!: string | null;

  @Column({ name: 'merchant_id', type: 'int', nullable: true })
  merchantId!: number | null;

  @Column({ name: 'recommendation_rule_id', type: 'int', nullable: true })
  recommendationRuleId!: number | null;

  @Column({ name: 'default_script_template_id', type: 'int', nullable: true })
  defaultScriptTemplateId!: number | null;

  @Column({ name: 'execution_channel', type: 'varchar', length: 30, default: 'manual_followup' })
  executionChannel!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: boolean;

  @Column({ name: 'normalized_payload', type: 'json', nullable: true })
  normalizedPayload!: Record<string, unknown> | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
