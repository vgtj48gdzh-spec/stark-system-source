import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export const BUSINESS_CONTRIBUTION_IDENTITY_KINDS = ['source', 'evidence'] as const;
export type BusinessContributionIdentityKind =
  (typeof BUSINESS_CONTRIBUTION_IDENTITY_KINDS)[number];

export const BUSINESS_CONTRIBUTION_IDENTITY_OWNER_KINDS = [
  'contribution',
  'contribution_evidence',
  'correction',
] as const;
export type BusinessContributionIdentityOwnerKind =
  (typeof BUSINESS_CONTRIBUTION_IDENTITY_OWNER_KINDS)[number];

/**
 * Shared transaction-serialized identity allocation ledger. Every formal
 * contribution, reversal and correction must allocate its source and evidence
 * identities here in the same transaction as the owning business row.
 */
@Entity('business_contribution_identity_allocations')
@Index('uq_bcia_identity', ['identityKind', 'identityHash'], { unique: true })
@Index('idx_bcia_owner', ['ownerKind', 'ownerId', 'identityKind'])
export class BusinessContributionIdentityAllocation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    name: 'identity_kind',
    type: 'enum',
    enum: BUSINESS_CONTRIBUTION_IDENTITY_KINDS,
    charset: 'ascii',
    collation: 'ascii_bin',
  })
  identityKind!: BusinessContributionIdentityKind;

  @Column({
    name: 'identity_hash',
    type: 'char',
    length: 64,
    charset: 'ascii',
    collation: 'ascii_bin',
  })
  identityHash!: string;

  @Column({
    name: 'owner_kind',
    type: 'enum',
    enum: BUSINESS_CONTRIBUTION_IDENTITY_OWNER_KINDS,
    charset: 'ascii',
    collation: 'ascii_bin',
  })
  ownerKind!: BusinessContributionIdentityOwnerKind;

  @Column({ name: 'owner_id', type: 'int' })
  ownerId!: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;
}

export const BUSINESS_CONTRIBUTION_IDENTITY_ALLOCATION_ENTITIES = [
  BusinessContributionIdentityAllocation,
] as const;
