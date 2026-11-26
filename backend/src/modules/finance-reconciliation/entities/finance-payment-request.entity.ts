import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FinanceCollectionOrder } from './finance-collection-order.entity';

export type FinancePaymentRequestProvider =
  | 'enterprise_wechat'
  | 'wechat_pay'
  | 'alipay'
  | 'mock'
  | 'enterprise_wechat_mock';

export type FinancePaymentRequestChannel =
  | 'enterprise_wechat'
  | 'wechat'
  | 'alipay'
  | 'mini_program'
  | 'old_qr'
  | 'other';

export type FinancePaymentRequestStatus =
  | 'created'
  | 'qr_generated'
  | 'waiting_payment'
  | 'paid_by_channel'
  | 'expired'
  | 'cancelled'
  | 'failed'
  | 'refunded';

@Entity('finance_payment_request')
export class FinancePaymentRequest {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'payment_request_no', type: 'varchar', length: 40, unique: true })
  paymentRequestNo!: string;

  @Column({ name: 'collection_order_id', type: 'int' })
  collectionOrderId!: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId!: number;

  @Column({
    type: 'enum',
    enum: ['enterprise_wechat', 'wechat_pay', 'alipay', 'mock', 'enterprise_wechat_mock'],
  })
  provider!: FinancePaymentRequestProvider;

  @Column({
    name: 'payment_channel',
    type: 'enum',
    enum: ['enterprise_wechat', 'wechat', 'alipay', 'mini_program', 'old_qr', 'other'],
  })
  paymentChannel!: FinancePaymentRequestChannel;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({ name: 'payer_phone', type: 'varchar', length: 20, nullable: true })
  payerPhone!: string | null;

  @Column({ name: 'payer_customer_id', type: 'varchar', length: 100, nullable: true })
  payerCustomerId!: string | null;

  @Column({ name: 'created_by_employee_id', type: 'int', nullable: true })
  createdByEmployeeId!: number | null;

  @Column({
    name: 'request_status',
    type: 'enum',
    enum: [
      'created',
      'qr_generated',
      'waiting_payment',
      'paid_by_channel',
      'expired',
      'cancelled',
      'failed',
      'refunded',
    ],
    default: 'created',
  })
  requestStatus!: FinancePaymentRequestStatus;

  @Column({ name: 'qr_url', type: 'varchar', length: 500, nullable: true })
  qrUrl!: string | null;

  @Column({ name: 'payment_url', type: 'varchar', length: 500, nullable: true })
  paymentUrl!: string | null;

  @Column({ name: 'channel_app_id', type: 'varchar', length: 100, nullable: true })
  channelAppId!: string | null;

  @Column({ name: 'channel_mch_id', type: 'varchar', length: 100, nullable: true })
  channelMchId!: string | null;

  @Column({ name: 'channel_trade_no', type: 'varchar', length: 100, nullable: true })
  channelTradeNo!: string | null;

  @Column({ name: 'channel_prepay_id', type: 'varchar', length: 100, nullable: true })
  channelPrepayId!: string | null;

  @Column({ name: 'expire_at', type: 'datetime', nullable: true })
  expireAt!: Date | null;

  @Column({ name: 'paid_at', type: 'datetime', nullable: true })
  paidAt!: Date | null;

  @Column({ name: 'failed_at', type: 'datetime', nullable: true })
  failedAt!: Date | null;

  @Column({ name: 'cancelled_at', type: 'datetime', nullable: true })
  cancelledAt!: Date | null;

  @Column({ name: 'refunded_at', type: 'datetime', nullable: true })
  refundedAt!: Date | null;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 120, unique: true })
  idempotencyKey!: string;

  @Column({ name: 'request_payload', type: 'json', nullable: true })
  requestPayload!: Record<string, unknown> | null;

  @Column({ name: 'response_payload', type: 'json', nullable: true })
  responsePayload!: Record<string, unknown> | null;

  @Column({ name: 'callback_payload', type: 'json', nullable: true })
  callbackPayload!: Record<string, unknown> | null;

  @Column({ name: 'last_error_code', type: 'varchar', length: 80, nullable: true })
  lastErrorCode!: string | null;

  @Column({ name: 'last_error_message', type: 'varchar', length: 500, nullable: true })
  lastErrorMessage!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => FinanceCollectionOrder, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'collection_order_id' })
  collectionOrder!: FinanceCollectionOrder;
}
