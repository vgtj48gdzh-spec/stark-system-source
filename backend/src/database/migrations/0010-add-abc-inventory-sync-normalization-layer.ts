import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddAbcInventorySyncNormalizationLayer1710800010000
  implements MigrationInterface
{
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createSyncMaterialsTable(queryRunner);
    await this.createSyncSuppliersTable(queryRunner);
    await this.createSyncWarehousesTable(queryRunner);
    await this.createSyncInventoryLedgerTable(queryRunner);
    await this.seedStatusMappings(queryRunner);
    await this.seedAmountRules(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM abc_status_mappings
      WHERE source_system = 'ABC'
        AND source_table IN ('merchant_material', 'merchant_supplier', 'merchant_warehouse', 'merchant_warehouse_out')
        AND target_domain IN ('material_status', 'supplier_status', 'warehouse_status', 'inventory_status', 'inventory_ledger_type')
    `);
    await queryRunner.query(`
      DELETE FROM abc_amount_rules
      WHERE source_system = 'ABC'
        AND source_table IN ('merchant_material', 'merchant_warehouse', 'merchant_warehouse_out')
        AND amount_field IN ('storage_price', 'price', 'goods_list[].price')
    `);
    await this.dropTableIfExists(queryRunner, 'abc_sync_inventory_ledger');
    await this.dropTableIfExists(queryRunner, 'abc_sync_warehouses');
    await this.dropTableIfExists(queryRunner, 'abc_sync_suppliers');
    await this.dropTableIfExists(queryRunner, 'abc_sync_materials');
  }

  private async createSyncMaterialsTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('abc_sync_materials')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'abc_sync_materials',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'source_system', type: 'varchar', length: '50' },
          { name: 'source_table', type: 'varchar', length: '100' },
          { name: 'source_id', type: 'varchar', length: '100' },
          { name: 'source_order_no', type: 'varchar', length: '100', isNullable: true },
          { name: 'source_updated_at', type: 'datetime', isNullable: true },
          { name: 'raw_record_id', type: 'int' },
          { name: 'raw_table_name', type: 'varchar', length: '100' },
          { name: 'material_name', type: 'varchar', length: '255', isNullable: true },
          { name: 'material_code', type: 'varchar', length: '100', isNullable: true },
          { name: 'material_status_field', type: 'varchar', length: '100', isNullable: true },
          { name: 'material_status_raw', type: 'varchar', length: '100', isNullable: true },
          { name: 'material_status_standard', type: 'varchar', length: '100', isNullable: true },
          { name: 'warning_quantity_field', type: 'varchar', length: '100', isNullable: true },
          { name: 'warning_quantity_raw', type: 'varchar', length: '100', isNullable: true },
          { name: 'warning_quantity_standard', type: 'decimal', precision: 18, scale: 2, isNullable: true },
          { name: 'quantity_unit', type: 'varchar', length: '30', isNullable: true },
          { name: 'storage_amount_field', type: 'varchar', length: '100', isNullable: true },
          { name: 'storage_amount_raw', type: 'varchar', length: '100', isNullable: true },
          { name: 'storage_amount_standard', type: 'decimal', precision: 18, scale: 2, isNullable: true },
          { name: 'storage_amount_unit', type: 'varchar', length: '30', isNullable: true },
          { name: 'sale_amount_field', type: 'varchar', length: '100', isNullable: true },
          { name: 'sale_amount_raw', type: 'varchar', length: '100', isNullable: true },
          { name: 'sale_amount_standard', type: 'decimal', precision: 18, scale: 2, isNullable: true },
          { name: 'sale_amount_unit', type: 'varchar', length: '30', isNullable: true },
          { name: 'supplier_ids_raw', type: 'text', isNullable: true },
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
      'abc_sync_materials',
      new TableIndex({
        name: 'uniq_abc_sync_materials_source_key',
        columnNames: ['source_system', 'source_table', 'source_id'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'abc_sync_materials',
      new TableIndex({
        name: 'idx_abc_sync_materials_batch_no',
        columnNames: ['sync_batch_no'],
      }),
    );
    await queryRunner.createIndex(
      'abc_sync_materials',
      new TableIndex({
        name: 'idx_abc_sync_materials_status_standard',
        columnNames: ['material_status_standard'],
      }),
    );
  }

  private async createSyncSuppliersTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('abc_sync_suppliers')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'abc_sync_suppliers',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'source_system', type: 'varchar', length: '50' },
          { name: 'source_table', type: 'varchar', length: '100' },
          { name: 'source_id', type: 'varchar', length: '100' },
          { name: 'source_order_no', type: 'varchar', length: '100', isNullable: true },
          { name: 'source_updated_at', type: 'datetime', isNullable: true },
          { name: 'raw_record_id', type: 'int' },
          { name: 'raw_table_name', type: 'varchar', length: '100' },
          { name: 'supplier_name', type: 'varchar', length: '255', isNullable: true },
          { name: 'supplier_status_field', type: 'varchar', length: '100', isNullable: true },
          { name: 'supplier_status_raw', type: 'varchar', length: '100', isNullable: true },
          { name: 'supplier_status_standard', type: 'varchar', length: '100', isNullable: true },
          { name: 'contact_name', type: 'varchar', length: '100', isNullable: true },
          { name: 'contact_mobile', type: 'varchar', length: '100', isNullable: true },
          { name: 'email', type: 'varchar', length: '255', isNullable: true },
          { name: 'company_site', type: 'varchar', length: '255', isNullable: true },
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
      'abc_sync_suppliers',
      new TableIndex({
        name: 'uniq_abc_sync_suppliers_source_key',
        columnNames: ['source_system', 'source_table', 'source_id'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'abc_sync_suppliers',
      new TableIndex({
        name: 'idx_abc_sync_suppliers_batch_no',
        columnNames: ['sync_batch_no'],
      }),
    );
    await queryRunner.createIndex(
      'abc_sync_suppliers',
      new TableIndex({
        name: 'idx_abc_sync_suppliers_status_standard',
        columnNames: ['supplier_status_standard'],
      }),
    );
  }

  private async createSyncWarehousesTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('abc_sync_warehouses')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'abc_sync_warehouses',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'source_system', type: 'varchar', length: '50' },
          { name: 'source_table', type: 'varchar', length: '100' },
          { name: 'source_id', type: 'varchar', length: '100' },
          { name: 'source_order_no', type: 'varchar', length: '100', isNullable: true },
          { name: 'source_updated_at', type: 'datetime', isNullable: true },
          { name: 'raw_record_id', type: 'int' },
          { name: 'raw_table_name', type: 'varchar', length: '100' },
          { name: 'warehouse_source_id', type: 'varchar', length: '100', isNullable: true },
          { name: 'warehouse_name', type: 'varchar', length: '255', isNullable: true },
          { name: 'warehouse_status_field', type: 'varchar', length: '100', isNullable: true },
          { name: 'warehouse_status_raw', type: 'varchar', length: '100', isNullable: true },
          { name: 'warehouse_status_standard', type: 'varchar', length: '100', isNullable: true },
          { name: 'quantity_field', type: 'varchar', length: '100', isNullable: true },
          { name: 'quantity_raw', type: 'varchar', length: '100', isNullable: true },
          { name: 'quantity_standard', type: 'decimal', precision: 18, scale: 2, isNullable: true },
          { name: 'quantity_unit', type: 'varchar', length: '30', isNullable: true },
          { name: 'amount_field', type: 'varchar', length: '100', isNullable: true },
          { name: 'amount_raw', type: 'varchar', length: '100', isNullable: true },
          { name: 'amount_standard', type: 'decimal', precision: 18, scale: 2, isNullable: true },
          { name: 'amount_unit', type: 'varchar', length: '30', isNullable: true },
          { name: 'source_merchant_id', type: 'varchar', length: '100', isNullable: true },
          { name: 'supplier_source_id', type: 'varchar', length: '100', isNullable: true },
          { name: 'material_source_id', type: 'varchar', length: '100', isNullable: true },
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
      'abc_sync_warehouses',
      new TableIndex({
        name: 'uniq_abc_sync_warehouses_source_key',
        columnNames: ['source_system', 'source_table', 'source_id'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'abc_sync_warehouses',
      new TableIndex({
        name: 'idx_abc_sync_warehouses_batch_no',
        columnNames: ['sync_batch_no'],
      }),
    );
    await queryRunner.createIndex(
      'abc_sync_warehouses',
      new TableIndex({
        name: 'idx_abc_sync_warehouses_status_standard',
        columnNames: ['warehouse_status_standard'],
      }),
    );
  }

  private async createSyncInventoryLedgerTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('abc_sync_inventory_ledger')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'abc_sync_inventory_ledger',
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
          { name: 'quantity_field', type: 'varchar', length: '100', isNullable: true },
          { name: 'quantity_raw', type: 'varchar', length: '100', isNullable: true },
          { name: 'quantity_standard', type: 'decimal', precision: 18, scale: 2, isNullable: true },
          { name: 'quantity_unit', type: 'varchar', length: '30', isNullable: true },
          { name: 'amount_field', type: 'varchar', length: '100', isNullable: true },
          { name: 'amount_raw', type: 'varchar', length: '100', isNullable: true },
          { name: 'amount_standard', type: 'decimal', precision: 18, scale: 2, isNullable: true },
          { name: 'amount_unit', type: 'varchar', length: '30', isNullable: true },
          { name: 'warehouse_source_id', type: 'varchar', length: '100', isNullable: true },
          { name: 'material_source_id', type: 'varchar', length: '100', isNullable: true },
          { name: 'supplier_source_id', type: 'varchar', length: '100', isNullable: true },
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
      'abc_sync_inventory_ledger',
      new TableIndex({
        name: 'uniq_abc_sync_inventory_ledger_source_key',
        columnNames: ['source_system', 'source_table', 'source_id'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'abc_sync_inventory_ledger',
      new TableIndex({
        name: 'idx_abc_sync_inventory_ledger_batch_no',
        columnNames: ['sync_batch_no'],
      }),
    );
    await queryRunner.createIndex(
      'abc_sync_inventory_ledger',
      new TableIndex({
        name: 'idx_abc_sync_inventory_ledger_status_standard',
        columnNames: ['status_standard'],
      }),
    );
  }

  private async seedStatusMappings(queryRunner: QueryRunner) {
    const rows = [
      ['ABC', 'merchant_material', 'derived_status', 'active', 'material_status', 'active', 'inferred', 'merchant_material active status is inferred from deleted_at being null.'],
      ['ABC', 'merchant_material', 'derived_status', 'inactive', 'material_status', 'inactive', 'inferred', 'merchant_material inactive status is inferred from deleted_at not being null.'],
      ['ABC', 'merchant_supplier', 'derived_status', 'active', 'supplier_status', 'active', 'inferred', 'merchant_supplier active status is inferred from deleted_at being null.'],
      ['ABC', 'merchant_supplier', 'derived_status', 'inactive', 'supplier_status', 'inactive', 'inferred', 'merchant_supplier inactive status is inferred from deleted_at not being null.'],
      ['ABC', 'merchant_warehouse', 'status', '0', 'warehouse_status', 'pending', 'documented', 'merchant_warehouse.status=0 means pending confirmation.'],
      ['ABC', 'merchant_warehouse', 'status', '1', 'warehouse_status', 'completed', 'documented', 'merchant_warehouse.status=1 means confirmed inbound.'],
      ['ABC', 'merchant_warehouse', 'status', '2', 'warehouse_status', 'returned', 'documented', 'merchant_warehouse.status=2 means returned goods.'],
      ['ABC', 'merchant_warehouse', 'status', '3', 'warehouse_status', 'shipped', 'documented', 'merchant_warehouse.status=3 means shipped.'],
      ['ABC', 'merchant_warehouse_out', 'derived_status', 'active', 'inventory_status', 'completed', 'inferred', 'merchant_warehouse_out active status is inferred from deleted_at being null.'],
      ['ABC', 'merchant_warehouse_out', 'derived_status', 'inactive', 'inventory_status', 'cancelled', 'inferred', 'merchant_warehouse_out inactive status is inferred from deleted_at not being null.'],
      ['ABC', 'merchant_warehouse_out', 'type', '1', 'inventory_ledger_type', 'work_order_outbound', 'documented', 'merchant_warehouse_out.type=1 means work-order outbound.'],
      ['ABC', 'merchant_warehouse_out', 'type', '2', 'inventory_ledger_type', 'internal_use', 'documented', 'merchant_warehouse_out.type=2 means internal use.'],
      ['ABC', 'merchant_warehouse_out', 'type', '3', 'inventory_ledger_type', 'goods_sale', 'documented', 'merchant_warehouse_out.type=3 means goods sale.'],
      ['ABC', 'merchant_warehouse_out', 'type', '4', 'inventory_ledger_type', 'other_outbound', 'documented', 'merchant_warehouse_out.type=4 means other outbound.'],
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
      ['ABC', 'merchant_material', 'storage_price', 'yuan_integer', 'yuan', '1.000000', 2, 'inferred', 'merchant_material.storage_price is stored as integer-like amount and is treated as yuan in the first batch.'],
      ['ABC', 'merchant_material', 'price', 'yuan_integer', 'yuan', '1.000000', 2, 'inferred', 'merchant_material.price is stored as integer-like amount and is treated as yuan in the first batch.'],
      ['ABC', 'merchant_warehouse', 'price', 'yuan', 'yuan', '1.000000', 2, 'documented', 'merchant_warehouse.price is stored as decimal yuan unit price.'],
      ['ABC', 'merchant_warehouse_out', 'price', 'yuan', 'yuan', '1.000000', 2, 'documented', 'merchant_warehouse_out.price is stored as decimal yuan header amount.'],
      ['ABC', 'merchant_warehouse_out', 'goods_list[].price', 'yuan', 'yuan', '1.000000', 2, 'inferred', 'merchant_warehouse_out goods_list line price is inferred as yuan unit price.'],
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
