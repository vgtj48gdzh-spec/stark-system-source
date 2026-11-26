import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddAbcReadonlyIntegrationFoundation1710800007000 implements MigrationInterface {
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createSourceSystemsTable(queryRunner);
    await this.createSyncJobsTable(queryRunner);
    await this.createSyncJobRunsTable(queryRunner);
    await this.createSyncCheckpointsTable(queryRunner);
    await this.createRawTable(queryRunner, 'abc_raw_orders', 'uniq_abc_raw_orders_source_key');
    await this.createRawTable(
      queryRunner,
      'abc_raw_transactions',
      'uniq_abc_raw_transactions_source_key',
    );
    await this.createRawTable(queryRunner, 'abc_raw_cards', 'uniq_abc_raw_cards_source_key');
    await this.createRawTable(
      queryRunner,
      'abc_raw_inventory',
      'uniq_abc_raw_inventory_source_key',
    );
    await this.seedAbcSourceSystem(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropTableIfExists(queryRunner, 'abc_raw_inventory');
    await this.dropTableIfExists(queryRunner, 'abc_raw_cards');
    await this.dropTableIfExists(queryRunner, 'abc_raw_transactions');
    await this.dropTableIfExists(queryRunner, 'abc_raw_orders');
    await this.dropTableIfExists(queryRunner, 'sync_checkpoints');
    await this.dropTableIfExists(queryRunner, 'sync_job_runs');
    await this.dropTableIfExists(queryRunner, 'sync_jobs');
    await this.dropTableIfExists(queryRunner, 'source_systems');
  }

  private async createSourceSystemsTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('source_systems')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'source_systems',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'source_system_code',
            type: 'varchar',
            length: '50',
            isUnique: true,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '30',
            default: "'active'",
          },
          {
            name: 'sync_scope',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'last_synced_at',
            type: 'datetime',
            isNullable: true,
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
  }

  private async createSyncJobsTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('sync_jobs')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'sync_jobs',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'source_system_id',
            type: 'int',
          },
          {
            name: 'source_system_code',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'job_code',
            type: 'varchar',
            length: '100',
            isUnique: true,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '150',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '30',
            default: "'active'",
          },
          {
            name: 'sync_scope',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'source_table',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'target_raw_table',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'import_mode',
            type: 'varchar',
            length: '30',
            default: "'offline'",
          },
          {
            name: 'checkpoint_key',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'last_synced_at',
            type: 'datetime',
            isNullable: true,
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
        foreignKeys: [
          new TableForeignKey({
            name: 'fk_sync_jobs_source_system_id',
            columnNames: ['source_system_id'],
            referencedTableName: 'source_systems',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          }),
        ],
      }),
    );

    await queryRunner.createIndex(
      'sync_jobs',
      new TableIndex({
        name: 'idx_sync_jobs_source_table',
        columnNames: ['source_table'],
      }),
    );
  }

  private async createSyncJobRunsTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('sync_job_runs')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'sync_job_runs',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'sync_job_id',
            type: 'int',
          },
          {
            name: 'batch_no',
            type: 'varchar',
            length: '64',
          },
          {
            name: 'run_status',
            type: 'varchar',
            length: '30',
            default: "'running'",
          },
          {
            name: 'started_at',
            type: 'datetime',
          },
          {
            name: 'finished_at',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'input_format',
            type: 'varchar',
            length: '30',
            isNullable: true,
          },
          {
            name: 'input_path',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'total_records',
            type: 'int',
            default: '0',
          },
          {
            name: 'imported_records',
            type: 'int',
            default: '0',
          },
          {
            name: 'skipped_records',
            type: 'int',
            default: '0',
          },
          {
            name: 'failed_records',
            type: 'int',
            default: '0',
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'result_payload',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'created_by',
            type: 'int',
            isNullable: true,
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
        foreignKeys: [
          new TableForeignKey({
            name: 'fk_sync_job_runs_sync_job_id',
            columnNames: ['sync_job_id'],
            referencedTableName: 'sync_jobs',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
          new TableForeignKey({
            name: 'fk_sync_job_runs_created_by',
            columnNames: ['created_by'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          }),
        ],
      }),
    );

    await queryRunner.createIndex(
      'sync_job_runs',
      new TableIndex({
        name: 'idx_sync_job_runs_batch_no',
        columnNames: ['batch_no'],
      }),
    );
  }

  private async createSyncCheckpointsTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('sync_checkpoints')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'sync_checkpoints',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'sync_job_id',
            type: 'int',
          },
          {
            name: 'checkpoint_key',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'checkpoint_value',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'last_synced_at',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'batch_no',
            type: 'varchar',
            length: '64',
            isNullable: true,
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
        foreignKeys: [
          new TableForeignKey({
            name: 'fk_sync_checkpoints_sync_job_id',
            columnNames: ['sync_job_id'],
            referencedTableName: 'sync_jobs',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
      }),
    );

    await queryRunner.createIndex(
      'sync_checkpoints',
      new TableIndex({
        name: 'uniq_sync_checkpoints_job_key',
        columnNames: ['sync_job_id', 'checkpoint_key'],
        isUnique: true,
      }),
    );
  }

  private async createRawTable(
    queryRunner: QueryRunner,
    tableName: string,
    uniqueIndexName: string,
  ) {
    if (await queryRunner.hasTable(tableName)) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: tableName,
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
            name: 'synced_at',
            type: 'datetime',
          },
          {
            name: 'sync_batch_no',
            type: 'varchar',
            length: '64',
          },
          {
            name: 'raw_payload',
            type: 'json',
          },
          {
            name: 'normalized_flag',
            type: 'tinyint',
            width: 1,
            default: '0',
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
      tableName,
      new TableIndex({
        name: uniqueIndexName,
        columnNames: ['source_system', 'source_table', 'source_id'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      tableName,
      new TableIndex({
        name: `idx_${tableName}_batch_no`,
        columnNames: ['sync_batch_no'],
      }),
    );
    await queryRunner.createIndex(
      tableName,
      new TableIndex({
        name: `idx_${tableName}_normalized_flag`,
        columnNames: ['normalized_flag'],
      }),
    );
  }

  private async seedAbcSourceSystem(queryRunner: QueryRunner) {
    const existing = await queryRunner.query(
      "SELECT id FROM source_systems WHERE source_system_code = 'ABC' LIMIT 1",
    );

    if (existing.length > 0) {
      return;
    }

    await queryRunner.query(
      `INSERT INTO source_systems (source_system_code, name, status, sync_scope)
       VALUES ('ABC', 'ABC Source System', 'active', JSON_ARRAY('readonly', 'offline', 'raw'))`,
    );
  }

  private async dropTableIfExists(queryRunner: QueryRunner, tableName: string) {
    if (await queryRunner.hasTable(tableName)) {
      await queryRunner.dropTable(tableName, true, true, true);
    }
  }
}
