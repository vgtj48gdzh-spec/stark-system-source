import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SyncInputFormat } from '../../../shared/enums/sync-input-format.enum';
import { SyncJobRunStatus } from '../../../shared/enums/sync-job-run-status.enum';
import { User } from '../../users/entities/user.entity';
import { SyncJob } from './sync-job.entity';

@Entity('sync_job_runs')
export class SyncJobRun {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'sync_job_id' })
  syncJobId!: number;

  @Column({ name: 'batch_no', type: 'varchar', length: 64 })
  batchNo!: string;

  @Column({ name: 'run_status', type: 'varchar', length: 30, default: SyncJobRunStatus.RUNNING })
  runStatus!: SyncJobRunStatus;

  @Column({ name: 'started_at', type: 'datetime' })
  startedAt!: Date;

  @Column({ name: 'finished_at', type: 'datetime', nullable: true })
  finishedAt!: Date | null;

  @Column({ name: 'input_format', type: 'varchar', length: 30, nullable: true })
  inputFormat!: SyncInputFormat | null;

  @Column({ name: 'input_path', type: 'varchar', length: 500, nullable: true })
  inputPath!: string | null;

  @Column({ name: 'total_records', type: 'int', default: 0 })
  totalRecords!: number;

  @Column({ name: 'imported_records', type: 'int', default: 0 })
  importedRecords!: number;

  @Column({ name: 'skipped_records', type: 'int', default: 0 })
  skippedRecords!: number;

  @Column({ name: 'failed_records', type: 'int', default: 0 })
  failedRecords!: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'result_payload', type: 'json', nullable: true })
  resultPayload!: Record<string, unknown> | null;

  @Column({ name: 'created_by', nullable: true })
  createdBy!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => SyncJob, (syncJob) => syncJob.runs)
  @JoinColumn({ name: 'sync_job_id' })
  syncJob!: SyncJob;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User | null;
}
