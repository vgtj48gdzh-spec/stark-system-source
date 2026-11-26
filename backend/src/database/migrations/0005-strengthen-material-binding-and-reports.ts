import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class StrengthenMaterialBindingAndReports1710800004000
  implements MigrationInterface
{
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'materials',
      new TableColumn({
        name: 'warning_quantity',
        type: 'decimal',
        precision: 12,
        scale: 2,
        default: '0.00',
      }),
    );

    await queryRunner.addColumn(
      'material_preparations',
      new TableColumn({
        name: 'warehouse_id',
        type: 'int',
        isNullable: true,
      }),
    );

    await queryRunner.createForeignKey(
      'material_preparations',
      new TableForeignKey({
        columnNames: ['warehouse_id'],
        referencedTableName: 'warehouses',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.addColumns('work_order_materials', [
      new TableColumn({
        name: 'updated_by',
        type: 'int',
        isNullable: true,
      }),
      new TableColumn({
        name: 'deleted_at',
        type: 'datetime',
        isNullable: true,
      }),
      new TableColumn({
        name: 'deleted_by',
        type: 'int',
        isNullable: true,
      }),
    ]);

    await queryRunner.createForeignKeys('work_order_materials', [
      new TableForeignKey({
        columnNames: ['updated_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        columnNames: ['deleted_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);

    await queryRunner.createIndices('material_preparations', [
      new TableIndex({
        name: 'idx_material_preparations_bind_deadline',
        columnNames: ['bind_status', 'bind_deadline_at'],
      }),
      new TableIndex({
        name: 'idx_material_preparations_responsible_created',
        columnNames: ['responsible_user_id', 'created_at'],
      }),
      new TableIndex({
        name: 'idx_material_preparations_supplier_material',
        columnNames: ['supplier_id', 'material_id'],
      }),
    ]);

    await queryRunner.createIndex(
      'inventory_transactions',
      new TableIndex({
        name: 'idx_inventory_transactions_lookup',
        columnNames: ['warehouse_id', 'material_id', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'work_order_materials',
      new TableIndex({
        name: 'idx_work_order_materials_work_order_deleted',
        columnNames: ['work_order_id', 'deleted_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('work_order_materials', 'idx_work_order_materials_work_order_deleted');
    await queryRunner.dropIndex('inventory_transactions', 'idx_inventory_transactions_lookup');
    await queryRunner.dropIndex('material_preparations', 'idx_material_preparations_supplier_material');
    await queryRunner.dropIndex('material_preparations', 'idx_material_preparations_responsible_created');
    await queryRunner.dropIndex('material_preparations', 'idx_material_preparations_bind_deadline');

    const workOrderMaterialsTable = await queryRunner.getTable('work_order_materials');
    const updatedByForeignKey = workOrderMaterialsTable?.foreignKeys.find((foreignKey) =>
      foreignKey.columnNames.includes('updated_by'),
    );
    const deletedByForeignKey = workOrderMaterialsTable?.foreignKeys.find((foreignKey) =>
      foreignKey.columnNames.includes('deleted_by'),
    );

    if (updatedByForeignKey) {
      await queryRunner.dropForeignKey('work_order_materials', updatedByForeignKey);
    }

    if (deletedByForeignKey) {
      await queryRunner.dropForeignKey('work_order_materials', deletedByForeignKey);
    }

    await queryRunner.dropColumns('work_order_materials', ['updated_by', 'deleted_at', 'deleted_by']);

    const materialPreparationsTable = await queryRunner.getTable('material_preparations');
    const warehouseForeignKey = materialPreparationsTable?.foreignKeys.find((foreignKey) =>
      foreignKey.columnNames.includes('warehouse_id'),
    );

    if (warehouseForeignKey) {
      await queryRunner.dropForeignKey('material_preparations', warehouseForeignKey);
    }

    await queryRunner.dropColumn('material_preparations', 'warehouse_id');
    await queryRunner.dropColumn('materials', 'warning_quantity');
  }
}
