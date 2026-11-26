import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
} from 'typeorm';

export class AddAbcSyncNormalizationLayer1710800008000 implements MigrationInterface {
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createStatusMappingsTable(queryRunner);
    await this.createAmountRulesTable(queryRunner);
    await this.createSyncOrdersTable(queryRunner);
    await this.createSyncFundsTable(queryRunner);
    await this.seedStatusMappings(queryRunner);
    await this.seedAmountRules(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropTableIfExists(queryRunner, 'abc_sync_funds');
    await this.dropTableIfExists(queryRunner, 'abc_sync_orders');
    await this.dropTableIfExists(queryRunner, 'abc_amount_rules');
    await this.dropTableIfExists(queryRunner, 'abc_status_mappings');
  }

  private async createStatusMappingsTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('abc_status_mappings')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'abc_status_mappings',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'source_system',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'source_table',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'source_field',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'source_value',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'target_domain',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'target_value',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'confidence_level',
            type: 'varchar',
            length: '30',
            default: "'inferred'",
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'tinyint',
            width: 1,
            default: '1',
          },
          {
            name: 'created_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'abc_status_mappings',
      new TableIndex({
        name: 'uniq_abc_status_mappings_source_key',
        columnNames: [
          'source_system',
          'source_table',
          'source_field',
          'source_value',
          'target_domain',
        ],
        isUnique: true,
      }),
    );
  }

  private async createAmountRulesTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('abc_amount_rules')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'abc_amount_rules',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'source_system',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'source_table',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'amount_field',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'amount_unit_raw',
            type: 'varchar',
            length: '30',
          },
          {
            name: 'standard_unit',
            type: 'varchar',
            length: '30',
            default: "'yuan'",
          },
          {
            name: 'conversion_rate',
            type: 'decimal',
            precision: 18,
            scale: 6,
            default: '1.000000',
          },
          {
            name: 'standard_scale',
            type: 'int',
            default: '2',
          },
          {
            name: 'confidence_level',
            type: 'varchar',
            length: '30',
            default: "'inferred'",
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'tinyint',
            width: 1,
            default: '1',
          },
          {
            name: 'created_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'abc_amount_rules',
      new TableIndex({
        name: 'uniq_abc_amount_rules_source_key',
        columnNames: ['source_system', 'source_table', 'amount_field'],
        isUnique: true,
      }),
    );
  }

  private async createSyncOrdersTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('abc_sync_orders')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'abc_sync_orders',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'source_system',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'source_table',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'source_id',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'source_order_no',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'source_updated_at',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'raw_record_id',
            type: 'int',
          },
          {
            name: 'raw_table_name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'business_type',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'status_field',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'status_raw',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'status_standard',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'amount_field',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'amount_raw',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'amount_standard',
            type: 'decimal',
            precision: 18,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'amount_unit',
            type: 'varchar',
            length: '30',
            isNullable: true,
          },
          {
            name: 'source_user_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'source_merchant_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'mapping_confirmed',
            type: 'tinyint',
            width: 1,
            default: '0',
          },
          {
            name: 'mapping_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'normalized_payload',
            type: 'json',
          },
          {
            name: 'synced_at',
            type: 'datetime',
          },
          {
            name: 'sync_batch_no',
            type: 'varchar',
            length: '64',
          },
          {
            name: 'created_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'abc_sync_orders',
      new TableIndex({
        name: 'uniq_abc_sync_orders_source_key',
        columnNames: ['source_system', 'source_table', 'source_id'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'abc_sync_orders',
      new TableIndex({
        name: 'idx_abc_sync_orders_batch_no',
        columnNames: ['sync_batch_no'],
      }),
    );
    await queryRunner.createIndex(
      'abc_sync_orders',
      new TableIndex({
        name: 'idx_abc_sync_orders_status_standard',
        columnNames: ['status_standard'],
      }),
    );
  }

  private async createSyncFundsTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('abc_sync_funds')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'abc_sync_funds',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'source_system',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'source_table',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'source_id',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'source_order_no',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'source_updated_at',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'raw_record_id',
            type: 'int',
          },
          {
            name: 'raw_table_name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'fund_type_standard',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'status_field',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'status_raw',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'status_standard',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'direction_standard',
            type: 'varchar',
            length: '30',
            isNullable: true,
          },
          {
            name: 'amount_field',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'amount_raw',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'amount_standard',
            type: 'decimal',
            precision: 18,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'amount_unit',
            type: 'varchar',
            length: '30',
            isNullable: true,
          },
          {
            name: 'related_order_no',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'source_user_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'source_merchant_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'mapping_confirmed',
            type: 'tinyint',
            width: 1,
            default: '0',
          },
          {
            name: 'mapping_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'normalized_payload',
            type: 'json',
          },
          {
            name: 'synced_at',
            type: 'datetime',
          },
          {
            name: 'sync_batch_no',
            type: 'varchar',
            length: '64',
          },
          {
            name: 'created_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'abc_sync_funds',
      new TableIndex({
        name: 'uniq_abc_sync_funds_source_key',
        columnNames: ['source_system', 'source_table', 'source_id'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'abc_sync_funds',
      new TableIndex({
        name: 'idx_abc_sync_funds_batch_no',
        columnNames: ['sync_batch_no'],
      }),
    );
    await queryRunner.createIndex(
      'abc_sync_funds',
      new TableIndex({
        name: 'idx_abc_sync_funds_status_standard',
        columnNames: ['status_standard'],
      }),
    );
  }

  private async seedStatusMappings(queryRunner: QueryRunner) {
    const rows = [
      ['ABC', 'order', 'status', 'COMPLETE', 'order_status', 'completed', 'documented', 'Order status COMPLETE is treated as completed.'],
      ['ABC', 'repair_order', 'order_status', '4', 'order_status', 'completed', 'inferred', 'repair_order.order_status=4 is inferred as completed from static analysis.'],
      ['ABC', 'supermarket_order', 'take_status', '1', 'order_status', 'processing', 'inferred', 'supermarket_order.take_status=1 is treated as processing in the first batch mapping.'],
      ['ABC', 'top_up_order', 'pay_status', 'WAIT', 'order_status', 'pending_payment', 'documented', 'top_up_order WAIT means payment is pending.'],
      ['ABC', 'top_up_order', 'pay_status', 'WAIT', 'fund_status', 'pending_payment', 'documented', 'top_up_order WAIT means recharge payment is pending.'],
      ['ABC', 'transaction', 'type', 'FREEZE', 'fund_status', 'recorded', 'inferred', 'transaction records are treated as recorded fund events in the first batch.'],
      ['ABC', 'transaction', 'type', 'FREEZE', 'fund_type', 'freeze', 'documented', 'transaction.type FREEZE is mapped to fund_type freeze.'],
    ];

    for (const row of rows) {
      await queryRunner.query(
        `
          INSERT INTO abc_status_mappings
            (source_system, source_table, source_field, source_value, target_domain, target_value, confidence_level, notes, is_active)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, 1
          FROM DUAL
          WHERE NOT EXISTS (
            SELECT 1
            FROM abc_status_mappings
            WHERE source_system = ?
              AND source_table = ?
              AND source_field = ?
              AND source_value = ?
              AND target_domain = ?
          )
        `,
        [...row, row[0], row[1], row[2], row[3], row[4]],
      );
    }
  }

  private async seedAmountRules(queryRunner: QueryRunner) {
    const rows = [
      ['ABC', 'order', 'amount', 'fen', 'yuan', '0.010000', 2, 'documented', 'order.amount behaves like fen based on sample amount=800 and item price 8.00.'],
      ['ABC', 'repair_order', 'amount', 'unknown', 'yuan', '1.000000', 2, 'inferred', 'repair_order.amount unit is not confirmed in the first batch; raw numeric value is retained.'],
      ['ABC', 'supermarket_order', 'money', 'yuan', 'yuan', '1.000000', 2, 'documented', 'supermarket_order.money behaves like yuan based on sample money=0.02.'],
      ['ABC', 'top_up_order', 'amount', 'fen', 'yuan', '0.010000', 2, 'documented', 'top_up_order.amount behaves like fen based on sample amount=50000.'],
      ['ABC', 'transaction', 'amount', 'fen', 'yuan', '0.010000', 2, 'documented', 'transaction.amount behaves like fen based on sample amount=800 and related order amount 8.00.'],
    ];

    for (const row of rows) {
      await queryRunner.query(
        `
          INSERT INTO abc_amount_rules
            (source_system, source_table, amount_field, amount_unit_raw, standard_unit, conversion_rate, standard_scale, confidence_level, notes, is_active)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 1
          FROM DUAL
          WHERE NOT EXISTS (
            SELECT 1
            FROM abc_amount_rules
            WHERE source_system = ?
              AND source_table = ?
              AND amount_field = ?
          )
        `,
        [...row, row[0], row[1], row[2]],
      );
    }
  }

  private async dropTableIfExists(queryRunner: QueryRunner, tableName: string) {
    if (await queryRunner.hasTable(tableName)) {
      await queryRunner.dropTable(tableName, true, true, true);
    }
  }
}
