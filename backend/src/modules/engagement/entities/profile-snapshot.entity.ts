import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('profile_snapshots')
export class ProfileSnapshot {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'subject_type', type: 'varchar', length: 30 })
  subjectType!: string;

  @Column({ name: 'subject_id', type: 'int' })
  subjectId!: number;

  @Column({ name: 'display_name', type: 'varchar', length: 100, nullable: true })
  displayName!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  mobile!: string | null;

  @Column({ name: 'merchant_id', type: 'int', nullable: true })
  merchantId!: number | null;

  @Column({ name: 'employee_id', type: 'int', nullable: true })
  employeeId!: number | null;

  @Column({ name: 'latest_interaction_at', type: 'datetime', nullable: true })
  latestInteractionAt!: Date | null;

  @Column({ name: 'latest_attribution_at', type: 'datetime', nullable: true })
  latestAttributionAt!: Date | null;

  @Column({ name: 'interaction_count', type: 'int', default: 0 })
  interactionCount!: number;

  @Column({ name: 'memory_count', type: 'int', default: 0 })
  memoryCount!: number;

  @Column({ name: 'attributed_business_count', type: 'int', default: 0 })
  attributedBusinessCount!: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @Column({ name: 'summary_json', type: 'json' })
  summaryJson!: Record<string, unknown>;

  @Column({ name: 'normalized_payload', type: 'json' })
  normalizedPayload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
