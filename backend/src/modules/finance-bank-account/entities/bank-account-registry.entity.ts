import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BankAccountRegistryReviewAuthority } from './bank-account-registry-review-authority.entity';

@Entity('bank_account_registry')
export class BankAccountRegistry {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId!: number;

  @Column({ name: 'bank_name', type: 'varchar', length: 100 })
  bankName!: string;

  @Column({ name: 'sms_sender', type: 'varchar', length: 100 })
  smsSender!: string;

  @Column({ name: 'account_tail', type: 'varchar', length: 8 })
  accountTail!: string;

  @Column({ name: 'account_alias', type: 'varchar', length: 100 })
  accountAlias!: string;

  @Column({ name: 'account_holder', type: 'varchar', length: 100, nullable: true })
  accountHolder!: string | null;

  @Column({ name: 'virtual_ledger_id', type: 'int', nullable: true })
  virtualLedgerId!: number | null;

  @Column({ name: 'account_use', type: 'varchar', length: 80, nullable: true })
  accountUse!: string | null;

  @Column({ name: 'evidence_source', type: 'varchar', length: 200, nullable: true })
  evidenceSource!: string | null;

  @Column({ name: 'evidence_ref', type: 'varchar', length: 200, nullable: true })
  evidenceRef!: string | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy!: number | null;

  @Column({ name: 'last_edited_by', type: 'int', nullable: true })
  lastEditedBy!: number | null;

  @Column({ name: 'reviewed_by', type: 'int', nullable: true })
  reviewedBy!: number | null;

  @Column({
    name: 'review_status',
    type: 'enum',
    enum: ['pending_review', 'reviewed', 'rejected'],
    default: 'pending_review',
  })
  reviewStatus!: 'pending_review' | 'reviewed' | 'rejected';

  @Column({ name: 'review_remark', type: 'varchar', length: 500, nullable: true })
  reviewRemark!: string | null;

  @Column({ name: 'content_version', type: 'int', default: 1 })
  contentVersion!: number;

  @Column({ name: 'formal_review_authority_id', type: 'int', nullable: true })
  @Index('uq_bank_account_registry_formal_review_authority', { unique: true })
  formalReviewAuthorityId!: number | null;

  @Column({ name: 'formal_review_authority_hash', type: 'char', length: 64, nullable: true })
  formalReviewAuthorityHash!: string | null;

  @ManyToOne(() => BankAccountRegistryReviewAuthority, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'formal_review_authority_id' })
  formalReviewAuthority!: BankAccountRegistryReviewAuthority | null;

  @Column({ name: 'device_id', type: 'varchar', length: 100, nullable: true })
  deviceId!: string | null;

  @Column({ name: 'sim_slot', type: 'int', nullable: true })
  simSlot!: number | null;

  @Column({ type: 'enum', enum: ['active', 'inactive'], default: 'active' })
  status!: 'active' | 'inactive';

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
