import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiKnowledgeEntries1710800029000 implements MigrationInterface {
  name = 'AddAiKnowledgeEntries1710800029000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`ai_knowledge_entries\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`knowledge_type\` varchar(64) NOT NULL,
        \`scope_type\` varchar(64) NOT NULL,
        \`scope_key\` varchar(191) NULL,
        \`title\` varchar(191) NOT NULL,
        \`summary\` varchar(500) NOT NULL,
        \`content\` text NOT NULL,
        \`tags\` json NULL,
        \`role_scope\` json NULL,
        \`scene_scope\` json NULL,
        \`enabled_flag\` tinyint NOT NULL DEFAULT 1,
        \`source_type\` varchar(64) NULL,
        \`ai_learning_mode\` varchar(64) NULL,
        \`created_by\` int NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`normalized_payload\` json NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_ai_knowledge_scope\` (\`scope_type\`, \`scope_key\`),
        KEY \`idx_ai_knowledge_type\` (\`knowledge_type\`, \`enabled_flag\`),
        CONSTRAINT \`fk_ai_knowledge_created_by\`
          FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`)
          ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      INSERT INTO \`ai_knowledge_entries\` (
        \`knowledge_type\`,
        \`scope_type\`,
        \`scope_key\`,
        \`title\`,
        \`summary\`,
        \`content\`,
        \`tags\`,
        \`role_scope\`,
        \`scene_scope\`,
        \`enabled_flag\`,
        \`source_type\`,
        \`ai_learning_mode\`,
        \`created_by\`,
        \`normalized_payload\`
      )
      VALUES
      (
        'identity_rule',
        'global',
        NULL,
        '客户识别主键规则',
        '电话号码是客户唯一主键，车牌只能作为辅助信息。',
        '在 ABC 经营闭环里，电话号码是客户识别与归并的唯一主键。车牌号只能用于辅助展示、辅助核对或辅助关联，不能替代电话号码做主归并。',
        JSON_ARRAY('phone_primary', 'customer_binding', 'identity'),
        JSON_ARRAY('founder', 'finance', 'admin', 'approver', 'operator', 'store_manager', 'customer_service'),
        JSON_ARRAY('global', 'customer_binding'),
        1,
        'seed_baseline',
        'treat_as_global_reference',
        NULL,
        JSON_OBJECT('priority', 100, 'version', 's1-05-round-3f')
      ),
      (
        'classification_rule',
        'global',
        NULL,
        'A端/A+C/B卡/员工福利拆分规则',
        '销售联动购物卡、员工福利购物卡、其他活动购物卡必须严格拆分。',
        'A端销售、A+C 联动、B 端购物卡、员工福利购物卡和其他活动购物卡不能混淆。B 端购物卡金额不得当作现金收入；员工福利链必须与销售联动链分开看。',
        JSON_ARRAY('a_card_sale', 'a_plus_c_bundle', 'bcard', 'employee_welfare', 'classification'),
        JSON_ARRAY('founder', 'finance', 'admin', 'approver', 'store_manager', 'customer_service'),
        JSON_ARRAY('global', 'sheet_repair', 'performance_confirmation'),
        1,
        'seed_baseline',
        'treat_as_global_reference',
        NULL,
        JSON_OBJECT('priority', 95, 'version', 's1-05-round-3f')
      ),
      (
        'payment_rule',
        'global',
        NULL,
        '支付/对账规则',
        '已支付、未支付、积分支付、测试数据、台账漏记必须分开处理。',
        '已支付事实优先于台账缺失；未支付默认不能进入绩效统计；积分支付不能混成现金；测试数据只能清洗或参考展示；sheet_missing 需要保留审计痕迹。',
        JSON_ARRAY('paid_cash', 'paid_points', 'unpaid', 'test_data', 'sheet_missing', 'reconciliation'),
        JSON_ARRAY('founder', 'finance', 'admin', 'approver'),
        JSON_ARRAY('global', 'sheet_repair', 'data_cleanup', 'performance_confirmation'),
        1,
        'seed_baseline',
        'treat_as_global_reference',
        NULL,
        JSON_OBJECT('priority', 98, 'version', 's1-05-round-3f')
      ),
      (
        'manual_decision_rule',
        'global',
        NULL,
        '人工裁决适用范围规则',
        'case_only / same_pattern / global_rule 代表不同的人审适用范围。',
        '人工裁决必须明确适用范围。case_only 只适用于当前记录；same_pattern 仅可作为同类候选；global_rule 才能作为全局参考。AI 读取时必须尊重这个边界，不能自动外推。',
        JSON_ARRAY('manual_decision', 'decision_scope', 'ai_learning'),
        JSON_ARRAY('founder', 'finance', 'admin', 'approver'),
        JSON_ARRAY('global', 'customer_binding', 'performance_confirmation'),
        1,
        'seed_baseline',
        'can_generalize_with_review',
        NULL,
        JSON_OBJECT('priority', 92, 'version', 's1-05-round-3f')
      ),
      (
        'audit_rule',
        'global',
        NULL,
        '积分赠送与高风险修改边界',
        '积分赠送不能再靠数据库直改，高风险动作必须走接口和审计。',
        '积分赠送、人工活动调整、影响工资或高风险数据的动作，都必须走系统接口与审计留痕。AI 只能提出建议，不能越权直接改工资、改高风险业务数据。',
        JSON_ARRAY('points_redemption', 'manual_activity', 'audit', 'ai_boundary'),
        JSON_ARRAY('founder', 'finance', 'admin', 'approver'),
        JSON_ARRAY('global', 'data_cleanup', 'performance_confirmation'),
        1,
        'seed_baseline',
        'treat_as_global_reference',
        NULL,
        JSON_OBJECT('priority', 97, 'version', 's1-05-round-3f')
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `ai_knowledge_entries`');
  }
}
