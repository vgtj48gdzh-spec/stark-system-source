import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddFinanceBankSmsReconciliation00371745163000000
  implements MigrationInterface
{
  name = 'AddFinanceBankSmsReconciliation00371745163000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('mobile_sms_raw'))) {
      await queryRunner.createTable(
        new Table({
          name: 'mobile_sms_raw',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'device_id', type: 'varchar', length: '100' },
            { name: 'sender', type: 'varchar', length: '100' },
            { name: 'body', type: 'longtext' },
            { name: 'received_at', type: 'datetime' },
            { name: 'raw_json', type: 'json', isNullable: true },
            { name: 'parse_status', type: 'varchar', length: '32', default: "'pending'" },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );

      await queryRunner.createIndex(
        'mobile_sms_raw',
        new TableIndex({
          name: 'idx_mobile_sms_raw_received_at',
          columnNames: ['received_at', 'id'],
        }),
      );
      await queryRunner.createIndex(
        'mobile_sms_raw',
        new TableIndex({
          name: 'idx_mobile_sms_raw_sender',
          columnNames: ['sender'],
        }),
      );
    }

    if (!(await queryRunner.hasTable('bank_sms_transaction'))) {
      await queryRunner.createTable(
        new Table({
          name: 'bank_sms_transaction',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'raw_sms_id', type: 'int', isUnique: true },
            { name: 'bank_name', type: 'varchar', length: '100' },
            { name: 'sender', type: 'varchar', length: '100' },
            { name: 'account_tail', type: 'varchar', length: '8' },
            { name: 'bank_business_date', type: 'datetime' },
            { name: 'sms_received_at', type: 'datetime' },
            {
              name: 'direction',
              type: 'enum',
              enum: ['income', 'expense'],
            },
            { name: 'amount', type: 'decimal', precision: 12, scale: 2 },
            { name: 'balance_after', type: 'decimal', precision: 14, scale: 2 },
            { name: 'counterparty', type: 'varchar', length: '200', isNullable: true },
            { name: 'fingerprint', type: 'varchar', length: '64', isUnique: true },
            {
              name: 'parse_confidence',
              type: 'decimal',
              precision: 5,
              scale: 2,
              default: "'0.00'",
            },
            {
              name: 'reconcile_status',
              type: 'varchar',
              length: '32',
              default: "'pending'",
            },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );

      await queryRunner.createForeignKey(
        'bank_sms_transaction',
        new TableForeignKey({
          columnNames: ['raw_sms_id'],
          referencedTableName: 'mobile_sms_raw',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
      await queryRunner.createIndex(
        'bank_sms_transaction',
        new TableIndex({
          name: 'idx_bank_sms_transaction_sms_received_at',
          columnNames: ['sms_received_at', 'id'],
        }),
      );
      await queryRunner.createIndex(
        'bank_sms_transaction',
        new TableIndex({
          name: 'idx_bank_sms_transaction_business_date',
          columnNames: ['bank_business_date'],
        }),
      );
      await queryRunner.createIndex(
        'bank_sms_transaction',
        new TableIndex({
          name: 'idx_bank_sms_transaction_direction_status',
          columnNames: ['direction', 'reconcile_status'],
        }),
      );
    }

    if (!(await queryRunner.hasTable('finance_reconciliation_link'))) {
      await queryRunner.createTable(
        new Table({
          name: 'finance_reconciliation_link',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'bank_sms_transaction_id', type: 'int' },
            {
              name: 'link_type',
              type: 'enum',
              enum: ['receipt_item', 'approval_order', 'manual_fee', 'ignore'],
            },
            { name: 'link_id', type: 'int', isNullable: true },
            { name: 'suggested_amount', type: 'decimal', precision: 12, scale: 2 },
            {
              name: 'confirmed_amount',
              type: 'decimal',
              precision: 12,
              scale: 2,
              isNullable: true,
            },
            {
              name: 'status',
              type: 'enum',
              enum: ['suggested', 'confirmed', 'rejected'],
              default: "'suggested'",
            },
            { name: 'confirmed_by', type: 'int', isNullable: true },
            { name: 'confirmed_at', type: 'datetime', isNullable: true },
            {
              name: 'verification_code_required',
              type: 'tinyint',
              width: 1,
              default: '0',
            },
            { name: 'note', type: 'varchar', length: '500', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );

      await queryRunner.createForeignKeys('finance_reconciliation_link', [
        new TableForeignKey({
          columnNames: ['bank_sms_transaction_id'],
          referencedTableName: 'bank_sms_transaction',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
        new TableForeignKey({
          columnNames: ['confirmed_by'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      ]);

      await queryRunner.createIndex(
        'finance_reconciliation_link',
        new TableIndex({
          name: 'idx_finance_reconciliation_link_transaction',
          columnNames: ['bank_sms_transaction_id', 'status'],
        }),
      );
      await queryRunner.createIndex(
        'finance_reconciliation_link',
        new TableIndex({
          name: 'idx_finance_reconciliation_link_target',
          columnNames: ['link_type', 'link_id', 'status'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('finance_reconciliation_link')) {
      await queryRunner.dropIndex(
        'finance_reconciliation_link',
        'idx_finance_reconciliation_link_target',
      );
      await queryRunner.dropIndex(
        'finance_reconciliation_link',
        'idx_finance_reconciliation_link_transaction',
      );
      await queryRunner.dropTable('finance_reconciliation_link');
    }

    if (await queryRunner.hasTable('bank_sms_transaction')) {
      await queryRunner.dropIndex(
        'bank_sms_transaction',
        'idx_bank_sms_transaction_direction_status',
      );
      await queryRunner.dropIndex(
        'bank_sms_transaction',
        'idx_bank_sms_transaction_business_date',
      );
      await queryRunner.dropIndex(
        'bank_sms_transaction',
        'idx_bank_sms_transaction_sms_received_at',
      );
      await queryRunner.dropTable('bank_sms_transaction');
    }

    if (await queryRunner.hasTable('mobile_sms_raw')) {
      await queryRunner.dropIndex('mobile_sms_raw', 'idx_mobile_sms_raw_sender');
      await queryRunner.dropIndex('mobile_sms_raw', 'idx_mobile_sms_raw_received_at');
      await queryRunner.dropTable('mobile_sms_raw');
    }
  }
}
