import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddPointsCommandPilot1710800030000 implements MigrationInterface {
  name = 'AddPointsCommandPilot1710800030000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('points_command_requests'))) {
      await queryRunner.createTable(
        new Table({
          name: 'points_command_requests',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'command_type', type: 'varchar', length: '32' },
            { name: 'command_status', type: 'varchar', length: '32', default: "'drafted'" },
            { name: 'owner_type', type: 'varchar', length: '32' },
            { name: 'owner_id', type: 'int', isNullable: true },
            { name: 'owner_mobile', type: 'varchar', length: '32', isNullable: true },
            { name: 'merchant_id', type: 'int', isNullable: true },
            { name: 'change_amount', type: 'decimal', precision: 18, scale: 2 },
            { name: 'source_type', type: 'varchar', length: '64' },
            { name: 'request_source', type: 'varchar', length: '32', default: "'manual'" },
            { name: 'reason_code', type: 'varchar', length: '100', isNullable: true },
            { name: 'remark', type: 'varchar', length: '500', isNullable: true },
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
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
            { name: 'normalized_payload', type: 'json', isNullable: true },
          ],
        }),
      );
    }

    if (!(await queryRunner.hasTable('points_ledger_entries'))) {
      await queryRunner.createTable(
        new Table({
          name: 'points_ledger_entries',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'owner_type', type: 'varchar', length: '32' },
            { name: 'owner_id', type: 'int', isNullable: true },
            { name: 'owner_mobile', type: 'varchar', length: '32', isNullable: true },
            { name: 'merchant_id', type: 'int', isNullable: true },
            { name: 'change_type', type: 'varchar', length: '32' },
            { name: 'change_amount', type: 'decimal', precision: 18, scale: 2 },
            { name: 'balance_after', type: 'decimal', precision: 18, scale: 2, isNullable: true },
            { name: 'source_type', type: 'varchar', length: '64' },
            { name: 'source_id', type: 'varchar', length: '100', isNullable: true },
            { name: 'source_no', type: 'varchar', length: '100', isNullable: true },
            { name: 'request_source', type: 'varchar', length: '32', isNullable: true },
            { name: 'reason_code', type: 'varchar', length: '100', isNullable: true },
            { name: 'remark', type: 'varchar', length: '500', isNullable: true },
            { name: 'executed_by', type: 'int', isNullable: true },
            { name: 'executed_by_name', type: 'varchar', length: '100', isNullable: true },
            { name: 'executed_at', type: 'datetime', isNullable: true },
            { name: 'approved_by', type: 'int', isNullable: true },
            { name: 'approved_by_name', type: 'varchar', length: '100', isNullable: true },
            { name: 'approved_at', type: 'datetime', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            { name: 'normalized_payload', type: 'json', isNullable: true },
          ],
        }),
      );
    }

    await this.createIndexIfMissing(
      queryRunner,
      'points_command_requests',
      new TableIndex({
        name: 'idx_points_command_status_owner',
        columnNames: ['command_status', 'owner_type', 'owner_mobile'],
      }),
    );
    await this.createIndexIfMissing(
      queryRunner,
      'points_ledger_entries',
      new TableIndex({
        name: 'idx_points_ledger_owner_lookup',
        columnNames: ['owner_type', 'owner_id', 'owner_mobile'],
      }),
    );
    await this.createForeignKeyIfMissing(
      queryRunner,
      'points_command_requests',
      new TableForeignKey({
        name: 'fk_points_command_requested_by',
        columnNames: ['requested_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
    await this.createForeignKeyIfMissing(
      queryRunner,
      'points_ledger_entries',
      new TableForeignKey({
        name: 'fk_points_ledger_executed_by',
        columnNames: ['executed_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('points_ledger_entries')) {
      await this.dropForeignKeyIfExists(queryRunner, 'points_ledger_entries', 'fk_points_ledger_executed_by');
      await this.dropIndexIfExists(queryRunner, 'points_ledger_entries', 'idx_points_ledger_owner_lookup');
      await queryRunner.dropTable('points_ledger_entries');
    }
    if (await queryRunner.hasTable('points_command_requests')) {
      await this.dropForeignKeyIfExists(queryRunner, 'points_command_requests', 'fk_points_command_requested_by');
      await this.dropIndexIfExists(queryRunner, 'points_command_requests', 'idx_points_command_status_owner');
      await queryRunner.dropTable('points_command_requests');
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

  private async dropForeignKeyIfExists(
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
