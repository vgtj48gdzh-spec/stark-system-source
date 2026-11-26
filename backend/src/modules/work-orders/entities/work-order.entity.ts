import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WorkOrderStatus } from '../../../shared/enums/work-order-status.enum';
import { ApprovalRequest } from '../../approval-requests/entities/approval-request.entity';
import { PaymentRecord } from '../../payment-records/entities/payment-record.entity';
import { User } from '../../users/entities/user.entity';
import { WorkOrderMaterial } from '../../work-order-materials/entities/work-order-material.entity';

@Entity('work_orders')
export class WorkOrder {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'work_order_no', type: 'varchar', length: 20, unique: true })
  workOrderNo!: string;

  @Column({ type: 'varchar', length: 100 })
  title!: string;

  @Column({ name: 'customer_name', type: 'varchar', length: 100 })
  customerName!: string;

  @Column({ name: 'customer_mobile', type: 'varchar', length: 20, nullable: true })
  customerMobile!: string | null;

  @Column({ name: 'amount_due', type: 'decimal', precision: 12, scale: 2 })
  amountDue!: string;

  @Column({
    name: 'amount_received',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: '0.00',
  })
  amountReceived!: string;

  @Column({
    name: 'material_cost_total',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: '0.00',
  })
  materialCostTotal!: string;

  @Column({
    type: 'enum',
    enum: WorkOrderStatus,
    default: WorkOrderStatus.PENDING_PAYMENT,
  })
  status!: WorkOrderStatus;

  @Column({ name: 'responsible_user_id', nullable: true })
  responsibleUserId!: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'created_by' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.responsibleWorkOrders, { nullable: true })
  @JoinColumn({ name: 'responsible_user_id' })
  responsibleUser!: User | null;

  @ManyToOne(() => User, (user) => user.createdWorkOrders)
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User;

  @OneToMany(() => PaymentRecord, (paymentRecord) => paymentRecord.workOrder)
  paymentRecords!: PaymentRecord[];

  @OneToMany(() => ApprovalRequest, (approvalRequest) => approvalRequest.relatedWorkOrder)
  approvalRequests!: ApprovalRequest[];

  @OneToMany(() => WorkOrderMaterial, (workOrderMaterial) => workOrderMaterial.workOrder)
  workOrderMaterials!: WorkOrderMaterial[];
}
