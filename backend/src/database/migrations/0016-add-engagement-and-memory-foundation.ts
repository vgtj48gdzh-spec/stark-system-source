import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddEngagementAndMemoryFoundation1710800016000
  implements MigrationInterface
{
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createPlatformContentsTable(queryRunner);
    await this.createPlatformInteractionsTable(queryRunner);
    await this.createMemoryEntriesTable(queryRunner);
    await this.createInteractionLinksTable(queryRunner);
    await this.createAiRecommendationsTable(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropTableIfExists(queryRunner, 'ai_recommendations');
    await this.dropTableIfExists(queryRunner, 'interaction_links');
    await this.dropTableIfExists(queryRunner, 'memory_entries');
    await this.dropTableIfExists(queryRunner, 'platform_interactions');
    await this.dropTableIfExists(queryRunner, 'platform_contents');
  }

  private async createPlatformContentsTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('platform_contents')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'platform_contents',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'platform', type: 'varchar', length: '50' },
          { name: 'account_id', type: 'varchar', length: '100' },
          { name: 'content_id', type: 'varchar', length: '100' },
          { name: 'campaign_id', type: 'varchar', length: '100', isNullable: true },
          { name: 'title', type: 'varchar', length: '255' },
          { name: 'content_type', type: 'varchar', length: '50' },
          { name: 'tags', type: 'json', isNullable: true },
          { name: 'published_at', type: 'datetime', isNullable: true },
          { name: 'status', type: 'varchar', length: '30' },
          { name: 'normalized_payload', type: 'json' },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createIndices('platform_contents', [
      new TableIndex({
        name: 'uniq_platform_contents_platform_account_content',
        columnNames: ['platform', 'account_id', 'content_id'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'idx_platform_contents_platform_published',
        columnNames: ['platform', 'published_at'],
      }),
      new TableIndex({
        name: 'idx_platform_contents_campaign_published',
        columnNames: ['campaign_id', 'published_at'],
      }),
      new TableIndex({
        name: 'idx_platform_contents_status',
        columnNames: ['status'],
      }),
    ]);
  }

  private async createPlatformInteractionsTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('platform_interactions')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'platform_interactions',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'platform', type: 'varchar', length: '50' },
          { name: 'account_id', type: 'varchar', length: '100' },
          { name: 'content_id', type: 'varchar', length: '100', isNullable: true },
          { name: 'interaction_type', type: 'varchar', length: '50' },
          { name: 'interaction_value', type: 'varchar', length: '255', isNullable: true },
          { name: 'interaction_time', type: 'datetime' },
          { name: 'source_user_ref', type: 'varchar', length: '100', isNullable: true },
          { name: 'source_session_ref', type: 'varchar', length: '100', isNullable: true },
          { name: 'source_contact_ref', type: 'varchar', length: '100', isNullable: true },
          { name: 'normalized_payload', type: 'json' },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createIndices('platform_interactions', [
      new TableIndex({
        name: 'idx_platform_interactions_platform_account_time',
        columnNames: ['platform', 'account_id', 'interaction_time'],
      }),
      new TableIndex({
        name: 'idx_platform_interactions_content_time',
        columnNames: ['content_id', 'interaction_time'],
      }),
      new TableIndex({
        name: 'idx_platform_interactions_source_user_ref',
        columnNames: ['source_user_ref'],
      }),
      new TableIndex({
        name: 'idx_platform_interactions_source_contact_ref',
        columnNames: ['source_contact_ref'],
      }),
    ]);
  }

  private async createMemoryEntriesTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('memory_entries')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'memory_entries',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'subject_type', type: 'varchar', length: '30' },
          { name: 'subject_id', type: 'int' },
          { name: 'memory_type', type: 'varchar', length: '50' },
          { name: 'content', type: 'text' },
          { name: 'source_type', type: 'varchar', length: '50' },
          { name: 'source_id', type: 'varchar', length: '100', isNullable: true },
          { name: 'evidence_status', type: 'varchar', length: '20' },
          { name: 'confidence_score', type: 'decimal', precision: 5, scale: 4, default: '0.0000' },
          { name: 'expires_at', type: 'datetime', isNullable: true },
          { name: 'is_active', type: 'tinyint', width: 1, default: '1' },
          { name: 'normalized_payload', type: 'json' },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createIndices('memory_entries', [
      new TableIndex({
        name: 'idx_memory_entries_subject_active',
        columnNames: ['subject_type', 'subject_id', 'is_active'],
      }),
      new TableIndex({
        name: 'idx_memory_entries_type_evidence',
        columnNames: ['memory_type', 'evidence_status'],
      }),
      new TableIndex({
        name: 'idx_memory_entries_expires_at',
        columnNames: ['expires_at'],
      }),
    ]);
  }

  private async createInteractionLinksTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('interaction_links')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'interaction_links',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'interaction_id', type: 'int' },
          { name: 'linked_subject_type', type: 'varchar', length: '30' },
          { name: 'linked_subject_id', type: 'int' },
          { name: 'linked_business_type', type: 'varchar', length: '50', isNullable: true },
          { name: 'linked_business_id', type: 'varchar', length: '100', isNullable: true },
          { name: 'attribution_status', type: 'varchar', length: '20' },
          { name: 'attribution_confidence', type: 'decimal', precision: 5, scale: 4, default: '0.0000' },
          { name: 'remark', type: 'varchar', length: '500', isNullable: true },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'interaction_links',
      new TableForeignKey({
        name: 'fk_interaction_links_interaction_id',
        columnNames: ['interaction_id'],
        referencedTableName: 'platform_interactions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndices('interaction_links', [
      new TableIndex({
        name: 'idx_interaction_links_interaction',
        columnNames: ['interaction_id'],
      }),
      new TableIndex({
        name: 'idx_interaction_links_subject',
        columnNames: ['linked_subject_type', 'linked_subject_id'],
      }),
      new TableIndex({
        name: 'idx_interaction_links_business',
        columnNames: ['linked_business_type', 'linked_business_id'],
      }),
      new TableIndex({
        name: 'idx_interaction_links_attribution',
        columnNames: ['attribution_status'],
      }),
    ]);
  }

  private async createAiRecommendationsTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('ai_recommendations')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'ai_recommendations',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'subject_type', type: 'varchar', length: '30' },
          { name: 'subject_id', type: 'int' },
          { name: 'recommendation_type', type: 'varchar', length: '50' },
          { name: 'recommendation_text', type: 'text' },
          { name: 'recommendation_reason', type: 'text', isNullable: true },
          { name: 'source_context', type: 'json' },
          { name: 'evidence_status', type: 'varchar', length: '20' },
          { name: 'confidence_score', type: 'decimal', precision: 5, scale: 4, default: '0.0000' },
          { name: 'status', type: 'varchar', length: '30' },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createIndices('ai_recommendations', [
      new TableIndex({
        name: 'idx_ai_recommendations_subject_status',
        columnNames: ['subject_type', 'subject_id', 'status'],
      }),
      new TableIndex({
        name: 'idx_ai_recommendations_type_created',
        columnNames: ['recommendation_type', 'created_at'],
      }),
      new TableIndex({
        name: 'idx_ai_recommendations_evidence',
        columnNames: ['evidence_status'],
      }),
    ]);
  }

  private async dropTableIfExists(queryRunner: QueryRunner, tableName: string) {
    if (await queryRunner.hasTable(tableName)) {
      await queryRunner.dropTable(tableName);
    }
  }
}
