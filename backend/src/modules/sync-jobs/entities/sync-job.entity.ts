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
import { SyncJobStatus } from '../../../shared/enums/sync-job-status.enum';
import { SourceSystem } from '../../source-systems/entities/source-system.entity';
import { SyncCheckpoint } from './sync-checkpoint.entity';
import { SyncJobRun } from './sync-job-run.entity';

@Entity('sync_jobs')
export class SyncJob {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'source_system_id' })
  sourceSystemId!: number;

  @Column({ name: 'source_system_code', type: 'varchar', length: 50 })
  sourceSystemCode!: string;

  @Column({ name: 'job_code', type: 'varchar', length: 100, unique: true })
  jobCode!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 30, default: SyncJobStatus.ACTIVE })
  status!: SyncJobStatus;

  @Column({ name: 'sync_scope', type: 'json', nullable: true })
  syncScope!: string[] | null;

  @Column({ name: 'source_table', type: 'varchar', length: 100 })
  sourceTable!: string;

  @Column({ name: 'target_raw_table', type: 'varchar', length: 100 })
  targetRawTable!: string;

  @Column({ name: 'import_mode', type: 'varchar', length: 30, default: 'offline' })
  importMode!: string;

  @Column({ name: 'checkpoint_key', type: 'varchar', length: 100, nullable: true })
  checkpointKey!: string | null;

  @Column({ name: 'last_synced_at', type: 'datetime', nullable: true })
  lastSyncedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => SourceSystem, (sourceSystem) => sourceSystem.syncJobs)
  @JoinColumn({ name: 'source_system_id' })
  sourceSystem!: SourceSystem;

  @OneToMany(() => SyncJobRun, (syncJobRun) => syncJobRun.syncJob)
  runs!: SyncJobRun[];

  @OneToMany(() => SyncCheckpoint, (syncCheckpoint) => syncCheckpoint.syncJob)
  checkpoints!: SyncCheckpoint[];
}
