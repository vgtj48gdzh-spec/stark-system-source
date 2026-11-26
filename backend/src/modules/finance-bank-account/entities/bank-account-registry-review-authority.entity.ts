import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('bank_account_registry_review_authority')
@Index('uq_barra_registry_version', ['registryId', 'contentVersion'], { unique: true })
@Index('uq_barra_authority_hash', ['authorityHash'], { unique: true })
export class BankAccountRegistryReviewAuthority {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'registry_id', type: 'int' })
  registryId!: number;

  @Column({ name: 'content_version', type: 'int' })
  contentVersion!: number;

  @Column({ name: 'content_snapshot_hash', type: 'char', length: 64 })
  contentSnapshotHash!: string;

  @Column({ type: 'enum', enum: ['approved', 'rejected'] })
  decision!: 'approved' | 'rejected';

  @Column({ name: 'reviewed_by', type: 'int' })
  reviewedBy!: number;

  @Column({ name: 'reviewed_at', type: 'datetime', precision: 6 })
  reviewedAt!: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'authority_hash', type: 'char', length: 64 })
  authorityHash!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;
}
