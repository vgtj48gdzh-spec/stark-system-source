import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('execution_tasks')
export class ExecutionTask {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'task_code', type: 'varchar', length: 100 })
  taskCode!: string;

  @Column({ name: 'task_name', type: 'varchar', length: 120 })
  taskName!: string;

  @Column({ name: 'playbook_id', type: 'int' })
  playbookId!: number;

  @Column({ name: 'scenario_code', type: 'varchar', length: 50 })
  scenarioCode!: string;

  @Column({ name: 'scenario_name', type: 'varchar', length: 80 })
  scenarioName!: string;

  @Column({ name: 'recommendation_type', type: 'varchar', length: 50 })
  recommendationType!: string;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: string;

  @Column({ name: 'assigned_to', type: 'int', nullable: true })
  assignedTo!: number | null;

  @Column({ name: 'merchant_id', type: 'int', nullable: true })
  merchantId!: number | null;

  @Column({ name: 'target_count', type: 'int', default: 0 })
  targetCount!: number;

  @Column({ name: 'confirmed_by', type: 'int', nullable: true })
  confirmedBy!: number | null;

  @Column({ name: 'confirmed_at', type: 'datetime', nullable: true })
  confirmedAt!: Date | null;

  @Column({ name: 'closed_by', type: 'int', nullable: true })
  closedBy!: number | null;

  @Column({ name: 'closed_at', type: 'datetime', nullable: true })
  closedAt!: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'normalized_payload', type: 'json', nullable: true })
  normalizedPayload!: Record<string, unknown> | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
