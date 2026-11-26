import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddBusinessStatTagsAndRewardEvents1710800013000 implements MigrationInterface {
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createBusinessStatTagsTable(queryRunner);
    await this.createRewardEventsTable(queryRunner);
    await this.createRewardEventRulesTable(queryRunner);
    await this.createBusinessStatSummariesTable(queryRunner);
    await this.seedRewardEventRules(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropTableIfExists(queryRunner, 'business_stat_summaries');
    await this.dropTableIfExists(queryRunner, 'reward_event_rules');
    await this.dropTableIfExists(queryRunner, 'reward_events');
    await this.dropTableIfExists(queryRunner, 'business_stat_tags');
  }

  private async createBusinessStatTagsTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('business_stat_tags')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'business_stat_tags',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'tag_code', type: 'varchar', length: '50' },
          { name: 'source_system', type: 'varchar', length: '50' },
          { name: 'source_table', type: 'varchar', length: '100' },
          { name: 'source_id', type: 'varchar', length: '100' },
          { name: 'source_order_no', type: 'varchar', length: '100', isNullable: true },
          { name: 'business_domain', type: 'varchar', length: '50' },
          { name: 'merchant_id', type: 'int', isNullable: true },
          { name: 'store_id', type: 'int', isNullable: true },
          { name: 'responsible_employee_id', type: 'int', isNullable: true },
          { name: 'customer_id', type: 'varchar', length: '100', isNullable: true },
          { name: 'vehicle_type', type: 'varchar', length: '50', isNullable: true },
          { name: 'insurance_flag', type: 'tinyint', width: 1, default: '0' },
          { name: 'occurred_at', type: 'datetime' },
          { name: 'period_key', type: 'varchar', length: '20' },
          { name: 'confirmed_flag', type: 'tinyint', width: 1, default: '0' },
          { name: 'remark', type: 'varchar', length: '500', isNullable: true },
          { name: 'normalized_payload', type: 'json' },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'business_stat_tags',
      new TableForeignKey({
        name: 'fk_business_stat_tags_employee_id',
        columnNames: ['responsible_employee_id'],
        referencedTableName: 'employees',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createIndices('business_stat_tags', [
      new TableIndex({
        name: 'uniq_business_stat_tags_source_tag',
        columnNames: ['source_system', 'source_table', 'source_id', 'tag_code', 'business_domain'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'idx_business_stat_tags_period_tag',
        columnNames: ['period_key', 'tag_code'],
      }),
      new TableIndex({
        name: 'idx_business_stat_tags_merchant_occurred',
        columnNames: ['merchant_id', 'occurred_at'],
      }),
      new TableIndex({
        name: 'idx_business_stat_tags_employee_occurred',
        columnNames: ['responsible_employee_id', 'occurred_at'],
      }),
    ]);
  }

  private async createRewardEventsTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('reward_events')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'reward_events',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'event_type', type: 'varchar', length: '100' },
          { name: 'source_system', type: 'varchar', length: '50' },
          { name: 'source_table', type: 'varchar', length: '100' },
          { name: 'source_id', type: 'varchar', length: '100' },
          { name: 'source_order_no', type: 'varchar', length: '100', isNullable: true },
          { name: 'business_domain', type: 'varchar', length: '50' },
          { name: 'merchant_id', type: 'int', isNullable: true },
          { name: 'store_id', type: 'int', isNullable: true },
          { name: 'responsible_employee_id', type: 'int', isNullable: true },
          { name: 'customer_id', type: 'varchar', length: '100', isNullable: true },
          { name: 'vehicle_type', type: 'varchar', length: '50', isNullable: true },
          { name: 'insurance_flag', type: 'tinyint', width: 1, default: '0' },
          { name: 'amount_standard', type: 'decimal', precision: 18, scale: 2, isNullable: true },
          { name: 'quantity_standard', type: 'decimal', precision: 18, scale: 2, isNullable: true },
          { name: 'occurred_at', type: 'datetime' },
          { name: 'period_key', type: 'varchar', length: '20' },
          { name: 'confirmed_flag', type: 'tinyint', width: 1, default: '0' },
          { name: 'ignored_flag', type: 'tinyint', width: 1, default: '0' },
          { name: 'handled_by', type: 'int', isNullable: true },
          { name: 'handled_at', type: 'datetime', isNullable: true },
          { name: 'handling_action', type: 'varchar', length: '30', isNullable: true },
          { name: 'remark', type: 'varchar', length: '500', isNullable: true },
          { name: 'normalized_payload', type: 'json' },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createForeignKeys('reward_events', [
      new TableForeignKey({
        name: 'fk_reward_events_employee_id',
        columnNames: ['responsible_employee_id'],
        referencedTableName: 'employees',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        name: 'fk_reward_events_handled_by',
        columnNames: ['handled_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);

    await queryRunner.createIndices('reward_events', [
      new TableIndex({
        name: 'uniq_reward_events_source_event',
        columnNames: ['source_system', 'source_table', 'source_id', 'event_type'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'idx_reward_events_period_type',
        columnNames: ['period_key', 'event_type'],
      }),
      new TableIndex({
        name: 'idx_reward_events_employee_occurred',
        columnNames: ['responsible_employee_id', 'occurred_at'],
      }),
      new TableIndex({
        name: 'idx_reward_events_pending_state',
        columnNames: ['confirmed_flag', 'ignored_flag'],
      }),
    ]);
  }

  private async createRewardEventRulesTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('reward_event_rules')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'reward_event_rules',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'rule_code', type: 'varchar', length: '100' },
          { name: 'rule_name', type: 'varchar', length: '100' },
          { name: 'event_type', type: 'varchar', length: '100' },
          { name: 'business_domain', type: 'varchar', length: '50' },
          { name: 'required_tag_code', type: 'varchar', length: '50', isNullable: true },
          { name: 'vehicle_type', type: 'varchar', length: '50', isNullable: true },
          { name: 'insurance_flag', type: 'tinyint', width: 1, isNullable: true },
          { name: 'reward_enabled', type: 'tinyint', width: 1, default: '1' },
          { name: 'requires_manual_confirmation', type: 'tinyint', width: 1, default: '0' },
          { name: 'default_weight', type: 'decimal', precision: 10, scale: 2, default: '1.00' },
          { name: 'default_coefficient', type: 'decimal', precision: 10, scale: 2, default: '1.00' },
          { name: 'is_active', type: 'tinyint', width: 1, default: '1' },
          { name: 'remark', type: 'varchar', length: '500', isNullable: true },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createIndices('reward_event_rules', [
      new TableIndex({
        name: 'uniq_reward_event_rules_rule_code',
        columnNames: ['rule_code'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'idx_reward_event_rules_type_active',
        columnNames: ['event_type', 'is_active'],
      }),
    ]);
  }

  private async createBusinessStatSummariesTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('business_stat_summaries')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'business_stat_summaries',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'summary_key', type: 'varchar', length: '255' },
          { name: 'summary_domain', type: 'varchar', length: '50' },
          { name: 'period_key', type: 'varchar', length: '20' },
          { name: 'merchant_id', type: 'int', isNullable: true },
          { name: 'store_id', type: 'int', isNullable: true },
          { name: 'responsible_employee_id', type: 'int', isNullable: true },
          { name: 'customer_id', type: 'varchar', length: '100', isNullable: true },
          { name: 'tag_count', type: 'int', default: '0' },
          { name: 'reward_event_count', type: 'int', default: '0' },
          { name: 'confirmed_reward_event_count', type: 'int', default: '0' },
          { name: 'pending_reward_event_count', type: 'int', default: '0' },
          { name: 'amount_total', type: 'decimal', precision: 18, scale: 2, default: '0.00' },
          { name: 'quantity_total', type: 'decimal', precision: 18, scale: 2, default: '0.00' },
          { name: 'confirmed_flag', type: 'tinyint', width: 1, default: '0' },
          { name: 'confirmed_by', type: 'int', isNullable: true },
          { name: 'confirmed_at', type: 'datetime', isNullable: true },
          { name: 'remark', type: 'varchar', length: '500', isNullable: true },
          { name: 'normalized_payload', type: 'json' },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createForeignKeys('business_stat_summaries', [
      new TableForeignKey({
        name: 'fk_business_stat_summaries_employee_id',
        columnNames: ['responsible_employee_id'],
        referencedTableName: 'employees',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        name: 'fk_business_stat_summaries_confirmed_by',
        columnNames: ['confirmed_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);

    await queryRunner.createIndices('business_stat_summaries', [
      new TableIndex({
        name: 'uniq_business_stat_summaries_key',
        columnNames: ['summary_key'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'idx_business_stat_summaries_period_domain',
        columnNames: ['period_key', 'summary_domain'],
      }),
      new TableIndex({
        name: 'idx_business_stat_summaries_employee_period',
        columnNames: ['responsible_employee_id', 'period_key'],
      }),
    ]);
  }

  private async seedRewardEventRules(queryRunner: QueryRunner) {
    const rules = [
      [
        'A_ORDER_COMPLETED',
        'A端订单完成',
        'a_order_completed',
        'stark_work_order',
        null,
        null,
        0,
        1,
        0,
        '1.00',
        '1.00',
        1,
        '已完成工单或订单可计入基础奖励资格',
      ],
      [
        'A_ORDER_COMPLETED_ABC_ORDER',
        'ABC订单完成',
        'a_order_completed',
        'abc_order',
        null,
        null,
        0,
        1,
        0,
        '1.00',
        '1.00',
        1,
        'ABC 已完成或已支付订单可计入基础奖励资格',
      ],
      [
        'COMBO_SUCCESS',
        'A+C 组合成功',
        'combo_success',
        'abc_order',
        'abc_overall',
        null,
        0,
        1,
        1,
        '1.00',
        '1.20',
        1,
        '仅对显式组合成功记录生效',
      ],
      [
        'CARD_ISSUE',
        '卡发放事件',
        'card_issue',
        'abc_card',
        'abc_overall',
        null,
        0,
        1,
        0,
        '1.00',
        '1.00',
        1,
        '卡账户建立或发卡成功事件',
      ],
      [
        'PUBLIC_VEHICLE_COMPLETED',
        '公车业务完成',
        'public_vehicle_completed',
        'stark_work_order',
        'public_vehicle',
        'public_vehicle',
        0,
        1,
        1,
        '1.00',
        '1.10',
        1,
        '公车业务完成后进入待确认奖励池',
      ],
      [
        'PRIVATE_VEHICLE_REPURCHASE',
        '私家车复购',
        'private_vehicle_repurchase',
        'abc_order',
        'private_vehicle',
        'private_vehicle',
        0,
        1,
        1,
        '1.00',
        '1.15',
        1,
        '同客户同商户重复购买的私家车事件',
      ],
      [
        'INSURANCE_CONVERSION',
        '保险转化',
        'insurance_conversion',
        'stark_work_order',
        'insurance_claim',
        null,
        1,
        1,
        1,
        '1.00',
        '1.30',
        1,
        '保险理赔相关转化事件',
      ],
    ];

    for (const rule of rules) {
      await queryRunner.query(
        `
          INSERT INTO reward_event_rules (
            rule_code,
            rule_name,
            event_type,
            business_domain,
            required_tag_code,
            vehicle_type,
            insurance_flag,
            reward_enabled,
            requires_manual_confirmation,
            default_weight,
            default_coefficient,
            is_active,
            remark,
            created_at,
            updated_at
          )
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
          WHERE NOT EXISTS (
            SELECT 1
            FROM reward_event_rules rer
            WHERE rer.rule_code = ?
          )
        `,
        [...rule, rule[0]],
      );
    }
  }

  private async dropTableIfExists(queryRunner: QueryRunner, tableName: string) {
    if (await queryRunner.hasTable(tableName)) {
      await queryRunner.dropTable(tableName);
    }
  }
}
