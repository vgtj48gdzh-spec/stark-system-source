import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddAiAssistantInteractions1710800028000 implements MigrationInterface {
  name = 'AddAiAssistantInteractions1710800028000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('ai_assistant_interactions'))) {
      await queryRunner.createTable(
        new Table({
          name: 'ai_assistant_interactions',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'thread_key',
              type: 'varchar',
              length: '191',
            },
            {
              name: 'route_path',
              type: 'varchar',
              length: '191',
            },
            {
              name: 'entity_type',
              type: 'varchar',
              length: '64',
              isNullable: true,
            },
            {
              name: 'entity_id',
              type: 'varchar',
              length: '100',
              isNullable: true,
            },
            {
              name: 'role_code',
              type: 'varchar',
              length: '64',
              isNullable: true,
            },
            {
              name: 'scene_code',
              type: 'varchar',
              length: '64',
              isNullable: true,
            },
            {
              name: 'source_action_id',
              type: 'varchar',
              length: '191',
              isNullable: true,
            },
            {
              name: 'user_message',
              type: 'text',
            },
            {
              name: 'assistant_reply',
              type: 'text',
            },
            {
              name: 'suggested_actions',
              type: 'json',
              isNullable: true,
            },
            {
              name: 'suggested_command_draft',
              type: 'json',
              isNullable: true,
            },
            {
              name: 'provider_key',
              type: 'varchar',
              length: '100',
              isNullable: true,
            },
            {
              name: 'created_by',
              type: 'int',
              isNullable: true,
            },
            {
              name: 'created_by_name',
              type: 'varchar',
              length: '120',
              isNullable: true,
            },
            {
              name: 'created_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
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
      'ai_assistant_interactions',
      new TableIndex({
        name: 'idx_ai_assistant_thread',
        columnNames: ['thread_key', 'created_at'],
      }),
    );
    await this.createIndexIfMissing(
      queryRunner,
      'ai_assistant_interactions',
      new TableIndex({
        name: 'idx_ai_assistant_route',
        columnNames: ['route_path', 'created_at'],
      }),
    );
    await this.createIndexIfMissing(
      queryRunner,
      'ai_assistant_interactions',
      new TableIndex({
        name: 'idx_ai_assistant_source_action',
        columnNames: ['source_action_id', 'created_at'],
      }),
    );
    await this.createForeignKeyIfMissing(
      queryRunner,
      'ai_assistant_interactions',
      new TableForeignKey({
        name: 'fk_ai_assistant_created_by',
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('ai_assistant_interactions'))) {
      return;
    }

    await this.dropForeignKeyIfExists(
      queryRunner,
      'ai_assistant_interactions',
      'fk_ai_assistant_created_by',
    );
    await this.dropIndexIfExists(
      queryRunner,
      'ai_assistant_interactions',
      'idx_ai_assistant_thread',
    );
    await this.dropIndexIfExists(
      queryRunner,
      'ai_assistant_interactions',
      'idx_ai_assistant_route',
    );
    await this.dropIndexIfExists(
      queryRunner,
      'ai_assistant_interactions',
      'idx_ai_assistant_source_action',
    );
    await queryRunner.dropTable('ai_assistant_interactions');
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
