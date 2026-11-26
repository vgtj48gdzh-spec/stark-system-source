import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddFinanceReceivableTracking00441777092000000 implements MigrationInterface {
  name = 'AddFinanceReceivableTracking00441777092000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE finance_reconciliation_link
      MODIFY link_type ENUM('receipt_item', 'approval_order', 'manual_fee', 'wechat_settlement_batch', 'internal_fund_flow', 'receivable_tracking', 'ignore') NOT NULL
    `);

    if (!(await queryRunner.hasTable('finance_receivable_tracking'))) {
      await queryRunner.createTable(
        new Table({
          name: 'finance_receivable_tracking',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'company_id', type: 'int' },
            { name: 'source_type', type: 'varchar', length: '50', isNullable: true },
            { name: 'source_id', type: 'varchar', length: '100', isNullable: true },
            { name: 'source_ref_no', type: 'varchar', length: '100', isNullable: true },
            { name: 'work_order_id', type: 'int', isNullable: true },
            { name: 'invoice_no', type: 'varchar', length: '100', isNullable: true },
            { name: 'counterparty_name', type: 'varchar', length: '200' },
            { name: 'normalized_counterparty_name', type: 'varchar', length: '200', isNullable: true },
            { name: 'invoice_amount', type: 'decimal', precision: 12, scale: 2 },
            {
              name: 'received_amount',
              type: 'decimal',
              precision: 12,
              scale: 2,
              default: "'0.00'",
            },
            { name: 'outstanding_amount', type: 'decimal', precision: 12, scale: 2 },
            {
              name: 'current_status',
              type: 'enum',
              enum: [
                'invoice_issued',
                'receivable_open',
                'partial_receipt',
                'fully_received',
                'cancelled',
                'written_off',
              ],
              default: "'invoice_issued'",
            },
            {
              name: 'evidence_status',
              type: 'enum',
              enum: ['candidate', 'pending', 'supported'],
              default: "'candidate'",
            },
            { name: 'invoice_issued_at', type: 'datetime', isNullable: true },
            { name: 'due_date', type: 'date', isNullable: true },
            { name: 'last_bank_sms_transaction_id', type: 'int', isNullable: true },
            { name: 'last_receipt_at', type: 'datetime', isNullable: true },
            { name: 'evidence_note', type: 'varchar', length: '500', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            {
              name: 'updated_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
              onUpdate: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
      );

      await queryRunner.createIndices('finance_receivable_tracking', [
        new TableIndex({
          name: 'idx_receivable_tracking_company_status',
          columnNames: ['company_id', 'current_status', 'evidence_status'],
        }),
        new TableIndex({
          name: 'idx_receivable_tracking_outstanding_counterparty',
          columnNames: ['company_id', 'outstanding_amount', 'normalized_counterparty_name'],
        }),
      ]);

      await queryRunner.createForeignKeys('finance_receivable_tracking', [
        new TableForeignKey({
          columnNames: ['work_order_id'],
          referencedTableName: 'work_orders',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
        new TableForeignKey({
          columnNames: ['last_bank_sms_transaction_id'],
          referencedTableName: 'bank_sms_transaction',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('finance_receivable_tracking')) {
      await queryRunner.dropIndex(
        'finance_receivable_tracking',
        'idx_receivable_tracking_outstanding_counterparty',
      );
      await queryRunner.dropIndex('finance_receivable_tracking', 'idx_receivable_tracking_company_status');
      await queryRunner.dropTable('finance_receivable_tracking');
    }

    await queryRunner.query(`
      ALTER TABLE finance_reconciliation_link
      MODIFY link_type ENUM('receipt_item', 'approval_order', 'manual_fee', 'wechat_settlement_batch', 'internal_fund_flow', 'ignore') NOT NULL
    `);
  }
}
