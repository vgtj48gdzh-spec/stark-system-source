import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PaymentStatus } from '../../../shared/enums/payment-status.enum';
import { User } from '../../users/entities/user.entity';
import { WorkOrder } from '../../work-orders/entities/work-order.entity';

@Entity('payment_records')
export class PaymentRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'payment_no', type: 'varchar', length: 20, unique: true })
  paymentNo!: string;

  @Column({ name: 'work_order_id' })
  workOrderId!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({ name: 'payment_method', type: 'varchar', length: 30 })
  paymentMethod!: string;

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus!: PaymentStatus;

  @Column({ name: 'paid_at', type: 'datetime', nullable: true })
  paidAt!: Date | null;

  @Column({ name: 'payer_name', type: 'varchar', length: 100, nullable: true })
  payerName!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'created_by' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => WorkOrder, (workOrder) => workOrder.paymentRecords)
  @JoinColumn({ name: 'work_order_id' })
  workOrder!: WorkOrder;

  @ManyToOne(() => User, (user) => user.createdPaymentRecords)
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User;
}
