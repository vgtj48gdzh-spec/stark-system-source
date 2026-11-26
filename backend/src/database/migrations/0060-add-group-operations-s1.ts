import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGroupOperationsS100601787200000000 implements MigrationInterface {
  name = 'AddGroupOperationsS100601787200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE organization_groups (
        id INT NOT NULL AUTO_INCREMENT,
        group_code VARCHAR(64) NOT NULL,
        group_name VARCHAR(160) NOT NULL,
        company_ref VARCHAR(100) NOT NULL,
        business_sector_ref VARCHAR(100) NULL,
        store_ref VARCHAR(100) NULL,
        leader_employee_id INT NULL,
        business_owner_employee_id INT NULL,
        established_at DATE NOT NULL,
        closed_at DATE NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'active',
        safety_factor_policy_version_id VARCHAR(100) NOT NULL,
        ramp_up_policy_version_id VARCHAR(100) NOT NULL,
        change_reason VARCHAR(500) NOT NULL,
        source_channel VARCHAR(50) NOT NULL,
        correlation_id VARCHAR(100) NOT NULL,
        idempotency_key VARCHAR(120) NOT NULL,
        request_fingerprint CHAR(64) NOT NULL,
        version INT NOT NULL DEFAULT 1,
        created_by INT NOT NULL,
        approved_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_organization_group_code (group_code),
        UNIQUE KEY uq_organization_group_idempotency (idempotency_key),
        KEY idx_organization_group_scope (company_ref, business_sector_ref, store_ref, status),
        CONSTRAINT chk_organization_group_date_range CHECK (closed_at IS NULL OR closed_at >= established_at),
        CONSTRAINT chk_organization_group_request_fingerprint CHECK (request_fingerprint REGEXP '^[0-9a-f]{64}$'),
        CONSTRAINT fk_organization_group_leader FOREIGN KEY (leader_employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
        CONSTRAINT fk_organization_group_business_owner FOREIGN KEY (business_owner_employee_id) REFERENCES employees(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE group_members (
        id INT NOT NULL AUTO_INCREMENT,
        group_id INT NOT NULL,
        employee_id INT NOT NULL,
        job_level VARCHAR(2) NOT NULL,
        role_code VARCHAR(64) NOT NULL,
        is_primary TINYINT(1) NOT NULL DEFAULT 1,
        effective_from DATE NOT NULL,
        effective_to DATE NULL,
        responsibility_weight_bps INT NULL,
        cost_allocation_bps INT NOT NULL DEFAULT 10000,
        change_reason VARCHAR(500) NOT NULL,
        source_channel VARCHAR(50) NOT NULL,
        correlation_id VARCHAR(100) NOT NULL,
        idempotency_key VARCHAR(120) NOT NULL,
        last_command_idempotency_key VARCHAR(120) NOT NULL,
        create_request_fingerprint CHAR(64) NOT NULL,
        last_command_fingerprint CHAR(64) NOT NULL,
        version INT NOT NULL DEFAULT 1,
        created_by INT NOT NULL,
        approved_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_group_member_idempotency (idempotency_key),
        UNIQUE KEY uq_group_member_last_command_idempotency (last_command_idempotency_key),
        KEY idx_group_member_group_period (group_id, effective_from, effective_to),
        KEY idx_group_member_employee_period (employee_id, effective_from, effective_to),
        CONSTRAINT chk_group_member_job_level CHECK (job_level IN ('L0','L1','L2','L3')),
        CONSTRAINT chk_group_member_responsibility_weight CHECK (responsibility_weight_bps IS NULL OR (responsibility_weight_bps > 0 AND responsibility_weight_bps <= 10000)),
        CONSTRAINT chk_group_member_cost_allocation CHECK (cost_allocation_bps >= 0 AND cost_allocation_bps <= 10000),
        CONSTRAINT chk_group_member_date_range CHECK (effective_to IS NULL OR effective_to >= effective_from),
        CONSTRAINT chk_group_member_request_fingerprints CHECK (
          create_request_fingerprint REGEXP '^[0-9a-f]{64}$' AND
          last_command_fingerprint REGEXP '^[0-9a-f]{64}$'
        ),
        CONSTRAINT fk_group_member_group FOREIGN KEY (group_id) REFERENCES organization_groups(id) ON DELETE RESTRICT,
        CONSTRAINT fk_group_member_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE group_target_policy_versions (
        id INT NOT NULL AUTO_INCREMENT,
        group_id INT NOT NULL,
        settlement_period CHAR(7) NOT NULL,
        policy_version_id VARCHAR(100) NOT NULL,
        safety_factor_bps INT NOT NULL,
        ramp_factor_bps INT NOT NULL,
        standard_payroll_days INT NOT NULL,
        safety_factor_policy_version_id VARCHAR(100) NOT NULL,
        ramp_up_policy_version_id VARCHAR(100) NOT NULL,
        calendar_rule_version_id VARCHAR(100) NOT NULL,
        currency CHAR(3) NOT NULL DEFAULT 'CNY',
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
        UNIQUE KEY uq_group_target_policy_version_id (policy_version_id),
        UNIQUE KEY uq_group_target_policy_group_period_version (group_id, settlement_period, version),
        UNIQUE KEY uq_group_target_policy_scope_identity (id, group_id, settlement_period),
        UNIQUE KEY uq_group_target_policy_idempotency (idempotency_key),
        KEY idx_group_target_policy_group_period_status (group_id, settlement_period, status),
        CONSTRAINT chk_group_target_policy_factors CHECK (
          safety_factor_bps > 0 AND safety_factor_bps <= 100000 AND
          ramp_factor_bps > 0 AND ramp_factor_bps <= 10000
        ),
        CONSTRAINT chk_group_target_policy_days CHECK (standard_payroll_days > 0),
        CONSTRAINT chk_group_target_policy_currency CHECK (currency = 'CNY'),
        CONSTRAINT chk_group_target_policy_status CHECK (status IN ('approved','superseded')),
        CONSTRAINT chk_group_target_policy_version CHECK (version > 0),
        CONSTRAINT chk_group_target_policy_request_fingerprint CHECK (request_fingerprint REGEXP '^[0-9a-f]{64}$'),
        CONSTRAINT fk_group_target_policy_group FOREIGN KEY (group_id) REFERENCES organization_groups(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE compensation_profiles (
        id INT NOT NULL AUTO_INCREMENT,
        employee_id INT NOT NULL,
        base_guarantee_cents BIGINT NOT NULL,
        position_performance_budget_cents BIGINT NOT NULL,
        employer_social_cost_cents BIGINT NOT NULL,
        fixed_benefit_cost_cents BIGINT NOT NULL,
        benefit_cash_offset_cents BIGINT NOT NULL DEFAULT 0,
        other_fixed_employment_cost_cents BIGINT NOT NULL,
        fully_loaded_labor_cost_cents BIGINT NOT NULL,
        currency CHAR(3) NOT NULL DEFAULT 'CNY',
        effective_from DATE NOT NULL,
        effective_to DATE NULL,
        benefit_rule_version_id VARCHAR(100) NULL,
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
        UNIQUE KEY uq_compensation_profile_employee_version (employee_id, version),
        UNIQUE KEY uq_compensation_profile_idempotency (idempotency_key),
        KEY idx_compensation_profile_employee_period (employee_id, effective_from, effective_to, status),
        CONSTRAINT chk_compensation_profile_nonnegative_costs CHECK (
          base_guarantee_cents >= 0 AND
          position_performance_budget_cents >= 0 AND
          employer_social_cost_cents >= 0 AND
          fixed_benefit_cost_cents >= 0 AND
          other_fixed_employment_cost_cents >= 0 AND
          fully_loaded_labor_cost_cents >= 0
        ),
        CONSTRAINT chk_compensation_profile_cost_sum CHECK (
          fully_loaded_labor_cost_cents =
            base_guarantee_cents +
            position_performance_budget_cents +
            employer_social_cost_cents +
            fixed_benefit_cost_cents +
            other_fixed_employment_cost_cents
        ),
        CONSTRAINT chk_compensation_profile_currency CHECK (currency = 'CNY'),
        CONSTRAINT chk_compensation_profile_cash_offset CHECK (
          benefit_cash_offset_cents = 0 AND benefit_rule_version_id IS NULL
        ),
        CONSTRAINT chk_compensation_profile_date_range CHECK (effective_to IS NULL OR effective_to >= effective_from),
        CONSTRAINT chk_compensation_profile_request_fingerprint CHECK (request_fingerprint REGEXP '^[0-9a-f]{64}$'),
        CONSTRAINT fk_compensation_profile_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE labor_cost_snapshots (
        id INT NOT NULL AUTO_INCREMENT,
        group_id INT NOT NULL,
        employee_id INT NOT NULL,
        group_member_id INT NOT NULL,
        compensation_profile_id INT NOT NULL,
        settlement_period CHAR(7) NOT NULL,
        calculation_version INT NOT NULL,
        job_level_snapshot VARCHAR(2) NOT NULL,
        role_code_snapshot VARCHAR(64) NOT NULL,
        active_payroll_days INT NOT NULL,
        standard_payroll_days INT NOT NULL,
        calendar_rule_version_id VARCHAR(100) NOT NULL,
        currency CHAR(3) NOT NULL DEFAULT 'CNY',
        cost_allocation_bps INT NOT NULL,
        base_guarantee_cents BIGINT NOT NULL,
        position_performance_budget_cents BIGINT NOT NULL,
        employer_social_cost_cents BIGINT NOT NULL,
        fixed_benefit_cost_cents BIGINT NOT NULL,
        benefit_cash_offset_cents BIGINT NOT NULL,
        other_fixed_employment_cost_cents BIGINT NOT NULL,
        fully_loaded_labor_cost_cents BIGINT NOT NULL,
        prorated_labor_cost_cents BIGINT NOT NULL,
        allocated_labor_cost_cents BIGINT NOT NULL,
        rounding_mode VARCHAR(24) NOT NULL,
        profile_snapshot_json JSON NOT NULL,
        snapshot_status VARCHAR(32) NOT NULL DEFAULT 'calculated',
        source_channel VARCHAR(50) NOT NULL,
        correlation_id VARCHAR(100) NOT NULL,
        idempotency_key VARCHAR(120) NOT NULL,
        created_by INT NOT NULL,
        locked_at DATETIME NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_labor_cost_snapshot_member_period_version (group_member_id, settlement_period, calculation_version),
        UNIQUE KEY uq_labor_cost_snapshot_idempotency (idempotency_key),
        CONSTRAINT chk_labor_cost_snapshot_days CHECK (standard_payroll_days > 0 AND active_payroll_days >= 0 AND active_payroll_days <= standard_payroll_days),
        CONSTRAINT chk_labor_cost_snapshot_currency CHECK (currency = 'CNY'),
        CONSTRAINT chk_labor_cost_snapshot_allocation CHECK (cost_allocation_bps >= 0 AND cost_allocation_bps <= 10000),
        CONSTRAINT chk_labor_cost_snapshot_components CHECK (
          base_guarantee_cents >= 0 AND
          position_performance_budget_cents >= 0 AND
          employer_social_cost_cents >= 0 AND
          fixed_benefit_cost_cents >= 0 AND
          benefit_cash_offset_cents = 0 AND
          other_fixed_employment_cost_cents >= 0
        ),
        CONSTRAINT chk_labor_cost_snapshot_cost_sum CHECK (
          fully_loaded_labor_cost_cents =
            base_guarantee_cents +
            position_performance_budget_cents +
            employer_social_cost_cents +
            fixed_benefit_cost_cents +
            other_fixed_employment_cost_cents
        ),
        CONSTRAINT chk_labor_cost_snapshot_nonnegative CHECK (fully_loaded_labor_cost_cents >= 0 AND prorated_labor_cost_cents >= 0 AND allocated_labor_cost_cents >= 0),
        CONSTRAINT fk_labor_cost_snapshot_group FOREIGN KEY (group_id) REFERENCES organization_groups(id) ON DELETE RESTRICT,
        CONSTRAINT fk_labor_cost_snapshot_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
        CONSTRAINT fk_labor_cost_snapshot_member FOREIGN KEY (group_member_id) REFERENCES group_members(id) ON DELETE RESTRICT,
        CONSTRAINT fk_labor_cost_snapshot_profile FOREIGN KEY (compensation_profile_id) REFERENCES compensation_profiles(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE group_targets (
        id INT NOT NULL AUTO_INCREMENT,
        group_id INT NOT NULL,
        settlement_period CHAR(7) NOT NULL,
        calculation_version INT NOT NULL,
        target_policy_id INT NOT NULL,
        group_fixed_labor_cost_cents BIGINT NOT NULL,
        safety_factor_bps INT NOT NULL,
        ramp_factor_bps INT NOT NULL,
        standard_payroll_days INT NOT NULL,
        currency CHAR(3) NOT NULL DEFAULT 'CNY',
        break_even_target_cents BIGINT NOT NULL,
        marginal_target_change_cents BIGINT NOT NULL DEFAULT 0,
        member_snapshot_count INT NOT NULL DEFAULT 0,
        labor_cost_snapshot_ids JSON NOT NULL,
        calculation_input_json JSON NOT NULL,
        calculation_status VARCHAR(32) NOT NULL,
        blocked_reason VARCHAR(500) NULL,
        safety_factor_policy_version_id VARCHAR(100) NOT NULL,
        ramp_up_policy_version_id VARCHAR(100) NOT NULL,
        calendar_rule_version_id VARCHAR(100) NOT NULL,
        rounding_mode VARCHAR(24) NOT NULL,
        source_channel VARCHAR(50) NOT NULL,
        correlation_id VARCHAR(100) NOT NULL,
        idempotency_key VARCHAR(120) NOT NULL,
        request_fingerprint CHAR(64) NOT NULL,
        created_by INT NOT NULL,
        approved_by INT NOT NULL,
        locked_at DATETIME NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_group_target_period_version (group_id, settlement_period, calculation_version),
        UNIQUE KEY uq_group_target_idempotency (idempotency_key),
        CONSTRAINT chk_group_target_factors CHECK (safety_factor_bps > 0 AND safety_factor_bps <= 100000 AND ramp_factor_bps > 0 AND ramp_factor_bps <= 10000),
        CONSTRAINT chk_group_target_days CHECK (standard_payroll_days > 0),
        CONSTRAINT chk_group_target_currency CHECK (currency = 'CNY'),
        CONSTRAINT chk_group_target_nonnegative CHECK (group_fixed_labor_cost_cents >= 0 AND break_even_target_cents >= 0),
        CONSTRAINT chk_group_target_status_payload CHECK (
          (
            calculation_status = 'calculation_blocked' AND
            group_fixed_labor_cost_cents = 0 AND
            break_even_target_cents = 0 AND
            member_snapshot_count = 0 AND
            blocked_reason IS NOT NULL
          ) OR (
            calculation_status IN ('calculated','locked') AND
            group_fixed_labor_cost_cents > 0 AND
            break_even_target_cents > 0 AND
            member_snapshot_count > 0 AND
            blocked_reason IS NULL
          ) OR (
            calculation_status = 'recalculation_required' AND
            group_fixed_labor_cost_cents > 0 AND
            break_even_target_cents > 0 AND
            member_snapshot_count > 0 AND
            blocked_reason IS NOT NULL AND
            locked_at IS NULL
          )
        ),
        CONSTRAINT chk_group_target_request_fingerprint CHECK (request_fingerprint REGEXP '^[0-9a-f]{64}$'),
        CONSTRAINT fk_group_target_group FOREIGN KEY (group_id) REFERENCES organization_groups(id) ON DELETE RESTRICT,
        CONSTRAINT fk_group_target_policy_scope FOREIGN KEY (target_policy_id, group_id, settlement_period) REFERENCES group_target_policy_versions(id, group_id, settlement_period) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS group_targets');
    await queryRunner.query('DROP TABLE IF EXISTS labor_cost_snapshots');
    await queryRunner.query('DROP TABLE IF EXISTS compensation_profiles');
    await queryRunner.query('DROP TABLE IF EXISTS group_target_policy_versions');
    await queryRunner.query('DROP TABLE IF EXISTS group_members');
    await queryRunner.query('DROP TABLE IF EXISTS organization_groups');
  }
}
