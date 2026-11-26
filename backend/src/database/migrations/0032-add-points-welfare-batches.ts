import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class AddPointsWelfareBatches1710800032000 implements MigrationInterface {
  name = 'AddPointsWelfareBatches1710800032000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('points_command_batches'))) {
      await queryRunner.createTable(
        new Table({
          name: 'points_command_batches',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'batch_type', type: 'varchar', length: '64' },
            { name: 'period_key', type: 'varchar', length: '20' },
            { name: 'company_id', type: 'int', isNullable: true },
            { name: 'target_employee_count', type: 'int', default: '0' },
            { name: 'target_total_amount', type: 'decimal', precision: 18, scale: 2, default: '0' },
            { name: 'batch_status', type: 'varchar', length: '32', default: "'drafted'" },
            { name: 'source_type', type: 'varchar', length: '64' },
            { name: 'requested_by', type: 'int', isNullable: true },
            { name: 'requested_by_name', type: 'varchar', length: '100', isNullable: true },
            { name: 'requested_at', type: 'datetime', isNullable: true },
            { name: 'confirmed_by', type: 'int', isNullable: true },
            { name: 'confirmed_by_name', type: 'varchar', length: '100', isNullable: true },
            { name: 'confirmed_at', type: 'datetime', isNullable: true },
            { name: 'executed_by', type: 'int', isNullable: true },
            { name: 'executed_by_name', type: 'varchar', length: '100', isNullable: true },
            { name: 'executed_at', type: 'datetime', isNullable: true },
            { name: 'cancelled_by', type: 'int', isNullable: true },
            { name: 'cancelled_by_name', type: 'varchar', length: '100', isNullable: true },
            { name: 'cancelled_at', type: 'datetime', isNullable: true },
            { name: 'provider_key', type: 'varchar', length: '100', isNullable: true },
            { name: 'source_action_id', type: 'varchar', length: '150', isNullable: true },
            { name: 'thread_key', type: 'varchar', length: '150', isNullable: true },
            { name: 'remark', type: 'varchar', length: '500', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
            { name: 'normalized_payload', type: 'json', isNullable: true },
          ],
        }),
      );
    }

    const pointsCommandTable = await queryRunner.getTable('points_command_requests');
    if (pointsCommandTable && !pointsCommandTable.findColumnByName('batch_id')) {
      await queryRunner.addColumn(
        'points_command_requests',
        new TableColumn({
          name: 'batch_id',
          type: 'int',
          isNullable: true,
        }),
      );
    }

    await this.createIndexIfMissing(
      queryRunner,
      'points_command_batches',
      new TableIndex({
        name: 'idx_points_batch_status_period',
        columnNames: ['batch_status', 'period_key'],
      }),
    );
    await this.createIndexIfMissing(
      queryRunner,
      'points_command_requests',
      new TableIndex({
        name: 'idx_points_command_batch_status',
        columnNames: ['batch_id', 'command_status'],
      }),
    );

    await this.createForeignKeyIfMissing(
      queryRunner,
      'points_command_batches',
      new TableForeignKey({
        name: 'fk_points_batch_requested_by',
        columnNames: ['requested_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await this.createForeignKeyIfMissing(
      queryRunner,
      'points_command_requests',
      new TableForeignKey({
        name: 'fk_points_command_batch_id',
        columnNames: ['batch_id'],
        referencedTableName: 'points_command_batches',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('points_command_requests')) {
      await this.dropForeignKeyIfExists(queryRunner, 'points_command_requests', 'fk_points_command_batch_id');
      await this.dropIndexIfExists(queryRunner, 'points_command_requests', 'idx_points_command_batch_status');
      const table = await queryRunner.getTable('points_command_requests');
      if (table?.findColumnByName('batch_id')) {
        await queryRunner.dropColumn('points_command_requests', 'batch_id');
      }
    }

    if (await queryRunner.hasTable('points_command_batches')) {
      await this.dropForeignKeyIfExists(queryRunner, 'points_command_batches', 'fk_points_batch_requested_by');
      await this.dropIndexIfExists(queryRunner, 'points_command_batches', 'idx_points_batch_status_period');
      await queryRunner.dropTable('points_command_batches');
    }
  }

  private async createIndexIfMissing(queryRunner: QueryRunner, tableName: string, index: TableIndex) {
    const table = await queryRunner.getTable(tableName);
    if (!table?.indices.some((item) => item.name === index.name)) {
      await queryRunner.createIndex(tableName, index);
    }
  }

  private async dropIndexIfExists(queryRunner: QueryRunner, tableName: string, indexName: string) {
    const table = await queryRunner.getTable(tableName);
    const index = table?.indices.find((item) => item.name === indexName);
    if (index) {
      await queryRunner.dropIndex(tableName, index);
    }
  }

  private async createForeignKeyIfMissing(
    queryRunner: QueryRunner,
    tableName: string,
    foreignKey: TableForeignKey,
  ) {
    const table = await queryRunner.getTable(tableName);
    if (!table?.foreignKeys.some((item) => item.name === foreignKey.name)) {
      await queryRunner.createForeignKey(tableName, foreignKey);
    }
  }

  private async dropForeignKeyIfExists(queryRunner: QueryRunner, tableName: string, foreignKeyName: string) {
    const table = await queryRunner.getTable(tableName);
    const foreignKey = table?.foreignKeys.find((item) => item.name === foreignKeyName);
    if (foreignKey) {
      await queryRunner.dropForeignKey(tableName, foreignKey);
    }
  }
}
