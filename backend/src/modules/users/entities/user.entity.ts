import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApprovalRequest } from '../../approval-requests/entities/approval-request.entity';
import { OperationLog } from '../../operation-logs/entities/operation-log.entity';
import { PaymentRecord } from '../../payment-records/entities/payment-record.entity';
import { PayoutRecord } from '../../payout-records/entities/payout-record.entity';
import { UserRole } from '../../roles/entities/user-role.entity';
import { WorkOrder } from '../../work-orders/entities/work-order.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  username!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ name: 'real_name', type: 'varchar', length: 50 })
  realName!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  mobile!: string | null;

  @Column({ type: 'tinyint', default: 1 })
  status!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => UserRole, (userRole) => userRole.user)
  userRoles!: UserRole[];

  @OneToMany(() => WorkOrder, (workOrder) => workOrder.responsibleUser)
  responsibleWorkOrders!: WorkOrder[];

  @OneToMany(() => WorkOrder, (workOrder) => workOrder.createdByUser)
  createdWorkOrders!: WorkOrder[];

  @OneToMany(() => PaymentRecord, (paymentRecord) => paymentRecord.createdByUser)
  createdPaymentRecords!: PaymentRecord[];

  @OneToMany(() => ApprovalRequest, (approvalRequest) => approvalRequest.applicantUser)
  submittedApprovalRequests!: ApprovalRequest[];

  @OneToMany(() => ApprovalRequest, (approvalRequest) => approvalRequest.finalApprover)
  approvedRequests!: ApprovalRequest[];

  @OneToMany(() => PayoutRecord, (payoutRecord) => payoutRecord.createdByUser)
  createdPayoutRecords!: PayoutRecord[];

  @OneToMany(() => OperationLog, (operationLog) => operationLog.operator)
  operationLogs!: OperationLog[];
}
