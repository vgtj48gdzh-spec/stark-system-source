import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type WechatPayEvidenceProvider =
  | 'wechat_pay_v3'
  | 'wechat_pay_v3_official_like_dummy';

export type WechatPayCallbackEvidenceStatus =
  | 'received'
  | 'signature_failed'
  | 'decrypt_failed'
  | 'parsed'
  | 'linked_to_payment_request'
  | 'linked_to_collection_order'
  | 'duplicate'
  | 'exception_candidate'
  | 'review_required'
  | 'archived';

@Entity('wechat_pay_callback_evidence')
@Index('idx_wechat_pay_callback_evidence_provider_status', ['provider', 'status'])
@Index('idx_wechat_pay_callback_evidence_transaction_hash', ['transactionIdHash'])
@Index('idx_wechat_pay_callback_evidence_out_trade_hash', ['outTradeNoHash'])
@Index('idx_wechat_pay_callback_evidence_created_at', ['createdAt'])
export class WechatPayCallbackEvidence {
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
      'received',
      'signature_failed',
      'decrypt_failed',
      'parsed',
      'linked_to_payment_request',
      'linked_to_collection_order',
      'duplicate',
      'exception_candidate',
      'review_required',
      'archived',
    ],
    default: 'received',
  })
  status!: WechatPayCallbackEvidenceStatus;

  @Column({ name: 'event_type', type: 'varchar', length: 80, nullable: true })
  eventType!: string | null;

  @Column({ name: 'resource_type', type: 'varchar', length: 120, nullable: true })
  resourceType!: string | null;

  @Column({ name: 'notification_id_hash', type: 'varchar', length: 128, nullable: true })
  notificationIdHash!: string | null;

  @Column({ name: 'transaction_id_hash', type: 'varchar', length: 128, nullable: true })
  transactionIdHash!: string | null;

  @Column({ name: 'out_trade_no_hash', type: 'varchar', length: 128, nullable: true })
  outTradeNoHash!: string | null;

  @Column({ name: 'finance_payment_request_id', type: 'int', nullable: true })
  financePaymentRequestId!: number | null;

  @Column({ name: 'finance_collection_order_id', type: 'int', nullable: true })
  financeCollectionOrderId!: number | null;

  @Column({ name: 'amount_total_cents', type: 'int', nullable: true })
  amountTotalCents!: number | null;

  @Column({ name: 'payer_total_cents', type: 'int', nullable: true })
  payerTotalCents!: number | null;

  @Column({ type: 'varchar', length: 12, nullable: true })
  currency!: string | null;

  @Column({ name: 'trade_state', type: 'varchar', length: 80, nullable: true })
  tradeState!: string | null;

  @Column({ name: 'success_time', type: 'datetime', nullable: true })
  successTime!: Date | null;

  @Column({ name: 'payload_hash', type: 'varchar', length: 128 })
  payloadHash!: string;

  @Column({ type: 'varchar', length: 128, unique: true })
  fingerprint!: string;

  @Column({ name: 'sanitized_payload', type: 'json', nullable: true })
  sanitizedPayload!: Record<string, unknown> | null;

  @Column({ name: 'redaction_version', type: 'varchar', length: 40 })
  redactionVersion!: string;

  @Column({ name: 'received_at', type: 'datetime', nullable: true })
  receivedAt!: Date | null;

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
