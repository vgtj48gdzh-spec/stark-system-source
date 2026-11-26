import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

const tableName = 'mobile_device_diagnostics';
const migrationColumnComment = 'added_by_0049_mobile_device_diagnostics_runtime_columns';

export class AddMobileDeviceDiagnosticsRuntimeColumns00491779000000000
  implements MigrationInterface
{
  name = 'AddMobileDeviceDiagnosticsRuntimeColumns00491779000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable(tableName))) {
      return;
    }

    await this.addColumnIfMissing(
      queryRunner,
      new TableColumn({
        name: 'device_reported_at',
        type: 'datetime',
        isNullable: true,
        comment: migrationColumnComment,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      new TableColumn({
        name: 'resolved_base_url',
        type: 'varchar',
        length: '255',
        isNullable: true,
        comment: migrationColumnComment,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      new TableColumn({
        name: 'base_url_source',
        type: 'varchar',
        length: '32',
        isNullable: true,
        comment: migrationColumnComment,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      new TableColumn({
        name: 'runtime_snapshot_json',
        type: 'json',
        isNullable: true,
        comment: migrationColumnComment,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable(tableName))) {
      return;
    }

    for (const columnName of [
      'runtime_snapshot_json',
      'base_url_source',
      'resolved_base_url',
      'device_reported_at',
    ]) {
      if (await queryRunner.hasColumn(tableName, columnName)) {
        const table = await queryRunner.getTable(tableName);
        const column = table?.findColumnByName(columnName);
        if (column?.comment === migrationColumnComment) {
          await queryRunner.dropColumn(tableName, columnName);
        }
      }
    }
  }

  private async addColumnIfMissing(
    queryRunner: QueryRunner,
    column: TableColumn,
  ): Promise<void> {
    if (!(await queryRunner.hasColumn(tableName, column.name))) {
      await queryRunner.addColumn(tableName, column);
    }
  }
}
