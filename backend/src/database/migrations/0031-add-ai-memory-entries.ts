import { MigrationInterface, QueryRunner } from 'typeorm';

type MemorySeed = {
  memoryType: string;
  scopeType: string;
  scopeKey: string | null;
  roleScope: string[] | null;
  sceneScope: string[] | null;
  title: string;
  summary: string;
  content: string;
  tags: string[];
  priorityLevel: number;
  enabledFlag: boolean;
  sourceType: string;
  generalizationMode: string;
  aiUsageMode: string;
  normalizedPayload: Record<string, unknown>;
};

const FOUNDER_ROLE_SCOPE = [
  'founder',
  'finance',
  'admin',
  'approver',
  'operator',
  'store_manager',
  'customer_service',
];

const MEMORY_SEEDS: MemorySeed[] = [
  {
    memoryType: 'founder_principle',
    scopeType: 'founder',
    scopeKey: 'founder',
    roleScope: FOUNDER_ROLE_SCOPE,
    sceneScope: ['global'],
    title: '电话号码是唯一主键，车牌只作辅助',
    summary: '客户识别、绑定和核对优先看手机号，车牌只能做辅助展示与辅助校验。',
    content:
      '在斯塔克系统 / ABC 接入与经营闭环里，电话号码是客户唯一主键。车牌不能替代手机号做主归并，只能用于辅助展示、人工核对和辅助关联。',
    tags: ['identity', 'phone_primary', 'customer_binding'],
    priorityLevel: 100,
    enabledFlag: true,
    sourceType: 'founder_seed',
    generalizationMode: 'global_reference',
    aiUsageMode: 'must_consider',
    normalizedPayload: { memoryKey: 'founder.phone_primary', version: 's1-05-round-3h' },
  },
  {
    memoryType: 'founder_principle',
    scopeType: 'founder',
    scopeKey: 'founder',
    roleScope: FOUNDER_ROLE_SCOPE,
    sceneScope: ['global'],
    title: '先看闭环，再看局部',
    summary: '先判断业务链是否闭环、是否可追溯，再判断局部样本。',
    content:
      '创始人判断业务时优先看闭环：收款、支付、审批、工单、统计、执行、回流是否串起来。不要只盯单条记录而忽略整条主链是否贯通。',
    tags: ['founder_style', 'closed_loop', 'traceability'],
    priorityLevel: 96,
    enabledFlag: true,
    sourceType: 'founder_seed',
    generalizationMode: 'global_reference',
    aiUsageMode: 'must_consider',
    normalizedPayload: { memoryKey: 'founder.closed_loop_first', version: 's1-05-round-3h' },
  },
  {
    memoryType: 'founder_principle',
    scopeType: 'founder',
    scopeKey: 'founder',
    roleScope: FOUNDER_ROLE_SCOPE,
    sceneScope: ['global'],
    title: '先管钱，支付/审批/工单必须联动',
    summary: '支付事实、审批痕迹、工单链路优先于表面台账。',
    content:
      '业务口径里先看钱：真实收款、支付状态、审批记录、工单履约必须联动。台账缺失不能直接覆盖已支付事实，但需要保留审计标记与人工确认。',
    tags: ['cashflow', 'payment', 'approval', 'work_order'],
    priorityLevel: 99,
    enabledFlag: true,
    sourceType: 'founder_seed',
    generalizationMode: 'global_reference',
    aiUsageMode: 'must_consider',
    normalizedPayload: { memoryKey: 'founder.cashflow_first', version: 's1-05-round-3h' },
  },
  {
    memoryType: 'founder_principle',
    scopeType: 'founder',
    scopeKey: 'founder',
    roleScope: FOUNDER_ROLE_SCOPE,
    sceneScope: ['global'],
    title: '不跳过人工确认层',
    summary: '员工绑定、购物卡归因、奖励事件确认、工资试算确认、AI执行确认都不能跳过人工确认。',
    content:
      '人工确认层是系统边界的一部分。AI 可以建议，但不能替代人工完成员工绑定、购物卡归因、奖励事件确认、工资试算确认或高风险执行确认。',
    tags: ['manual_confirmation', 'boundary', 'high_risk'],
    priorityLevel: 100,
    enabledFlag: true,
    sourceType: 'founder_seed',
    generalizationMode: 'global_reference',
    aiUsageMode: 'must_consider',
    normalizedPayload: { memoryKey: 'founder.manual_confirmation', version: 's1-05-round-3h' },
  },
  {
    memoryType: 'founder_preference',
    scopeType: 'founder',
    scopeKey: 'founder',
    roleScope: FOUNDER_ROLE_SCOPE,
    sceneScope: ['global'],
    title: '特例与同类规则必须区分',
    summary: '单条特例不能直接外推成通用规则，同类模式要明确适用范围。',
    content:
      '创始人非常在意“这条是特例还是模式”。单条低价异常、台账漏记、积分补偿、员工测试等不能自动泛化。只有明确归类为 same_pattern 或 global_reference 的规则，才可供同类参考。',
    tags: ['generalization', 'case_only', 'same_pattern'],
    priorityLevel: 98,
    enabledFlag: true,
    sourceType: 'founder_seed',
    generalizationMode: 'global_reference',
    aiUsageMode: 'must_consider',
    normalizedPayload: { memoryKey: 'founder.generalization_boundary', version: 's1-05-round-3h' },
  },
  {
    memoryType: 'founder_principle',
    scopeType: 'founder',
    scopeKey: 'founder',
    roleScope: FOUNDER_ROLE_SCOPE,
    sceneScope: ['global'],
    title: 'B端购物卡不等于现金收入',
    summary: 'B卡要独立核算，不得直接混入现金收入或工资依据。',
    content:
      'B端购物卡金额、余额、消费链与现金收入是不同层。B卡统计要独立看，不能自动混进现金收入，也不能直接当工资结论。',
    tags: ['bcard', 'cash_income_boundary', 'financial_reconciliation'],
    priorityLevel: 97,
    enabledFlag: true,
    sourceType: 'founder_seed',
    generalizationMode: 'global_reference',
    aiUsageMode: 'must_consider',
    normalizedPayload: { memoryKey: 'founder.bcard_not_cash', version: 's1-05-round-3h' },
  },
  {
    memoryType: 'founder_principle',
    scopeType: 'founder',
    scopeKey: 'founder',
    roleScope: FOUNDER_ROLE_SCOPE,
    sceneScope: ['global'],
    title: '测试数据、低价异常、台账漏记、积分支付、员工福利必须拆开识别',
    summary: '这些场景都需要单独分类，不得混成同一种业务。',
    content:
      '测试数据、低价异常产品、台账漏记、积分支付、员工福利都有不同业务含义。AI 回答和人工裁决都要先拆分类，再决定是否进入统计、核对或待确认。',
    tags: ['test_data', 'price_abnormal', 'sheet_missing', 'paid_points', 'employee_welfare'],
    priorityLevel: 95,
    enabledFlag: true,
    sourceType: 'founder_seed',
    generalizationMode: 'global_reference',
    aiUsageMode: 'must_consider',
    normalizedPayload: { memoryKey: 'founder.special_case_split', version: 's1-05-round-3h' },
  },
  {
    memoryType: 'founder_principle',
    scopeType: 'founder',
    scopeKey: 'founder',
    roleScope: FOUNDER_ROLE_SCOPE,
    sceneScope: ['global'],
    title: '高风险业务数据不能靠数据库手改',
    summary: '积分赠送、工资前置、高风险业务变更必须走接口和审计。',
    content:
      '积分赠送、手工活动调整、影响工资或高风险业务数据的变更都必须走系统接口、审批和审计，不允许再靠数据库手改。',
    tags: ['audit', 'points', 'no_direct_db_change'],
    priorityLevel: 100,
    enabledFlag: true,
    sourceType: 'founder_seed',
    generalizationMode: 'global_reference',
    aiUsageMode: 'must_consider',
    normalizedPayload: { memoryKey: 'founder.no_direct_db_change', version: 's1-05-round-3h' },
  },
  {
    memoryType: 'language_style',
    scopeType: 'founder',
    scopeKey: 'founder',
    roleScope: FOUNDER_ROLE_SCOPE,
    sceneScope: ['global'],
    title: '创始人偏好的管理语气',
    summary: '先看长期、先看闭环、先看规则和边界，用管理助手口吻回答。',
    content:
      'AI 对创始人和管理视角的回答要更像管理助手：先讲闭环、再讲风险、再讲下一步，不要只给表面解释或空泛聊天。',
    tags: ['language_style', 'founder_style', 'management_assistant'],
    priorityLevel: 88,
    enabledFlag: true,
    sourceType: 'founder_seed',
    generalizationMode: 'role_only',
    aiUsageMode: 'cite_when_relevant',
    normalizedPayload: { memoryKey: 'founder.language_style', version: 's1-05-round-3h' },
  },
  {
    memoryType: 'role_playbook',
    scopeType: 'role',
    scopeKey: 'founder',
    roleScope: ['founder'],
    sceneScope: ['global'],
    title: '创始人岗位记忆',
    summary: '创始人优先关注闭环、长期影响、风险边界和是否可追溯。',
    content:
      '创始人最关心是否形成经营闭环、是否影响长期管理、是否可追溯，以及是否越过了规则边界。AI 应优先提示关键阻塞和组织动作，不要陷入局部细枝末节。',
    tags: ['role_playbook', 'founder', 'closed_loop'],
    priorityLevel: 90,
    enabledFlag: true,
    sourceType: 'role_seed',
    generalizationMode: 'role_only',
    aiUsageMode: 'must_consider',
    normalizedPayload: { memoryKey: 'role.founder.playbook', version: 's1-05-round-3h' },
  },
  {
    memoryType: 'role_playbook',
    scopeType: 'role',
    scopeKey: 'finance',
    roleScope: ['finance'],
    sceneScope: ['global'],
    title: '财务岗位记忆',
    summary: '财务优先看收款、支付、对账、台账漏记和账实一致。',
    content:
      '财务最关心支付事实、收款记录、台账漏记、资金对账和 B卡与现金的边界。AI 面向财务时应优先提醒“会不会污染统计、会不会影响对账准确性”。',
    tags: ['role_playbook', 'finance', 'reconciliation'],
    priorityLevel: 90,
    enabledFlag: true,
    sourceType: 'role_seed',
    generalizationMode: 'role_only',
    aiUsageMode: 'must_consider',
    normalizedPayload: { memoryKey: 'role.finance.playbook', version: 's1-05-round-3h' },
  },
  {
    memoryType: 'role_playbook',
    scopeType: 'role',
    scopeKey: 'admin',
    roleScope: ['admin'],
    sceneScope: ['global'],
    title: '管理员岗位记忆',
    summary: '管理员优先收口绑定、规则边界、异常数据和命令执行审计。',
    content:
      '管理员看到待处理数据时，优先处理缺客户绑定、台账漏记、测试数据、命令确认与执行审计，不得越权直接改高风险业务事实。',
    tags: ['role_playbook', 'admin', 'binding', 'audit'],
    priorityLevel: 88,
    enabledFlag: true,
    sourceType: 'role_seed',
    generalizationMode: 'role_only',
    aiUsageMode: 'must_consider',
    normalizedPayload: { memoryKey: 'role.admin.playbook', version: 's1-05-round-3h' },
  },
  {
    memoryType: 'role_playbook',
    scopeType: 'role',
    scopeKey: 'approver',
    roleScope: ['approver'],
    sceneScope: ['global'],
    title: '审批人岗位记忆',
    summary: '审批人优先看证据是否足够、适用范围是否清楚、是否需要保守处理。',
    content:
      '审批人面对人工裁决或待确认记录时，要先判断证据是否足够、适用范围是否清晰、会不会误推广。AI 对审批人应更强调“边界”和“保守建议”。',
    tags: ['role_playbook', 'approver', 'evidence'],
    priorityLevel: 86,
    enabledFlag: true,
    sourceType: 'role_seed',
    generalizationMode: 'role_only',
    aiUsageMode: 'must_consider',
    normalizedPayload: { memoryKey: 'role.approver.playbook', version: 's1-05-round-3h' },
  },
  {
    memoryType: 'role_playbook',
    scopeType: 'role',
    scopeKey: 'operator',
    roleScope: ['operator'],
    sceneScope: ['global'],
    title: '操作员岗位记忆',
    summary: '操作员优先做明确、低风险、可回填的动作，不越权做高风险确认。',
    content:
      '操作员更适合先补录、补台账、执行明确任务和回填信息，不应直接做客户绑定确认、工资判断或高风险业务执行。',
    tags: ['role_playbook', 'operator', 'safe_action'],
    priorityLevel: 80,
    enabledFlag: true,
    sourceType: 'role_seed',
    generalizationMode: 'role_only',
    aiUsageMode: 'must_consider',
    normalizedPayload: { memoryKey: 'role.operator.playbook', version: 's1-05-round-3h' },
  },
  {
    memoryType: 'role_playbook',
    scopeType: 'role',
    scopeKey: 'customer_service',
    roleScope: ['customer_service'],
    sceneScope: ['global'],
    title: '客服岗位记忆',
    summary: '客服优先看客户识别、服务补偿、沟通解释与后续跟进。',
    content:
      '客服看到问题记录时，优先确认客户身份、沟通语气和补偿边界。AI 面向客服时应更偏向解释清楚问题、建议补偿草稿和跟进动作。',
    tags: ['role_playbook', 'customer_service', 'service_compensation'],
    priorityLevel: 82,
    enabledFlag: true,
    sourceType: 'role_seed',
    generalizationMode: 'role_only',
    aiUsageMode: 'must_consider',
    normalizedPayload: { memoryKey: 'role.customer_service.playbook', version: 's1-05-round-3h' },
  },
  {
    memoryType: 'role_playbook',
    scopeType: 'role',
    scopeKey: 'store_manager',
    roleScope: ['store_manager'],
    sceneScope: ['global'],
    title: '门店负责人岗位记忆',
    summary: '门店负责人优先看现场履约、收款事实、客户关系和可执行动作。',
    content:
      '门店负责人更关注现场业务是否闭环、客户是否真实到店、收款是否成立、后续是否需要门店动作协同。AI 应给出更接地气的处理建议。',
    tags: ['role_playbook', 'store_manager', 'onsite_execution'],
    priorityLevel: 82,
    enabledFlag: true,
    sourceType: 'role_seed',
    generalizationMode: 'role_only',
    aiUsageMode: 'must_consider',
    normalizedPayload: { memoryKey: 'role.store_manager.playbook', version: 's1-05-round-3h' },
  },
];

export class AddAiMemoryEntries1710800031000 implements MigrationInterface {
  name = 'AddAiMemoryEntries1710800031000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`ai_memory_entries\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`memory_type\` varchar(64) NOT NULL,
        \`scope_type\` varchar(64) NOT NULL,
        \`scope_key\` varchar(191) NULL,
        \`role_scope\` json NULL,
        \`scene_scope\` json NULL,
        \`title\` varchar(191) NOT NULL,
        \`summary\` varchar(500) NOT NULL,
        \`content\` text NOT NULL,
        \`tags\` json NULL,
        \`priority_level\` int NOT NULL DEFAULT 50,
        \`enabled_flag\` tinyint NOT NULL DEFAULT 1,
        \`source_type\` varchar(64) NULL,
        \`generalization_mode\` varchar(64) NULL,
        \`ai_usage_mode\` varchar(64) NULL,
        \`created_by\` int NULL,
        \`created_by_name\` varchar(191) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`normalized_payload\` json NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_ai_memory_scope\` (\`scope_type\`, \`scope_key\`),
        KEY \`idx_ai_memory_type\` (\`memory_type\`, \`enabled_flag\`),
        KEY \`idx_ai_memory_priority\` (\`priority_level\`, \`enabled_flag\`),
        CONSTRAINT \`fk_ai_memory_created_by\`
          FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`)
          ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    for (const seed of MEMORY_SEEDS) {
      await queryRunner.query(
        `
          INSERT INTO \`ai_memory_entries\` (
            \`memory_type\`,
            \`scope_type\`,
            \`scope_key\`,
            \`role_scope\`,
            \`scene_scope\`,
            \`title\`,
            \`summary\`,
            \`content\`,
            \`tags\`,
            \`priority_level\`,
            \`enabled_flag\`,
            \`source_type\`,
            \`generalization_mode\`,
            \`ai_usage_mode\`,
            \`created_by\`,
            \`created_by_name\`,
            \`normalized_payload\`
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          seed.memoryType,
          seed.scopeType,
          seed.scopeKey,
          seed.roleScope ? JSON.stringify(seed.roleScope) : null,
          seed.sceneScope ? JSON.stringify(seed.sceneScope) : null,
          seed.title,
          seed.summary,
          seed.content,
          JSON.stringify(seed.tags),
          seed.priorityLevel,
          seed.enabledFlag ? 1 : 0,
          seed.sourceType,
          seed.generalizationMode,
          seed.aiUsageMode,
          null,
          null,
          JSON.stringify(seed.normalizedPayload),
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `ai_memory_entries`');
  }
}
