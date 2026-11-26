import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

const tableName = 'approval_request_drafts';

export class AddApprovalRequestDrafts00551783760000000 implements MigrationInterface {
  name = 'AddApprovalRequestDrafts00551783760000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable(tableName)) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: tableName,
        columns: [
          idColumn(),
          { name: 'draft_no', type: 'varchar', length: '50', isUnique: true },
          { name: 'candidate_ref', type: 'varchar', length: '160' },
          { name: 'idempotency_key', type: 'varchar', length: '200', isUnique: true },
          { name: 'candidate_type', type: 'varchar', length: '80' },
          { name: 'source_system', type: 'varchar', length: '80' },
          { name: 'source_entity_type', type: 'varchar', length: '120' },
          { name: 'source_ref', type: 'varchar', length: '200' },
          decimalColumn('amount', true),
          { name: 'draft_reason', type: 'varchar', length: '500', isNullable: true },
          {
            name: 'draft_status',
            type: 'varchar',
            length: '40',
            default: "'draft_created'",
          },
          { name: 'evidence_snapshot_json', type: 'longtext' },
          { name: 'learning_context_json', type: 'longtext' },
          { name: 'ai_suggestion_snapshot_json', type: 'longtext', isNullable: true },
          { name: 'created_by_user_id', type: 'int', isNullable: true },
          { name: 'linked_approval_request_id', type: 'int', isNullable: true },
          createdAtColumn(),
          updatedAtColumn(),
        ],
      }),
    );

    await queryRunner.createIndices(tableName, [
      new TableIndex({
        name: 'idx_approval_request_drafts_candidate_ref',
        columnNames: ['candidate_ref'],
      }),
      new TableIndex({
        name: 'idx_approval_request_drafts_draft_status',
        columnNames: ['draft_status'],
      }),
      new TableIndex({
        name: 'idx_approval_request_drafts_source_system',
        columnNames: ['source_system'],
      }),
      new TableIndex({
        name: 'idx_approval_request_drafts_created_by',
        columnNames: ['created_by_user_id'],
      }),
    ]);

    await queryRunner.createForeignKeys(tableName, [
      new TableForeignKey({
        name: 'fk_approval_request_drafts_created_by_user',
        columnNames: ['created_by_user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        name: 'fk_approval_request_drafts_linked_approval_request',
        columnNames: ['linked_approval_request_id'],
        referencedTableName: 'approval_requests',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable(tableName)) {
      await queryRunner.dropTable(tableName);
    }
  }
}

function idColumn() {
  return {
    name: 'id',
    type: 'int',
    isPrimary: true,
    isGenerated: true,
    generationStrategy: 'increment' as const,
  };
}

function decimalColumn(name: string, isNullable: boolean) {
  return {
    name,
    type: 'decimal',
    precision: 12,
    scale: 2,
    isNullable,
  };
}

function createdAtColumn() {
  return { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' };
}

function updatedAtColumn() {
  return {
    name: 'updated_at',
    type: 'datetime',
    default: 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  };
}
