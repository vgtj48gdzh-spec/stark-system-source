import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddAbcCardSyncNormalizationLayer1710800009000
  implements MigrationInterface
{
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createSyncCardsTable(queryRunner);
    await this.createSyncCardLedgerTable(queryRunner);
    await this.seedStatusMappings(queryRunner);
    await this.seedAmountRules(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM abc_status_mappings
      WHERE source_system = 'ABC'
        AND source_table IN ('shopping_card', 'user_shopping_card', 'user_shopping_card_money', 'user_shopping_card_recharge')
        AND target_domain IN ('card_status', 'card_ledger_type')
    `);
    await queryRunner.query(`
      DELETE FROM abc_amount_rules
      WHERE source_system = 'ABC'
        AND source_table IN ('user_shopping_card', 'user_shopping_card_money', 'user_shopping_card_recharge')
        AND amount_field IN ('balance', 'total_amount', 'amount')
    `);
    await this.dropTableIfExists(queryRunner, 'abc_sync_card_ledger');
    await this.dropTableIfExists(queryRunner, 'abc_sync_cards');
  }

  private async createSyncCardsTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('abc_sync_cards')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'abc_sync_cards',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'source_system', type: 'varchar', length: '50' },
          { name: 'source_table', type: 'varchar', length: '100' },
          { name: 'source_id', type: 'varchar', length: '100' },
          { name: 'source_order_no', type: 'varchar', length: '100', isNullable: true },
          { name: 'source_updated_at', type: 'datetime', isNullable: true },
          { name: 'raw_record_id', type: 'int' },
          { name: 'raw_table_name', type: 'varchar', length: '100' },
          { name: 'card_object_type', type: 'varchar', length: '50' },
          { name: 'card_name', type: 'varchar', length: '255', isNullable: true },
          { name: 'card_number', type: 'varchar', length: '100', isNullable: true },
          { name: 'card_status_field', type: 'varchar', length: '100', isNullable: true },
          { name: 'card_status_raw', type: 'varchar', length: '100', isNullable: true },
          { name: 'card_status_standard', type: 'varchar', length: '100', isNullable: true },
          { name: 'amount_field', type: 'varchar', length: '100', isNullable: true },
          { name: 'amount_raw', type: 'varchar', length: '100', isNullable: true },
          { name: 'amount_standard', type: 'decimal', precision: 18, scale: 2, isNullable: true },
          { name: 'amount_unit', type: 'varchar', length: '30', isNullable: true },
          { name: 'source_card_id', type: 'varchar', length: '100', isNullable: true },
          { name: 'source_user_id', type: 'varchar', length: '100', isNullable: true },
          { name: 'source_merchant_id', type: 'varchar', length: '100', isNullable: true },
          { name: 'mapping_confirmed', type: 'tinyint', width: 1, default: '0' },
          { name: 'mapping_notes', type: 'text', isNullable: true },
          { name: 'normalized_payload', type: 'json' },
          { name: 'synced_at', type: 'datetime' },
          { name: 'sync_batch_no', type: 'varchar', length: '64' },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createIndex(
      'abc_sync_cards',
      new TableIndex({
        name: 'uniq_abc_sync_cards_source_key',
        columnNames: ['source_system', 'source_table', 'source_id'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'abc_sync_cards',
      new TableIndex({
        name: 'idx_abc_sync_cards_batch_no',
        columnNames: ['sync_batch_no'],
      }),
    );
    await queryRunner.createIndex(
      'abc_sync_cards',
      new TableIndex({
        name: 'idx_abc_sync_cards_status_standard',
        columnNames: ['card_status_standard'],
      }),
    );
  }

  private async createSyncCardLedgerTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('abc_sync_card_ledger')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'abc_sync_card_ledger',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'source_system', type: 'varchar', length: '50' },
          { name: 'source_table', type: 'varchar', length: '100' },
          { name: 'source_id', type: 'varchar', length: '100' },
          { name: 'source_order_no', type: 'varchar', length: '100', isNullable: true },
          { name: 'source_updated_at', type: 'datetime', isNullable: true },
          { name: 'raw_record_id', type: 'int' },
          { name: 'raw_table_name', type: 'varchar', length: '100' },
          { name: 'ledger_type_standard', type: 'varchar', length: '100', isNullable: true },
          { name: 'status_field', type: 'varchar', length: '100', isNullable: true },
          { name: 'status_raw', type: 'varchar', length: '100', isNullable: true },
          { name: 'status_standard', type: 'varchar', length: '100', isNullable: true },
          { name: 'amount_field', type: 'varchar', length: '100', isNullable: true },
          { name: 'amount_raw', type: 'varchar', length: '100', isNullable: true },
          { name: 'amount_standard', type: 'decimal', precision: 18, scale: 2, isNullable: true },
          { name: 'amount_unit', type: 'varchar', length: '30', isNullable: true },
          { name: 'balance_field', type: 'varchar', length: '100', isNullable: true },
          { name: 'balance_raw', type: 'varchar', length: '100', isNullable: true },
          { name: 'balance_standard', type: 'decimal', precision: 18, scale: 2, isNullable: true },
          { name: 'balance_unit', type: 'varchar', length: '30', isNullable: true },
          { name: 'related_card_source_id', type: 'varchar', length: '100', isNullable: true },
          { name: 'related_order_no', type: 'varchar', length: '100', isNullable: true },
          { name: 'source_user_id', type: 'varchar', length: '100', isNullable: true },
          { name: 'source_merchant_id', type: 'varchar', length: '100', isNullable: true },
          { name: 'mapping_confirmed', type: 'tinyint', width: 1, default: '0' },
          { name: 'mapping_notes', type: 'text', isNullable: true },
          { name: 'normalized_payload', type: 'json' },
          { name: 'synced_at', type: 'datetime' },
          { name: 'sync_batch_no', type: 'varchar', length: '64' },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createIndex(
      'abc_sync_card_ledger',
      new TableIndex({
        name: 'uniq_abc_sync_card_ledger_source_key',
        columnNames: ['source_system', 'source_table', 'source_id'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'abc_sync_card_ledger',
      new TableIndex({
        name: 'idx_abc_sync_card_ledger_batch_no',
        columnNames: ['sync_batch_no'],
      }),
    );
    await queryRunner.createIndex(
      'abc_sync_card_ledger',
      new TableIndex({
        name: 'idx_abc_sync_card_ledger_status_standard',
        columnNames: ['status_standard'],
      }),
    );
  }

  private async seedStatusMappings(queryRunner: QueryRunner) {
    const rows = [
      ['ABC', 'shopping_card', 'status', '1', 'card_status', 'active', 'documented', 'shopping_card.status=1 means the card template is active.'],
      ['ABC', 'shopping_card', 'status', '2', 'card_status', 'inactive', 'documented', 'shopping_card.status=2 means the card template is inactive.'],
      ['ABC', 'user_shopping_card', 'derived_status', 'active', 'card_status', 'active', 'inferred', 'user_shopping_card active status is inferred from deleted_at being null.'],
      ['ABC', 'user_shopping_card', 'derived_status', 'inactive', 'card_status', 'inactive', 'inferred', 'user_shopping_card inactive status is inferred from deleted_at not being null.'],
      ['ABC', 'user_shopping_card_recharge', 'status', '1', 'card_status', 'pending_payment', 'documented', 'user_shopping_card_recharge.status=1 means payment is pending.'],
      ['ABC', 'user_shopping_card_recharge', 'status', '2', 'card_status', 'completed', 'documented', 'user_shopping_card_recharge.status=2 means recharge is completed.'],
      ['ABC', 'user_shopping_card_recharge', 'status', '3', 'card_status', 'failed', 'documented', 'user_shopping_card_recharge.status=3 means recharge failed.'],
      ['ABC', 'user_shopping_card_money', 'derived_status', 'active', 'card_status', 'active', 'inferred', 'user_shopping_card_money active status is inferred from deleted_at being null.'],
      ['ABC', 'user_shopping_card_money', 'derived_status', 'inactive', 'card_status', 'inactive', 'inferred', 'user_shopping_card_money inactive status is inferred from deleted_at not being null.'],
      ['ABC', 'user_shopping_card_money', 'source_type', '1', 'card_ledger_type', 'points_recovery', 'inferred', 'user_shopping_card_money.source_type=1 is inferred as points recovery from sample remarks.'],
      ['ABC', 'user_shopping_card_money', 'source_type', '3', 'card_ledger_type', 'package_bonus', 'inferred', 'user_shopping_card_money.source_type=3 is inferred as package bonus from sample remarks.'],
      ['ABC', 'user_shopping_card_money', 'source_type', '4', 'card_ledger_type', 'privilege_bonus', 'inferred', 'user_shopping_card_money.source_type=4 is inferred as privilege bonus from sample remarks.'],
      ['ABC', 'user_shopping_card_money', 'source_type', '5', 'card_ledger_type', 'appointment_bonus', 'inferred', 'user_shopping_card_money.source_type=5 is inferred as appointment bonus from sample remarks.'],
      ['ABC', 'user_shopping_card_recharge', 'status', '1', 'card_ledger_type', 'recharge', 'documented', 'Recharge records are card recharge ledger entries.'],
      ['ABC', 'user_shopping_card_recharge', 'status', '2', 'card_ledger_type', 'recharge', 'documented', 'Recharge records are card recharge ledger entries.'],
      ['ABC', 'user_shopping_card_recharge', 'status', '3', 'card_ledger_type', 'recharge', 'documented', 'Recharge records are card recharge ledger entries.'],
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
      ['ABC', 'user_shopping_card', 'balance', 'fen', 'yuan', '0.010000', 2, 'documented', 'user_shopping_card.balance is explicitly documented as fen.'],
      ['ABC', 'user_shopping_card', 'total_amount', 'fen', 'yuan', '0.010000', 2, 'documented', 'user_shopping_card.total_amount is treated as cumulative fen amount.'],
      ['ABC', 'user_shopping_card_recharge', 'amount', 'fen', 'yuan', '0.010000', 2, 'inferred', 'user_shopping_card_recharge.amount is inferred to behave like fen from recharge samples.'],
      ['ABC', 'user_shopping_card_money', 'amount', 'fen_decimal', 'yuan', '0.010000', 2, 'inferred', 'user_shopping_card_money.amount is inferred to behave like fen from amount/balance pairing.'],
      ['ABC', 'user_shopping_card_money', 'balance', 'fen', 'yuan', '0.010000', 2, 'documented', 'user_shopping_card_money.balance is explicitly documented as fen.'],
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
