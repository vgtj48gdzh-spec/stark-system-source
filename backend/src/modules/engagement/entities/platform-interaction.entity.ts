import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('platform_interactions')
export class PlatformInteraction {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 50 })
  platform!: string;

  @Column({ name: 'account_id', type: 'varchar', length: 100 })
  accountId!: string;

  @Column({ name: 'content_id', type: 'varchar', length: 100, nullable: true })
  contentId!: string | null;

  @Column({ name: 'interaction_type', type: 'varchar', length: 50 })
  interactionType!: string;

  @Column({ name: 'interaction_value', type: 'varchar', length: 255, nullable: true })
  interactionValue!: string | null;

  @Column({ name: 'interaction_time', type: 'datetime' })
  interactionTime!: Date;

  @Column({ name: 'source_user_ref', type: 'varchar', length: 100, nullable: true })
  sourceUserRef!: string | null;

  @Column({ name: 'source_session_ref', type: 'varchar', length: 100, nullable: true })
  sourceSessionRef!: string | null;

  @Column({ name: 'source_contact_ref', type: 'varchar', length: 100, nullable: true })
  sourceContactRef!: string | null;

  @Column({ name: 'source_file', type: 'varchar', length: 255, nullable: true })
  sourceFile!: string | null;

  @Column({ name: 'import_batch_id', type: 'int', nullable: true })
  importBatchId!: number | null;

  @Column({ name: 'normalized_payload', type: 'json' })
  normalizedPayload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
