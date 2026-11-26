import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddFinanceInternalFundFlow00411750726400000
  implements MigrationInterface
{
  name = 'AddFinanceInternalFundFlow00411750726400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE finance_reconciliation_link
      MODIFY link_type ENUM('receipt_item', 'approval_order', 'manual_fee', 'wechat_settlement_batch', 'internal_fund_flow', 'ignore') NOT NULL
    `);

    if (!(await queryRunner.hasTable('finance_internal_fund_flow'))) {
      await queryRunner.createTable(
        new Table({
          name: 'finance_internal_fund_flow',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'company_id', type: 'int' },
            { name: 'bank_account_registry_id', type: 'int' },
            {
              name: 'flow_type',
              type: 'enum',
              enum: ['loan_interest_expense'],
            },
            {
              name: 'current_status',
              type: 'enum',
              enum: ['draft', 'approved', 'confirmed', 'cancelled'],
              default: "'draft'",
            },
            { name: 'amount', type: 'decimal', precision: 12, scale: 2 },
            { name: 'business_date', type: 'date' },
            { name: 'counterparty_name', type: 'varchar', length: '200', isNullable: true },
            {
              name: 'normalized_counterparty_name',
              type: 'varchar',
              length: '200',
              isNullable: true,
            },
            { name: 'evidence_note', type: 'varchar', length: '500', isNullable: true },
            { name: 'linked_bank_sms_transaction_id', type: 'int', isNullable: true },
            { name: 'created_by', type: 'int', isNullable: true },
            { name: 'approved_by', type: 'int', isNullable: true },
            { name: 'approved_at', type: 'datetime', isNullable: true },
            { name: 'confirmed_by', type: 'int', isNullable: true },
            { name: 'confirmed_at', type: 'datetime', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );

      await queryRunner.createIndices('finance_internal_fund_flow', [
        new TableIndex({
          name: 'idx_internal_fund_flow_company_status_type',
          columnNames: ['company_id', 'current_status', 'flow_type'],
        }),
        new TableIndex({
          name: 'idx_internal_fund_flow_bank_account_date_amount',
          columnNames: ['bank_account_registry_id', 'business_date', 'amount'],
        }),
      ]);

      await queryRunner.createForeignKeys('finance_internal_fund_flow', [
        new TableForeignKey({
          columnNames: ['bank_account_registry_id'],
          referencedTableName: 'bank_account_registry',
          referencedColumnNames: ['id'],
          onDelete: 'RESTRICT',
        }),
        new TableForeignKey({
          columnNames: ['linked_bank_sms_transaction_id'],
          referencedTableName: 'bank_sms_transaction',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
        new TableForeignKey({
          columnNames: ['created_by'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
        new TableForeignKey({
          columnNames: ['approved_by'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
        new TableForeignKey({
          columnNames: ['confirmed_by'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('finance_internal_fund_flow')) {
      await queryRunner.dropIndex(
        'finance_internal_fund_flow',
        'idx_internal_fund_flow_bank_account_date_amount',
      );
      await queryRunner.dropIndex(
        'finance_internal_fund_flow',
        'idx_internal_fund_flow_company_status_type',
      );
      await queryRunner.dropTable('finance_internal_fund_flow');
    }

    await queryRunner.query(`
      ALTER TABLE finance_reconciliation_link
      MODIFY link_type ENUM('receipt_item', 'approval_order', 'manual_fee', 'wechat_settlement_batch', 'ignore') NOT NULL
    `);
  }
}
