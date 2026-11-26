import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddPointsWelfareBatchItemsAndTermKnowledge1710800034000
  implements MigrationInterface
{
  name = 'AddPointsWelfareBatchItemsAndTermKnowledge1710800034000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('points_welfare_batch_items'))) {
      await queryRunner.createTable(
        new Table({
          name: 'points_welfare_batch_items',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'batch_id', type: 'int' },
            { name: 'employee_id', type: 'int', isNullable: true },
            { name: 'command_id', type: 'int', isNullable: true },
            { name: 'employee_name_snapshot', type: 'varchar', length: '100' },
            { name: 'employee_mobile_snapshot', type: 'varchar', length: '32', isNullable: true },
            { name: 'company_name_snapshot', type: 'varchar', length: '150', isNullable: true },
            { name: 'position_name_snapshot', type: 'varchar', length: '150', isNullable: true },
            { name: 'allocation_mode', type: 'varchar', length: '32' },
            { name: 'default_amount', type: 'decimal', precision: 18, scale: 2, default: '0' },
            { name: 'final_amount', type: 'decimal', precision: 18, scale: 2, default: '0' },
            { name: 'exclusion_reason', type: 'varchar', length: '64', isNullable: true },
            { name: 'adjustment_reason_code', type: 'varchar', length: '100', isNullable: true },
            { name: 'adjustment_remark', type: 'varchar', length: '500', isNullable: true },
            { name: 'basis_type', type: 'varchar', length: '32', isNullable: true },
            { name: 'decision_scope', type: 'varchar', length: '32', isNullable: true },
            { name: 'ai_learning_mode', type: 'varchar', length: '64', isNullable: true },
            { name: 'decided_by', type: 'int', isNullable: true },
            { name: 'decided_at', type: 'datetime', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
            { name: 'normalized_payload', type: 'json', isNullable: true },
          ],
        }),
      );
    }

    await this.createIndexIfMissing(
      queryRunner,
      'points_welfare_batch_items',
      new TableIndex({
        name: 'idx_points_welfare_batch_item_batch_mode',
        columnNames: ['batch_id', 'allocation_mode'],
      }),
    );

    await this.createIndexIfMissing(
      queryRunner,
      'points_welfare_batch_items',
      new TableIndex({
        name: 'idx_points_welfare_batch_item_employee',
        columnNames: ['employee_id'],
      }),
    );

    await this.createForeignKeyIfMissing(
      queryRunner,
      'points_welfare_batch_items',
      new TableForeignKey({
        name: 'fk_points_welfare_batch_item_batch_id',
        columnNames: ['batch_id'],
        referencedTableName: 'points_command_batches',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await this.createForeignKeyIfMissing(
      queryRunner,
      'points_welfare_batch_items',
      new TableForeignKey({
        name: 'fk_points_welfare_batch_item_command_id',
        columnNames: ['command_id'],
        referencedTableName: 'points_command_requests',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    if (await queryRunner.hasTable('ai_knowledge_entries')) {
      await queryRunner.query(`
        INSERT INTO \`ai_knowledge_entries\` (
          \`knowledge_type\`,
          \`scope_type\`,
          \`scope_key\`,
          \`title\`,
          \`summary\`,
          \`content\`,
          \`tags\`,
          \`role_scope\`,
          \`scene_scope\`,
          \`enabled_flag\`,
          \`source_type\`,
          \`ai_learning_mode\`,
          \`created_by\`,
          \`normalized_payload\`
        )
        SELECT
          'term_definition',
          'global',
          'points_user_term',
          '积点术语统一',
          '系统内部结构仍叫 points，但用户口径统一叫“积点”。',
          '面向用户的页面、AI 助手、批次说明、命令说明、审批文案统一使用“积点”。AI 不应混用“积分/积点”；数据库、表名、接口技术字段保留 points 命名即可。',
          JSON_ARRAY('points', 'term_definition', '积点'),
          JSON_ARRAY('founder', 'finance', 'admin', 'approver', 'operator', 'customer_service', 'store_manager'),
          JSON_ARRAY('global', 'performance_confirmation', 'data_cleanup'),
          1,
          'seed_round_3j1',
          'treat_as_global_reference',
          NULL,
          JSON_OBJECT('priority', 99, 'version', 's1-05-round-3j1')
        WHERE NOT EXISTS (
          SELECT 1
          FROM \`ai_knowledge_entries\`
          WHERE \`scope_type\` = 'global'
            AND \`scope_key\` = 'points_user_term'
        )
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('ai_knowledge_entries')) {
      await queryRunner.query(`
        DELETE FROM \`ai_knowledge_entries\`
        WHERE \`scope_type\` = 'global'
          AND \`scope_key\` = 'points_user_term'
      `);
    }

    if (await queryRunner.hasTable('points_welfare_batch_items')) {
      await this.dropForeignKeyIfExists(
        queryRunner,
        'points_welfare_batch_items',
        'fk_points_welfare_batch_item_command_id',
      );
      await this.dropForeignKeyIfExists(
        queryRunner,
        'points_welfare_batch_items',
        'fk_points_welfare_batch_item_batch_id',
      );
      await this.dropIndexIfExists(
        queryRunner,
        'points_welfare_batch_items',
        'idx_points_welfare_batch_item_batch_mode',
      );
      await this.dropIndexIfExists(
        queryRunner,
        'points_welfare_batch_items',
        'idx_points_welfare_batch_item_employee',
      );
      await queryRunner.dropTable('points_welfare_batch_items');
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
