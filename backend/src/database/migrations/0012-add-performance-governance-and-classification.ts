import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddPerformanceGovernanceAndClassification1710800012000
  implements MigrationInterface
{
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createPerformanceRulesTable(queryRunner);
    await this.createPerformanceEventClassificationsTable(queryRunner);
    await this.extendPerformanceEventsTable(queryRunner);
    await this.seedDefaultPerformanceRules(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropTableIfExists(queryRunner, 'performance_event_classifications');
    await this.dropTableIfExists(queryRunner, 'performance_rules');
  }

  private async createPerformanceRulesTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('performance_rules')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'performance_rules',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'source_domain', type: 'varchar', length: '50' },
          { name: 'event_type', type: 'varchar', length: '100' },
          { name: 'rule_code', type: 'varchar', length: '100' },
          { name: 'rule_name', type: 'varchar', length: '100' },
          { name: 'classification_key', type: 'varchar', length: '100' },
          { name: 'include_in_performance', type: 'tinyint', width: 1, default: '1' },
          { name: 'default_weight', type: 'decimal', precision: 10, scale: 2, default: '1.00' },
          {
            name: 'default_coefficient',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: '1.00',
          },
          { name: 'requires_manual_confirmation', type: 'tinyint', width: 1, default: '0' },
          { name: 'is_active', type: 'tinyint', width: 1, default: '1' },
          { name: 'remark', type: 'varchar', length: '500', isNullable: true },
          { name: 'created_by', type: 'int', isNullable: true },
          { name: 'updated_by', type: 'int', isNullable: true },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createForeignKeys('performance_rules', [
      new TableForeignKey({
        name: 'fk_performance_rules_created_by',
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        name: 'fk_performance_rules_updated_by',
        columnNames: ['updated_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);

    await queryRunner.createIndices('performance_rules', [
      new TableIndex({
        name: 'uniq_performance_rules_rule_code',
        columnNames: ['rule_code'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'uniq_performance_rules_domain_event',
        columnNames: ['source_domain', 'event_type'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'idx_performance_rules_active_domain',
        columnNames: ['is_active', 'source_domain'],
      }),
    ]);
  }

  private async createPerformanceEventClassificationsTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('performance_event_classifications')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'performance_event_classifications',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'performance_event_id', type: 'int' },
          { name: 'performance_rule_id', type: 'int', isNullable: true },
          { name: 'classification_key', type: 'varchar', length: '100', isNullable: true },
          { name: 'include_in_performance', type: 'tinyint', width: 1, default: '0' },
          { name: 'weight', type: 'decimal', precision: 10, scale: 2, default: '1.00' },
          { name: 'coefficient', type: 'decimal', precision: 10, scale: 2, default: '1.00' },
          { name: 'requires_manual_confirmation', type: 'tinyint', width: 1, default: '0' },
          { name: 'rule_matched_flag', type: 'tinyint', width: 1, default: '0' },
          { name: 'normalized_payload', type: 'json' },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createForeignKeys('performance_event_classifications', [
      new TableForeignKey({
        name: 'fk_perf_event_classifications_event_id',
        columnNames: ['performance_event_id'],
        referencedTableName: 'performance_events',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'fk_perf_event_classifications_rule_id',
        columnNames: ['performance_rule_id'],
        referencedTableName: 'performance_rules',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);

    await queryRunner.createIndices('performance_event_classifications', [
      new TableIndex({
        name: 'uniq_perf_event_classifications_event_id',
        columnNames: ['performance_event_id'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'idx_perf_event_classifications_rule',
        columnNames: ['performance_rule_id', 'classification_key'],
      }),
    ]);
  }

  private async extendPerformanceEventsTable(queryRunner: QueryRunner) {
    await this.addColumnIfMissing(
      queryRunner,
      'performance_events',
      new TableColumn({
        name: 'ignored_flag',
        type: 'tinyint',
        width: 1,
        default: '0',
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'performance_events',
      new TableColumn({
        name: 'handled_by',
        type: 'int',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'performance_events',
      new TableColumn({
        name: 'handled_at',
        type: 'datetime',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'performance_events',
      new TableColumn({
        name: 'handling_action',
        type: 'varchar',
        length: '30',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'performance_events',
      new TableColumn({
        name: 'handling_remark',
        type: 'varchar',
        length: '500',
        isNullable: true,
      }),
    );

    if (!(await queryRunner.hasColumn('performance_events', 'handled_by'))) {
      return;
    }

    const handledByForeignKeyExists = (await queryRunner.getTable('performance_events'))?.foreignKeys.some(
      (item) => item.name === 'fk_performance_events_handled_by',
    );
    if (!handledByForeignKeyExists) {
      await queryRunner.createForeignKey(
        'performance_events',
        new TableForeignKey({
          name: 'fk_performance_events_handled_by',
          columnNames: ['handled_by'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      );
    }

    const table = await queryRunner.getTable('performance_events');
    const existingIndexNames = new Set((table?.indices ?? []).map((item) => item.name));

    if (!existingIndexNames.has('idx_performance_events_pending_state')) {
      await queryRunner.createIndex(
        'performance_events',
        new TableIndex({
          name: 'idx_performance_events_pending_state',
          columnNames: ['ignored_flag', 'confirmed_flag'],
        }),
      );
    }
    if (!existingIndexNames.has('idx_performance_events_handled_by')) {
      await queryRunner.createIndex(
        'performance_events',
        new TableIndex({
          name: 'idx_performance_events_handled_by',
          columnNames: ['handled_by', 'handled_at'],
        }),
      );
    }
    if (!existingIndexNames.has('idx_performance_events_handling_action')) {
      await queryRunner.createIndex(
        'performance_events',
        new TableIndex({
          name: 'idx_performance_events_handling_action',
          columnNames: ['handling_action'],
        }),
      );
    }
  }

  private async seedDefaultPerformanceRules(queryRunner: QueryRunner) {
    const rules = [
      ['work_orders', 'stark_work_order_completed', 'STARK_WORK_ORDER_COMPLETED', '工单完成事件', 'work_order_completion', 1, '1.00', '1.00', 0, 1, '默认计入工单绩效'],
      ['work_orders', 'stark_work_order_material_cost', 'STARK_WORK_ORDER_MATERIAL_COST', '工单材料成本事件', 'work_order_material_cost', 1, '1.00', '1.00', 0, 1, '默认计入工单材料成本绩效'],
      ['orders', 'abc_order_event', 'ABC_ORDER_EVENT', 'ABC 订单事件', 'abc_order', 1, '1.00', '1.00', 0, 1, 'ABC 订单域默认规则'],
      ['funds', 'abc_fund_event', 'ABC_FUND_EVENT', 'ABC 资金事件', 'abc_fund', 1, '1.00', '1.00', 0, 1, 'ABC 资金域默认规则'],
      ['funds', 'abc_fund_freeze', 'ABC_FUND_FREEZE', 'ABC 资金冻结事件', 'abc_fund_freeze', 1, '1.00', '1.00', 0, 1, 'ABC 资金冻结默认规则'],
      ['cards', 'abc_card_recharge_event', 'ABC_CARD_RECHARGE', 'ABC 卡充值事件', 'abc_card_recharge', 1, '1.00', '1.00', 0, 1, 'ABC 卡充值默认规则'],
      ['cards', 'abc_card_ledger_event', 'ABC_CARD_LEDGER', 'ABC 卡流水事件', 'abc_card_ledger', 1, '1.00', '1.00', 0, 1, 'ABC 卡流水默认规则'],
    ];

    for (const rule of rules) {
      await queryRunner.query(
        `
          INSERT INTO performance_rules (
            source_domain,
            event_type,
            rule_code,
            rule_name,
            classification_key,
            include_in_performance,
            default_weight,
            default_coefficient,
            requires_manual_confirmation,
            is_active,
            remark,
            created_at,
            updated_at
          )
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
          WHERE NOT EXISTS (
            SELECT 1
            FROM performance_rules pr
            WHERE pr.rule_code = ?
          )
        `,
        [...rule, rule[2]],
      );
    }
  }

  private async addColumnIfMissing(
    queryRunner: QueryRunner,
    tableName: string,
    column: TableColumn,
  ) {
    if (!(await queryRunner.hasColumn(tableName, column.name))) {
      await queryRunner.addColumn(tableName, column);
    }
  }

  private async dropTableIfExists(queryRunner: QueryRunner, tableName: string) {
    if (await queryRunner.hasTable(tableName)) {
      await queryRunner.dropTable(tableName);
    }
  }
}
