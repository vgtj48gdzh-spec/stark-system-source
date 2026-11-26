import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { SourceSystemStatus } from '../../../shared/enums/source-system-status.enum';
import { SyncJob } from '../../sync-jobs/entities/sync-job.entity';

@Entity('source_systems')
export class SourceSystem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'source_system_code', type: 'varchar', length: 50, unique: true })
  sourceSystemCode!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 30, default: SourceSystemStatus.ACTIVE })
  status!: SourceSystemStatus;

  @Column({ name: 'sync_scope', type: 'json', nullable: true })
  syncScope!: string[] | null;

  @Column({ name: 'last_synced_at', type: 'datetime', nullable: true })
  lastSyncedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => SyncJob, (syncJob) => syncJob.sourceSystem)
  syncJobs!: SyncJob[];
}
