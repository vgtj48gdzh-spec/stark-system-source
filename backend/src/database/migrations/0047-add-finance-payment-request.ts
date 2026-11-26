import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddFinancePaymentRequest00471750930000000 implements MigrationInterface {
  name = 'AddFinancePaymentRequest00471750930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('finance_payment_request')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'finance_payment_request',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'payment_request_no', type: 'varchar', length: '40', isUnique: true },
          { name: 'collection_order_id', type: 'int' },
          { name: 'company_id', type: 'int' },
          {
            name: 'provider',
            type: 'enum',
            enum: ['enterprise_wechat', 'wechat_pay', 'alipay', 'mock', 'enterprise_wechat_mock'],
          },
          {
            name: 'payment_channel',
            type: 'enum',
            enum: ['enterprise_wechat', 'wechat', 'alipay', 'mini_program', 'old_qr', 'other'],
          },
          { name: 'amount', type: 'decimal', precision: 12, scale: 2 },
          { name: 'payer_phone', type: 'varchar', length: '20', isNullable: true },
          { name: 'payer_customer_id', type: 'varchar', length: '100', isNullable: true },
          { name: 'created_by_employee_id', type: 'int', isNullable: true },
          {
            name: 'request_status',
            type: 'enum',
            enum: [
              'created',
              'qr_generated',
              'waiting_payment',
              'paid_by_channel',
              'expired',
              'cancelled',
              'failed',
              'refunded',
            ],
            default: "'created'",
          },
          { name: 'qr_url', type: 'varchar', length: '500', isNullable: true },
          { name: 'payment_url', type: 'varchar', length: '500', isNullable: true },
          { name: 'channel_app_id', type: 'varchar', length: '100', isNullable: true },
          { name: 'channel_mch_id', type: 'varchar', length: '100', isNullable: true },
          { name: 'channel_trade_no', type: 'varchar', length: '100', isNullable: true },
          { name: 'channel_prepay_id', type: 'varchar', length: '100', isNullable: true },
          { name: 'expire_at', type: 'datetime', isNullable: true },
          { name: 'paid_at', type: 'datetime', isNullable: true },
          { name: 'failed_at', type: 'datetime', isNullable: true },
          { name: 'cancelled_at', type: 'datetime', isNullable: true },
          { name: 'refunded_at', type: 'datetime', isNullable: true },
          { name: 'idempotency_key', type: 'varchar', length: '120', isUnique: true },
          { name: 'request_payload', type: 'json', isNullable: true },
          { name: 'response_payload', type: 'json', isNullable: true },
          { name: 'callback_payload', type: 'json', isNullable: true },
          { name: 'last_error_code', type: 'varchar', length: '80', isNullable: true },
          { name: 'last_error_message', type: 'varchar', length: '500', isNullable: true },
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

    await queryRunner.createIndices('finance_payment_request', [
      new TableIndex({
        name: 'idx_finance_payment_request_collection_order',
        columnNames: ['collection_order_id'],
      }),
      new TableIndex({
        name: 'idx_finance_payment_request_company',
        columnNames: ['company_id'],
      }),
      new TableIndex({
        name: 'idx_finance_payment_request_provider',
        columnNames: ['provider'],
      }),
      new TableIndex({
        name: 'idx_finance_payment_request_channel',
        columnNames: ['payment_channel'],
      }),
      new TableIndex({
        name: 'idx_finance_payment_request_status',
        columnNames: ['request_status'],
      }),
      new TableIndex({
        name: 'idx_finance_payment_request_channel_trade',
        columnNames: ['channel_trade_no'],
      }),
      new TableIndex({
        name: 'idx_finance_payment_request_payer_phone',
        columnNames: ['payer_phone'],
      }),
      new TableIndex({
        name: 'idx_finance_payment_request_expire_at',
        columnNames: ['expire_at'],
      }),
      new TableIndex({
        name: 'idx_finance_payment_request_created_at',
        columnNames: ['created_at'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('finance_payment_request')) {
      await queryRunner.dropTable('finance_payment_request');
    }
  }
}
