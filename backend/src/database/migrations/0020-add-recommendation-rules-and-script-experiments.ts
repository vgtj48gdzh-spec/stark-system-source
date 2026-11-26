import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddRecommendationRulesAndScriptExperiments1710800020000 implements MigrationInterface {
  name = 'AddRecommendationRulesAndScriptExperiments1710800020000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('recommendation_rules'))) {
      await queryRunner.createTable(
        new Table({
          name: 'recommendation_rules',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'rule_code', type: 'varchar', length: '100' },
            { name: 'rule_name', type: 'varchar', length: '120' },
            { name: 'recommendation_type', type: 'varchar', length: '50' },
            { name: 'subject_type', type: 'varchar', length: '30', isNullable: true },
            { name: 'business_domain', type: 'varchar', length: '50', isNullable: true },
            { name: 'trigger_memory_type', type: 'varchar', length: '50', isNullable: true },
            { name: 'trigger_interaction_type', type: 'varchar', length: '50', isNullable: true },
            { name: 'evidence_status', type: 'varchar', length: '20' },
            { name: 'confidence_score', type: 'decimal', precision: 5, scale: 4, default: "'0.0000'" },
            { name: 'rule_strength', type: 'varchar', length: '20', default: "'weak'" },
            { name: 'match_conditions', type: 'json', isNullable: true },
            { name: 'recommendation_template', type: 'text', isNullable: true },
            { name: 'is_active', type: 'tinyint', width: 1, default: '1' },
            { name: 'remark', type: 'varchar', length: '500', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );

      await queryRunner.createIndices('recommendation_rules', [
        new TableIndex({
          name: 'uniq_recommendation_rules_code',
          columnNames: ['rule_code'],
          isUnique: true,
        }),
        new TableIndex({
          name: 'idx_recommendation_rules_type_active',
          columnNames: ['recommendation_type', 'is_active'],
        }),
      ]);
    }

    if (!(await queryRunner.hasTable('script_templates'))) {
      await queryRunner.createTable(
        new Table({
          name: 'script_templates',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'template_code', type: 'varchar', length: '100' },
            { name: 'template_name', type: 'varchar', length: '120' },
            { name: 'template_group', type: 'varchar', length: '30' },
            { name: 'recommendation_type', type: 'varchar', length: '50', isNullable: true },
            { name: 'channel', type: 'varchar', length: '30', isNullable: true },
            { name: 'opening_text', type: 'varchar', length: '255', isNullable: true },
            { name: 'script_content', type: 'text' },
            { name: 'closing_text', type: 'varchar', length: '255', isNullable: true },
            { name: 'is_active', type: 'tinyint', width: 1, default: '1' },
            { name: 'remark', type: 'varchar', length: '500', isNullable: true },
            { name: 'normalized_payload', type: 'json', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );

      await queryRunner.createIndices('script_templates', [
        new TableIndex({
          name: 'uniq_script_templates_code',
          columnNames: ['template_code'],
          isUnique: true,
        }),
        new TableIndex({
          name: 'idx_script_templates_group_active',
          columnNames: ['template_group', 'is_active'],
        }),
      ]);
    }

    if (!(await queryRunner.hasTable('script_experiments'))) {
      await queryRunner.createTable(
        new Table({
          name: 'script_experiments',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'experiment_code', type: 'varchar', length: '100' },
            { name: 'experiment_name', type: 'varchar', length: '120' },
            { name: 'experiment_type', type: 'varchar', length: '50' },
            { name: 'recommendation_type', type: 'varchar', length: '50', isNullable: true },
            { name: 'subject_type', type: 'varchar', length: '30', isNullable: true },
            { name: 'business_domain', type: 'varchar', length: '50', isNullable: true },
            { name: 'status', type: 'varchar', length: '20' },
            { name: 'hypothesis', type: 'text', isNullable: true },
            { name: 'start_at', type: 'datetime', isNullable: true },
            { name: 'end_at', type: 'datetime', isNullable: true },
            { name: 'template_count', type: 'int', default: '0' },
            { name: 'remark', type: 'varchar', length: '500', isNullable: true },
            { name: 'normalized_payload', type: 'json', isNullable: true },
            { name: 'created_by', type: 'int', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );

      await queryRunner.createIndices('script_experiments', [
        new TableIndex({
          name: 'uniq_script_experiments_code',
          columnNames: ['experiment_code'],
          isUnique: true,
        }),
        new TableIndex({
          name: 'idx_script_experiments_status',
          columnNames: ['status', 'experiment_type'],
        }),
      ]);
    }

    if (!(await queryRunner.hasTable('script_experiment_results'))) {
      await queryRunner.createTable(
        new Table({
          name: 'script_experiment_results',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'script_experiment_id', type: 'int' },
            { name: 'script_template_id', type: 'int' },
            { name: 'sample_count', type: 'int', default: '0' },
            { name: 'followed_up_count', type: 'int', default: '0' },
            { name: 'replied_count', type: 'int', default: '0' },
            { name: 'converted_count', type: 'int', default: '0' },
            { name: 'ignored_count', type: 'int', default: '0' },
            { name: 'reply_rate', type: 'decimal', precision: 7, scale: 4, default: "'0.0000'" },
            { name: 'conversion_rate', type: 'decimal', precision: 7, scale: 4, default: "'0.0000'" },
            { name: 'summary_json', type: 'json', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );

      await queryRunner.createIndices('script_experiment_results', [
        new TableIndex({
          name: 'uniq_script_experiment_results_variant',
          columnNames: ['script_experiment_id', 'script_template_id'],
          isUnique: true,
        }),
      ]);

      await queryRunner.createForeignKeys('script_experiment_results', [
        new TableForeignKey({
          name: 'fk_script_experiment_results_experiment',
          columnNames: ['script_experiment_id'],
          referencedTableName: 'script_experiments',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
        new TableForeignKey({
          name: 'fk_script_experiment_results_template',
          columnNames: ['script_template_id'],
          referencedTableName: 'script_templates',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      ]);
    }

    if (!(await queryRunner.hasTable('followup_feedback'))) {
      await queryRunner.createTable(
        new Table({
          name: 'followup_feedback',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'recommendation_id', type: 'int', isNullable: true },
            { name: 'recommendation_rule_id', type: 'int', isNullable: true },
            { name: 'script_template_id', type: 'int', isNullable: true },
            { name: 'script_experiment_id', type: 'int', isNullable: true },
            { name: 'script_experiment_result_id', type: 'int', isNullable: true },
            { name: 'subject_type', type: 'varchar', length: '30' },
            { name: 'subject_id', type: 'int' },
            { name: 'merchant_id', type: 'int', isNullable: true },
            { name: 'employee_id', type: 'int', isNullable: true },
            { name: 'business_type', type: 'varchar', length: '50', isNullable: true },
            { name: 'business_id', type: 'varchar', length: '100', isNullable: true },
            { name: 'followed_up_flag', type: 'tinyint', width: 1, default: '0' },
            { name: 'followup_at', type: 'datetime', isNullable: true },
            { name: 'customer_replied_flag', type: 'tinyint', width: 1, default: '0' },
            { name: 'converted_flag', type: 'tinyint', width: 1, default: '0' },
            { name: 'non_conversion_reason', type: 'varchar', length: '255', isNullable: true },
            { name: 'employee_remark', type: 'varchar', length: '500', isNullable: true },
            { name: 'feedback_status', type: 'varchar', length: '20', default: "'recorded'" },
            { name: 'normalized_payload', type: 'json', isNullable: true },
            { name: 'created_by', type: 'int', isNullable: true },
            { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
          ],
        }),
      );

      await queryRunner.createIndices('followup_feedback', [
        new TableIndex({
          name: 'idx_followup_feedback_subject',
          columnNames: ['subject_type', 'subject_id'],
        }),
        new TableIndex({
          name: 'idx_followup_feedback_experiment',
          columnNames: ['script_experiment_id', 'script_template_id'],
        }),
      ]);
    }

    await this.ensureColumn(
      queryRunner,
      'ai_recommendations',
      new TableColumn({
        name: 'recommendation_rule_id',
        type: 'int',
        isNullable: true,
      }),
    );
    await this.ensureColumn(
      queryRunner,
      'ai_recommendations',
      new TableColumn({
        name: 'matched_memory_entry_id',
        type: 'int',
        isNullable: true,
      }),
    );
    await this.ensureColumn(
      queryRunner,
      'ai_recommendations',
      new TableColumn({
        name: 'matched_interaction_id',
        type: 'int',
        isNullable: true,
      }),
    );
    await this.ensureColumn(
      queryRunner,
      'ai_recommendations',
      new TableColumn({
        name: 'rule_strength',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
    );

    await this.insertSeedRules(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropColumnIfExists(queryRunner, 'ai_recommendations', 'rule_strength');
    await this.dropColumnIfExists(queryRunner, 'ai_recommendations', 'matched_interaction_id');
    await this.dropColumnIfExists(queryRunner, 'ai_recommendations', 'matched_memory_entry_id');
    await this.dropColumnIfExists(queryRunner, 'ai_recommendations', 'recommendation_rule_id');

    if (await queryRunner.hasTable('followup_feedback')) {
      await queryRunner.dropTable('followup_feedback');
    }
    if (await queryRunner.hasTable('script_experiment_results')) {
      await queryRunner.dropTable('script_experiment_results');
    }
    if (await queryRunner.hasTable('script_experiments')) {
      await queryRunner.dropTable('script_experiments');
    }
    if (await queryRunner.hasTable('script_templates')) {
      await queryRunner.dropTable('script_templates');
    }
    if (await queryRunner.hasTable('recommendation_rules')) {
      await queryRunner.dropTable('recommendation_rules');
    }
  }

  private async insertSeedRules(queryRunner: QueryRunner) {
    const seeds = [
      {
        ruleCode: 'content_recommendation_basic',
        ruleName: '内容推荐-基础建议',
        recommendationType: 'content_recommendation',
        businessDomain: 'engagement',
        evidenceStatus: 'inferred',
        confidenceScore: '0.7000',
        ruleStrength: 'weak',
        recommendationTemplate: '建议围绕当前高互动主题继续补充内容样本，并观察互动变化。',
      },
      {
        ruleCode: 'followup_recommendation_basic',
        ruleName: '跟进建议-基础建议',
        recommendationType: 'followup_recommendation',
        businessDomain: 'engagement',
        evidenceStatus: 'inferred',
        confidenceScore: '0.7800',
        ruleStrength: 'strong',
        recommendationTemplate: '建议尽快人工跟进线索，确认客户需求、预算和时间窗口。',
      },
      {
        ruleCode: 'script_recommendation_basic',
        ruleName: '话术建议-基础建议',
        recommendationType: 'script_recommendation',
        businessDomain: 'engagement',
        evidenceStatus: 'inferred',
        confidenceScore: '0.7600',
        ruleStrength: 'strong',
        recommendationTemplate: '建议根据客户顾虑切换价格型、体验型或福利型话术进行跟进。',
      },
      {
        ruleCode: 'benefit_reminder_recommendation_basic',
        ruleName: '福利提醒建议-基础建议',
        recommendationType: 'benefit_reminder_recommendation',
        businessDomain: 'employee_benefit',
        evidenceStatus: 'confirmed',
        confidenceScore: '0.8800',
        ruleStrength: 'strong',
        recommendationTemplate: '建议提醒员工查看福利到账、余额变化与临期金额。',
      },
      {
        ruleCode: 'customer_interest_recommendation_basic',
        ruleName: '客户兴趣建议-基础建议',
        recommendationType: 'customer_interest_recommendation',
        businessDomain: 'engagement',
        evidenceStatus: 'inferred',
        confidenceScore: '0.7200',
        ruleStrength: 'weak',
        recommendationTemplate: '建议结合客户近期互动与历史记忆，优先推荐最相关业务内容。',
      },
    ];

    for (const seed of seeds) {
      const existing = await queryRunner.query(
        'SELECT id FROM recommendation_rules WHERE rule_code = ? LIMIT 1',
        [seed.ruleCode],
      );
      if (existing.length > 0) {
        continue;
      }
      await queryRunner.query(
        `
          INSERT INTO recommendation_rules
          (rule_code, rule_name, recommendation_type, business_domain, evidence_status, confidence_score, rule_strength, recommendation_template, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        `,
        [
          seed.ruleCode,
          seed.ruleName,
          seed.recommendationType,
          seed.businessDomain,
          seed.evidenceStatus,
          seed.confidenceScore,
          seed.ruleStrength,
          seed.recommendationTemplate,
        ],
      );
    }
  }

  private async ensureColumn(queryRunner: QueryRunner, tableName: string, column: TableColumn) {
    if (!(await queryRunner.hasTable(tableName))) {
      return;
    }
    if (!(await queryRunner.hasColumn(tableName, column.name))) {
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
