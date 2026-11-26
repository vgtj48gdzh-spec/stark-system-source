import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class KeepExternalCardSalesStagingBatches1710800025000 implements MigrationInterface {
  name = 'KeepExternalCardSalesStagingBatches1710800025000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('external_card_sales_staging'))) {
      return;
    }

    await this.dropIndexIfExists(
      queryRunner,
      'external_card_sales_staging',
      'ux_external_card_sales_source_row',
    );
    await this.createIndexIfMissing(
      queryRunner,
      'external_card_sales_staging',
      new TableIndex({
        name: 'ux_external_card_sales_batch_source_row',
        isUnique: true,
        columnNames: ['import_batch_no', 'source_file_name', 'source_sheet_name', 'source_row_no'],
      }),
    );
    await this.createIndexIfMissing(
      queryRunner,
      'external_card_sales_staging',
      new TableIndex({
        name: 'idx_external_card_sales_source_row',
        columnNames: ['source_file_name', 'source_sheet_name', 'source_row_no'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('external_card_sales_staging'))) {
      return;
    }

    await this.dropIndexIfExists(
      queryRunner,
      'external_card_sales_staging',
      'ux_external_card_sales_batch_source_row',
    );
    await this.dropIndexIfExists(
      queryRunner,
      'external_card_sales_staging',
      'idx_external_card_sales_source_row',
    );

    const duplicateRows = await queryRunner.query(`
      SELECT COUNT(*) AS duplicateCount
      FROM (
        SELECT source_file_name, source_sheet_name, source_row_no
        FROM external_card_sales_staging
        GROUP BY source_file_name, source_sheet_name, source_row_no
        HAVING COUNT(*) > 1
      ) duplicate_source_rows
    `);
    const duplicateCount = Number(duplicateRows?.[0]?.duplicateCount ?? 0);
    if (duplicateCount > 0) {
      return;
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
  }

  private async dropIndexIfExists(queryRunner: QueryRunner, tableName: string, indexName: string) {
    const table = await queryRunner.getTable(tableName);
    const index = table?.indices.find((item) => item.name === indexName);
    if (index) {
      await queryRunner.dropIndex(tableName, index);
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
