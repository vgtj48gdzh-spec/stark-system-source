import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddFinanceCollectionAndTemporaryServiceOrder00461750850000000
  implements MigrationInterface
{
  name = 'AddFinanceCollectionAndTemporaryServiceOrder00461750850000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('temporary_service_order'))) {
      await queryRunner.createTable(
        new Table({
          name: 'temporary_service_order',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'temporary_service_no', type: 'varchar', length: '32', isUnique: true },
            { name: 'company_id', type: 'int' },
            {
              name: 'service_type',
              type: 'enum',
              enum: ['wash_single', 'inspection', 'simple_repair', 'other'],
            },
            { name: 'service_title', type: 'varchar', length: '120' },
            { name: 'service_amount', type: 'decimal', precision: 12, scale: 2 },
            { name: 'customer_id', type: 'varchar', length: '100', isNullable: true },
            { name: 'customer_phone', type: 'varchar', length: '20', isNullable: true },
            { name: 'customer_name', type: 'varchar', length: '120', isNullable: true },
            {
              name: 'temporary_customer_flag',
              type: 'tinyint',
              width: 1,
              default: 0,
            },
            {
              name: 'missing_customer_phone_flag',
              type: 'tinyint',
              width: 1,
              default: 0,
            },
            { name: 'vehicle_plate', type: 'varchar', length: '30', isNullable: true },
            {
              name: 'source_channel',
              type: 'enum',
              enum: ['enterprise_wechat', 'wechat', 'mini_program', 'manual', 'other'],
              isNullable: true,
            },
            { name: 'responsible_employee_id', type: 'int', isNullable: true },
            { name: 'related_work_order_id', type: 'int', isNullable: true },
            { name: 'collection_order_id', type: 'int', isNullable: true },
            {
              name: 'status',
              type: 'enum',
              enum: [
                'created',
                'waiting_payment',
                'paid',
                'service_done',
                'converted_to_work_order',
                'cancelled',
              ],
              default: "'created'",
            },
            {
              name: 'payment_status',
              type: 'enum',
              enum: [
                'created',
                'payment_pending',
                'paid_by_channel',
                'bank_settlement_pending',
                'bank_matched',
                'completed_candidate',
                'completed',
                'cancelled',
                'refunded',
              ],
              default: "'created'",
            },
            {
              name: 'evidence_status',
              type: 'enum',
              enum: [
                'missing_payment_receipt',
                'missing_customer_phone',
                'receipt_only',
                'bank_only',
                'matched_pending_confirmation',
                'confirmed',
              ],
              default: "'missing_payment_receipt'",
            },
            { name: 'created_by', type: 'int' },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            {
              name: 'updated_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
              onUpdate: 'CURRENT_TIMESTAMP',
            },
            { name: 'completed_at', type: 'datetime', isNullable: true },
            { name: 'evidence_payload', type: 'json', isNullable: true },
            { name: 'remark', type: 'varchar', length: '500', isNullable: true },
          ],
        }),
      );

      await queryRunner.createIndices('temporary_service_order', [
        new TableIndex({
          name: 'idx_temporary_service_customer_phone',
          columnNames: ['customer_phone'],
        }),
        new TableIndex({
          name: 'idx_temporary_service_related_work_order',
          columnNames: ['related_work_order_id'],
        }),
        new TableIndex({
          name: 'idx_temporary_service_collection_order',
          columnNames: ['collection_order_id'],
        }),
        new TableIndex({
          name: 'idx_temporary_service_status_evidence',
          columnNames: ['status', 'payment_status', 'evidence_status'],
        }),
        new TableIndex({
          name: 'idx_temporary_service_created_at',
          columnNames: ['created_at'],
        }),
      ]);
    }

    if (!(await queryRunner.hasTable('finance_collection_order'))) {
      await queryRunner.createTable(
        new Table({
          name: 'finance_collection_order',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'collection_no', type: 'varchar', length: '32', isUnique: true },
            { name: 'company_id', type: 'int' },
            {
              name: 'source_type',
              type: 'enum',
              enum: ['temporary_service', 'work_order', 'mini_program', 'enterprise_wechat', 'manual'],
            },
            { name: 'source_id', type: 'varchar', length: '100', isNullable: true },
            {
              name: 'business_type',
              type: 'enum',
              enum: ['wash_single', 'maintenance', 'deposit', 'other'],
            },
            { name: 'business_amount', type: 'decimal', precision: 12, scale: 2 },
            { name: 'receipt_amount', type: 'decimal', precision: 12, scale: 2, isNullable: true },
            {
              name: 'bank_received_amount',
              type: 'decimal',
              precision: 12,
              scale: 2,
              isNullable: true,
            },
            {
              name: 'channel_fee_amount',
              type: 'decimal',
              precision: 12,
              scale: 2,
              isNullable: true,
            },
            {
              name: 'payment_channel',
              type: 'enum',
              enum: ['enterprise_wechat', 'wechat', 'alipay', 'mini_program', 'old_qr', 'other'],
              isNullable: true,
            },
            { name: 'channel_trade_no', type: 'varchar', length: '100', isNullable: true },
            { name: 'payment_receipt_id', type: 'int', isNullable: true },
            { name: 'settlement_batch_id', type: 'int', isNullable: true },
            { name: 'bank_transaction_id', type: 'int', isNullable: true },
            { name: 'reconciliation_link_id', type: 'int', isNullable: true },
            { name: 'work_order_id', type: 'int', isNullable: true },
            { name: 'temporary_service_order_id', type: 'int', isNullable: true },
            { name: 'customer_id', type: 'varchar', length: '100', isNullable: true },
            { name: 'customer_phone', type: 'varchar', length: '20', isNullable: true },
            { name: 'customer_name', type: 'varchar', length: '120', isNullable: true },
            {
              name: 'temporary_customer_flag',
              type: 'tinyint',
              width: 1,
              default: 0,
            },
            {
              name: 'missing_customer_phone_flag',
              type: 'tinyint',
              width: 1,
              default: 0,
            },
            { name: 'responsible_employee_id', type: 'int', isNullable: true },
            { name: 'source_employee_id', type: 'int', isNullable: true },
            {
              name: 'evidence_status',
              type: 'enum',
              enum: [
                'missing_payment_receipt',
                'missing_collection_order',
                'missing_customer_phone',
                'missing_bank_settlement',
                'unmatched_payment_candidate',
                'receipt_only',
                'bank_only',
                'matched_pending_confirmation',
                'confirmed',
              ],
              default: "'missing_payment_receipt'",
            },
            {
              name: 'reconcile_status',
              type: 'enum',
              enum: ['pending', 'partially_matched', 'matched', 'mismatch', 'confirmed', 'rejected'],
              default: "'pending'",
            },
            {
              name: 'status',
              type: 'enum',
              enum: [
                'created',
                'payment_pending',
                'paid_by_channel',
                'bank_settlement_pending',
                'bank_matched',
                'completed_candidate',
                'completed',
                'cancelled',
                'refunded',
              ],
              default: "'created'",
            },
            { name: 'created_by', type: 'int' },
            { name: 'confirmed_by', type: 'int', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            {
              name: 'updated_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
              onUpdate: 'CURRENT_TIMESTAMP',
            },
            { name: 'confirmed_at', type: 'datetime', isNullable: true },
            { name: 'evidence_payload', type: 'json', isNullable: true },
            { name: 'remark', type: 'varchar', length: '500', isNullable: true },
          ],
        }),
      );

      await queryRunner.createIndices('finance_collection_order', [
        new TableIndex({
          name: 'idx_finance_collection_customer_phone',
          columnNames: ['customer_phone'],
        }),
        new TableIndex({
          name: 'idx_finance_collection_work_order',
          columnNames: ['work_order_id'],
        }),
        new TableIndex({
          name: 'idx_finance_collection_temporary_service',
          columnNames: ['temporary_service_order_id'],
        }),
        new TableIndex({
          name: 'idx_finance_collection_bank_transaction',
          columnNames: ['bank_transaction_id'],
        }),
        new TableIndex({
          name: 'idx_finance_collection_payment_receipt',
          columnNames: ['payment_receipt_id'],
        }),
        new TableIndex({
          name: 'idx_finance_collection_reconciliation_link',
          columnNames: ['reconciliation_link_id'],
        }),
        new TableIndex({
          name: 'idx_finance_collection_status_evidence_reconcile',
          columnNames: ['status', 'evidence_status', 'reconcile_status'],
        }),
        new TableIndex({
          name: 'idx_finance_collection_created_at',
          columnNames: ['created_at'],
        }),
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('finance_collection_order')) {
      await queryRunner.dropTable('finance_collection_order');
    }
    if (await queryRunner.hasTable('temporary_service_order')) {
      await queryRunner.dropTable('temporary_service_order');
    }
  }
}
