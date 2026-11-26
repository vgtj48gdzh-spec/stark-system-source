import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { WechatPayEvidenceProvider } from './wechat-pay-callback-evidence.entity';

export type WechatPaySettlementEvidenceStatus =
  | 'pending_bank_match'
  | 'bank_matched'
  | 'fee_candidate'
  | 'settlement_mismatch'
  | 'matched_pending_confirmation'
  | 'review_required'
  | 'manual_confirmation_terminal_reserved';

export type WechatPaySettlementEvidenceSource =
  | 'callback'
  | 'transaction_bill'
  | 'fund_bill'
  | 'bank_sms_candidate'
  | 'manual_upload'
  | 'self_check';

@Entity('wechat_pay_settlement_evidence')
@Index('idx_wechat_pay_settlement_provider_status', ['provider', 'status'])
@Index('idx_wechat_pay_settlement_transaction_hash', ['transactionIdHash'])
@Index('idx_wechat_pay_settlement_out_trade_hash', ['outTradeNoHash'])
@Index('idx_wechat_pay_settlement_bank_sms', ['bankSmsTransactionId'])
@Index('idx_wechat_pay_settlement_created_at', ['createdAt'])
export class WechatPaySettlementEvidence {
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
      'pending_bank_match',
      'bank_matched',
      'fee_candidate',
      'settlement_mismatch',
      'matched_pending_confirmation',
      'review_required',
      'manual_confirmation_terminal_reserved',
    ],
    default: 'pending_bank_match',
  })
  status!: WechatPaySettlementEvidenceStatus;

  @Column({ name: 'transaction_id_hash', type: 'varchar', length: 128, nullable: true })
  transactionIdHash!: string | null;

  @Column({ name: 'out_trade_no_hash', type: 'varchar', length: 128, nullable: true })
  outTradeNoHash!: string | null;

  @Column({ name: 'finance_payment_request_id', type: 'int', nullable: true })
  financePaymentRequestId!: number | null;

  @Column({ name: 'finance_collection_order_id', type: 'int', nullable: true })
  financeCollectionOrderId!: number | null;

  @Column({ name: 'bank_sms_transaction_id', type: 'int', nullable: true })
  bankSmsTransactionId!: number | null;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  paidAmount!: string | null;

  @Column({
    name: 'settlement_amount_candidate',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  settlementAmountCandidate!: string | null;

  @Column({
    name: 'fee_amount_candidate',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  feeAmountCandidate!: string | null;

  @Column({ name: 'settlement_currency', type: 'varchar', length: 12, nullable: true })
  settlementCurrency!: string | null;

  @Column({ name: 'transaction_bill_hash', type: 'varchar', length: 128, nullable: true })
  transactionBillHash!: string | null;

  @Column({ name: 'fund_bill_hash', type: 'varchar', length: 128, nullable: true })
  fundBillHash!: string | null;

  @Column({ name: 'bank_arrival_fingerprint_hash', type: 'varchar', length: 128, nullable: true })
  bankArrivalFingerprintHash!: string | null;

  @Column({
    name: 'evidence_source',
    type: 'enum',
    enum: [
      'callback',
      'transaction_bill',
      'fund_bill',
      'bank_sms_candidate',
      'manual_upload',
      'self_check',
    ],
  })
  evidenceSource!: WechatPaySettlementEvidenceSource;

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
