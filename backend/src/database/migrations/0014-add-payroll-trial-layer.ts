import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddPayrollTrialLayer1710800014000 implements MigrationInterface {
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createPayrollTrialRunsTable(queryRunner);
    await this.createPayrollTrialItemsTable(queryRunner);
    await this.createPayrollTrialItemDetailsTable(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropTableIfExists(queryRunner, 'payroll_trial_item_details');
    await this.dropTableIfExists(queryRunner, 'payroll_trial_items');
    await this.dropTableIfExists(queryRunner, 'payroll_trial_runs');
  }

  private async createPayrollTrialRunsTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('payroll_trial_runs')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'payroll_trial_runs',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'period_key', type: 'varchar', length: '20' },
          { name: 'batch_no', type: 'varchar', length: '100' },
          { name: 'force_regenerate', type: 'tinyint', width: 1, default: '0' },
          { name: 'run_status', type: 'varchar', length: '30' },
          { name: 'source_summary_count', type: 'int', default: '0' },
          { name: 'source_event_count', type: 'int', default: '0' },
          { name: 'created_item_count', type: 'int', default: '0' },
          { name: 'updated_item_count', type: 'int', default: '0' },
          { name: 'processed_item_count', type: 'int', default: '0' },
          { name: 'error_message', type: 'varchar', length: '1000', isNullable: true },
          { name: 'normalized_payload', type: 'json' },
          { name: 'started_at', type: 'datetime' },
          { name: 'finished_at', type: 'datetime', isNullable: true },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createIndices('payroll_trial_runs', [
      new TableIndex({
        name: 'uniq_payroll_trial_runs_batch_no',
        columnNames: ['batch_no'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'idx_payroll_trial_runs_period_status',
        columnNames: ['period_key', 'run_status'],
      }),
      new TableIndex({
        name: 'idx_payroll_trial_runs_started_at',
        columnNames: ['started_at'],
      }),
    ]);
  }

  private async createPayrollTrialItemsTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('payroll_trial_items')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'payroll_trial_items',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'trial_key', type: 'varchar', length: '255' },
          { name: 'payroll_trial_run_id', type: 'int' },
          { name: 'employee_id', type: 'int', isNullable: true },
          { name: 'period_key', type: 'varchar', length: '20' },
          { name: 'summary_domain', type: 'varchar', length: '50' },
          { name: 'source_summary_count', type: 'int', default: '0' },
          { name: 'source_event_count', type: 'int', default: '0' },
          { name: 'reward_amount_total', type: 'decimal', precision: 18, scale: 2, default: '0.00' },
          { name: 'reward_points_total', type: 'decimal', precision: 18, scale: 2, default: '0.00' },
          { name: 'pending_count', type: 'int', default: '0' },
          { name: 'ignored_count', type: 'int', default: '0' },
          { name: 'calculated_total', type: 'decimal', precision: 18, scale: 2, default: '0.00' },
          { name: 'confirmed_flag', type: 'tinyint', width: 1, default: '0' },
          { name: 'confirmed_by', type: 'int', isNullable: true },
          { name: 'confirmed_at', type: 'datetime', isNullable: true },
          { name: 'remark', type: 'varchar', length: '500', isNullable: true },
          { name: 'normalized_payload', type: 'json' },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createForeignKeys('payroll_trial_items', [
      new TableForeignKey({
        name: 'fk_payroll_trial_items_run_id',
        columnNames: ['payroll_trial_run_id'],
        referencedTableName: 'payroll_trial_runs',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'fk_payroll_trial_items_employee_id',
        columnNames: ['employee_id'],
        referencedTableName: 'employees',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        name: 'fk_payroll_trial_items_confirmed_by',
        columnNames: ['confirmed_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);

    await queryRunner.createIndices('payroll_trial_items', [
      new TableIndex({
        name: 'uniq_payroll_trial_items_trial_key',
        columnNames: ['trial_key'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'idx_payroll_trial_items_period_domain',
        columnNames: ['period_key', 'summary_domain'],
      }),
      new TableIndex({
        name: 'idx_payroll_trial_items_employee_period',
        columnNames: ['employee_id', 'period_key'],
      }),
      new TableIndex({
        name: 'idx_payroll_trial_items_pending',
        columnNames: ['pending_count', 'confirmed_flag'],
      }),
    ]);
  }

  private async createPayrollTrialItemDetailsTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('payroll_trial_item_details')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'payroll_trial_item_details',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'payroll_trial_item_id', type: 'int' },
          { name: 'payroll_trial_run_id', type: 'int' },
          { name: 'detail_type', type: 'varchar', length: '50' },
          { name: 'source_system', type: 'varchar', length: '50' },
          { name: 'source_table', type: 'varchar', length: '100' },
          { name: 'source_id', type: 'varchar', length: '100' },
          { name: 'source_order_no', type: 'varchar', length: '100', isNullable: true },
          { name: 'source_record_id', type: 'int', isNullable: true },
          { name: 'employee_id', type: 'int', isNullable: true },
          { name: 'period_key', type: 'varchar', length: '20' },
          { name: 'summary_domain', type: 'varchar', length: '50' },
          { name: 'amount_standard', type: 'decimal', precision: 18, scale: 2, isNullable: true },
          { name: 'quantity_standard', type: 'decimal', precision: 18, scale: 2, isNullable: true },
          { name: 'reward_points', type: 'decimal', precision: 18, scale: 2, default: '0.00' },
          { name: 'reward_amount', type: 'decimal', precision: 18, scale: 2, default: '0.00' },
          { name: 'calculated_amount', type: 'decimal', precision: 18, scale: 2, default: '0.00' },
          { name: 'pending_flag', type: 'tinyint', width: 1, default: '0' },
          { name: 'ignored_flag', type: 'tinyint', width: 1, default: '0' },
          { name: 'occurred_at', type: 'datetime' },
          { name: 'normalized_payload', type: 'json' },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createForeignKeys('payroll_trial_item_details', [
      new TableForeignKey({
        name: 'fk_payroll_trial_item_details_item_id',
        columnNames: ['payroll_trial_item_id'],
        referencedTableName: 'payroll_trial_items',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'fk_payroll_trial_item_details_run_id',
        columnNames: ['payroll_trial_run_id'],
        referencedTableName: 'payroll_trial_runs',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'fk_payroll_trial_item_details_employee_id',
        columnNames: ['employee_id'],
        referencedTableName: 'employees',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);

    await queryRunner.createIndices('payroll_trial_item_details', [
      new TableIndex({
        name: 'uniq_payroll_trial_item_details_source',
        columnNames: ['payroll_trial_item_id', 'detail_type', 'source_table', 'source_id'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'idx_payroll_trial_item_details_period_domain',
        columnNames: ['period_key', 'summary_domain'],
      }),
      new TableIndex({
        name: 'idx_payroll_trial_item_details_occurred',
        columnNames: ['occurred_at'],
      }),
    ]);
  }

  private async dropTableIfExists(queryRunner: QueryRunner, tableName: string) {
    if (await queryRunner.hasTable(tableName)) {
      await queryRunner.dropTable(tableName);
    }
  }
}
