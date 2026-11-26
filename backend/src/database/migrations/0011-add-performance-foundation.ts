import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddPerformanceFoundation1710800011000 implements MigrationInterface {
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createEmployeesTable(queryRunner);
    await this.createEmployeeSourceBindingsTable(queryRunner);
    await this.createPerformancePeriodsTable(queryRunner);
    await this.createPerformanceEventsTable(queryRunner);
    await this.createPerformanceSummariesTable(queryRunner);
    await this.seedEmployeesFromUsers(queryRunner);
    await this.seedStarkUserBindings(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropTableIfExists(queryRunner, 'performance_summaries');
    await this.dropTableIfExists(queryRunner, 'performance_events');
    await this.dropTableIfExists(queryRunner, 'performance_periods');
    await this.dropTableIfExists(queryRunner, 'employee_source_bindings');
    await this.dropTableIfExists(queryRunner, 'employees');
  }

  private async createEmployeesTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('employees')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'employees',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'name', type: 'varchar', length: '100' },
          { name: 'linked_user_id', type: 'int', isNullable: true },
          { name: 'mobile', type: 'varchar', length: '20', isNullable: true },
          { name: 'status', type: 'tinyint', default: '1' },
          { name: 'remark', type: 'varchar', length: '500', isNullable: true },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'employees',
      new TableForeignKey({
        name: 'fk_employees_linked_user_id',
        columnNames: ['linked_user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createIndex(
      'employees',
      new TableIndex({
        name: 'uniq_employees_linked_user_id',
        columnNames: ['linked_user_id'],
        isUnique: true,
      }),
    );
  }

  private async createEmployeeSourceBindingsTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('employee_source_bindings')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'employee_source_bindings',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'employee_id', type: 'int' },
          { name: 'source_system', type: 'varchar', length: '50' },
          { name: 'source_table', type: 'varchar', length: '100' },
          { name: 'source_id', type: 'varchar', length: '100' },
          { name: 'binding_type', type: 'varchar', length: '100' },
          { name: 'is_active', type: 'tinyint', width: 1, default: '1' },
          { name: 'remark', type: 'varchar', length: '500', isNullable: true },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'employee_source_bindings',
      new TableForeignKey({
        name: 'fk_employee_source_bindings_employee_id',
        columnNames: ['employee_id'],
        referencedTableName: 'employees',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'employee_source_bindings',
      new TableIndex({
        name: 'uniq_employee_source_binding_key',
        columnNames: ['source_system', 'source_table', 'source_id', 'binding_type'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'employee_source_bindings',
      new TableIndex({
        name: 'idx_employee_source_bindings_employee_active',
        columnNames: ['employee_id', 'is_active'],
      }),
    );
  }

  private async createPerformancePeriodsTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('performance_periods')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'performance_periods',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'period_type', type: 'varchar', length: '20', default: "'monthly'" },
          { name: 'period_key', type: 'varchar', length: '20' },
          { name: 'period_start', type: 'date' },
          { name: 'period_end', type: 'date' },
          { name: 'status', type: 'varchar', length: '30', default: "'open'" },
          { name: 'remark', type: 'varchar', length: '500', isNullable: true },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createIndex(
      'performance_periods',
      new TableIndex({
        name: 'uniq_performance_period_key',
        columnNames: ['period_type', 'period_key'],
        isUnique: true,
      }),
    );
  }

  private async createPerformanceEventsTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('performance_events')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'performance_events',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'employee_id', type: 'int', isNullable: true },
          { name: 'source_domain', type: 'varchar', length: '50' },
          { name: 'event_type', type: 'varchar', length: '100' },
          { name: 'source_system', type: 'varchar', length: '50' },
          { name: 'source_table', type: 'varchar', length: '100' },
          { name: 'source_id', type: 'varchar', length: '100' },
          { name: 'source_order_no', type: 'varchar', length: '100', isNullable: true },
          { name: 'amount_standard', type: 'decimal', precision: 18, scale: 2, isNullable: true },
          { name: 'quantity_standard', type: 'decimal', precision: 18, scale: 2, isNullable: true },
          { name: 'occurred_at', type: 'datetime' },
          { name: 'period_key', type: 'varchar', length: '20' },
          { name: 'confirmed_flag', type: 'tinyint', width: 1, default: '0' },
          { name: 'remark', type: 'varchar', length: '500', isNullable: true },
          { name: 'normalized_payload', type: 'json' },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'performance_events',
      new TableForeignKey({
        name: 'fk_performance_events_employee_id',
        columnNames: ['employee_id'],
        referencedTableName: 'employees',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createIndex(
      'performance_events',
      new TableIndex({
        name: 'uniq_performance_event_source_key',
        columnNames: ['source_system', 'source_table', 'source_id', 'event_type'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'performance_events',
      new TableIndex({
        name: 'idx_performance_events_period_domain',
        columnNames: ['period_key', 'source_domain'],
      }),
    );
    await queryRunner.createIndex(
      'performance_events',
      new TableIndex({
        name: 'idx_performance_events_employee_confirmed',
        columnNames: ['employee_id', 'confirmed_flag'],
      }),
    );
    await queryRunner.createIndex(
      'performance_events',
      new TableIndex({
        name: 'idx_performance_events_occurred_at',
        columnNames: ['occurred_at'],
      }),
    );
  }

  private async createPerformanceSummariesTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('performance_summaries')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'performance_summaries',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'performance_period_id', type: 'int' },
          { name: 'employee_id', type: 'int' },
          { name: 'source_domain', type: 'varchar', length: '50' },
          { name: 'event_count', type: 'int', default: '0' },
          { name: 'confirmed_event_count', type: 'int', default: '0' },
          { name: 'pending_event_count', type: 'int', default: '0' },
          { name: 'amount_total', type: 'decimal', precision: 18, scale: 2, default: '0.00' },
          { name: 'quantity_total', type: 'decimal', precision: 18, scale: 2, default: '0.00' },
          { name: 'normalized_payload', type: 'json' },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'performance_summaries',
      new TableForeignKey({
        name: 'fk_performance_summaries_period_id',
        columnNames: ['performance_period_id'],
        referencedTableName: 'performance_periods',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'performance_summaries',
      new TableForeignKey({
        name: 'fk_performance_summaries_employee_id',
        columnNames: ['employee_id'],
        referencedTableName: 'employees',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'performance_summaries',
      new TableIndex({
        name: 'uniq_performance_summary_key',
        columnNames: ['performance_period_id', 'employee_id', 'source_domain'],
        isUnique: true,
      }),
    );
  }

  private async seedEmployeesFromUsers(queryRunner: QueryRunner) {
    await queryRunner.query(`
      INSERT INTO employees (name, linked_user_id, mobile, status, remark, created_at, updated_at)
      SELECT u.real_name, u.id, u.mobile, u.status, CONCAT('Auto seeded from users#', u.id), NOW(), NOW()
      FROM users u
      LEFT JOIN employees e ON e.linked_user_id = u.id
      WHERE u.status = 1
        AND e.id IS NULL
    `);
  }

  private async seedStarkUserBindings(queryRunner: QueryRunner) {
    await queryRunner.query(`
      INSERT INTO employee_source_bindings (
        employee_id,
        source_system,
        source_table,
        source_id,
        binding_type,
        is_active,
        remark,
        created_at,
        updated_at
      )
      SELECT
        e.id,
        'STARK',
        'users',
        CAST(e.linked_user_id AS CHAR),
        'user',
        1,
        'Auto seeded from linked_user_id',
        NOW(),
        NOW()
      FROM employees e
      WHERE e.linked_user_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM employee_source_bindings b
          WHERE b.source_system = 'STARK'
            AND b.source_table = 'users'
            AND b.binding_type = 'user'
            AND b.source_id = CONVERT(CAST(e.linked_user_id AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci
        )
    `);
  }

  private async dropTableIfExists(queryRunner: QueryRunner, tableName: string) {
    if (await queryRunner.hasTable(tableName)) {
      await queryRunner.dropTable(tableName);
    }
  }
}
