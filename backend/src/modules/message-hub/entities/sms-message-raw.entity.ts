import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MobileSmsEvent } from '../../mobile-bridge/entities/mobile-sms-event.entity';

@Entity('sms_message_raw')
export class SmsMessageRaw {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'device_id', type: 'varchar', length: 100 })
  deviceId!: string;

  @Column({ name: 'sim_slot', type: 'int', nullable: true })
  simSlot!: number | null;

  @Column({ type: 'varchar', length: 100 })
  sender!: string;

  @Column({ type: 'longtext' })
  body!: string;

  @Column({ name: 'device_sms_id', type: 'varchar', length: 64, nullable: true })
  deviceSmsId!: string | null;

  @Column({ name: 'dedupe_fingerprint', type: 'varchar', length: 255, nullable: true })
  dedupeFingerprint!: string | null;

  @Column({ name: 'mobile_sms_event_id', type: 'int', nullable: true, unique: true })
  mobileSmsEventId!: number | null;

  @Column({
    name: 'promotion_admission_key',
    type: 'varchar',
    length: 64,
    nullable: true,
    unique: true,
  })
  promotionAdmissionKey!: string | null;

  @Column({ name: 'promotion_policy_version', type: 'varchar', length: 64, nullable: true })
  promotionPolicyVersion!: string | null;

  @Column({ name: 'promotion_admission_outcome', type: 'varchar', length: 32, nullable: true })
  promotionAdmissionOutcome!: string | null;

  @Column({ name: 'promotion_decision_fingerprint', type: 'char', length: 64, nullable: true })
  promotionDecisionFingerprint!: string | null;

  @Column({ name: 'promotion_evidence_fingerprint', type: 'char', length: 64, nullable: true })
  promotionEvidenceFingerprint!: string | null;

  @Column({ name: 'promotion_blocker_codes', type: 'json', nullable: true })
  promotionBlockerCodes!: string[] | null;

  @Column({ name: 'promotion_evidence_blocker_codes', type: 'json', nullable: true })
  promotionEvidenceBlockerCodes!: string[] | null;

  @Column({ name: 'promotion_target_status_preview', type: 'varchar', length: 32, nullable: true })
  promotionTargetStatusPreview!: 'pending' | 'pending_binding' | null;

  @Column({ name: 'received_at', type: 'datetime' })
  receivedAt!: Date;

  @Column({
    name: 'ingest_source',
    type: 'enum',
    enum: ['live_broadcast', 'inbox_sync', 'manual_import'],
  })
  ingestSource!: 'live_broadcast' | 'inbox_sync' | 'manual_import';

  @Column({ name: 'upload_status', type: 'varchar', length: 32, default: 'stored' })
  uploadStatus!: string;

  @Column({ name: 'classify_status', type: 'varchar', length: 32, default: 'pending' })
  classifyStatus!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => MobileSmsEvent, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'mobile_sms_event_id' })
  mobileSmsEvent!: MobileSmsEvent | null;
}
