import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPayrollTrialDetailExplainability1710800015000 implements MigrationInterface {
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('payroll_trial_item_details'))) {
      return;
    }

    await this.addColumnIfMissing(
      queryRunner,
      'payroll_trial_item_details',
      new TableColumn({
        name: 'included_flag',
        type: 'tinyint',
        width: 1,
        default: '0',
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'payroll_trial_item_details',
      new TableColumn({
        name: 'included_reason',
        type: 'varchar',
        length: '500',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'payroll_trial_item_details',
      new TableColumn({
        name: 'excluded_reason',
        type: 'varchar',
        length: '500',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'payroll_trial_item_details',
      new TableColumn({
        name: 'matched_rule',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'payroll_trial_item_details',
      new TableColumn({
        name: 'rule_strength',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'payroll_trial_item_details',
      new TableColumn({
        name: 'evidence_status',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('payroll_trial_item_details'))) {
      return;
    }

    await this.dropColumnIfExists(queryRunner, 'payroll_trial_item_details', 'evidence_status');
    await this.dropColumnIfExists(queryRunner, 'payroll_trial_item_details', 'rule_strength');
    await this.dropColumnIfExists(queryRunner, 'payroll_trial_item_details', 'matched_rule');
    await this.dropColumnIfExists(queryRunner, 'payroll_trial_item_details', 'excluded_reason');
    await this.dropColumnIfExists(queryRunner, 'payroll_trial_item_details', 'included_reason');
    await this.dropColumnIfExists(queryRunner, 'payroll_trial_item_details', 'included_flag');
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
}
