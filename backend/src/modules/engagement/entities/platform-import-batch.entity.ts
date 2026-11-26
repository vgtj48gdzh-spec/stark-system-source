import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { PlatformImportRecord } from './platform-import-record.entity';

@Entity('platform_import_batches')
export class PlatformImportBatch {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'source_platform', type: 'varchar', length: 50 })
  sourcePlatform!: string;

  @Column({ name: 'account_id', type: 'varchar', length: 100, nullable: true })
  accountId!: string | null;

  @Column({ name: 'import_type', type: 'varchar', length: 30 })
  importType!: string;

  @Column({ name: 'source_format', type: 'varchar', length: 20 })
  sourceFormat!: string;

  @Column({ name: 'source_file', type: 'varchar', length: 255 })
  sourceFile!: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ name: 'connector_config_id', type: 'int', nullable: true })
  connectorConfigId!: number | null;

  @Column({ name: 'import_status', type: 'varchar', length: 20 })
  importStatus!: string;

  @Column({ name: 'record_count', type: 'int', default: 0 })
  recordCount!: number;

  @Column({ name: 'success_count', type: 'int', default: 0 })
  successCount!: number;

  @Column({ name: 'failed_count', type: 'int', default: 0 })
  failedCount!: number;

  @Column({ name: 'trigger_lead_generation', type: 'tinyint', width: 1, default: 0 })
  triggerLeadGeneration!: boolean;

  @Column({ name: 'trigger_attribution_generation', type: 'tinyint', width: 1, default: 0 })
  triggerAttributionGeneration!: boolean;

  @Column({ name: 'sync_lead_memories', type: 'tinyint', width: 1, default: 0 })
  syncLeadMemories!: boolean;

  @Column({ name: 'imported_by', type: 'int', nullable: true })
  importedBy!: number | null;

  @Column({ name: 'started_at', type: 'datetime', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'finished_at', type: 'datetime', nullable: true })
  finishedAt!: Date | null;

  @Column({ name: 'summary_json', type: 'json', nullable: true })
  summaryJson!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'imported_by' })
  importedByUser!: User | null;

  @OneToMany(() => PlatformImportRecord, (record) => record.importBatch)
  records!: PlatformImportRecord[];
}
