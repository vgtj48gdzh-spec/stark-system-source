import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddEmployeeMasterDataImportFoundation1710800022000
  implements MigrationInterface
{
  name = 'AddEmployeeMasterDataImportFoundation1710800022000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('employees'))) {
      return;
    }

    await this.addColumnIfMissing(
      queryRunner,
      'employees',
      new TableColumn({
        name: 'source_company_name',
        type: 'varchar',
        length: '120',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'employees',
      new TableColumn({
        name: 'position_name',
        type: 'varchar',
        length: '120',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'employees',
      new TableColumn({
        name: 'source_file_name',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'employees',
      new TableColumn({
        name: 'source_row_index',
        type: 'int',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'employees',
      new TableColumn({
        name: 'imported_at',
        type: 'datetime',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'employees',
      new TableColumn({
        name: 'import_batch_no',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'employees',
      new TableColumn({
        name: 'import_conflict_note',
        type: 'varchar',
        length: '500',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'employees',
      new TableColumn({
        name: 'referral_code',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'employees',
      new TableColumn({
        name: 'referred_by_employee_id',
        type: 'int',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'employees',
      new TableColumn({
        name: 'referred_by_employee_mobile',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'employees',
      new TableColumn({
        name: 'referral_source_type',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
    );

    await this.createIndexIfMissing(
      queryRunner,
      'employees',
      new TableIndex({
        name: 'idx_employees_mobile',
        columnNames: ['mobile'],
      }),
    );
    await this.createIndexIfMissing(
      queryRunner,
      'employees',
      new TableIndex({
        name: 'idx_employees_import_batch_no',
        columnNames: ['import_batch_no'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('employees'))) {
      return;
    }

    await this.dropIndexIfExists(queryRunner, 'employees', 'idx_employees_import_batch_no');
    await this.dropIndexIfExists(queryRunner, 'employees', 'idx_employees_mobile');

    await this.dropColumnIfExists(queryRunner, 'employees', 'referral_source_type');
    await this.dropColumnIfExists(queryRunner, 'employees', 'referred_by_employee_mobile');
    await this.dropColumnIfExists(queryRunner, 'employees', 'referred_by_employee_id');
    await this.dropColumnIfExists(queryRunner, 'employees', 'referral_code');
    await this.dropColumnIfExists(queryRunner, 'employees', 'import_conflict_note');
    await this.dropColumnIfExists(queryRunner, 'employees', 'import_batch_no');
    await this.dropColumnIfExists(queryRunner, 'employees', 'imported_at');
    await this.dropColumnIfExists(queryRunner, 'employees', 'source_row_index');
    await this.dropColumnIfExists(queryRunner, 'employees', 'source_file_name');
    await this.dropColumnIfExists(queryRunner, 'employees', 'position_name');
    await this.dropColumnIfExists(queryRunner, 'employees', 'source_company_name');
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

  private async dropIndexIfExists(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
  ) {
    const table = await queryRunner.getTable(tableName);
    if (table?.indices.some((item) => item.name === indexName)) {
      await queryRunner.dropIndex(tableName, indexName);
    }
  }
}
