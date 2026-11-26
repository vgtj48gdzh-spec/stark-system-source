import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey } from 'typeorm';

export class AddInventoryAndSupplierModules1710800002000 implements MigrationInterface {
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'work_orders',
      new TableColumn({
        name: 'material_cost_total',
        type: 'decimal',
        precision: 12,
        scale: 2,
        default: '0.00',
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'warehouses',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'warehouse_no', type: 'varchar', length: '20', isUnique: true },
          { name: 'name', type: 'varchar', length: '100' },
          { name: 'code', type: 'varchar', length: '50', isUnique: true },
          { name: 'manager_user_id', type: 'int', isNullable: true },
          { name: 'address', type: 'varchar', length: '255', isNullable: true },
          { name: 'status', type: 'enum', enum: ['active', 'inactive'], default: "'active'" },
          { name: 'remark', type: 'varchar', length: '500', isNullable: true },
          { name: 'created_by', type: 'int' },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'suppliers',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'supplier_no', type: 'varchar', length: '20', isUnique: true },
          { name: 'name', type: 'varchar', length: '100' },
          { name: 'contact_name', type: 'varchar', length: '50', isNullable: true },
          { name: 'contact_mobile', type: 'varchar', length: '20', isNullable: true },
          { name: 'address', type: 'varchar', length: '255', isNullable: true },
          { name: 'status', type: 'enum', enum: ['active', 'inactive'], default: "'active'" },
          { name: 'remark', type: 'varchar', length: '500', isNullable: true },
          { name: 'score', type: 'decimal', precision: 5, scale: 2, isNullable: true },
          { name: 'created_by', type: 'int' },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'materials',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'material_no', type: 'varchar', length: '20', isUnique: true },
          { name: 'name', type: 'varchar', length: '100' },
          { name: 'specification', type: 'varchar', length: '100', isNullable: true },
          { name: 'unit', type: 'varchar', length: '30' },
          { name: 'category', type: 'varchar', length: '50', isNullable: true },
          { name: 'default_supplier_id', type: 'int', isNullable: true },
          { name: 'default_unit_price', type: 'decimal', precision: 12, scale: 2, default: '0.00' },
          { name: 'status', type: 'enum', enum: ['active', 'inactive'], default: "'active'" },
          { name: 'remark', type: 'varchar', length: '500', isNullable: true },
          { name: 'created_by', type: 'int' },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'material_stocks',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'warehouse_id', type: 'int' },
          { name: 'material_id', type: 'int' },
          { name: 'current_quantity', type: 'decimal', precision: 12, scale: 2, default: '0.00' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
        indices: [
          {
            name: 'uniq_material_stock',
            columnNames: ['warehouse_id', 'material_id'],
            isUnique: true,
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'material_preparations',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'preparation_no', type: 'varchar', length: '20', isUnique: true },
          { name: 'material_id', type: 'int' },
          { name: 'supplier_id', type: 'int', isNullable: true },
          { name: 'quantity', type: 'decimal', precision: 12, scale: 2 },
          { name: 'unit_price', type: 'decimal', precision: 12, scale: 2 },
          { name: 'total_price', type: 'decimal', precision: 12, scale: 2 },
          { name: 'linked_work_order_id', type: 'int', isNullable: true },
          { name: 'responsible_user_id', type: 'int', isNullable: true },
          { name: 'bind_status', type: 'enum', enum: ['unbound', 'bound'], default: "'unbound'" },
          { name: 'prepared_at', type: 'datetime', isNullable: true },
          { name: 'bind_deadline_at', type: 'datetime', isNullable: true },
          { name: 'remark', type: 'varchar', length: '500', isNullable: true },
          { name: 'created_by', type: 'int' },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'inventory_transactions',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'transaction_no', type: 'varchar', length: '20', isUnique: true },
          { name: 'transaction_type', type: 'enum', enum: ['inbound', 'outbound'] },
          { name: 'warehouse_id', type: 'int' },
          { name: 'material_id', type: 'int' },
          { name: 'quantity', type: 'decimal', precision: 12, scale: 2 },
          { name: 'unit_price', type: 'decimal', precision: 12, scale: 2 },
          { name: 'total_price', type: 'decimal', precision: 12, scale: 2 },
          { name: 'related_work_order_id', type: 'int', isNullable: true },
          { name: 'related_preparation_id', type: 'int', isNullable: true },
          { name: 'remark', type: 'varchar', length: '500', isNullable: true },
          { name: 'created_by', type: 'int' },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'work_order_materials',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'work_order_id', type: 'int' },
          { name: 'material_id', type: 'int' },
          { name: 'source_type', type: 'enum', enum: ['manual', 'warehouse', 'preparation'], default: "'manual'" },
          { name: 'warehouse_id', type: 'int', isNullable: true },
          { name: 'preparation_id', type: 'int', isNullable: true },
          { name: 'quantity', type: 'decimal', precision: 12, scale: 2 },
          { name: 'unit_price', type: 'decimal', precision: 12, scale: 2 },
          { name: 'total_price', type: 'decimal', precision: 12, scale: 2 },
          { name: 'remark', type: 'varchar', length: '500', isNullable: true },
          { name: 'created_by', type: 'int' },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createForeignKeys('warehouses', [
      new TableForeignKey({ columnNames: ['manager_user_id'], referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'SET NULL' }),
      new TableForeignKey({ columnNames: ['created_by'], referencedTableName: 'users', referencedColumnNames: ['id'] }),
    ]);

    await queryRunner.createForeignKeys('suppliers', [
      new TableForeignKey({ columnNames: ['created_by'], referencedTableName: 'users', referencedColumnNames: ['id'] }),
    ]);

    await queryRunner.createForeignKeys('materials', [
      new TableForeignKey({ columnNames: ['default_supplier_id'], referencedTableName: 'suppliers', referencedColumnNames: ['id'], onDelete: 'SET NULL' }),
      new TableForeignKey({ columnNames: ['created_by'], referencedTableName: 'users', referencedColumnNames: ['id'] }),
    ]);

    await queryRunner.createForeignKeys('material_stocks', [
      new TableForeignKey({ columnNames: ['warehouse_id'], referencedTableName: 'warehouses', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
      new TableForeignKey({ columnNames: ['material_id'], referencedTableName: 'materials', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
    ]);

    await queryRunner.createForeignKeys('material_preparations', [
      new TableForeignKey({ columnNames: ['material_id'], referencedTableName: 'materials', referencedColumnNames: ['id'] }),
      new TableForeignKey({ columnNames: ['supplier_id'], referencedTableName: 'suppliers', referencedColumnNames: ['id'], onDelete: 'SET NULL' }),
      new TableForeignKey({ columnNames: ['linked_work_order_id'], referencedTableName: 'work_orders', referencedColumnNames: ['id'], onDelete: 'SET NULL' }),
      new TableForeignKey({ columnNames: ['responsible_user_id'], referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'SET NULL' }),
      new TableForeignKey({ columnNames: ['created_by'], referencedTableName: 'users', referencedColumnNames: ['id'] }),
    ]);

    await queryRunner.createForeignKeys('inventory_transactions', [
      new TableForeignKey({ columnNames: ['warehouse_id'], referencedTableName: 'warehouses', referencedColumnNames: ['id'] }),
      new TableForeignKey({ columnNames: ['material_id'], referencedTableName: 'materials', referencedColumnNames: ['id'] }),
      new TableForeignKey({ columnNames: ['related_work_order_id'], referencedTableName: 'work_orders', referencedColumnNames: ['id'], onDelete: 'SET NULL' }),
      new TableForeignKey({ columnNames: ['related_preparation_id'], referencedTableName: 'material_preparations', referencedColumnNames: ['id'], onDelete: 'SET NULL' }),
      new TableForeignKey({ columnNames: ['created_by'], referencedTableName: 'users', referencedColumnNames: ['id'] }),
    ]);

    await queryRunner.createForeignKeys('work_order_materials', [
      new TableForeignKey({ columnNames: ['work_order_id'], referencedTableName: 'work_orders', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
      new TableForeignKey({ columnNames: ['material_id'], referencedTableName: 'materials', referencedColumnNames: ['id'] }),
      new TableForeignKey({ columnNames: ['warehouse_id'], referencedTableName: 'warehouses', referencedColumnNames: ['id'], onDelete: 'SET NULL' }),
      new TableForeignKey({ columnNames: ['preparation_id'], referencedTableName: 'material_preparations', referencedColumnNames: ['id'], onDelete: 'SET NULL' }),
      new TableForeignKey({ columnNames: ['created_by'], referencedTableName: 'users', referencedColumnNames: ['id'] }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('work_order_materials');
    await queryRunner.dropTable('inventory_transactions');
    await queryRunner.dropTable('material_preparations');
    await queryRunner.dropTable('material_stocks');
    await queryRunner.dropTable('materials');
    await queryRunner.dropTable('suppliers');
    await queryRunner.dropTable('warehouses');
    await queryRunner.dropColumn('work_orders', 'material_cost_total');
  }
}
