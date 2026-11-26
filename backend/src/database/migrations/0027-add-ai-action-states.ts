import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddAiActionStates1710800027000 implements MigrationInterface {
  name = 'AddAiActionStates1710800027000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('ai_action_states'))) {
      await queryRunner.createTable(
        new Table({
          name: 'ai_action_states',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'action_id',
              type: 'varchar',
              length: '191',
            },
            {
              name: 'source_key',
              type: 'varchar',
              length: '191',
              isNullable: true,
            },
            {
              name: 'task_type',
              type: 'varchar',
              length: '64',
            },
            {
              name: 'owner_role',
              type: 'varchar',
              length: '64',
            },
            {
              name: 'processing_status',
              type: 'varchar',
              length: '32',
            },
            {
              name: 'defer_until',
              type: 'datetime',
              isNullable: true,
            },
            {
              name: 'defer_reason',
              type: 'varchar',
              length: '200',
              isNullable: true,
            },
            {
              name: 'marked_by',
              type: 'int',
            },
            {
              name: 'marked_by_name',
              type: 'varchar',
              length: '120',
              isNullable: true,
            },
            {
              name: 'marked_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
            },
            {
              name: 'reopen_at',
              type: 'datetime',
              isNullable: true,
            },
            {
              name: 'status_remark',
              type: 'varchar',
              length: '500',
              isNullable: true,
            },
            {
              name: 'time_bucket',
              type: 'varchar',
              length: '32',
              isNullable: true,
            },
            {
              name: 'bucket_label',
              type: 'varchar',
              length: '60',
              isNullable: true,
            },
            {
              name: 'time_anchor_type',
              type: 'varchar',
              length: '64',
              isNullable: true,
            },
            {
              name: 'time_anchor_date',
              type: 'datetime',
              isNullable: true,
            },
            {
              name: 'normalized_payload',
              type: 'json',
              isNullable: true,
            },
          ],
        }),
      );
    }

    await this.createIndexIfMissing(
      queryRunner,
      'ai_action_states',
      new TableIndex({
        name: 'idx_ai_action_state_action',
        columnNames: ['action_id', 'marked_at'],
      }),
    );
    await this.createIndexIfMissing(
      queryRunner,
      'ai_action_states',
      new TableIndex({
        name: 'idx_ai_action_state_status',
        columnNames: ['processing_status', 'marked_at'],
      }),
    );
    await this.createIndexIfMissing(
      queryRunner,
      'ai_action_states',
      new TableIndex({
        name: 'idx_ai_action_state_role',
        columnNames: ['owner_role', 'task_type'],
      }),
    );
    await this.createForeignKeyIfMissing(
      queryRunner,
      'ai_action_states',
      new TableForeignKey({
        name: 'fk_ai_action_state_marked_by',
        columnNames: ['marked_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('ai_action_states'))) {
      return;
    }

    await this.dropForeignKeyIfExists(
      queryRunner,
      'ai_action_states',
      'fk_ai_action_state_marked_by',
    );
    await this.dropIndexIfExists(queryRunner, 'ai_action_states', 'idx_ai_action_state_action');
    await this.dropIndexIfExists(queryRunner, 'ai_action_states', 'idx_ai_action_state_status');
    await this.dropIndexIfExists(queryRunner, 'ai_action_states', 'idx_ai_action_state_role');
    await queryRunner.dropTable('ai_action_states');
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
