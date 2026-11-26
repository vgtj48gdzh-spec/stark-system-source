import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('script_experiments')
export class ScriptExperiment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'experiment_code', type: 'varchar', length: 100 })
  experimentCode!: string;

  @Column({ name: 'experiment_name', type: 'varchar', length: 120 })
  experimentName!: string;

  @Column({ name: 'experiment_type', type: 'varchar', length: 50 })
  experimentType!: string;

  @Column({ name: 'recommendation_type', type: 'varchar', length: 50, nullable: true })
  recommendationType!: string | null;

  @Column({ name: 'subject_type', type: 'varchar', length: 30, nullable: true })
  subjectType!: string | null;

  @Column({ name: 'business_domain', type: 'varchar', length: 50, nullable: true })
  businessDomain!: string | null;

  @Column({ type: 'varchar', length: 20 })
  status!: string;

  @Column({ type: 'text', nullable: true })
  hypothesis!: string | null;

  @Column({ name: 'start_at', type: 'datetime', nullable: true })
  startAt!: Date | null;

  @Column({ name: 'end_at', type: 'datetime', nullable: true })
  endAt!: Date | null;

  @Column({ name: 'template_count', type: 'int', default: 0 })
  templateCount!: number;

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
