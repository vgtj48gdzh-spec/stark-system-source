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
import { ApprovalStatus } from '../../../shared/enums/approval-status.enum';
import { ApprovalType } from '../../../shared/enums/approval-type.enum';
import { InventoryAdjustmentAction } from '../../../shared/enums/inventory-adjustment-action.enum';
import { InventoryTransaction } from '../../inventory-transactions/entities/inventory-transaction.entity';
import { PayoutRecord } from '../../payout-records/entities/payout-record.entity';
import { User } from '../../users/entities/user.entity';
import { WorkOrder } from '../../work-orders/entities/work-order.entity';
import { ApprovalLog } from './approval-log.entity';

@Entity('approval_requests')
export class ApprovalRequest {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'approval_no', type: 'varchar', length: 20, unique: true })
  approvalNo!: string;

  @Column({
    name: 'approval_type',
    type: 'enum',
    enum: ApprovalType,
    default: ApprovalType.PAYOUT,
  })
  approvalType!: ApprovalType;

  @Column({ name: 'related_work_order_id', nullable: true })
  relatedWorkOrderId!: number | null;

  @Column({ name: 'related_inventory_transaction_id', nullable: true })
  relatedInventoryTransactionId!: number | null;

  @Column({ name: 'request_idempotency_key', type: 'varchar', length: 96, nullable: true })
  requestIdempotencyKey!: string | null;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64, nullable: true })
  requestFingerprint!: string | null;

  @Column({
    name: 'inventory_adjustment_action',
    type: 'enum',
    enum: InventoryAdjustmentAction,
    nullable: true,
  })
  inventoryAdjustmentAction!: InventoryAdjustmentAction | null;

  @Column({ name: 'inventory_target_quantity', type: 'decimal', precision: 12, scale: 2, nullable: true })
  inventoryTargetQuantity!: string | null;

  @Column({ name: 'inventory_target_unit_price', type: 'decimal', precision: 12, scale: 2, nullable: true })
  inventoryTargetUnitPrice!: string | null;

  @Column({ name: 'execution_idempotency_key', type: 'varchar', length: 96, nullable: true })
  executionIdempotencyKey!: string | null;

  @Column({ name: 'execution_fingerprint', type: 'char', length: 64, nullable: true })
  executionFingerprint!: string | null;

  @Column({ name: 'applicant_user_id' })
  applicantUserId!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({ type: 'varchar', length: 500 })
  reason!: string;

  @Column({
    name: 'current_status',
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  currentStatus!: ApprovalStatus;

  @Column({ name: 'final_approver_id', nullable: true })
  finalApproverId!: number | null;

  @Column({ name: 'verification_code', type: 'varchar', length: 20, nullable: true })
  verificationCode!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => WorkOrder, (workOrder) => workOrder.approvalRequests, { nullable: true })
  @JoinColumn({ name: 'related_work_order_id' })
  relatedWorkOrder!: WorkOrder | null;

  @ManyToOne(() => InventoryTransaction, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'related_inventory_transaction_id' })
  relatedInventoryTransaction!: InventoryTransaction | null;

  @ManyToOne(() => User, (user) => user.submittedApprovalRequests)
  @JoinColumn({ name: 'applicant_user_id' })
  applicantUser!: User;

  @ManyToOne(() => User, (user) => user.approvedRequests, { nullable: true })
  @JoinColumn({ name: 'final_approver_id' })
  finalApprover!: User | null;

  @OneToMany(() => ApprovalLog, (approvalLog) => approvalLog.approvalRequest)
  approvalLogs!: ApprovalLog[];

  @OneToMany(() => PayoutRecord, (payoutRecord) => payoutRecord.approvalRequest)
  payoutRecords!: PayoutRecord[];
}
