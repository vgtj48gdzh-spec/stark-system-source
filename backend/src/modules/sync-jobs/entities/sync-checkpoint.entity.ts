import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SyncJob } from './sync-job.entity';

@Entity('sync_checkpoints')
export class SyncCheckpoint {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'sync_job_id' })
  syncJobId!: number;

  @Column({ name: 'checkpoint_key', type: 'varchar', length: 100 })
  checkpointKey!: string;

  @Column({ name: 'checkpoint_value', type: 'varchar', length: 500, nullable: true })
  checkpointValue!: string | null;

  @Column({ name: 'last_synced_at', type: 'datetime', nullable: true })
  lastSyncedAt!: Date | null;

  @Column({ name: 'batch_no', type: 'varchar', length: 64, nullable: true })
  batchNo!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => SyncJob, (syncJob) => syncJob.checkpoints)
  @JoinColumn({ name: 'sync_job_id' })
  syncJob!: SyncJob;
}
