import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddControlledExecutionLayer1710800021000 implements MigrationInterface {
  name = 'AddControlledExecutionLayer1710800021000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('execution_playbooks'))) {
      await queryRunner.createTable(
        new Table({
          name: 'execution_playbooks',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'playbook_code', type: 'varchar', length: '100' },
            { name: 'playbook_name', type: 'varchar', length: '120' },
            { name: 'scenario_code', type: 'varchar', length: '50' },
            { name: 'scenario_name', type: 'varchar', length: '80' },
            { name: 'recommendation_type', type: 'varchar', length: '50' },
            { name: 'target_subject_type', type: 'varchar', length: '30', isNullable: true },
            { name: 'business_domain', type: 'varchar', length: '50', isNullable: true },
            { name: 'merchant_id', type: 'int', isNullable: true },
            { name: 'recommendation_rule_id', type: 'int', isNullable: true },
            { name: 'default_script_template_id', type: 'int', isNullable: true },
            { name: 'execution_channel', type: 'varchar', length: '30', default: "'manual_followup'" },
            { name: 'description', type: 'text', isNullable: true },
            { name: 'is_active', type: 'tinyint', width: 1, default: '1' },
            { name: 'normalized_payload', type: 'json', isNullable: true },
            { name: 'created_by', type: 'int', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );
      await queryRunner.createIndices('execution_playbooks', [
        new TableIndex({
          name: 'uniq_execution_playbooks_code',
          columnNames: ['playbook_code'],
          isUnique: true,
        }),
        new TableIndex({
          name: 'idx_execution_playbooks_scenario_active',
          columnNames: ['scenario_code', 'is_active'],
        }),
      ]);
    }

    if (!(await queryRunner.hasTable('execution_tasks'))) {
      await queryRunner.createTable(
        new Table({
          name: 'execution_tasks',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'task_code', type: 'varchar', length: '100' },
            { name: 'task_name', type: 'varchar', length: '120' },
            { name: 'playbook_id', type: 'int' },
            { name: 'scenario_code', type: 'varchar', length: '50' },
            { name: 'scenario_name', type: 'varchar', length: '80' },
            { name: 'recommendation_type', type: 'varchar', length: '50' },
            { name: 'status', type: 'varchar', length: '20', default: "'draft'" },
            { name: 'assigned_to', type: 'int', isNullable: true },
            { name: 'merchant_id', type: 'int', isNullable: true },
            { name: 'target_count', type: 'int', default: '0' },
            { name: 'confirmed_by', type: 'int', isNullable: true },
            { name: 'confirmed_at', type: 'datetime', isNullable: true },
            { name: 'closed_by', type: 'int', isNullable: true },
            { name: 'closed_at', type: 'datetime', isNullable: true },
            { name: 'remark', type: 'varchar', length: '500', isNullable: true },
            { name: 'normalized_payload', type: 'json', isNullable: true },
            { name: 'created_by', type: 'int', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );
      await queryRunner.createIndices('execution_tasks', [
        new TableIndex({
          name: 'uniq_execution_tasks_code',
          columnNames: ['task_code'],
          isUnique: true,
        }),
        new TableIndex({
          name: 'idx_execution_tasks_status_assigned',
          columnNames: ['status', 'assigned_to'],
        }),
      ]);
      await queryRunner.createForeignKey(
        'execution_tasks',
        new TableForeignKey({
          name: 'fk_execution_tasks_playbook',
          columnNames: ['playbook_id'],
          referencedTableName: 'execution_playbooks',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    if (!(await queryRunner.hasTable('execution_task_items'))) {
      await queryRunner.createTable(
        new Table({
          name: 'execution_task_items',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'task_id', type: 'int' },
            { name: 'recommendation_id', type: 'int', isNullable: true },
            { name: 'subject_type', type: 'varchar', length: '30' },
            { name: 'subject_id', type: 'int' },
            { name: 'merchant_id', type: 'int', isNullable: true },
            { name: 'employee_id', type: 'int', isNullable: true },
            { name: 'business_type', type: 'varchar', length: '50', isNullable: true },
            { name: 'business_id', type: 'varchar', length: '100', isNullable: true },
            { name: 'script_template_id', type: 'int', isNullable: true },
            { name: 'evidence_status', type: 'varchar', length: '20', isNullable: true },
            { name: 'confidence_score', type: 'decimal', precision: 5, scale: 4, default: "'0.0000'" },
            { name: 'matched_rule', type: 'varchar', length: '100', isNullable: true },
            { name: 'status', type: 'varchar', length: '30', default: "'pending_confirmation'" },
            { name: 'assigned_to', type: 'int', isNullable: true },
            { name: 'confirmed_by', type: 'int', isNullable: true },
            { name: 'confirmed_at', type: 'datetime', isNullable: true },
            { name: 'skipped_by', type: 'int', isNullable: true },
            { name: 'skipped_at', type: 'datetime', isNullable: true },
            { name: 'skip_reason', type: 'varchar', length: '255', isNullable: true },
            { name: 'normalized_payload', type: 'json', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );
      await queryRunner.createIndices('execution_task_items', [
        new TableIndex({
          name: 'idx_execution_task_items_task_status',
          columnNames: ['task_id', 'status'],
        }),
        new TableIndex({
          name: 'uniq_execution_task_items_task_recommendation',
          columnNames: ['task_id', 'recommendation_id', 'subject_type', 'subject_id'],
          isUnique: true,
        }),
      ]);
      await queryRunner.createForeignKeys('execution_task_items', [
        new TableForeignKey({
          name: 'fk_execution_task_items_task',
          columnNames: ['task_id'],
          referencedTableName: 'execution_tasks',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
        new TableForeignKey({
          name: 'fk_execution_task_items_recommendation',
          columnNames: ['recommendation_id'],
          referencedTableName: 'ai_recommendations',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      ]);
    }

    if (!(await queryRunner.hasTable('execution_results'))) {
      await queryRunner.createTable(
        new Table({
          name: 'execution_results',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'task_id', type: 'int' },
            { name: 'task_item_id', type: 'int' },
            { name: 'recommendation_id', type: 'int', isNullable: true },
            { name: 'followup_feedback_id', type: 'int', isNullable: true },
            { name: 'subject_type', type: 'varchar', length: '30' },
            { name: 'subject_id', type: 'int' },
            { name: 'merchant_id', type: 'int', isNullable: true },
            { name: 'employee_id', type: 'int', isNullable: true },
            { name: 'business_type', type: 'varchar', length: '50', isNullable: true },
            { name: 'business_id', type: 'varchar', length: '100', isNullable: true },
            { name: 'script_template_id', type: 'int', isNullable: true },
            { name: 'executed_at', type: 'datetime' },
            { name: 'executed_by', type: 'int' },
            { name: 'replied_flag', type: 'tinyint', width: 1, default: '0' },
            { name: 'converted_flag', type: 'tinyint', width: 1, default: '0' },
            { name: 'non_conversion_reason', type: 'varchar', length: '255', isNullable: true },
            { name: 'result_status', type: 'varchar', length: '20', default: "'recorded'" },
            { name: 'remark', type: 'varchar', length: '500', isNullable: true },
            { name: 'normalized_payload', type: 'json', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );
      await queryRunner.createIndices('execution_results', [
        new TableIndex({
          name: 'uniq_execution_results_task_item',
          columnNames: ['task_item_id'],
          isUnique: true,
        }),
        new TableIndex({
          name: 'idx_execution_results_task_executed',
          columnNames: ['task_id', 'executed_at'],
        }),
      ]);
      await queryRunner.createForeignKeys('execution_results', [
        new TableForeignKey({
          name: 'fk_execution_results_task',
          columnNames: ['task_id'],
          referencedTableName: 'execution_tasks',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
        new TableForeignKey({
          name: 'fk_execution_results_task_item',
          columnNames: ['task_item_id'],
          referencedTableName: 'execution_task_items',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
        new TableForeignKey({
          name: 'fk_execution_results_followup_feedback',
          columnNames: ['followup_feedback_id'],
          referencedTableName: 'followup_feedback',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      ]);
    }

    await queryRunner.query(`
      INSERT INTO execution_playbooks (
        playbook_code,
        playbook_name,
        scenario_code,
        scenario_name,
        recommendation_type,
        target_subject_type,
        business_domain,
        merchant_id,
        execution_channel,
        description,
        is_active,
        normalized_payload
      )
      SELECT
        'wash-card-promo-v0',
        'A端洗车卡宣传执行方案',
        'a_wash_card_promo',
        'A端洗车卡宣传',
        'script_recommendation',
        'customer',
        'abc_overall',
        7,
        'manual_followup',
        '面向 A 端洗车卡宣传的受控人工执行方案',
        1,
        JSON_OBJECT('businessType', 'goods_group_order', 'merchantId', 7, 'goodsGroupId', 47)
      FROM DUAL
      WHERE NOT EXISTS (
        SELECT 1 FROM execution_playbooks WHERE playbook_code = 'wash-card-promo-v0'
      )
    `);

    await queryRunner.query(`
      INSERT INTO execution_playbooks (
        playbook_code,
        playbook_name,
        scenario_code,
        scenario_name,
        recommendation_type,
        target_subject_type,
        business_domain,
        execution_channel,
        description,
        is_active,
        normalized_payload
      )
      SELECT
        'employee-benefit-notice-v0',
        '员工福利说明执行方案',
        'employee_benefit_notice',
        '员工福利说明',
        'benefit_reminder_recommendation',
        'employee',
        'employee_benefit',
        'manual_followup',
        '面向员工福利到账、临期与规则说明的受控人工执行方案',
        1,
        JSON_OBJECT('businessType', 'employee_benefit_notification')
      FROM DUAL
      WHERE NOT EXISTS (
        SELECT 1 FROM execution_playbooks WHERE playbook_code = 'employee-benefit-notice-v0'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('execution_results')) {
      await queryRunner.dropTable('execution_results');
    }
    if (await queryRunner.hasTable('execution_task_items')) {
      await queryRunner.dropTable('execution_task_items');
    }
    if (await queryRunner.hasTable('execution_tasks')) {
      await queryRunner.dropTable('execution_tasks');
    }
    if (await queryRunner.hasTable('execution_playbooks')) {
      await queryRunner.dropTable('execution_playbooks');
    }
  }
}
