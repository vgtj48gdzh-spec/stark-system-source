import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ApprovalRequest } from './approval-request.entity';

@Entity('approval_logs')
export class ApprovalLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'approval_request_id' })
  approvalRequestId!: number;

  @Column({ name: 'action_by' })
  actionBy!: number;

  @Column({ name: 'action_type', type: 'varchar', length: 30 })
  actionType!: string;

  @Column({ name: 'action_remark', type: 'varchar', length: 500, nullable: true })
  actionRemark!: string | null;

  @CreateDateColumn({ name: 'action_at' })
  actionAt!: Date;

  @ManyToOne(() => ApprovalRequest, (approvalRequest) => approvalRequest.approvalLogs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'approval_request_id' })
  approvalRequest!: ApprovalRequest;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'action_by' })
  actionByUser!: User;
}
