import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddMessageHubAndMobileDiagnostics00391745163200000
  implements MigrationInterface
{
  name = 'AddMessageHubAndMobileDiagnostics00391745163200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('sms_message_raw'))) {
      await queryRunner.createTable(
        new Table({
          name: 'sms_message_raw',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'device_id', type: 'varchar', length: '100' },
            { name: 'sim_slot', type: 'int', isNullable: true },
            { name: 'sender', type: 'varchar', length: '100' },
            { name: 'body', type: 'longtext' },
            { name: 'received_at', type: 'datetime' },
            {
              name: 'ingest_source',
              type: 'enum',
              enum: ['live_broadcast', 'inbox_sync'],
            },
            {
              name: 'upload_status',
              type: 'varchar',
              length: '32',
              default: "'stored'",
            },
            {
              name: 'classify_status',
              type: 'varchar',
              length: '32',
              default: "'pending'",
            },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );

      await queryRunner.createIndex(
        'sms_message_raw',
        new TableIndex({
          name: 'idx_sms_message_raw_received_at',
          columnNames: ['received_at', 'id'],
        }),
      );
      await queryRunner.createIndex(
        'sms_message_raw',
        new TableIndex({
          name: 'idx_sms_message_raw_device_sender',
          columnNames: ['device_id', 'sender'],
        }),
      );
    }

    if (await queryRunner.hasTable('mobile_sms_raw')) {
      await queryRunner.query(`
        INSERT IGNORE INTO sms_message_raw
          (id, device_id, sim_slot, sender, body, received_at, ingest_source, upload_status, classify_status, created_at)
        SELECT
          id,
          device_id,
          NULL,
          sender,
          body,
          received_at,
          'live_broadcast',
          'migrated',
          'migrated_legacy',
          created_at
        FROM mobile_sms_raw
      `);
    }

    if (!(await queryRunner.hasTable('sms_message_classification'))) {
      await queryRunner.createTable(
        new Table({
          name: 'sms_message_classification',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'raw_sms_id', type: 'int', isUnique: true },
            {
              name: 'classify_type',
              type: 'enum',
              enum: ['verification_code', 'bank_transaction', 'other'],
            },
            {
              name: 'confidence',
              type: 'decimal',
              precision: 5,
              scale: 2,
              default: "'0.00'",
            },
            { name: 'parsed_json', type: 'json', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );

      await queryRunner.createForeignKey(
        'sms_message_classification',
        new TableForeignKey({
          columnNames: ['raw_sms_id'],
          referencedTableName: 'sms_message_raw',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
      await queryRunner.createIndex(
        'sms_message_classification',
        new TableIndex({
          name: 'idx_sms_message_classification_type',
          columnNames: ['classify_type', 'created_at'],
        }),
      );
    }

    await queryRunner.query(`
      INSERT IGNORE INTO sms_message_classification
        (raw_sms_id, classify_type, confidence, parsed_json, created_at)
      SELECT
        raw.id,
        CASE
          WHEN tx.id IS NOT NULL THEN 'bank_transaction'
          ELSE 'other'
        END,
        COALESCE(tx.parse_confidence, '0.10'),
        CASE
          WHEN tx.id IS NOT NULL THEN JSON_OBJECT(
            'bankName', tx.bank_name,
            'sender', tx.sender,
            'accountTail', tx.account_tail,
            'bankBusinessDate', DATE_FORMAT(tx.bank_business_date, '%Y-%m-%dT%H:%i:%s'),
            'smsReceivedAt', DATE_FORMAT(tx.sms_received_at, '%Y-%m-%dT%H:%i:%s'),
            'direction', tx.direction,
            'amount', tx.amount,
            'balanceAfter', tx.balance_after,
            'counterparty', tx.counterparty,
            'parseStatus', 'parsed'
          )
          ELSE NULL
        END,
        raw.created_at
      FROM sms_message_raw raw
      LEFT JOIN bank_sms_transaction tx
        ON tx.raw_sms_id = raw.id
    `);

    if (!(await queryRunner.hasTable('verification_code_dispatch_log'))) {
      await queryRunner.createTable(
        new Table({
          name: 'verification_code_dispatch_log',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'raw_sms_id', type: 'int' },
            { name: 'code', type: 'varchar', length: '20' },
            {
              name: 'channel',
              type: 'enum',
              enum: ['ai_alert', 'email'],
            },
            { name: 'receiver', type: 'varchar', length: '200' },
            { name: 'dispatched_at', type: 'datetime' },
            { name: 'status', type: 'varchar', length: '32' },
            { name: 'response_payload', type: 'json', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );

      await queryRunner.createForeignKey(
        'verification_code_dispatch_log',
        new TableForeignKey({
          columnNames: ['raw_sms_id'],
          referencedTableName: 'sms_message_raw',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
      await queryRunner.createIndex(
        'verification_code_dispatch_log',
        new TableIndex({
          name: 'idx_verification_code_dispatch_log_raw_channel',
          columnNames: ['raw_sms_id', 'channel'],
        }),
      );
    }

    if (!(await queryRunner.hasTable('bank_account_registry'))) {
      await queryRunner.createTable(
        new Table({
          name: 'bank_account_registry',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'company_id', type: 'int' },
            { name: 'bank_name', type: 'varchar', length: '100' },
            { name: 'sms_sender', type: 'varchar', length: '100' },
            { name: 'account_tail', type: 'varchar', length: '8' },
            { name: 'account_alias', type: 'varchar', length: '100' },
            { name: 'account_holder', type: 'varchar', length: '100', isNullable: true },
            { name: 'virtual_ledger_id', type: 'int', isNullable: true },
            { name: 'device_id', type: 'varchar', length: '100', isNullable: true },
            { name: 'sim_slot', type: 'int', isNullable: true },
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
        'bank_account_registry',
        new TableIndex({
          name: 'idx_bank_account_registry_match',
          columnNames: ['bank_name', 'sms_sender', 'account_tail', 'status'],
        }),
      );
    }

    if (!(await queryRunner.hasColumn('bank_sms_transaction', 'company_id'))) {
      await queryRunner.addColumn(
        'bank_sms_transaction',
        new TableColumn({
          name: 'company_id',
          type: 'int',
          isNullable: true,
        }),
      );
    }

    const bankSmsTable = await queryRunner.getTable('bank_sms_transaction');
    const rawSmsForeignKey = bankSmsTable?.foreignKeys.find((item) =>
      item.columnNames.includes('raw_sms_id'),
    );
    if (rawSmsForeignKey) {
      await queryRunner.dropForeignKey('bank_sms_transaction', rawSmsForeignKey);
    }
    await queryRunner.createForeignKey(
      'bank_sms_transaction',
      new TableForeignKey({
        columnNames: ['raw_sms_id'],
        referencedTableName: 'sms_message_raw',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    const bankSmsTransactionTable = await queryRunner.getTable('bank_sms_transaction');
    if (
      bankSmsTransactionTable &&
      !bankSmsTransactionTable.indices.some((item) => item.name === 'idx_bank_sms_transaction_company_status')
    ) {
      await queryRunner.createIndex(
        'bank_sms_transaction',
        new TableIndex({
          name: 'idx_bank_sms_transaction_company_status',
          columnNames: ['company_id', 'bank_name', 'account_tail', 'reconcile_status'],
        }),
      );
    }

    if (!(await queryRunner.hasTable('mobile_device_diagnostics'))) {
      await queryRunner.createTable(
        new Table({
          name: 'mobile_device_diagnostics',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'device_id', type: 'varchar', length: '100', isUnique: true },
            { name: 'receive_sms_permission', type: 'tinyint', width: 1, isNullable: true },
            { name: 'read_sms_permission', type: 'tinyint', width: 1, isNullable: true },
            { name: 'last_broadcast_received_at', type: 'datetime', isNullable: true },
            { name: 'last_raw_sms_ingest_at', type: 'datetime', isNullable: true },
            { name: 'last_raw_sms_ingest_result', type: 'varchar', length: '64', isNullable: true },
            { name: 'last_inbox_sync_at', type: 'datetime', isNullable: true },
            { name: 'pending_upload_queue_count', type: 'int', default: '0' },
            { name: 'last_test_upload_at', type: 'datetime', isNullable: true },
            { name: 'last_heartbeat_at', type: 'datetime', isNullable: true },
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
    }

    if (!(await queryRunner.hasTable('mobile_device_command'))) {
      await queryRunner.createTable(
        new Table({
          name: 'mobile_device_command',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'device_id', type: 'varchar', length: '100' },
            {
              name: 'command_type',
              type: 'enum',
              enum: ['inbox_sync', 'test_upload'],
            },
            { name: 'status', type: 'varchar', length: '32', default: "'pending'" },
            { name: 'requested_by', type: 'int', isNullable: true },
            { name: 'requested_at', type: 'datetime' },
            { name: 'executed_at', type: 'datetime', isNullable: true },
            { name: 'response_payload', type: 'json', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );

      await queryRunner.createIndex(
        'mobile_device_command',
        new TableIndex({
          name: 'idx_mobile_device_command_device_status',
          columnNames: ['device_id', 'status', 'requested_at'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('mobile_device_command')) {
      await queryRunner.dropIndex(
        'mobile_device_command',
        'idx_mobile_device_command_device_status',
      );
      await queryRunner.dropTable('mobile_device_command');
    }

    if (await queryRunner.hasTable('mobile_device_diagnostics')) {
      await queryRunner.dropTable('mobile_device_diagnostics');
    }

    const bankSmsTransactionTable = await queryRunner.getTable('bank_sms_transaction');
    if (
      bankSmsTransactionTable &&
      bankSmsTransactionTable.indices.some((item) => item.name === 'idx_bank_sms_transaction_company_status')
    ) {
      await queryRunner.dropIndex(
        'bank_sms_transaction',
        'idx_bank_sms_transaction_company_status',
      );
    }

    if (await queryRunner.hasColumn('bank_sms_transaction', 'company_id')) {
      await queryRunner.dropColumn('bank_sms_transaction', 'company_id');
    }

    if (await queryRunner.hasTable('bank_account_registry')) {
      await queryRunner.dropIndex('bank_account_registry', 'idx_bank_account_registry_match');
      await queryRunner.dropTable('bank_account_registry');
    }

    if (await queryRunner.hasTable('verification_code_dispatch_log')) {
      await queryRunner.dropIndex(
        'verification_code_dispatch_log',
        'idx_verification_code_dispatch_log_raw_channel',
      );
      await queryRunner.dropTable('verification_code_dispatch_log');
    }

    if (await queryRunner.hasTable('sms_message_classification')) {
      await queryRunner.dropIndex(
        'sms_message_classification',
        'idx_sms_message_classification_type',
      );
      await queryRunner.dropTable('sms_message_classification');
    }

    if (await queryRunner.hasTable('sms_message_raw')) {
      await queryRunner.dropIndex('sms_message_raw', 'idx_sms_message_raw_device_sender');
      await queryRunner.dropIndex('sms_message_raw', 'idx_sms_message_raw_received_at');
      await queryRunner.dropTable('sms_message_raw');
    }
  }
}
