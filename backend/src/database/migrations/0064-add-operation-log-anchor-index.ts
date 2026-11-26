import { MigrationInterface, QueryRunner } from 'typeorm';

const OPERATION_LOG_ANCHOR_INDEX = 'idx_operation_logs_module_target_action_id';

export class AddOperationLogAnchorIndex00641787400000000 implements MigrationInterface {
  name = 'AddOperationLogAnchorIndex00641787400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`operation_logs\`
        ADD INDEX \`${OPERATION_LOG_ANCHOR_INDEX}\`
          (\`module\`, \`target_id\`, \`action\`, \`id\`),
        ALGORITHM=INPLACE,
        LOCK=NONE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`operation_logs\`
        DROP INDEX \`${OPERATION_LOG_ANCHOR_INDEX}\`,
        ALGORITHM=INPLACE,
        LOCK=NONE
    `);
  }
}
