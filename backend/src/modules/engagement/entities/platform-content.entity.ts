import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('platform_contents')
export class PlatformContent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 50 })
  platform!: string;

  @Column({ name: 'account_id', type: 'varchar', length: 100 })
  accountId!: string;

  @Column({ name: 'content_id', type: 'varchar', length: 100 })
  contentId!: string;

  @Column({ name: 'campaign_id', type: 'varchar', length: 100, nullable: true })
  campaignId!: string | null;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ name: 'content_type', type: 'varchar', length: 50 })
  contentType!: string;

  @Column({ type: 'json', nullable: true })
  tags!: string[] | null;

  @Column({ name: 'published_at', type: 'datetime', nullable: true })
  publishedAt!: Date | null;

  @Column({ type: 'varchar', length: 30 })
  status!: string;

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
