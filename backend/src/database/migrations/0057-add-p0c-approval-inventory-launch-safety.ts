import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

const APPROVAL_TABLE = 'approval_requests';
const INVENTORY_TABLE = 'inventory_transactions';
const WORK_ORDER_MATERIAL_TABLE = 'work_order_materials';

export class AddP0cApprovalInventoryLaunchSafety00571785500000000
  implements MigrationInterface
{
  name = 'AddP0cApprovalInventoryLaunchSafety00571785500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.expandWorkOrderMaterialIdempotency(queryRunner);
    await this.expandApprovalContract(queryRunner);
    await this.expandInventoryContract(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.assertRollbackSafe(queryRunner);
    await this.dropInventoryContract(queryRunner);
    await this.dropApprovalContract(queryRunner);
    await this.dropWorkOrderMaterialIdempotency(queryRunner);
  }

  private async expandWorkOrderMaterialIdempotency(queryRunner: QueryRunner) {
    await this.addColumnIfMissing(
      queryRunner,
      WORK_ORDER_MATERIAL_TABLE,
      new TableColumn({
        name: 'request_idempotency_key',
        type: 'varchar',
        length: '96',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      WORK_ORDER_MATERIAL_TABLE,
      new TableColumn({
        name: 'request_fingerprint',
        type: 'char',
        length: '64',
        isNullable: true,
      }),
    );
    await this.createIndexIfMissing(
      queryRunner,
      WORK_ORDER_MATERIAL_TABLE,
      new TableIndex({
        name: 'uq_work_order_materials_request_idempotency_key',
        columnNames: ['request_idempotency_key'],
        isUnique: true,
      }),
    );
  }

  private async expandApprovalContract(queryRunner: QueryRunner) {
    const approvalTable = await queryRunner.getTable(APPROVAL_TABLE);
    const approvalType = approvalTable?.findColumnByName('approval_type');
    if (approvalType) {
      await queryRunner.changeColumn(
        APPROVAL_TABLE,
        approvalType,
        new TableColumn({
          name: 'approval_type',
          type: 'enum',
          enum: ['payout', 'inventory_adjustment'],
          default: "'payout'",
        }),
      );
    }

    const refreshed = await queryRunner.getTable(APPROVAL_TABLE);
    const workOrderForeignKey = refreshed?.foreignKeys.find((item) =>
      item.columnNames.includes('related_work_order_id'),
    );
    if (workOrderForeignKey) {
      await queryRunner.dropForeignKey(APPROVAL_TABLE, workOrderForeignKey);
    }
    const workOrderColumn = refreshed?.findColumnByName('related_work_order_id');
    if (workOrderColumn && !workOrderColumn.isNullable) {
      await queryRunner.changeColumn(
        APPROVAL_TABLE,
        workOrderColumn,
        new TableColumn({ name: 'related_work_order_id', type: 'int', isNullable: true }),
      );
    }
    await this.createForeignKeyIfMissing(
      queryRunner,
      APPROVAL_TABLE,
      new TableForeignKey({
        name: 'fk_approval_requests_related_work_order',
        columnNames: ['related_work_order_id'],
        referencedTableName: 'work_orders',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    for (const column of [
      new TableColumn({
        name: 'related_inventory_transaction_id',
        type: 'int',
        isNullable: true,
      }),
      new TableColumn({
        name: 'request_idempotency_key',
        type: 'varchar',
        length: '96',
        isNullable: true,
      }),
      new TableColumn({
        name: 'request_fingerprint',
        type: 'char',
        length: '64',
        isNullable: true,
      }),
      new TableColumn({
        name: 'inventory_adjustment_action',
        type: 'enum',
        enum: ['reverse', 'adjust'],
        isNullable: true,
      }),
      new TableColumn({
        name: 'inventory_target_quantity',
        type: 'decimal',
        precision: 12,
        scale: 2,
        isNullable: true,
      }),
      new TableColumn({
        name: 'inventory_target_unit_price',
        type: 'decimal',
        precision: 12,
        scale: 2,
        isNullable: true,
      }),
      new TableColumn({
        name: 'execution_idempotency_key',
        type: 'varchar',
        length: '96',
        isNullable: true,
      }),
      new TableColumn({
        name: 'execution_fingerprint',
        type: 'char',
        length: '64',
        isNullable: true,
      }),
    ]) {
      await this.addColumnIfMissing(queryRunner, APPROVAL_TABLE, column);
    }

    await this.createIndexIfMissing(
      queryRunner,
      APPROVAL_TABLE,
      new TableIndex({
        name: 'uq_approval_requests_request_idempotency_key',
        columnNames: ['request_idempotency_key'],
        isUnique: true,
      }),
    );
    await this.createIndexIfMissing(
      queryRunner,
      APPROVAL_TABLE,
      new TableIndex({
        name: 'uq_approval_requests_execution_idempotency_key',
        columnNames: ['execution_idempotency_key'],
        isUnique: true,
      }),
    );
    await this.createForeignKeyIfMissing(
      queryRunner,
      APPROVAL_TABLE,
      new TableForeignKey({
        name: 'fk_approval_requests_inventory_transaction',
        columnNames: ['related_inventory_transaction_id'],
        referencedTableName: INVENTORY_TABLE,
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }

  private async expandInventoryContract(queryRunner: QueryRunner) {
    for (const column of [
      new TableColumn({
        name: 'entry_kind',
        type: 'enum',
        enum: ['original', 'reversal', 'adjustment'],
        default: "'original'",
      }),
      new TableColumn({
        name: 'request_idempotency_key',
        type: 'varchar',
        length: '96',
        isNullable: true,
      }),
      new TableColumn({
        name: 'request_fingerprint',
        type: 'char',
        length: '64',
        isNullable: true,
      }),
      new TableColumn({ name: 'source_transaction_id', type: 'int', isNullable: true }),
      new TableColumn({ name: 'approval_request_id', type: 'int', isNullable: true }),
      new TableColumn({
        name: 'adjustment_reason',
        type: 'varchar',
        length: '500',
        isNullable: true,
      }),
    ]) {
      await this.addColumnIfMissing(queryRunner, INVENTORY_TABLE, column);
    }

    await this.createIndexIfMissing(
      queryRunner,
      INVENTORY_TABLE,
      new TableIndex({
        name: 'uq_inventory_transactions_request_idempotency_key',
        columnNames: ['request_idempotency_key'],
        isUnique: true,
      }),
    );
    await this.createIndexIfMissing(
      queryRunner,
      INVENTORY_TABLE,
      new TableIndex({
        name: 'uq_inventory_transactions_source_entry_kind',
        columnNames: ['source_transaction_id', 'entry_kind'],
        isUnique: true,
      }),
    );
    await this.createForeignKeyIfMissing(
      queryRunner,
      INVENTORY_TABLE,
      new TableForeignKey({
        name: 'fk_inventory_transactions_source_transaction',
        columnNames: ['source_transaction_id'],
        referencedTableName: INVENTORY_TABLE,
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
    await this.createForeignKeyIfMissing(
      queryRunner,
      INVENTORY_TABLE,
      new TableForeignKey({
        name: 'fk_inventory_transactions_approval_request',
        columnNames: ['approval_request_id'],
        referencedTableName: APPROVAL_TABLE,
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }

  private async assertRollbackSafe(queryRunner: QueryRunner) {
    if (await queryRunner.hasColumn(WORK_ORDER_MATERIAL_TABLE, 'request_idempotency_key')) {
      const rows = (await queryRunner.query(`
        SELECT COUNT(*) AS row_count
        FROM work_order_materials
        WHERE request_idempotency_key IS NOT NULL
           OR request_fingerprint IS NOT NULL
      `)) as Array<{ row_count: string | number }>;
      if (Number(rows[0]?.row_count ?? 0) > 0) {
        throw new Error(
          'Cannot roll back P0C work-order material schema while idempotency evidence exists.',
        );
      }
    }

    if (await queryRunner.hasColumn(APPROVAL_TABLE, 'related_inventory_transaction_id')) {
      const rows = (await queryRunner.query(`
        SELECT COUNT(*) AS row_count
        FROM approval_requests
        WHERE approval_type = 'inventory_adjustment'
           OR related_inventory_transaction_id IS NOT NULL
           OR related_work_order_id IS NULL
           OR request_idempotency_key IS NOT NULL
           OR execution_idempotency_key IS NOT NULL
      `)) as Array<{ row_count: string | number }>;
      if (Number(rows[0]?.row_count ?? 0) > 0) {
        throw new Error(
          'Cannot roll back P0C approval schema while inventory adjustment evidence exists.',
        );
      }
    }

    if (await queryRunner.hasColumn(INVENTORY_TABLE, 'entry_kind')) {
      const rows = (await queryRunner.query(`
        SELECT COUNT(*) AS row_count
        FROM inventory_transactions
        WHERE entry_kind <> 'original'
           OR request_idempotency_key IS NOT NULL
           OR source_transaction_id IS NOT NULL
           OR approval_request_id IS NOT NULL
      `)) as Array<{ row_count: string | number }>;
      if (Number(rows[0]?.row_count ?? 0) > 0) {
        throw new Error(
          'Cannot roll back P0C inventory schema while idempotency or correction evidence exists.',
        );
      }
    }
  }

  private async dropWorkOrderMaterialIdempotency(queryRunner: QueryRunner) {
    await this.dropIndexIfPresent(
      queryRunner,
      WORK_ORDER_MATERIAL_TABLE,
      'uq_work_order_materials_request_idempotency_key',
    );
    await this.dropColumnIfPresent(
      queryRunner,
      WORK_ORDER_MATERIAL_TABLE,
      'request_fingerprint',
    );
    await this.dropColumnIfPresent(
      queryRunner,
      WORK_ORDER_MATERIAL_TABLE,
      'request_idempotency_key',
    );
  }

  private async dropInventoryContract(queryRunner: QueryRunner) {
    await this.dropForeignKeyIfPresent(
      queryRunner,
      INVENTORY_TABLE,
      'fk_inventory_transactions_approval_request',
    );
    await this.dropForeignKeyIfPresent(
      queryRunner,
      INVENTORY_TABLE,
      'fk_inventory_transactions_source_transaction',
    );
    await this.dropIndexIfPresent(
      queryRunner,
      INVENTORY_TABLE,
      'uq_inventory_transactions_source_entry_kind',
    );
    await this.dropIndexIfPresent(
      queryRunner,
      INVENTORY_TABLE,
      'uq_inventory_transactions_request_idempotency_key',
    );
    for (const column of [
      'adjustment_reason',
      'approval_request_id',
      'source_transaction_id',
      'request_fingerprint',
      'request_idempotency_key',
      'entry_kind',
    ]) {
      await this.dropColumnIfPresent(queryRunner, INVENTORY_TABLE, column);
    }
  }

  private async dropApprovalContract(queryRunner: QueryRunner) {
    await this.dropForeignKeyIfPresent(
      queryRunner,
      APPROVAL_TABLE,
      'fk_approval_requests_inventory_transaction',
    );
    await this.dropIndexIfPresent(
      queryRunner,
      APPROVAL_TABLE,
      'uq_approval_requests_execution_idempotency_key',
    );
    await this.dropIndexIfPresent(
      queryRunner,
      APPROVAL_TABLE,
      'uq_approval_requests_request_idempotency_key',
    );
    for (const column of [
      'execution_fingerprint',
      'execution_idempotency_key',
      'inventory_target_unit_price',
      'inventory_target_quantity',
      'inventory_adjustment_action',
      'request_fingerprint',
      'request_idempotency_key',
      'related_inventory_transaction_id',
    ]) {
      await this.dropColumnIfPresent(queryRunner, APPROVAL_TABLE, column);
    }

    const workOrderTable = await queryRunner.getTable(APPROVAL_TABLE);
    const workOrderForeignKey = workOrderTable?.foreignKeys.find((item) =>
      item.columnNames.includes('related_work_order_id'),
    );
    if (workOrderForeignKey) {
      await queryRunner.dropForeignKey(APPROVAL_TABLE, workOrderForeignKey);
    }
    const workOrderColumn = workOrderTable?.findColumnByName('related_work_order_id');
    if (workOrderColumn?.isNullable) {
      await queryRunner.changeColumn(
        APPROVAL_TABLE,
        workOrderColumn,
        new TableColumn({ name: 'related_work_order_id', type: 'int', isNullable: false }),
      );
    }
    await this.createForeignKeyIfMissing(
      queryRunner,
      APPROVAL_TABLE,
      new TableForeignKey({
        name: 'fk_approval_requests_related_work_order',
        columnNames: ['related_work_order_id'],
        referencedTableName: 'work_orders',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    const table = await queryRunner.getTable(APPROVAL_TABLE);
    const approvalType = table?.findColumnByName('approval_type');
    if (approvalType) {
      await queryRunner.changeColumn(
        APPROVAL_TABLE,
        approvalType,
        new TableColumn({
          name: 'approval_type',
          type: 'enum',
          enum: ['payout'],
          default: "'payout'",
        }),
      );
    }
  }

  private async addColumnIfMissing(
    queryRunner: QueryRunner,
    tableName: string,
    column: TableColumn,
  ) {
    if (!(await queryRunner.hasColumn(tableName, column.name))) {
      await queryRunner.addColumn(tableName, column);
    }
  }

  private async dropColumnIfPresent(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
  ) {
    if (await queryRunner.hasColumn(tableName, columnName)) {
      await queryRunner.dropColumn(tableName, columnName);
    }
  }

  private async createIndexIfMissing(
    queryRunner: QueryRunner,
    tableName: string,
    index: TableIndex,
  ) {
    const table = await queryRunner.getTable(tableName);
    if (!table?.indices.some((item) => item.name === index.name)) {
      await queryRunner.createIndex(tableName, index);
    }
  }

  private async dropIndexIfPresent(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
  ) {
    const table = await queryRunner.getTable(tableName);
    if (table?.indices.some((item) => item.name === indexName)) {
      await queryRunner.dropIndex(tableName, indexName);
    }
  }

  private async createForeignKeyIfMissing(
    queryRunner: QueryRunner,
    tableName: string,
    foreignKey: TableForeignKey,
  ) {
    const table = await queryRunner.getTable(tableName);
    if (
      !table?.foreignKeys.some(
        (item) =>
          item.name === foreignKey.name ||
          item.columnNames.join(',') === foreignKey.columnNames.join(','),
      )
    ) {
      await queryRunner.createForeignKey(tableName, foreignKey);
    }
  }

  private async dropForeignKeyIfPresent(
    queryRunner: QueryRunner,
    tableName: string,
    foreignKeyName: string,
  ) {
    const table = await queryRunner.getTable(tableName);
    const foreignKey = table?.foreignKeys.find((item) => item.name === foreignKeyName);
    if (foreignKey) {
      await queryRunner.dropForeignKey(tableName, foreignKey);
    }
  }
}
