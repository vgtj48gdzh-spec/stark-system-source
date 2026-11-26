import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

const tableName = 'approval_payment_intent';

const intentStatuses = [
  'draft',
  'pending_approval',
  'approved',
  'payment_planned',
  'partially_paid',
  'paid',
  'cancelled',
  'rejected',
  'reconciliation_pending',
  'reconciliation_confirmed',
  'voided',
];

const readinessGates = [
  'schema_not_ready',
  'binding_not_ready',
  'account_not_ready',
  'amount_not_ready',
  'status_not_ready',
  'payout_occupation_not_ready',
  'business_relation_not_ready',
  'idempotency_not_ready',
  'ready_for_readonly_candidate_audit',
  'ready_for_suggested_link_design',
  'ready_for_owner_approved_runtime_trial',
];

export class AddApprovalPaymentIntentSchemaSkeleton00501780550000000
  implements MigrationInterface
{
  name = 'AddApprovalPaymentIntentSchemaSkeleton00501780550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable(tableName)) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: tableName,
        columns: [
          idColumn(),
          { name: 'approval_request_id', type: 'int', isNullable: true },
          { name: 'intent_no', type: 'varchar', length: '50', isUnique: true },
          { name: 'idempotency_key', type: 'varchar', length: '120', isNullable: true, isUnique: true },
          { name: 'source_type', type: 'varchar', length: '80', isNullable: true },
          { name: 'source_ref_type', type: 'varchar', length: '80', isNullable: true },
          { name: 'source_ref_id', type: 'varchar', length: '100', isNullable: true },
          { name: 'source_ref_snapshot', type: 'json', isNullable: true },
          { name: 'company_id', type: 'int', isNullable: true },
          { name: 'business_unit', type: 'varchar', length: '80', isNullable: true },
          { name: 'business_domain', type: 'varchar', length: '80', isNullable: true },
          { name: 'project_id', type: 'int', isNullable: true },
          { name: 'department_id', type: 'int', isNullable: true },
          { name: 'responsible_person_id', type: 'int', isNullable: true },
          { name: 'bank_account_registry_id', type: 'int', isNullable: true },
          { name: 'account_tail', type: 'varchar', length: '8', isNullable: true },
          { name: 'payout_account_type', type: 'varchar', length: '80', isNullable: true },
          { name: 'account_binding_source', type: 'varchar', length: '80', isNullable: true },
          {
            name: 'account_binding_status',
            type: 'enum',
            enum: ['pending', 'verified', 'owner_confirmed', 'rejected', 'expired'],
            default: "'pending'",
          },
          decimalColumn('requested_amount', true),
          decimalColumn('approved_amount', true),
          decimalColumn('planned_pay_amount', true),
          decimalColumn('paid_amount', true, "'0.00'"),
          decimalColumn('occupied_amount', true, "'0.00'"),
          decimalColumn('remaining_amount', true),
          { name: 'currency', type: 'varchar', length: '12', default: "'CNY'" },
          { name: 'amount_source', type: 'varchar', length: '80', isNullable: true },
          { name: 'amount_snapshot', type: 'json', isNullable: true },
          { name: 'approved_at', type: 'datetime', isNullable: true },
          { name: 'planned_pay_at', type: 'datetime', isNullable: true },
          { name: 'expected_pay_at', type: 'datetime', isNullable: true },
          { name: 'paid_at', type: 'datetime', isNullable: true },
          { name: 'reconciled_at', type: 'datetime', isNullable: true },
          { name: 'status_changed_at', type: 'datetime', isNullable: true },
          {
            name: 'intent_status',
            type: 'enum',
            enum: intentStatuses,
            default: "'draft'",
          },
          {
            name: 'readiness_gate',
            type: 'enum',
            enum: readinessGates,
            default: "'schema_not_ready'",
          },
          {
            name: 'reconciliation_status',
            type: 'enum',
            enum: ['not_started', 'candidate', 'suggested', 'confirmed', 'rejected', 'consumed', 'voided'],
            default: "'not_started'",
          },
          {
            name: 'suggested_link_status',
            type: 'enum',
            enum: ['not_available', 'not_started', 'candidate', 'rejected', 'voided'],
            default: "'not_available'",
          },
          {
            name: 'confirmed_link_status',
            type: 'enum',
            enum: ['not_confirmed', 'confirmed', 'rejected', 'voided'],
            default: "'not_confirmed'",
          },
          { name: 'occupied_by_reconciliation', type: 'boolean', default: false },
          { name: 'work_order_id', type: 'int', isNullable: true },
          { name: 'material_usage_id', type: 'int', isNullable: true },
          { name: 'supplier_id', type: 'int', isNullable: true },
          { name: 'invoice_id', type: 'int', isNullable: true },
          { name: 'cost_category', type: 'varchar', length: '80', isNullable: true },
          { name: 'payment_reason', type: 'varchar', length: '500', isNullable: true },
          { name: 'special_flag', type: 'varchar', length: '80', isNullable: true },
          { name: 'special_approval_required', type: 'boolean', default: false },
          { name: 'created_by', type: 'int', isNullable: true },
          { name: 'approved_by', type: 'int', isNullable: true },
          { name: 'planned_by', type: 'int', isNullable: true },
          { name: 'paid_by', type: 'int', isNullable: true },
          { name: 'confirmed_by', type: 'int', isNullable: true },
          { name: 'audit_reason_snapshot', type: 'json', isNullable: true },
          { name: 'evidence_source', type: 'varchar', length: '80', isNullable: true },
          { name: 'redacted_evidence_ref', type: 'varchar', length: '200', isNullable: true },
          createdAtColumn(),
          updatedAtColumn(),
        ],
      }),
    );

    await queryRunner.createIndices(tableName, [
      new TableIndex({
        name: 'idx_approval_payment_intent_approval_status',
        columnNames: ['approval_request_id', 'intent_status'],
      }),
      new TableIndex({
        name: 'idx_approval_payment_intent_company_status_expected',
        columnNames: ['company_id', 'intent_status', 'expected_pay_at'],
      }),
      new TableIndex({
        name: 'idx_approval_payment_intent_account_status',
        columnNames: ['bank_account_registry_id', 'account_tail', 'intent_status'],
      }),
      new TableIndex({
        name: 'idx_approval_payment_intent_readiness_domain_category',
        columnNames: ['readiness_gate', 'business_domain', 'cost_category'],
      }),
      new TableIndex({
        name: 'idx_approval_payment_intent_reconciliation',
        columnNames: ['reconciliation_status', 'confirmed_link_status'],
      }),
      new TableIndex({
        name: 'idx_approval_payment_intent_planned_expected_at',
        columnNames: ['planned_pay_at', 'expected_pay_at'],
      }),
    ]);

    await queryRunner.createForeignKeys(tableName, [
      new TableForeignKey({
        columnNames: ['approval_request_id'],
        referencedTableName: 'approval_requests',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        columnNames: ['bank_account_registry_id'],
        referencedTableName: 'bank_account_registry',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        columnNames: ['work_order_id'],
        referencedTableName: 'work_orders',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        columnNames: ['supplier_id'],
        referencedTableName: 'suppliers',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable(tableName)) {
      await queryRunner.dropTable(tableName);
    }
  }
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

function decimalColumn(name: string, isNullable: boolean, defaultValue?: string) {
  return {
    name,
    type: 'decimal',
    precision: 12,
    scale: 2,
    isNullable,
    ...(defaultValue ? { default: defaultValue } : {}),
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
