import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddFinanceWechatAndManualSmsImport00401750691800000
  implements MigrationInterface
{
  name = 'AddFinanceWechatAndManualSmsImport00401750691800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sms_message_raw
      MODIFY ingest_source ENUM('live_broadcast', 'inbox_sync', 'manual_import') NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE finance_reconciliation_link
      MODIFY link_type ENUM('receipt_item', 'approval_order', 'manual_fee', 'wechat_settlement_batch', 'ignore') NOT NULL
    `);

    if (!(await queryRunner.hasTable('wechat_merchant_registry'))) {
      await queryRunner.createTable(
        new Table({
          name: 'wechat_merchant_registry',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'company_id', type: 'int' },
            { name: 'merchant_id', type: 'varchar', length: '100' },
            { name: 'app_id', type: 'varchar', length: '100', isNullable: true },
            { name: 'merchant_name', type: 'varchar', length: '200' },
            { name: 'settlement_bank_account_registry_id', type: 'int', isNullable: true },
            {
              name: 'status',
              type: 'enum',
              enum: ['active', 'inactive'],
              default: "'active'",
            },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );

      await queryRunner.createIndex(
        'wechat_merchant_registry',
        new TableIndex({
          name: 'idx_wechat_merchant_registry_company_merchant',
          columnNames: ['company_id', 'merchant_id', 'status'],
          isUnique: true,
        }),
      );
      await queryRunner.createForeignKey(
        'wechat_merchant_registry',
        new TableForeignKey({
          columnNames: ['settlement_bank_account_registry_id'],
          referencedTableName: 'bank_account_registry',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      );
    }

    if (!(await queryRunner.hasTable('wechat_payment_receipt'))) {
      await queryRunner.createTable(
        new Table({
          name: 'wechat_payment_receipt',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'company_id', type: 'int' },
            { name: 'merchant_id', type: 'varchar', length: '100' },
            { name: 'work_order_id', type: 'int', isNullable: true },
            { name: 'out_trade_no', type: 'varchar', length: '100' },
            { name: 'transaction_id', type: 'varchar', length: '100' },
            { name: 'payer_ref', type: 'varchar', length: '100', isNullable: true },
            { name: 'amount_paid', type: 'decimal', precision: 12, scale: 2 },
            { name: 'paid_at', type: 'datetime' },
            {
              name: 'payment_status',
              type: 'enum',
              enum: ['paid_confirmed', 'refunded', 'closed'],
              default: "'paid_confirmed'",
            },
            {
              name: 'settlement_status',
              type: 'enum',
              enum: ['pending_settlement', 'batched', 'settled', 'exception'],
              default: "'pending_settlement'",
            },
            {
              name: 'source_type',
              type: 'enum',
              enum: ['api', 'manual_import'],
              default: "'manual_import'",
            },
            { name: 'raw_payload', type: 'json' },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );

      await queryRunner.createIndex(
        'wechat_payment_receipt',
        new TableIndex({
          name: 'idx_wechat_payment_receipt_company_merchant_paid',
          columnNames: ['company_id', 'merchant_id', 'paid_at'],
        }),
      );
      await queryRunner.createIndex(
        'wechat_payment_receipt',
        new TableIndex({
          name: 'idx_wechat_payment_receipt_transaction',
          columnNames: ['transaction_id'],
          isUnique: true,
        }),
      );
      await queryRunner.createIndex(
        'wechat_payment_receipt',
        new TableIndex({
          name: 'idx_wechat_payment_receipt_out_trade',
          columnNames: ['out_trade_no'],
          isUnique: true,
        }),
      );
      await queryRunner.createForeignKey(
        'wechat_payment_receipt',
        new TableForeignKey({
          columnNames: ['work_order_id'],
          referencedTableName: 'work_orders',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      );
    }

    if (!(await queryRunner.hasTable('wechat_settlement_batch'))) {
      await queryRunner.createTable(
        new Table({
          name: 'wechat_settlement_batch',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'company_id', type: 'int' },
            { name: 'merchant_id', type: 'varchar', length: '100' },
            { name: 'settlement_date', type: 'date' },
            { name: 'batch_no', type: 'varchar', length: '100', isNullable: true },
            { name: 'gross_amount', type: 'decimal', precision: 12, scale: 2 },
            { name: 'fee_amount', type: 'decimal', precision: 12, scale: 2 },
            { name: 'net_amount', type: 'decimal', precision: 12, scale: 2 },
            { name: 'receipt_count', type: 'int' },
            { name: 'bank_account_registry_id', type: 'int', isNullable: true },
            { name: 'bank_sms_transaction_id', type: 'int', isNullable: true },
            {
              name: 'match_status',
              type: 'enum',
              enum: ['pending_bank_match', 'suggested', 'confirmed', 'exception'],
              default: "'pending_bank_match'",
            },
            {
              name: 'source_type',
              type: 'enum',
              enum: ['api', 'manual_import'],
              default: "'manual_import'",
            },
            { name: 'raw_payload', type: 'json', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );

      await queryRunner.createIndex(
        'wechat_settlement_batch',
        new TableIndex({
          name: 'idx_wechat_settlement_batch_company_merchant_date',
          columnNames: ['company_id', 'merchant_id', 'settlement_date'],
        }),
      );
      await queryRunner.createIndex(
        'wechat_settlement_batch',
        new TableIndex({
          name: 'idx_wechat_settlement_batch_match_status',
          columnNames: ['match_status', 'bank_sms_transaction_id'],
        }),
      );
      await queryRunner.createForeignKeys('wechat_settlement_batch', [
        new TableForeignKey({
          columnNames: ['bank_account_registry_id'],
          referencedTableName: 'bank_account_registry',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
        new TableForeignKey({
          columnNames: ['bank_sms_transaction_id'],
          referencedTableName: 'bank_sms_transaction',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      ]);
    }

    if (!(await queryRunner.hasTable('wechat_settlement_receipt_link'))) {
      await queryRunner.createTable(
        new Table({
          name: 'wechat_settlement_receipt_link',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'settlement_batch_id', type: 'int' },
            { name: 'payment_receipt_id', type: 'int' },
            { name: 'amount', type: 'decimal', precision: 12, scale: 2 },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );

      await queryRunner.createIndex(
        'wechat_settlement_receipt_link',
        new TableIndex({
          name: 'idx_wechat_settlement_receipt_link_batch_receipt',
          columnNames: ['settlement_batch_id', 'payment_receipt_id'],
          isUnique: true,
        }),
      );
      await queryRunner.createForeignKeys('wechat_settlement_receipt_link', [
        new TableForeignKey({
          columnNames: ['settlement_batch_id'],
          referencedTableName: 'wechat_settlement_batch',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
        new TableForeignKey({
          columnNames: ['payment_receipt_id'],
          referencedTableName: 'wechat_payment_receipt',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('wechat_settlement_receipt_link')) {
      await queryRunner.dropIndex(
        'wechat_settlement_receipt_link',
        'idx_wechat_settlement_receipt_link_batch_receipt',
      );
      await queryRunner.dropTable('wechat_settlement_receipt_link');
    }

    if (await queryRunner.hasTable('wechat_settlement_batch')) {
      await queryRunner.dropIndex(
        'wechat_settlement_batch',
        'idx_wechat_settlement_batch_match_status',
      );
      await queryRunner.dropIndex(
        'wechat_settlement_batch',
        'idx_wechat_settlement_batch_company_merchant_date',
      );
      await queryRunner.dropTable('wechat_settlement_batch');
    }

    if (await queryRunner.hasTable('wechat_payment_receipt')) {
      await queryRunner.dropIndex(
        'wechat_payment_receipt',
        'idx_wechat_payment_receipt_out_trade',
      );
      await queryRunner.dropIndex(
        'wechat_payment_receipt',
        'idx_wechat_payment_receipt_transaction',
      );
      await queryRunner.dropIndex(
        'wechat_payment_receipt',
        'idx_wechat_payment_receipt_company_merchant_paid',
      );
      await queryRunner.dropTable('wechat_payment_receipt');
    }

    if (await queryRunner.hasTable('wechat_merchant_registry')) {
      await queryRunner.dropIndex(
        'wechat_merchant_registry',
        'idx_wechat_merchant_registry_company_merchant',
      );
      await queryRunner.dropTable('wechat_merchant_registry');
    }

    await queryRunner.query(`
      ALTER TABLE finance_reconciliation_link
      MODIFY link_type ENUM('receipt_item', 'approval_order', 'manual_fee', 'ignore') NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE sms_message_raw
      MODIFY ingest_source ENUM('live_broadcast', 'inbox_sync') NOT NULL
    `);
  }
}
