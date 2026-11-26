import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

const candidateTable = 'hq_fund_approval_candidate';
const evidenceTable = 'hq_fund_approval_evidence';
const guardTable = 'hq_fund_approval_guard';
const auditEventTable = 'hq_fund_approval_audit_event';

const candidateStatuses = [
  'discovered',
  'evidence_ready',
  'owner_review_required',
  'rejected',
  'approved_for_draft',
  'converted_to_payment_intent',
];

const candidateTypes = [
  'work_order_reimbursement',
  'material_payment',
  'supplier_payment',
  'merchant_settlement',
  'reward_withdrawal',
  'top_up_reconciliation_evidence',
  'deposit_reconciliation_evidence',
  'shopping_card_reconciliation_evidence',
  'public_car_expense',
  'supermarket_retail_settlement',
];

const evidenceTypes = [
  'work_order_record',
  'staff_work_record',
  'warehouse_material_record',
  'material_usage_record',
  'supplier_profile',
  'supplier_invoice',
  'supplier_quote',
  'purchase_or_receipt_record',
  'merchant_settlement_record',
  'reward_withdrawal_request',
  'bank_sms_evidence',
  'payment_callback_reference',
  'card_or_deposit_record',
  'public_car_apply_record',
  'supermarket_order_record',
  'attachment_metadata',
  'legacy_context_reference',
];

const guardTypes = [
  'source_authority_guard',
  'company_subject_guard',
  'work_order_guard',
  'warehouse_material_guard',
  'material_usage_guard',
  'duplicate_material_payment_guard',
  'supplier_identity_guard',
  'supplier_invoice_guard',
  'supplier_account_guard',
  'merchant_identity_guard',
  'reward_withdrawal_guard',
  'amount_consistency_guard',
  'bank_account_registry_guard',
  'bank_confirmation_guard',
  'virtual_ledger_guard',
  'owner_review_guard',
  'redaction_guard',
  'audit_guard',
  'idempotency_guard',
  'rollback_guard',
];

const guardStatuses = [
  'pending',
  'passed',
  'blocked',
  'owner_review_required',
  'not_applicable',
];

const auditEventTypes = [
  'candidate_discovered',
  'evidence_attached',
  'evidence_rejected',
  'guard_evaluated',
  'owner_review_requested',
  'owner_review_completed',
  'candidate_rejected',
  'candidate_approved_for_draft',
  'candidate_converted_to_payment_intent',
  'candidate_blocked_by_guard',
  'redaction_policy_applied',
];

export class AddHqFundApprovalSchemaSkeleton00541783750000000
  implements MigrationInterface
{
  name = 'AddHqFundApprovalSchemaSkeleton00541783750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await createCandidateTable(queryRunner);
    await createEvidenceTable(queryRunner);
    await createGuardTable(queryRunner);
    await createAuditEventTable(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of [auditEventTable, guardTable, evidenceTable, candidateTable]) {
      if (await queryRunner.hasTable(tableName)) {
        await queryRunner.dropTable(tableName);
      }
    }
  }
}

async function createCandidateTable(queryRunner: QueryRunner): Promise<void> {
  if (await queryRunner.hasTable(candidateTable)) {
    return;
  }

  await queryRunner.createTable(
    new Table({
      name: candidateTable,
      columns: [
        idColumn(),
        { name: 'candidate_ref', type: 'varchar', length: '80', isUnique: true },
        { name: 'candidate_type', type: 'enum', enum: candidateTypes },
        {
          name: 'candidate_status',
          type: 'enum',
          enum: candidateStatuses,
          default: "'discovered'",
        },
        { name: 'business_domain', type: 'varchar', length: '80' },
        { name: 'company_ref', type: 'varchar', length: '120', isNullable: true },
        { name: 'source_context_system', type: 'varchar', length: '120', isNullable: true },
        { name: 'source_context_ref', type: 'varchar', length: '160', isNullable: true },
        { name: 'work_order_ref', type: 'varchar', length: '120', isNullable: true },
        { name: 'warehouse_material_ref', type: 'varchar', length: '120', isNullable: true },
        { name: 'supplier_ref', type: 'varchar', length: '120', isNullable: true },
        { name: 'merchant_ref', type: 'varchar', length: '120', isNullable: true },
        { name: 'reward_withdrawal_ref', type: 'varchar', length: '120', isNullable: true },
        decimalColumn('amount_claimed', true),
        { name: 'currency', type: 'varchar', length: '12', default: "'CNY'" },
        {
          name: 'payment_direction',
          type: 'enum',
          enum: ['inbound', 'outbound', 'internal'],
          default: "'outbound'",
        },
        { name: 'bank_account_registry_ref', type: 'varchar', length: '120', isNullable: true },
        {
          name: 'redaction_policy',
          type: 'varchar',
          length: '120',
          default: "'safe_reference_only'",
        },
        { name: 'idempotency_key', type: 'varchar', length: '160', isUnique: true },
        createdAtColumn(),
        updatedAtColumn(),
      ],
    }),
  );

  await queryRunner.createIndices(candidateTable, [
    new TableIndex({
      name: 'idx_hq_fund_candidate_status',
      columnNames: ['candidate_status'],
    }),
    new TableIndex({
      name: 'idx_hq_fund_candidate_type_status',
      columnNames: ['candidate_type', 'candidate_status'],
    }),
    new TableIndex({
      name: 'idx_hq_fund_candidate_company_domain',
      columnNames: ['company_ref', 'business_domain'],
    }),
    new TableIndex({
      name: 'idx_hq_fund_candidate_source',
      columnNames: ['source_context_system', 'source_context_ref'],
    }),
  ]);
}

async function createEvidenceTable(queryRunner: QueryRunner): Promise<void> {
  if (await queryRunner.hasTable(evidenceTable)) {
    return;
  }

  await queryRunner.createTable(
    new Table({
      name: evidenceTable,
      columns: [
        idColumn(),
        { name: 'evidence_ref', type: 'varchar', length: '80', isUnique: true },
        { name: 'candidate_ref', type: 'varchar', length: '80' },
        { name: 'evidence_type', type: 'enum', enum: evidenceTypes },
        { name: 'source_system', type: 'varchar', length: '120', isNullable: true },
        { name: 'source_surface', type: 'varchar', length: '160', isNullable: true },
        { name: 'source_ref_redacted', type: 'varchar', length: '160', isNullable: true },
        { name: 'evidence_summary', type: 'text', isNullable: true },
        decimalColumn('evidence_amount', true),
        { name: 'evidence_time', type: 'datetime', isNullable: true },
        {
          name: 'redaction_status',
          type: 'enum',
          enum: ['redacted', 'metadata_only', 'blocked_sensitive_source'],
          default: "'metadata_only'",
        },
        createdAtColumn(),
      ],
    }),
  );

  await queryRunner.createIndices(evidenceTable, [
    new TableIndex({
      name: 'idx_hq_fund_evidence_candidate',
      columnNames: ['candidate_ref'],
    }),
    new TableIndex({
      name: 'idx_hq_fund_evidence_type',
      columnNames: ['evidence_type'],
    }),
    new TableIndex({
      name: 'idx_hq_fund_evidence_source',
      columnNames: ['source_system', 'source_surface'],
    }),
  ]);
  await queryRunner.createForeignKey(evidenceTable, candidateRefForeignKey(evidenceTable));
}

async function createGuardTable(queryRunner: QueryRunner): Promise<void> {
  if (await queryRunner.hasTable(guardTable)) {
    return;
  }

  await queryRunner.createTable(
    new Table({
      name: guardTable,
      columns: [
        idColumn(),
        { name: 'guard_ref', type: 'varchar', length: '80', isUnique: true },
        { name: 'candidate_ref', type: 'varchar', length: '80' },
        { name: 'guard_type', type: 'enum', enum: guardTypes },
        {
          name: 'guard_status',
          type: 'enum',
          enum: guardStatuses,
          default: "'pending'",
        },
        { name: 'guard_reason', type: 'varchar', length: '500', isNullable: true },
        { name: 'blocking_code', type: 'varchar', length: '120', isNullable: true },
        { name: 'evidence_refs', type: 'json', isNullable: true },
        { name: 'evaluated_at', type: 'datetime', isNullable: true },
        { name: 'review_owner_ref', type: 'varchar', length: '120', isNullable: true },
        createdAtColumn(),
      ],
    }),
  );

  await queryRunner.createIndices(guardTable, [
    new TableIndex({
      name: 'idx_hq_fund_guard_candidate',
      columnNames: ['candidate_ref'],
    }),
    new TableIndex({
      name: 'idx_hq_fund_guard_type_status',
      columnNames: ['guard_type', 'guard_status'],
    }),
    new TableIndex({
      name: 'idx_hq_fund_guard_blocking',
      columnNames: ['blocking_code'],
    }),
  ]);
  await queryRunner.createForeignKey(guardTable, candidateRefForeignKey(guardTable));
}

async function createAuditEventTable(queryRunner: QueryRunner): Promise<void> {
  if (await queryRunner.hasTable(auditEventTable)) {
    return;
  }

  await queryRunner.createTable(
    new Table({
      name: auditEventTable,
      columns: [
        idColumn(),
        { name: 'audit_event_ref', type: 'varchar', length: '80', isUnique: true },
        { name: 'candidate_ref', type: 'varchar', length: '80' },
        { name: 'event_type', type: 'enum', enum: auditEventTypes },
        { name: 'actor_ref', type: 'varchar', length: '120', isNullable: true },
        { name: 'event_reason', type: 'varchar', length: '500', isNullable: true },
        {
          name: 'before_status',
          type: 'enum',
          enum: candidateStatuses,
          isNullable: true,
        },
        {
          name: 'after_status',
          type: 'enum',
          enum: candidateStatuses,
          isNullable: true,
        },
        { name: 'guard_refs', type: 'json', isNullable: true },
        { name: 'evidence_refs', type: 'json', isNullable: true },
        { name: 'safe_payload_summary', type: 'text', isNullable: true },
        createdAtColumn(),
      ],
    }),
  );

  await queryRunner.createIndices(auditEventTable, [
    new TableIndex({
      name: 'idx_hq_fund_audit_candidate',
      columnNames: ['candidate_ref'],
    }),
    new TableIndex({
      name: 'idx_hq_fund_audit_event_type',
      columnNames: ['event_type'],
    }),
    new TableIndex({
      name: 'idx_hq_fund_audit_created_at',
      columnNames: ['created_at'],
    }),
  ]);
  await queryRunner.createForeignKey(auditEventTable, candidateRefForeignKey(auditEventTable));
}

function candidateRefForeignKey(tableName: string) {
  return new TableForeignKey({
    name: `fk_${tableName}_candidate_ref`,
    columnNames: ['candidate_ref'],
    referencedTableName: candidateTable,
    referencedColumnNames: ['candidate_ref'],
    onDelete: 'CASCADE',
  });
}

function idColumn() {
  return {
    name: 'id',
    type: 'int',
    isPrimary: true,
    isGenerated: true,
    generationStrategy: 'increment' as const,
  };
}

function decimalColumn(name: string, isNullable: boolean) {
  return {
    name,
    type: 'decimal',
    precision: 12,
    scale: 2,
    isNullable,
  };
}

function createdAtColumn() {
  return { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' };
}

function updatedAtColumn() {
  return {
    name: 'updated_at',
    type: 'datetime',
    default: 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  };
}
