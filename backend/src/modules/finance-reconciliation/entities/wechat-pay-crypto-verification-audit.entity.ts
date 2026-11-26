import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { WechatPayEvidenceProvider } from './wechat-pay-callback-evidence.entity';

export type WechatPayCryptoVerificationAuditStatus =
  | 'audit_candidate'
  | 'signature_pass_candidate'
  | 'signature_failed'
  | 'decrypt_pass_candidate'
  | 'decrypt_failed'
  | 'replay_candidate'
  | 'review_required'
  | 'archived';

export type WechatPayVerificationResult =
  | 'pass_candidate'
  | 'failed'
  | 'not_evaluated'
  | 'review_required';

@Entity('wechat_pay_crypto_verification_audit')
@Index('idx_wechat_pay_crypto_audit_callback', ['callbackEvidenceId'])
@Index('idx_wechat_pay_crypto_audit_provider_status', ['provider', 'status'])
@Index('idx_wechat_pay_crypto_audit_replay_hash', ['replayFingerprintHash'])
@Index('idx_wechat_pay_crypto_audit_created_at', ['createdAt'])
export class WechatPayCryptoVerificationAudit {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 80 })
  source!: string;

  @Column({
    type: 'enum',
    enum: ['wechat_pay_v3', 'wechat_pay_v3_official_like_dummy'],
  })
  provider!: WechatPayEvidenceProvider;

  @Column({
    type: 'enum',
    enum: [
      'audit_candidate',
      'signature_pass_candidate',
      'signature_failed',
      'decrypt_pass_candidate',
      'decrypt_failed',
      'replay_candidate',
      'review_required',
      'archived',
    ],
    default: 'audit_candidate',
  })
  status!: WechatPayCryptoVerificationAuditStatus;

  @Column({ name: 'callback_evidence_id', type: 'int', nullable: true })
  callbackEvidenceId!: number | null;

  @Column({
    name: 'signature_result',
    type: 'enum',
    enum: ['pass_candidate', 'failed', 'not_evaluated', 'review_required'],
    default: 'not_evaluated',
  })
  signatureResult!: WechatPayVerificationResult;

  @Column({
    name: 'decrypt_result',
    type: 'enum',
    enum: ['pass_candidate', 'failed', 'not_evaluated', 'review_required'],
    default: 'not_evaluated',
  })
  decryptResult!: WechatPayVerificationResult;

  @Column({ name: 'certificate_serial_hash', type: 'varchar', length: 128, nullable: true })
  certificateSerialHash!: string | null;

  @Column({ name: 'timestamp_value', type: 'varchar', length: 40, nullable: true })
  timestampValue!: string | null;

  @Column({ name: 'timestamp_window_result', type: 'varchar', length: 60, nullable: true })
  timestampWindowResult!: string | null;

  @Column({ name: 'nonce_hash', type: 'varchar', length: 128, nullable: true })
  nonceHash!: string | null;

  @Column({ name: 'replay_fingerprint_hash', type: 'varchar', length: 128, nullable: true })
  replayFingerprintHash!: string | null;

  @Column({ name: 'replay_check_result', type: 'varchar', length: 60, nullable: true })
  replayCheckResult!: string | null;

  @Column({ name: 'payload_hash', type: 'varchar', length: 128 })
  payloadHash!: string;

  @Column({ type: 'varchar', length: 128, unique: true })
  fingerprint!: string;

  @Column({ name: 'sanitized_payload', type: 'json', nullable: true })
  sanitizedPayload!: Record<string, unknown> | null;

  @Column({ name: 'redaction_version', type: 'varchar', length: 40 })
  redactionVersion!: string;

  @Column({ name: 'audited_at', type: 'datetime', nullable: true })
  auditedAt!: Date | null;

  @Column({ name: 'error_code', type: 'varchar', length: 80, nullable: true })
  errorCode!: string | null;

  @Column({ name: 'error_reason', type: 'varchar', length: 500, nullable: true })
  errorReason!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
