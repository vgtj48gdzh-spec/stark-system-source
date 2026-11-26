import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddPerformanceSummaryManualDecisions1710800026000 implements MigrationInterface {
  name = 'AddPerformanceSummaryManualDecisions1710800026000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('performance_summary_manual_decisions'))) {
      await queryRunner.createTable(
        new Table({
          name: 'performance_summary_manual_decisions',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'source_summary_id',
              type: 'int',
            },
            {
              name: 'action_type',
              type: 'varchar',
              length: '50',
            },
            {
              name: 'source_system',
              type: 'varchar',
              length: '50',
              isNullable: true,
            },
            {
              name: 'source_table',
              type: 'varchar',
              length: '100',
              isNullable: true,
            },
            {
              name: 'source_id',
              type: 'varchar',
              length: '100',
              isNullable: true,
            },
            {
              name: 'original_matched_customer_id',
              type: 'varchar',
              length: '100',
              isNullable: true,
            },
            {
              name: 'final_matched_customer_id',
              type: 'varchar',
              length: '100',
              isNullable: true,
            },
            {
              name: 'original_classification',
              type: 'varchar',
              length: '64',
              isNullable: true,
            },
            {
              name: 'final_classification',
              type: 'varchar',
              length: '64',
              isNullable: true,
            },
            {
              name: 'original_binding_status',
              type: 'varchar',
              length: '32',
              isNullable: true,
            },
            {
              name: 'final_binding_status',
              type: 'varchar',
              length: '32',
              isNullable: true,
            },
            {
              name: 'operator_id',
              type: 'int',
            },
            {
              name: 'operator_name',
              type: 'varchar',
              length: '120',
              isNullable: true,
            },
            {
              name: 'operated_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
            },
            {
              name: 'reason_code',
              type: 'varchar',
              length: '100',
              isNullable: true,
            },
            {
              name: 'remark',
              type: 'varchar',
              length: '500',
            },
            {
              name: 'affect_performance_flag',
              type: 'boolean',
              default: false,
            },
            {
              name: 'affect_b_card_flag',
              type: 'boolean',
              default: false,
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
      'performance_summary_manual_decisions',
      new TableIndex({
        name: 'idx_perf_summary_manual_decision_summary',
        columnNames: ['source_summary_id', 'operated_at'],
      }),
    );
    await this.createIndexIfMissing(
      queryRunner,
      'performance_summary_manual_decisions',
      new TableIndex({
        name: 'idx_perf_summary_manual_decision_action',
        columnNames: ['action_type'],
      }),
    );
    await this.createIndexIfMissing(
      queryRunner,
      'performance_summary_manual_decisions',
      new TableIndex({
        name: 'idx_perf_summary_manual_decision_operator',
        columnNames: ['operator_id'],
      }),
    );

    await this.createForeignKeyIfMissing(
      queryRunner,
      'performance_summary_manual_decisions',
      new TableForeignKey({
        name: 'fk_perf_summary_manual_decision_operator',
        columnNames: ['operator_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('performance_summary_manual_decisions'))) {
      return;
    }

    await this.dropForeignKeyIfExists(
      queryRunner,
      'performance_summary_manual_decisions',
      'fk_perf_summary_manual_decision_operator',
    );
    await this.dropIndexIfExists(
      queryRunner,
      'performance_summary_manual_decisions',
      'idx_perf_summary_manual_decision_summary',
    );
    await this.dropIndexIfExists(
      queryRunner,
      'performance_summary_manual_decisions',
      'idx_perf_summary_manual_decision_action',
    );
    await this.dropIndexIfExists(
      queryRunner,
      'performance_summary_manual_decisions',
      'idx_perf_summary_manual_decision_operator',
    );
    await queryRunner.dropTable('performance_summary_manual_decisions');
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
