import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddCustomerIdentificationBindingFoundation1710800023000
  implements MigrationInterface
{
  name = 'AddCustomerIdentificationBindingFoundation1710800023000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('employees')) {
      await this.addColumnIfMissing(
        queryRunner,
        'employees',
        new TableColumn({
          name: 'name_remark',
          type: 'varchar',
          length: '120',
          isNullable: true,
        }),
      );
    }

    if (!(await queryRunner.hasTable('customer_identification_bindings'))) {
      await queryRunner.createTable(
        new Table({
          name: 'customer_identification_bindings',
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
              name: 'source_customer_name',
              type: 'varchar',
              length: '120',
              isNullable: true,
            },
            {
              name: 'source_customer_mobile',
              type: 'varchar',
              length: '20',
              isNullable: true,
            },
            {
              name: 'source_car_plate',
              type: 'varchar',
              length: '30',
              isNullable: true,
            },
            {
              name: 'matched_customer_id',
              type: 'varchar',
              length: '100',
              isNullable: true,
            },
            {
              name: 'matched_customer_name',
              type: 'varchar',
              length: '120',
              isNullable: true,
            },
            {
              name: 'matched_customer_mobile',
              type: 'varchar',
              length: '20',
              isNullable: true,
            },
            {
              name: 'binding_status',
              type: 'varchar',
              length: '32',
              default: "'manual_pending'",
            },
            {
              name: 'binding_confidence',
              type: 'decimal',
              precision: 5,
              scale: 4,
              isNullable: true,
            },
            {
              name: 'bound_by',
              type: 'int',
              isNullable: true,
            },
            {
              name: 'bound_at',
              type: 'datetime',
              isNullable: true,
            },
            {
              name: 'binding_remark',
              type: 'varchar',
              length: '500',
              isNullable: true,
            },
            {
              name: 'performance_ready_flag',
              type: 'boolean',
              default: false,
            },
            {
              name: 'performance_block_reason',
              type: 'varchar',
              length: '100',
              isNullable: true,
            },
            {
              name: 'performance_decision_reason',
              type: 'varchar',
              length: '500',
              isNullable: true,
            },
            {
              name: 'task_execution_count',
              type: 'int',
              isNullable: true,
            },
            {
              name: 'task_on_time_count',
              type: 'int',
              isNullable: true,
            },
            {
              name: 'task_confirmed_count',
              type: 'int',
              isNullable: true,
            },
            {
              name: 'task_reward_eligible_flag',
              type: 'boolean',
              isNullable: true,
            },
            {
              name: 'ai_task_score',
              type: 'decimal',
              precision: 10,
              scale: 2,
              isNullable: true,
            },
            {
              name: 'ai_task_remark',
              type: 'varchar',
              length: '500',
              isNullable: true,
            },
            {
              name: 'normalized_payload',
              type: 'json',
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
          indices: [
            {
              name: 'ux_customer_identification_source',
              isUnique: true,
              columnNames: ['source_system', 'source_table', 'source_id'],
            },
            {
              name: 'idx_customer_identification_source_customer_mobile',
              columnNames: ['source_customer_mobile'],
            },
            {
              name: 'idx_customer_identification_matched_customer_mobile',
              columnNames: ['matched_customer_mobile'],
            },
            {
              name: 'idx_customer_identification_binding_status',
              columnNames: ['binding_status'],
            },
          ],
        }),
      );
    }

    await this.createForeignKeyIfMissing(
      queryRunner,
      'customer_identification_bindings',
      new TableForeignKey({
        name: 'fk_customer_identification_bound_by_user',
        columnNames: ['bound_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('customer_identification_bindings')) {
      await this.dropForeignKeyIfExists(
        queryRunner,
        'customer_identification_bindings',
        'fk_customer_identification_bound_by_user',
      );
      await queryRunner.dropTable('customer_identification_bindings');
    }

    if (await queryRunner.hasTable('employees')) {
      await this.dropColumnIfExists(queryRunner, 'employees', 'name_remark');
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

  private async dropColumnIfExists(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
  ) {
    if (await queryRunner.hasColumn(tableName, columnName)) {
      await queryRunner.dropColumn(tableName, columnName);
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
