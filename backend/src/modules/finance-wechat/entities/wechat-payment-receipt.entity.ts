import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('wechat_payment_receipt')
export class WechatPaymentReceipt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId!: number;

  @Column({ name: 'merchant_id', type: 'varchar', length: 100 })
  merchantId!: string;

  @Column({ name: 'work_order_id', type: 'int', nullable: true })
  workOrderId!: number | null;

  @Column({ name: 'out_trade_no', type: 'varchar', length: 100 })
  outTradeNo!: string;

  @Column({ name: 'transaction_id', type: 'varchar', length: 100 })
  transactionId!: string;

  @Column({ name: 'payer_ref', type: 'varchar', length: 100, nullable: true })
  payerRef!: string | null;

  @Column({ name: 'amount_paid', type: 'decimal', precision: 12, scale: 2 })
  amountPaid!: string;

  @Column({ name: 'paid_at', type: 'datetime' })
  paidAt!: Date;

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: ['paid_confirmed', 'refunded', 'closed'],
    default: 'paid_confirmed',
  })
  paymentStatus!: 'paid_confirmed' | 'refunded' | 'closed';

  @Column({
    name: 'settlement_status',
    type: 'enum',
    enum: ['pending_settlement', 'batched', 'settled', 'exception'],
    default: 'pending_settlement',
  })
  settlementStatus!: 'pending_settlement' | 'batched' | 'settled' | 'exception';

  @Column({
    name: 'source_type',
    type: 'enum',
    enum: ['api', 'manual_import'],
    default: 'manual_import',
  })
  sourceType!: 'api' | 'manual_import';

  @Column({ name: 'raw_payload', type: 'json' })
  rawPayload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
