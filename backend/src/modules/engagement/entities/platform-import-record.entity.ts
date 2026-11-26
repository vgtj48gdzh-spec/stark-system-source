import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlatformImportBatch } from './platform-import-batch.entity';

@Entity('platform_import_records')
export class PlatformImportRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'import_batch_id', type: 'int' })
  importBatchId!: number;

  @Column({ name: 'source_platform', type: 'varchar', length: 50 })
  sourcePlatform!: string;

  @Column({ name: 'import_type', type: 'varchar', length: 30 })
  importType!: string;

  @Column({ name: 'source_file', type: 'varchar', length: 255 })
  sourceFile!: string;

  @Column({ name: 'record_index', type: 'int' })
  recordIndex!: number;

  @Column({ name: 'source_record_ref', type: 'varchar', length: 100, nullable: true })
  sourceRecordRef!: string | null;

  @Column({ name: 'import_status', type: 'varchar', length: 20 })
  importStatus!: string;

  @Column({ name: 'target_table', type: 'varchar', length: 100, nullable: true })
  targetTable!: string | null;

  @Column({ name: 'target_id', type: 'varchar', length: 100, nullable: true })
  targetId!: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'raw_payload', type: 'json' })
  rawPayload!: Record<string, unknown>;

  @Column({ name: 'normalized_payload', type: 'json', nullable: true })
  normalizedPayload!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => PlatformImportBatch, (batch) => batch.records, { nullable: false })
  @JoinColumn({ name: 'import_batch_id' })
  importBatch!: PlatformImportBatch;
}
