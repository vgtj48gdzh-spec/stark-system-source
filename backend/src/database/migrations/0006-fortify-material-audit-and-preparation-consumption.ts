import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class FortifyMaterialAuditAndPreparationConsumption1710800005000
  implements MigrationInterface
{
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.ensureMaterialWarningQuantityColumn(queryRunner);
    await this.ensurePreparationWarehouseColumn(queryRunner);
    await this.ensureOperationLogAuditColumns(queryRunner);
    await this.ensurePreparationConsumptionColumns(queryRunner);
    await this.ensureWorkOrderMaterialPreparationBinding(queryRunner);
    await this.ensureInventoryTransactionLineTracking(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropInventoryTransactionLineTracking(queryRunner);
    await this.dropWorkOrderMaterialPreparationBinding(queryRunner);
    await this.dropPreparationConsumptionColumns(queryRunner);
    await this.dropOperationLogAuditColumns(queryRunner);
  }

  private async ensureMaterialWarningQuantityColumn(queryRunner: QueryRunner) {
    const hasWarningQuantity = await queryRunner.hasColumn('materials', 'warning_quantity');

    if (!hasWarningQuantity) {
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
    }
  }

  private async ensurePreparationWarehouseColumn(queryRunner: QueryRunner) {
    const hasWarehouseId = await queryRunner.hasColumn('material_preparations', 'warehouse_id');

    if (!hasWarehouseId) {
      await queryRunner.addColumn(
        'material_preparations',
        new TableColumn({
          name: 'warehouse_id',
          type: 'int',
          isNullable: true,
        }),
      );
    }

    await this.ensureForeignKey(
      queryRunner,
      'material_preparations',
      new TableForeignKey({
        name: 'fk_material_preparations_warehouse_id',
        columnNames: ['warehouse_id'],
        referencedTableName: 'warehouses',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  private async ensureOperationLogAuditColumns(queryRunner: QueryRunner) {
    const operationLogsTable = await queryRunner.getTable('operation_logs');
    const detailColumn = operationLogsTable?.findColumnByName('detail');

    if (detailColumn && detailColumn.type !== 'text') {
      await queryRunner.changeColumn(
        'operation_logs',
        'detail',
        new TableColumn({
          name: 'detail',
          type: 'text',
          isNullable: true,
        }),
      );
    }

    const hasDetailJson = await queryRunner.hasColumn('operation_logs', 'detail_json');

    if (!hasDetailJson) {
      await queryRunner.addColumn(
        'operation_logs',
        new TableColumn({
          name: 'detail_json',
          type: 'json',
          isNullable: true,
        }),
      );
    }
  }

  private async ensurePreparationConsumptionColumns(queryRunner: QueryRunner) {
    const hasConsumedWorkOrderMaterialId = await queryRunner.hasColumn(
      'material_preparations',
      'consumed_work_order_material_id',
    );
    const hasConsumedAt = await queryRunner.hasColumn('material_preparations', 'consumed_at');

    if (!hasConsumedWorkOrderMaterialId) {
      await queryRunner.addColumn(
        'material_preparations',
        new TableColumn({
          name: 'consumed_work_order_material_id',
          type: 'int',
          isNullable: true,
        }),
      );
    }

    if (!hasConsumedAt) {
      await queryRunner.addColumn(
        'material_preparations',
        new TableColumn({
          name: 'consumed_at',
          type: 'datetime',
          isNullable: true,
        }),
      );
    }

    await this.ensureForeignKey(
      queryRunner,
      'material_preparations',
      new TableForeignKey({
        name: 'fk_material_preparations_consumed_work_order_material_id',
        columnNames: ['consumed_work_order_material_id'],
        referencedTableName: 'work_order_materials',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await this.ensureIndex(
      queryRunner,
      'material_preparations',
      new TableIndex({
        name: 'idx_material_preparations_consumed_work_order_material_id',
        columnNames: ['consumed_work_order_material_id'],
      }),
    );
  }

  private async ensureWorkOrderMaterialPreparationBinding(queryRunner: QueryRunner) {
    const hasPreparationId = await queryRunner.hasColumn('work_order_materials', 'preparation_id');

    if (!hasPreparationId) {
      await queryRunner.addColumn(
        'work_order_materials',
        new TableColumn({
          name: 'preparation_id',
          type: 'int',
          isNullable: true,
        }),
      );
    }

    await this.ensureForeignKey(
      queryRunner,
      'work_order_materials',
      new TableForeignKey({
        name: 'fk_work_order_materials_preparation_id',
        columnNames: ['preparation_id'],
        referencedTableName: 'material_preparations',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await this.ensureIndex(
      queryRunner,
      'work_order_materials',
      new TableIndex({
        name: 'uniq_work_order_materials_preparation_id',
        columnNames: ['preparation_id'],
        isUnique: true,
      }),
    );
  }

  private async ensureInventoryTransactionLineTracking(queryRunner: QueryRunner) {
    const hasRelatedWorkOrderMaterialId = await queryRunner.hasColumn(
      'inventory_transactions',
      'related_work_order_material_id',
    );

    if (!hasRelatedWorkOrderMaterialId) {
      await queryRunner.addColumn(
        'inventory_transactions',
        new TableColumn({
          name: 'related_work_order_material_id',
          type: 'int',
          isNullable: true,
        }),
      );
    }

    await this.ensureForeignKey(
      queryRunner,
      'inventory_transactions',
      new TableForeignKey({
        name: 'fk_inventory_transactions_related_work_order_material_id',
        columnNames: ['related_work_order_material_id'],
        referencedTableName: 'work_order_materials',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await this.ensureIndex(
      queryRunner,
      'inventory_transactions',
      new TableIndex({
        name: 'idx_inventory_transactions_related_work_order_material_id',
        columnNames: ['related_work_order_material_id', 'created_at'],
      }),
    );
  }

  private async dropInventoryTransactionLineTracking(queryRunner: QueryRunner) {
    await this.dropIndexIfExists(
      queryRunner,
      'inventory_transactions',
      'idx_inventory_transactions_related_work_order_material_id',
    );
    await this.dropForeignKeyByNameOrColumn(
      queryRunner,
      'inventory_transactions',
      'fk_inventory_transactions_related_work_order_material_id',
      'related_work_order_material_id',
    );

    if (await queryRunner.hasColumn('inventory_transactions', 'related_work_order_material_id')) {
      await queryRunner.dropColumn('inventory_transactions', 'related_work_order_material_id');
    }
  }

  private async dropWorkOrderMaterialPreparationBinding(queryRunner: QueryRunner) {
    await this.dropIndexIfExists(
      queryRunner,
      'work_order_materials',
      'uniq_work_order_materials_preparation_id',
    );

    const table = await queryRunner.getTable('work_order_materials');
    const preparationIdColumn = table?.findColumnByName('preparation_id');
    const preparationForeignKey = table?.foreignKeys.find(
      (foreignKey) =>
        foreignKey.name === 'fk_work_order_materials_preparation_id' ||
        foreignKey.columnNames.includes('preparation_id'),
    );

    if (!preparationIdColumn) {
      return;
    }

    if (!preparationForeignKey) {
      await queryRunner.dropColumn('work_order_materials', 'preparation_id');
      return;
    }

    if (preparationForeignKey.name === 'fk_work_order_materials_preparation_id') {
      await queryRunner.dropForeignKey('work_order_materials', preparationForeignKey);
      await queryRunner.dropColumn('work_order_materials', 'preparation_id');
    }
  }

  private async dropPreparationConsumptionColumns(queryRunner: QueryRunner) {
    await this.dropIndexIfExists(
      queryRunner,
      'material_preparations',
      'idx_material_preparations_consumed_work_order_material_id',
    );
    await this.dropForeignKeyByNameOrColumn(
      queryRunner,
      'material_preparations',
      'fk_material_preparations_consumed_work_order_material_id',
      'consumed_work_order_material_id',
    );

    if (await queryRunner.hasColumn('material_preparations', 'consumed_at')) {
      await queryRunner.dropColumn('material_preparations', 'consumed_at');
    }

    if (await queryRunner.hasColumn('material_preparations', 'consumed_work_order_material_id')) {
      await queryRunner.dropColumn('material_preparations', 'consumed_work_order_material_id');
    }
  }

  private async dropOperationLogAuditColumns(queryRunner: QueryRunner) {
    if (await queryRunner.hasColumn('operation_logs', 'detail_json')) {
      await queryRunner.dropColumn('operation_logs', 'detail_json');
    }

    const table = await queryRunner.getTable('operation_logs');
    const detailColumn = table?.findColumnByName('detail');

    if (detailColumn && detailColumn.type !== 'varchar') {
      await queryRunner.changeColumn(
        'operation_logs',
        'detail',
        new TableColumn({
          name: 'detail',
          type: 'varchar',
          length: '1000',
          isNullable: true,
        }),
      );
    }
  }

  private async ensureForeignKey(
    queryRunner: QueryRunner,
    tableName: string,
    foreignKey: TableForeignKey,
  ) {
    const table = await queryRunner.getTable(tableName);
    const exists = table?.foreignKeys.some(
      (item) =>
        item.name === foreignKey.name ||
        (item.columnNames.join(',') === foreignKey.columnNames.join(',') &&
          item.referencedTableName === foreignKey.referencedTableName &&
          item.referencedColumnNames.join(',') === foreignKey.referencedColumnNames.join(',')),
    );

    if (!exists) {
      await queryRunner.createForeignKey(tableName, foreignKey);
    }
  }

  private async ensureIndex(queryRunner: QueryRunner, tableName: string, index: TableIndex) {
    const table = await queryRunner.getTable(tableName);
    const exists = table?.indices.some((item) => item.name === index.name);

    if (!exists) {
      await queryRunner.createIndex(tableName, index);
    }
  }

  private async dropIndexIfExists(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
  ) {
    const table = await queryRunner.getTable(tableName);
    const index = table?.indices.find((item) => item.name === indexName);

    if (index) {
      await queryRunner.dropIndex(tableName, index);
    }
  }

  private async dropForeignKeyByNameOrColumn(
    queryRunner: QueryRunner,
    tableName: string,
    foreignKeyName: string,
    columnName: string,
  ) {
    const table = await queryRunner.getTable(tableName);
    const foreignKey = table?.foreignKeys.find(
      (item) => item.name === foreignKeyName || item.columnNames.includes(columnName),
    );

    if (foreignKey) {
      await queryRunner.dropForeignKey(tableName, foreignKey);
    }
  }
}
