import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('wechat_settlement_receipt_link')
export class WechatSettlementReceiptLink {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'settlement_batch_id', type: 'int' })
  settlementBatchId!: number;

  @Column({ name: 'payment_receipt_id', type: 'int' })
  paymentReceiptId!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
