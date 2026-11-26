import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddAbcPointsCommandPilot00351744614400000 implements MigrationInterface {
  name = 'AddAbcPointsCommandPilot00351744614400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('abc_points_command_requests'))) {
      await queryRunner.createTable(
        new Table({
          name: 'abc_points_command_requests',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'command_type', type: 'varchar', length: '32' },
            { name: 'command_status', type: 'varchar', length: '32', default: "'drafted'" },
            { name: 'owner_type', type: 'varchar', length: '32' },
            { name: 'owner_id', type: 'int', isNullable: true },
            { name: 'owner_mobile', type: 'varchar', length: '32', isNullable: true },
            { name: 'change_amount', type: 'decimal', precision: 18, scale: 2 },
            { name: 'source_type', type: 'varchar', length: '64' },
            { name: 'request_source', type: 'varchar', length: '32', default: "'manual'" },
            { name: 'reason_code', type: 'varchar', length: '100', isNullable: true },
            { name: 'remark', type: 'varchar', length: '500', isNullable: true },
            { name: 'requested_by', type: 'int', isNullable: true },
            { name: 'requested_by_name', type: 'varchar', length: '100', isNullable: true },
            { name: 'requested_at', type: 'datetime', isNullable: true },
            { name: 'confirmed_by', type: 'int', isNullable: true },
            { name: 'confirmed_by_name', type: 'varchar', length: '100', isNullable: true },
            { name: 'confirmed_at', type: 'datetime', isNullable: true },
            { name: 'executed_by', type: 'int', isNullable: true },
            { name: 'executed_by_name', type: 'varchar', length: '100', isNullable: true },
            { name: 'executed_at', type: 'datetime', isNullable: true },
            { name: 'cancelled_by', type: 'int', isNullable: true },
            { name: 'cancelled_by_name', type: 'varchar', length: '100', isNullable: true },
            { name: 'cancelled_at', type: 'datetime', isNullable: true },
            { name: 'provider_key', type: 'varchar', length: '100', isNullable: true },
            { name: 'source_action_id', type: 'varchar', length: '150', isNullable: true },
            { name: 'thread_key', type: 'varchar', length: '150', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            {
              name: 'updated_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
              onUpdate: 'CURRENT_TIMESTAMP',
            },
            { name: 'normalized_payload', type: 'json', isNullable: true },
          ],
        }),
      );

      await queryRunner.createIndex(
        'abc_points_command_requests',
        new TableIndex({
          name: 'idx_abc_points_command_status_owner',
          columnNames: ['command_status', 'owner_type', 'owner_mobile'],
        }),
      );
    }

    await queryRunner.query(`
      INSERT INTO ai_knowledge_entries
        (knowledge_type, scope_type, scope_key, title, summary, content, tags, role_scope, scene_scope, enabled_flag, source_type, ai_learning_mode, created_by, created_at, normalized_payload)
      SELECT
        'term_definition',
        'global',
        'reward_domain_hq_vs_abc',
        '总部积点与 ABC 积分必须分开理解',
        '总部积点是总部系统事实源；ABC 积分是 ABC 系统事实源，两者不能混说。',
        '总部系统的“积点”对应 rewardDomain=hq_points，事实源在总部 points/ledger/command 链。ABC 系统里的“积分”对应 rewardDomain=abc_score，事实源在 ABC 的 points、points_log、points_order、point_goods、user_account.points 等链路。AI 必须明确告诉用户当前动作写入哪个系统，不能把“积点兑换购物卡”和“ABC 积分补发”混成同一件事。',
        JSON_ARRAY('reward_domain', 'hq_points', 'abc_score', 'term_definition'),
        NULL,
        NULL,
        1,
        'migration_seed',
        'must_consider',
        1,
        NOW(),
        JSON_OBJECT('seedRound', '3M')
      FROM DUAL
      WHERE NOT EXISTS (
        SELECT 1
          FROM ai_knowledge_entries
         WHERE scope_key = 'reward_domain_hq_vs_abc'
      )
    `);

    await queryRunner.query(`
      INSERT INTO ai_memory_entries
        (memory_type, scope_type, scope_key, role_scope, scene_scope, title, summary, content, tags, priority_level, enabled_flag, source_type, generalization_mode, ai_usage_mode, created_by, created_by_name, created_at, updated_at, normalized_payload)
      SELECT
        'founder_principle',
        'founder',
        'reward_domain_distinction',
        NULL,
        NULL,
        '创始人要求先分清积点和积分',
        '总部积点与 ABC 积分是两套事实源，不能混用术语，也不能混用执行链。',
        '总部积点是总部系统发放、命令、兑换的点值；ABC 积分是 ABC 系统内的积分。前者可兑换购物卡，后者当前主要来自产品赠送与历史遗留。以后 ABC 积分补发/调整也必须通过总部系统受控命令链，不允许再手工改库。',
        JSON_ARRAY('hq_points', 'abc_score', 'founder_principle'),
        90,
        1,
        'migration_seed',
        'global_reference',
        'must_consider',
        1,
        '系统种子',
        NOW(),
        NOW(),
        JSON_OBJECT('seedRound', '3M')
      FROM DUAL
      WHERE NOT EXISTS (
        SELECT 1
          FROM ai_memory_entries
         WHERE scope_key = 'reward_domain_distinction'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM ai_memory_entries WHERE scope_key = 'reward_domain_distinction'`,
    );
    await queryRunner.query(
      `DELETE FROM ai_knowledge_entries WHERE scope_key = 'reward_domain_hq_vs_abc'`,
    );

    if (await queryRunner.hasTable('abc_points_command_requests')) {
      await queryRunner.dropIndex(
        'abc_points_command_requests',
        'idx_abc_points_command_status_owner',
      );
      await queryRunner.dropTable('abc_points_command_requests');
    }
  }
}
