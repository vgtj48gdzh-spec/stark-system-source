import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('company_registry')
export class CompanyRegistryAnchor {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'company_name', type: 'varchar', length: 200 })
  companyName!: string;

  @Column({ name: 'company_short_name', type: 'varchar', length: 100, nullable: true })
  companyShortName!: string | null;

  @Column({ type: 'varchar', length: 32 })
  status!: 'active' | 'inactive';

  @Column({ name: 'review_status', type: 'varchar', length: 32 })
  reviewStatus!: 'pending' | 'approved' | 'rejected';
}

@Entity('business_company_refs')
@Index('uq_business_company_ref', ['companyRef'], { unique: true })
@Index('uq_business_company_registry_id', ['companyRegistryId'], { unique: true })
export class BusinessCompanyRef {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'company_ref', type: 'varchar', length: 100 })
  companyRef!: string;

  @Column({ name: 'company_registry_id', type: 'int' })
  companyRegistryId!: number;

  @Column({ name: 'display_name_snapshot', type: 'varchar', length: 200 })
  displayNameSnapshot!: string;

  @Column({ type: 'varchar', length: 24, default: 'active' })
  status!: 'active' | 'inactive';

  @Column({ name: 'valid_from', type: 'datetime' })
  validFrom!: Date;

  @Column({ name: 'valid_until', type: 'datetime', nullable: true })
  validUntil!: Date | null;

  @Column({ name: 'evidence_ref', type: 'varchar', length: 255 })
  evidenceRef!: string;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'reviewed_by', type: 'int' })
  reviewedBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('business_sectors')
@Index('uq_business_sector_ref', ['businessSectorRef'], { unique: true })
@Index('uq_business_sector_code', ['code'], { unique: true })
export class BusinessSector {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'business_sector_ref', type: 'varchar', length: 100 })
  businessSectorRef!: string;

  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 24, default: 'active' })
  status!: 'active' | 'inactive';

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('company_sector_assignments')
@Index('uq_company_sector_assignment', ['companyRef', 'businessSectorRef'], { unique: true })
export class CompanySectorAssignment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'company_ref', type: 'varchar', length: 100 })
  companyRef!: string;

  @Column({ name: 'business_sector_ref', type: 'varchar', length: 100 })
  businessSectorRef!: string;

  @Column({ type: 'varchar', length: 24, default: 'active' })
  status!: 'active' | 'inactive';

  @Column({ name: 'valid_from', type: 'datetime' })
  validFrom!: Date;

  @Column({ name: 'valid_until', type: 'datetime', nullable: true })
  validUntil!: Date | null;

  @Column({ name: 'authorization_source', type: 'varchar', length: 255 })
  authorizationSource!: string;

  @Column({ name: 'reviewed_by', type: 'int' })
  reviewedBy!: number;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('business_stores')
@Index('uq_business_store_ref', ['storeRef'], { unique: true })
@Index('uq_business_store_company_code', ['companyRef', 'code'], { unique: true })
export class BusinessStore {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'store_ref', type: 'varchar', length: 100 })
  storeRef!: string;

  @Column({ name: 'company_ref', type: 'varchar', length: 100 })
  companyRef!: string;

  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 24, default: 'active' })
  status!: 'active' | 'inactive';

  @Column({ name: 'valid_from', type: 'datetime' })
  validFrom!: Date;

  @Column({ name: 'valid_until', type: 'datetime', nullable: true })
  validUntil!: Date | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('store_sector_assignments')
@Index('uq_store_sector_assignment', ['storeRef', 'businessSectorRef'], { unique: true })
export class StoreSectorAssignment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'store_ref', type: 'varchar', length: 100 })
  storeRef!: string;

  @Column({ name: 'business_sector_ref', type: 'varchar', length: 100 })
  businessSectorRef!: string;

  @Column({ type: 'varchar', length: 24, default: 'active' })
  status!: 'active' | 'inactive';

  @Column({ name: 'valid_from', type: 'datetime' })
  validFrom!: Date;

  @Column({ name: 'valid_until', type: 'datetime', nullable: true })
  validUntil!: Date | null;

  @Column({ name: 'authorization_source', type: 'varchar', length: 255 })
  authorizationSource!: string;

  @Column({ name: 'reviewed_by', type: 'int' })
  reviewedBy!: number;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('customer_master_records')
@Index('uq_customer_master_ref', ['customerRef'], { unique: true })
@Index('uq_customer_master_legacy_binding', ['legacyIdentificationBindingId'], { unique: true })
export class CustomerMasterRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'customer_ref', type: 'varchar', length: 100 })
  customerRef!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 120 })
  displayName!: string;

  @Column({ name: 'mobile_masked', type: 'varchar', length: 32, nullable: true })
  mobileMasked!: string | null;

  @Column({ name: 'legacy_identification_binding_id', type: 'int', nullable: true })
  legacyIdentificationBindingId!: number | null;

  @Column({ type: 'varchar', length: 24, default: 'active' })
  status!: 'active' | 'merged' | 'blocked' | 'inactive';

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'reviewed_by', type: 'int' })
  reviewedBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('customer_organization_relationships')
@Index('uq_customer_organization_relationship', ['customerRef', 'companyRef', 'storeScopeKey'], {
  unique: true,
})
export class CustomerOrganizationRelationship {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'customer_ref', type: 'varchar', length: 100 })
  customerRef!: string;

  @Column({ name: 'company_ref', type: 'varchar', length: 100 })
  companyRef!: string;

  @Column({ name: 'store_ref', type: 'varchar', length: 100, nullable: true })
  storeRef!: string | null;

  @Column({
    name: 'store_scope_key',
    type: 'varchar',
    length: 100,
    asExpression: "COALESCE(`store_ref`, '*')",
    generatedType: 'STORED',
    select: false,
    insert: false,
    update: false,
  })
  storeScopeKey!: string;

  @Column({ type: 'varchar', length: 24, default: 'active' })
  status!: 'active' | 'inactive';

  @Column({ name: 'valid_from', type: 'datetime' })
  validFrom!: Date;

  @Column({ name: 'valid_until', type: 'datetime', nullable: true })
  validUntil!: Date | null;

  @Column({ name: 'relationship_source', type: 'varchar', length: 255 })
  relationshipSource!: string;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('business_scope_grants')
@Index('idx_business_scope_grant_subject', ['userId', 'employeeId', 'status'])
export class BusinessScopeGrant {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id', type: 'int' })
  userId!: number;

  @Column({ name: 'employee_id', type: 'int' })
  employeeId!: number;

  @Column({ name: 'company_ref', type: 'varchar', length: 100 })
  companyRef!: string;

  @Column({ name: 'business_sector_ref', type: 'varchar', length: 100, nullable: true })
  businessSectorRef!: string | null;

  @Column({ name: 'store_ref', type: 'varchar', length: 100, nullable: true })
  storeRef!: string | null;

  @Column({ name: 'customer_ref', type: 'varchar', length: 100, nullable: true })
  customerRef!: string | null;

  @Column({ type: 'varchar', length: 16 })
  effect!: 'allow' | 'deny';

  @Column({ type: 'json' })
  permissions!: string[];

  @Column({ type: 'varchar', length: 24, default: 'active' })
  status!: 'active' | 'revoked';

  @Column({ name: 'valid_from', type: 'datetime' })
  validFrom!: Date;

  @Column({ name: 'valid_until', type: 'datetime', nullable: true })
  validUntil!: Date | null;

  @Column({ name: 'authorization_source', type: 'varchar', length: 255 })
  authorizationSource!: string;

  @Column({ name: 'reviewed_by', type: 'int' })
  reviewedBy!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

export const BUSINESS_FOUNDATION_ENTITIES = [
  CompanyRegistryAnchor,
  BusinessCompanyRef,
  BusinessSector,
  CompanySectorAssignment,
  BusinessStore,
  StoreSectorAssignment,
  CustomerMasterRecord,
  CustomerOrganizationRelationship,
  BusinessScopeGrant,
] as const;
