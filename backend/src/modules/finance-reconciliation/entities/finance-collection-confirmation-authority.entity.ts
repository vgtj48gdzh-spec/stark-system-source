import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FinanceCollectionOrder } from './finance-collection-order.entity';

export const FINANCE_CONFIRMATION_SOURCE_MODES = ['bank_transfer_one_to_one_v1'] as const;
export type FinanceConfirmationSourceMode = (typeof FINANCE_CONFIRMATION_SOURCE_MODES)[number];

/**
 * Immutable, typed authority row that proves a single repair maintenance work
 * order was formally confirmed from a one-to-one direct bank transfer.
 *
 * The service only ever INSERTs; update/delete are forbidden. Uniqueness is
 * enforced both by database constraints and by the transactional service.
 */
@Entity('finance_collection_confirmation_authorities')
@Index('uq_fcca_collection_order', ['collectionOrderId'], { unique: true })
@Index('uq_fcca_bank_transaction', ['bankTransactionId'], { unique: true })
@Index('uq_fcca_reconciliation_link', ['reconciliationLinkId'], { unique: true })
export class FinanceCollectionConfirmationAuthority {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'collection_order_id', type: 'int' })
  collectionOrderId!: number;

  @Column({ name: 'source_mode', type: 'varchar', length: 64 })
  sourceMode!: FinanceConfirmationSourceMode;

  @Column({ name: 'source_version', type: 'varchar', length: 32 })
  sourceVersion!: string;

  @Column({ name: 'company_id', type: 'int' })
  companyId!: number;

  @Column({ name: 'company_ref', type: 'varchar', length: 100 })
  companyRef!: string;

  @Column({ name: 'business_sector_ref', type: 'varchar', length: 100, nullable: true })
  businessSectorRef!: string | null;

  @Column({ name: 'store_ref', type: 'varchar', length: 100, nullable: true })
  storeRef!: string | null;

  @Column({ name: 'customer_ref', type: 'varchar', length: 100, nullable: true })
  customerRef!: string | null;

  @Column({ name: 'profile_scope_snapshot_hash', type: 'char', length: 64 })
  profileScopeSnapshotHash!: string;

  /**
   * The repair-work-order-profile `version` value captured at confirmation
   * time. It is an audit snapshot only and is NOT required to equal the
   * profile's later (incremented) version, so a legitimate delivery transition
   * after confirmation does not invalidate the authority.
   */
  @Column({ name: 'profile_scope_version', type: 'int' })
  profileScopeVersion!: number;

  @Column({ name: 'work_order_id', type: 'int' })
  workOrderId!: number;

  @Column({ name: 'bank_transaction_id', type: 'int' })
  bankTransactionId!: number;

  @Column({ name: 'reconciliation_link_id', type: 'int' })
  reconciliationLinkId!: number;

  @Column({ name: 'bank_account_registry_id', type: 'int' })
  bankAccountRegistryId!: number;

  @Column({ name: 'bank_account_registry_updated_at', type: 'datetime', precision: 6 })
  bankAccountRegistryUpdatedAt!: Date;

  @Column({ name: 'bank_account_registry_snapshot_hash', type: 'char', length: 64 })
  bankAccountRegistrySnapshotHash!: string;

  @Column({ name: 'gross_cents', type: 'bigint' })
  grossCents!: string;

  @Column({ name: 'net_cents', type: 'bigint' })
  netCents!: string;

  @Column({ name: 'fee_cents', type: 'bigint' })
  feeCents!: string;

  @Column({ type: 'char', length: 3, default: 'CNY' })
  currency!: 'CNY';

  @Column({ name: 'bank_snapshot_hash', type: 'char', length: 64 })
  bankSnapshotHash!: string;

  @Column({ name: 'link_snapshot_hash', type: 'char', length: 64 })
  linkSnapshotHash!: string;

  @Column({ name: 'work_order_snapshot_hash', type: 'char', length: 64 })
  workOrderSnapshotHash!: string;

  @Column({ name: 'canonical_snapshot_hash', type: 'char', length: 64 })
  canonicalSnapshotHash!: string;

  @Column({ name: 'source_occurred_at', type: 'datetime', precision: 6 })
  sourceOccurredAt!: Date;

  @Column({ name: 'authority_confirmed_at', type: 'datetime', precision: 6 })
  authorityConfirmedAt!: Date;

  @Column({ name: 'confirmed_by', type: 'int' })
  confirmedBy!: number;

  @Column({ name: 'reason_code', type: 'varchar', length: 64 })
  reasonCode!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;

  @OneToOne(() => FinanceCollectionOrder, (order) => order.formalConfirmationAuthority)
  @JoinColumn({ name: 'collection_order_id' })
  collectionOrder!: FinanceCollectionOrder;
}
