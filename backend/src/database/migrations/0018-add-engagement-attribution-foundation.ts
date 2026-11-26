import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEngagementAttributionFoundation1710800018000 implements MigrationInterface {
  name = 'AddEngagementAttributionFoundation1710800018000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lead_candidates (
        id INT NOT NULL AUTO_INCREMENT,
        interaction_id INT NOT NULL,
        platform VARCHAR(50) NOT NULL,
        account_id VARCHAR(100) NOT NULL,
        content_id VARCHAR(100) NULL,
        campaign_id VARCHAR(100) NULL,
        candidate_type VARCHAR(30) NOT NULL DEFAULT 'unknown',
        candidate_ref VARCHAR(100) NULL,
        merchant_id INT NULL,
        employee_id INT NULL,
        linked_subject_type VARCHAR(30) NULL,
        linked_subject_id INT NULL,
        linked_business_type VARCHAR(50) NULL,
        linked_business_id VARCHAR(100) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        evidence_status VARCHAR(20) NOT NULL DEFAULT 'uncertain',
        confidence_score DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
        rule_code VARCHAR(50) NULL,
        matched_fields JSON NOT NULL,
        remark VARCHAR(500) NULL,
        normalized_payload JSON NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_lead_candidates_interaction (interaction_id),
        KEY idx_lead_candidates_type_status (candidate_type, status),
        KEY idx_lead_candidates_merchant (merchant_id, created_at),
        KEY idx_lead_candidates_employee (employee_id, created_at),
        CONSTRAINT fk_lead_candidates_interaction_id FOREIGN KEY (interaction_id) REFERENCES platform_interactions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS attribution_rules (
        id INT NOT NULL AUTO_INCREMENT,
        rule_code VARCHAR(50) NOT NULL,
        rule_name VARCHAR(100) NOT NULL,
        rule_type VARCHAR(30) NOT NULL,
        match_field VARCHAR(50) NOT NULL,
        match_pattern VARCHAR(255) NULL,
        target_type VARCHAR(30) NOT NULL,
        target_business_type VARCHAR(50) NULL,
        confidence_score DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
        evidence_status VARCHAR(20) NOT NULL DEFAULT 'inferred',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        remark VARCHAR(500) NULL,
        normalized_payload JSON NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_attribution_rules_rule_code (rule_code),
        KEY idx_attribution_rules_type_active (rule_type, is_active),
        KEY idx_attribution_rules_target (target_type, target_business_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS attribution_results (
        id INT NOT NULL AUTO_INCREMENT,
        interaction_id INT NOT NULL,
        lead_candidate_id INT NULL,
        attributed_subject_type VARCHAR(30) NULL,
        attributed_subject_id INT NULL,
        merchant_id INT NULL,
        employee_id INT NULL,
        attributed_business_type VARCHAR(50) NULL,
        attributed_business_id VARCHAR(100) NULL,
        attribution_status VARCHAR(20) NOT NULL DEFAULT 'unknown',
        evidence_status VARCHAR(20) NOT NULL DEFAULT 'uncertain',
        confidence_score DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
        rule_code VARCHAR(50) NULL,
        matched_fields JSON NOT NULL,
        remark VARCHAR(500) NULL,
        handled_by INT NULL,
        handled_at DATETIME NULL,
        handling_action VARCHAR(20) NULL,
        normalized_payload JSON NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_attribution_results_interaction (interaction_id),
        KEY idx_attribution_results_subject (attributed_subject_type, attributed_subject_id),
        KEY idx_attribution_results_business (attributed_business_type, attributed_business_id),
        KEY idx_attribution_results_status (attribution_status, evidence_status),
        KEY idx_attribution_results_merchant_employee (merchant_id, employee_id),
        CONSTRAINT fk_attribution_results_interaction_id FOREIGN KEY (interaction_id) REFERENCES platform_interactions(id) ON DELETE CASCADE,
        CONSTRAINT fk_attribution_results_lead_candidate_id FOREIGN KEY (lead_candidate_id) REFERENCES lead_candidates(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS profile_snapshots (
        id INT NOT NULL AUTO_INCREMENT,
        subject_type VARCHAR(30) NOT NULL,
        subject_id INT NOT NULL,
        display_name VARCHAR(100) NULL,
        mobile VARCHAR(20) NULL,
        merchant_id INT NULL,
        employee_id INT NULL,
        latest_interaction_at DATETIME NULL,
        latest_attribution_at DATETIME NULL,
        interaction_count INT NOT NULL DEFAULT 0,
        memory_count INT NOT NULL DEFAULT 0,
        attributed_business_count INT NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        summary_json JSON NOT NULL,
        normalized_payload JSON NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_profile_snapshots_subject (subject_type, subject_id),
        KEY idx_profile_snapshots_merchant (merchant_id, subject_type),
        KEY idx_profile_snapshots_employee (employee_id, subject_type),
        KEY idx_profile_snapshots_latest_interaction (latest_interaction_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      INSERT INTO attribution_rules (
        rule_code, rule_name, rule_type, match_field, match_pattern, target_type,
        target_business_type, confidence_score, evidence_status, is_active, remark, normalized_payload
      )
      SELECT * FROM (
        SELECT
          'employee_mobile_match' AS rule_code,
          '员工手机号匹配' AS rule_name,
          'field_match' AS rule_type,
          'source_contact_ref' AS match_field,
          NULL AS match_pattern,
          'employee' AS target_type,
          NULL AS target_business_type,
          0.8200 AS confidence_score,
          'inferred' AS evidence_status,
          1 AS is_active,
          '当平台互动联系方式与员工手机号一致时，作为员工归因强规则' AS remark,
          JSON_OBJECT('strength', 'strong') AS normalized_payload
        UNION ALL
        SELECT
          'employee_user_ref_match',
          '员工用户引用匹配',
          'field_match',
          'source_user_ref',
          NULL,
          'employee',
          NULL,
          0.8600,
          'inferred',
          1,
          '当平台互动用户引用与员工绑定用户一致时，作为员工归因强规则',
          JSON_OBJECT('strength', 'strong')
        UNION ALL
        SELECT
          'payload_employee_match',
          '互动负载员工匹配',
          'payload_match',
          'employee_id',
          NULL,
          'employee',
          NULL,
          0.7800,
          'inferred',
          1,
          '当互动负载显式携带员工标识时，作为员工归因规则',
          JSON_OBJECT('strength', 'strong')
        UNION ALL
        SELECT
          'payload_customer_match',
          '互动负载客户匹配',
          'payload_match',
          'customer_id',
          NULL,
          'customer',
          NULL,
          0.7200,
          'inferred',
          1,
          '当互动负载显式携带客户标识时，作为客户归因规则',
          JSON_OBJECT('strength', 'strong')
        UNION ALL
        SELECT
          'payload_merchant_match',
          '互动负载商户匹配',
          'payload_match',
          'merchant_id',
          NULL,
          'merchant',
          NULL,
          0.7600,
          'inferred',
          1,
          '当互动负载已显式携带商户标识时，作为商户归因规则',
          JSON_OBJECT('strength', 'strong')
        UNION ALL
        SELECT
          'content_campaign_match',
          '内容活动归因匹配',
          'content_match',
          'content_id',
          NULL,
          'merchant',
          NULL,
          0.6800,
          'inferred',
          1,
          '当平台内容或活动带有商户上下文时，作为商户归因弱规则',
          JSON_OBJECT('strength', 'weak')
        UNION ALL
        SELECT
          'manual_override',
          '人工确认归因',
          'manual',
          'manual',
          NULL,
          'manual',
          NULL,
          1.0000,
          'confirmed',
          1,
          '人工确认或改归属使用的保底规则',
          JSON_OBJECT('strength', 'strong')
      ) AS seed_rows
      WHERE NOT EXISTS (
        SELECT 1 FROM attribution_rules existing WHERE existing.rule_code = seed_rows.rule_code
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS profile_snapshots');
    await queryRunner.query('DROP TABLE IF EXISTS attribution_results');
    await queryRunner.query('DROP TABLE IF EXISTS attribution_rules');
    await queryRunner.query('DROP TABLE IF EXISTS lead_candidates');
  }
}
