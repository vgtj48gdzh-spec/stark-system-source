import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddExternalCardSalesStaging1710800024000 implements MigrationInterface {
  name = 'AddExternalCardSalesStaging1710800024000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('external_card_sales_staging'))) {
      await queryRunner.createTable(
        new Table({
          name: 'external_card_sales_staging',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'source_file_name',
              type: 'varchar',
              length: '255',
            },
            {
              name: 'source_sheet_name',
              type: 'varchar',
              length: '120',
              isNullable: true,
            },
            {
              name: 'source_row_no',
              type: 'int',
            },
            {
              name: 'sale_date',
              type: 'datetime',
              isNullable: true,
            },
            {
              name: 'period_key',
              type: 'varchar',
              length: '7',
              isNullable: true,
            },
            {
              name: 'customer_mobile',
              type: 'varchar',
              length: '20',
              isNullable: true,
            },
            {
              name: 'customer_name_alias',
              type: 'varchar',
              length: '120',
              isNullable: true,
            },
            {
              name: 'car_plate',
              type: 'varchar',
              length: '30',
              isNullable: true,
            },
            {
              name: 'package_or_project_name',
              type: 'varchar',
              length: '255',
              isNullable: true,
            },
            {
              name: 'remark1',
              type: 'varchar',
              length: '500',
              isNullable: true,
            },
            {
              name: 'remark2',
              type: 'varchar',
              length: '500',
              isNullable: true,
            },
            {
              name: 'benefit_remark',
              type: 'varchar',
              length: '500',
              isNullable: true,
            },
            {
              name: 'amount',
              type: 'decimal',
              precision: 12,
              scale: 2,
              isNullable: true,
            },
            {
              name: 'normalized_mobile',
              type: 'varchar',
              length: '20',
              isNullable: true,
            },
            {
              name: 'normalized_plate',
              type: 'varchar',
              length: '30',
              isNullable: true,
            },
            {
              name: 'normalized_project_code',
              type: 'varchar',
              length: '120',
              isNullable: true,
            },
            {
              name: 'import_batch_no',
              type: 'varchar',
              length: '40',
            },
            {
              name: 'imported_at',
              type: 'datetime',
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
        }),
      );
    }

    await this.createIndexIfMissing(
      queryRunner,
      'external_card_sales_staging',
      new TableIndex({
        name: 'ux_external_card_sales_source_row',
        isUnique: true,
        columnNames: ['source_file_name', 'source_sheet_name', 'source_row_no'],
      }),
    );
    await this.createIndexIfMissing(
      queryRunner,
      'external_card_sales_staging',
      new TableIndex({
        name: 'idx_external_card_sales_period_key',
        columnNames: ['period_key'],
      }),
    );
    await this.createIndexIfMissing(
      queryRunner,
      'external_card_sales_staging',
      new TableIndex({
        name: 'idx_external_card_sales_normalized_mobile',
        columnNames: ['normalized_mobile'],
      }),
    );
    await this.createIndexIfMissing(
      queryRunner,
      'external_card_sales_staging',
      new TableIndex({
        name: 'idx_external_card_sales_project_code',
        columnNames: ['normalized_project_code'],
      }),
    );
    await this.createIndexIfMissing(
      queryRunner,
      'external_card_sales_staging',
      new TableIndex({
        name: 'idx_external_card_sales_import_batch_no',
        columnNames: ['import_batch_no'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('external_card_sales_staging')) {
      await queryRunner.dropTable('external_card_sales_staging');
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
}
