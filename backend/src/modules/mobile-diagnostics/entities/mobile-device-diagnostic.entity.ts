import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('mobile_device_diagnostics')
export class MobileDeviceDiagnostic {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'device_id', type: 'varchar', length: 100, unique: true })
  deviceId!: string;

  @Column({ name: 'receive_sms_permission', type: 'tinyint', width: 1, nullable: true })
  receiveSmsPermission!: boolean | null;

  @Column({ name: 'read_sms_permission', type: 'tinyint', width: 1, nullable: true })
  readSmsPermission!: boolean | null;

  @Column({ name: 'device_reported_at', type: 'datetime', nullable: true })
  deviceReportedAt!: Date | null;

  @Column({ name: 'last_broadcast_received_at', type: 'datetime', nullable: true })
  lastBroadcastReceivedAt!: Date | null;

  @Column({ name: 'last_raw_sms_ingest_at', type: 'datetime', nullable: true })
  lastRawSmsIngestAt!: Date | null;

  @Column({ name: 'last_raw_sms_ingest_result', type: 'varchar', length: 64, nullable: true })
  lastRawSmsIngestResult!: string | null;

  @Column({ name: 'last_inbox_sync_at', type: 'datetime', nullable: true })
  lastInboxSyncAt!: Date | null;

  @Column({ name: 'pending_upload_queue_count', type: 'int', default: 0 })
  pendingUploadQueueCount!: number;

  @Column({ name: 'last_test_upload_at', type: 'datetime', nullable: true })
  lastTestUploadAt!: Date | null;

  @Column({ name: 'resolved_base_url', type: 'varchar', length: 255, nullable: true })
  resolvedBaseUrl!: string | null;

  @Column({ name: 'base_url_source', type: 'varchar', length: 32, nullable: true })
  baseUrlSource!: string | null;

  @Column({ name: 'runtime_snapshot_json', type: 'json', nullable: true })
  runtimeSnapshotJson!: Record<string, unknown> | null;

  @Column({ name: 'last_heartbeat_at', type: 'datetime', nullable: true })
  lastHeartbeatAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
