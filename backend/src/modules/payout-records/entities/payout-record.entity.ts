import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApprovalRequest } from '../../approval-requests/entities/approval-request.entity';
import { User } from '../../users/entities/user.entity';

@Entity('payout_records')
export class PayoutRecord {
  @Column({ name: 'material_installment_id', type: 'int', nullable: true, unique: true })
  materialInstallmentId!: number | null;

  @Column({ name: 'request_idempotency_key', type: 'varchar', length: 96, nullable: true, unique: true })
  requestIdempotencyKey!: string | null;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64, nullable: true })
  requestFingerprint!: string | null;

  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'payout_no', type: 'varchar', length: 20, unique: true })
  payoutNo!: string;

  @Column({ name: 'approval_request_id' })
  approvalRequestId!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({ name: 'payee_name', type: 'varchar', length: 100 })
  payeeName!: string;

  @Column({ name: 'payment_method', type: 'varchar', length: 30 })
  paymentMethod!: string;

  @Column({ name: 'paid_at', type: 'datetime' })
  paidAt!: Date;

  @Column({ name: 'created_by' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => ApprovalRequest, (approvalRequest) => approvalRequest.payoutRecords)
  @JoinColumn({ name: 'approval_request_id' })
  approvalRequest!: ApprovalRequest;

  @ManyToOne(() => User, (user) => user.createdPayoutRecords)
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User;
}
