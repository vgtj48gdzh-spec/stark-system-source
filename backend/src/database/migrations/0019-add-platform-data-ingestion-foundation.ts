import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddPlatformDataIngestionFoundation1710800019000 implements MigrationInterface {
  name = 'AddPlatformDataIngestionFoundation1710800019000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('platform_import_batches'))) {
      await queryRunner.createTable(
        new Table({
          name: 'platform_import_batches',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'source_platform', type: 'varchar', length: '50' },
            { name: 'account_id', type: 'varchar', length: '100', isNullable: true },
            { name: 'import_type', type: 'varchar', length: '30' },
            { name: 'source_format', type: 'varchar', length: '20' },
            { name: 'source_file', type: 'varchar', length: '255' },
            { name: 'file_name', type: 'varchar', length: '255' },
            { name: 'connector_config_id', type: 'int', isNullable: true },
            { name: 'import_status', type: 'varchar', length: '20' },
            { name: 'record_count', type: 'int', default: '0' },
            { name: 'success_count', type: 'int', default: '0' },
            { name: 'failed_count', type: 'int', default: '0' },
            { name: 'trigger_lead_generation', type: 'tinyint', width: 1, default: '0' },
            { name: 'trigger_attribution_generation', type: 'tinyint', width: 1, default: '0' },
            { name: 'sync_lead_memories', type: 'tinyint', width: 1, default: '0' },
            { name: 'imported_by', type: 'int', isNullable: true },
            { name: 'started_at', type: 'datetime', isNullable: true },
            { name: 'finished_at', type: 'datetime', isNullable: true },
            { name: 'summary_json', type: 'json', isNullable: true },
            { name: 'remark', type: 'varchar', length: '500', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );

      await queryRunner.createIndices('platform_import_batches', [
        new TableIndex({
          name: 'idx_platform_import_batches_platform_status',
          columnNames: ['source_platform', 'import_status'],
        }),
        new TableIndex({
          name: 'idx_platform_import_batches_created_at',
          columnNames: ['created_at'],
        }),
      ]);
    }

    if (!(await queryRunner.hasTable('platform_import_records'))) {
      await queryRunner.createTable(
        new Table({
          name: 'platform_import_records',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'import_batch_id', type: 'int' },
            { name: 'source_platform', type: 'varchar', length: '50' },
            { name: 'import_type', type: 'varchar', length: '30' },
            { name: 'source_file', type: 'varchar', length: '255' },
            { name: 'record_index', type: 'int' },
            { name: 'source_record_ref', type: 'varchar', length: '100', isNullable: true },
            { name: 'import_status', type: 'varchar', length: '20' },
            { name: 'target_table', type: 'varchar', length: '100', isNullable: true },
            { name: 'target_id', type: 'varchar', length: '100', isNullable: true },
            { name: 'error_message', type: 'text', isNullable: true },
            { name: 'raw_payload', type: 'json' },
            { name: 'normalized_payload', type: 'json', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );

      await queryRunner.createIndices('platform_import_records', [
        new TableIndex({
          name: 'idx_platform_import_records_batch_status',
          columnNames: ['import_batch_id', 'import_status'],
        }),
        new TableIndex({
          name: 'idx_platform_import_records_target',
          columnNames: ['target_table', 'target_id'],
        }),
        new TableIndex({
          name: 'uniq_platform_import_records_batch_index',
          columnNames: ['import_batch_id', 'record_index'],
          isUnique: true,
        }),
      ]);

      await queryRunner.createForeignKey(
        'platform_import_records',
        new TableForeignKey({
          name: 'fk_platform_import_records_batch',
          columnNames: ['import_batch_id'],
          referencedTableName: 'platform_import_batches',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    if (!(await queryRunner.hasTable('platform_leads'))) {
      await queryRunner.createTable(
        new Table({
          name: 'platform_leads',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'platform', type: 'varchar', length: '50' },
            { name: 'account_id', type: 'varchar', length: '100' },
            { name: 'lead_ref', type: 'varchar', length: '100' },
            { name: 'campaign_id', type: 'varchar', length: '100', isNullable: true },
            { name: 'content_id', type: 'varchar', length: '100', isNullable: true },
            { name: 'interaction_id', type: 'int', isNullable: true },
            { name: 'lead_type', type: 'varchar', length: '50', isNullable: true },
            { name: 'lead_status', type: 'varchar', length: '20' },
            { name: 'lead_value', type: 'varchar', length: '255', isNullable: true },
            { name: 'source_user_ref', type: 'varchar', length: '100', isNullable: true },
            { name: 'source_session_ref', type: 'varchar', length: '100', isNullable: true },
            { name: 'source_contact_ref', type: 'varchar', length: '100', isNullable: true },
            { name: 'subject_type', type: 'varchar', length: '30', isNullable: true },
            { name: 'subject_id', type: 'int', isNullable: true },
            { name: 'merchant_id', type: 'int', isNullable: true },
            { name: 'employee_id', type: 'int', isNullable: true },
            { name: 'customer_id', type: 'int', isNullable: true },
            { name: 'linked_business_type', type: 'varchar', length: '50', isNullable: true },
            { name: 'linked_business_id', type: 'varchar', length: '100', isNullable: true },
            { name: 'attribution_status', type: 'varchar', length: '20', default: "'unknown'" },
            { name: 'evidence_status', type: 'varchar', length: '20', default: "'uncertain'" },
            { name: 'confidence_score', type: 'decimal', precision: 5, scale: 4, default: "'0.0000'" },
            { name: 'rule_code', type: 'varchar', length: '100', isNullable: true },
            { name: 'matched_fields', type: 'json', isNullable: true },
            { name: 'source_file', type: 'varchar', length: '255', isNullable: true },
            { name: 'import_batch_id', type: 'int', isNullable: true },
            { name: 'linked_memory_entry_id', type: 'int', isNullable: true },
            { name: 'linked_recommendation_id', type: 'int', isNullable: true },
            { name: 'remark', type: 'varchar', length: '500', isNullable: true },
            { name: 'normalized_payload', type: 'json' },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );

      await queryRunner.createIndices('platform_leads', [
        new TableIndex({
          name: 'uniq_platform_leads_account_ref',
          columnNames: ['platform', 'account_id', 'lead_ref'],
          isUnique: true,
        }),
        new TableIndex({
          name: 'idx_platform_leads_status',
          columnNames: ['lead_status', 'evidence_status'],
        }),
        new TableIndex({
          name: 'idx_platform_leads_subject',
          columnNames: ['subject_type', 'subject_id'],
        }),
      ]);
    }

    if (!(await queryRunner.hasTable('platform_connector_configs'))) {
      await queryRunner.createTable(
        new Table({
          name: 'platform_connector_configs',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'platform', type: 'varchar', length: '50' },
            { name: 'account_id', type: 'varchar', length: '100' },
            { name: 'connector_code', type: 'varchar', length: '100' },
            { name: 'connector_name', type: 'varchar', length: '100' },
            { name: 'connector_type', type: 'varchar', length: '30' },
            { name: 'auth_mode', type: 'varchar', length: '30', isNullable: true },
            { name: 'config_json', type: 'json', isNullable: true },
            { name: 'status', type: 'varchar', length: '20' },
            { name: 'last_synced_at', type: 'datetime', isNullable: true },
            { name: 'remark', type: 'varchar', length: '500', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );

      await queryRunner.createIndices('platform_connector_configs', [
        new TableIndex({
          name: 'uniq_platform_connector_configs_code',
          columnNames: ['platform', 'account_id', 'connector_code'],
          isUnique: true,
        }),
        new TableIndex({
          name: 'idx_platform_connector_configs_status',
          columnNames: ['platform', 'status'],
        }),
      ]);
    }

    await this.ensureColumn(
      queryRunner,
      'platform_contents',
      new TableColumn({
        name: 'source_file',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );
    await this.ensureColumn(
      queryRunner,
      'platform_contents',
      new TableColumn({
        name: 'import_batch_id',
        type: 'int',
        isNullable: true,
      }),
    );
    await this.ensureColumn(
      queryRunner,
      'platform_interactions',
      new TableColumn({
        name: 'source_file',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );
    await this.ensureColumn(
      queryRunner,
      'platform_interactions',
      new TableColumn({
        name: 'import_batch_id',
        type: 'int',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropColumnIfExists(queryRunner, 'platform_interactions', 'import_batch_id');
    await this.dropColumnIfExists(queryRunner, 'platform_interactions', 'source_file');
    await this.dropColumnIfExists(queryRunner, 'platform_contents', 'import_batch_id');
    await this.dropColumnIfExists(queryRunner, 'platform_contents', 'source_file');

    if (await queryRunner.hasTable('platform_connector_configs')) {
      await queryRunner.dropTable('platform_connector_configs');
    }
    if (await queryRunner.hasTable('platform_leads')) {
      await queryRunner.dropTable('platform_leads');
    }
    if (await queryRunner.hasTable('platform_import_records')) {
      await queryRunner.dropTable('platform_import_records');
    }
    if (await queryRunner.hasTable('platform_import_batches')) {
      await queryRunner.dropTable('platform_import_batches');
    }
  }

  private async ensureColumn(queryRunner: QueryRunner, tableName: string, column: TableColumn) {
    if (!(await queryRunner.hasTable(tableName))) {
      return;
    }
    const hasColumn = await queryRunner.hasColumn(tableName, column.name);
    if (!hasColumn) {
      await queryRunner.addColumn(tableName, column);
    }
  }

  private async dropColumnIfExists(queryRunner: QueryRunner, tableName: string, columnName: string) {
    if (!(await queryRunner.hasTable(tableName))) {
      return;
    }
    if (await queryRunner.hasColumn(tableName, columnName)) {
      await queryRunner.dropColumn(tableName, columnName);
    }
  }
}
