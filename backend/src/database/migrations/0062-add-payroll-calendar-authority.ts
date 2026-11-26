import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPayrollCalendarAuthority00621787200002000 implements MigrationInterface {
  name = 'AddPayrollCalendarAuthority00621787200002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payroll_calendar_rule_versions (
        id INT NOT NULL AUTO_INCREMENT,
        company_ref VARCHAR(100) NOT NULL,
        settlement_period CHAR(7) NOT NULL,
        calendar_rule_version_id VARCHAR(100) NOT NULL,
        payroll_dates_json JSON NOT NULL,
        payroll_date_set_hash CHAR(64) NOT NULL,
        standard_payroll_days INT NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'approved',
        version INT NOT NULL,
        change_reason VARCHAR(500) NOT NULL,
        source_channel VARCHAR(50) NOT NULL,
        correlation_id VARCHAR(100) NOT NULL,
        idempotency_key VARCHAR(120) NOT NULL,
        request_fingerprint CHAR(64) NOT NULL,
        created_by INT NOT NULL,
        approved_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_payroll_calendar_company_period_version (
          company_ref,
          settlement_period,
          calendar_rule_version_id
        ),
        UNIQUE KEY uq_payroll_calendar_company_period_sequence (
          company_ref,
          settlement_period,
          version
        ),
        UNIQUE KEY uq_payroll_calendar_idempotency (idempotency_key),
        KEY idx_payroll_calendar_company_period_status (
          company_ref,
          settlement_period,
          status
        ),
        CONSTRAINT chk_payroll_calendar_period
          CHECK (settlement_period REGEXP '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
        CONSTRAINT chk_payroll_calendar_standard_days
          CHECK (
            standard_payroll_days BETWEEN 1 AND 31
            AND JSON_LENGTH(payroll_dates_json) = standard_payroll_days
          ),
        CONSTRAINT chk_payroll_calendar_status CHECK (status = 'approved'),
        CONSTRAINT chk_payroll_calendar_date_set_hash
          CHECK (payroll_date_set_hash REGEXP '^[0-9a-f]{64}$'),
        CONSTRAINT chk_payroll_calendar_request_fingerprint
          CHECK (request_fingerprint REGEXP '^[0-9a-f]{64}$')
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      ALTER TABLE group_target_policy_versions
        ADD COLUMN payroll_calendar_rule_id INT NULL AFTER calendar_rule_version_id,
        ADD COLUMN payroll_date_set_hash CHAR(64) NULL AFTER payroll_calendar_rule_id,
        ADD KEY idx_group_target_policy_calendar_rule (payroll_calendar_rule_id),
        ADD CONSTRAINT chk_group_target_policy_calendar_binding
          CHECK (
            (
              payroll_calendar_rule_id IS NULL
              AND payroll_date_set_hash IS NULL
            )
            OR
            (
              payroll_calendar_rule_id IS NOT NULL
              AND payroll_date_set_hash IS NOT NULL
              AND payroll_date_set_hash REGEXP '^[0-9a-f]{64}$'
            )
          ),
        ADD CONSTRAINT fk_group_target_policy_calendar_rule
          FOREIGN KEY (payroll_calendar_rule_id)
          REFERENCES payroll_calendar_rule_versions(id)
          ON DELETE RESTRICT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE group_target_policy_versions
        DROP FOREIGN KEY fk_group_target_policy_calendar_rule,
        DROP CHECK chk_group_target_policy_calendar_binding,
        DROP INDEX idx_group_target_policy_calendar_rule,
        DROP COLUMN payroll_date_set_hash,
        DROP COLUMN payroll_calendar_rule_id
    `);
    await queryRunner.query('DROP TABLE payroll_calendar_rule_versions');
  }
}
