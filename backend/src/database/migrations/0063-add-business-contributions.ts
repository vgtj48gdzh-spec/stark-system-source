import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusinessContributions00631787300000000 implements MigrationInterface {
  name = 'AddBusinessContributions00631787300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE contribution_source_authority_versions (
        id INT NOT NULL AUTO_INCREMENT,
        rule_version_id VARCHAR(100) NOT NULL,
        authority_scope_key CHAR(64) NOT NULL,
        company_ref VARCHAR(100) NOT NULL,
        business_sector_ref VARCHAR(100) NULL,
        store_ref VARCHAR(100) NULL,
        business_domain VARCHAR(24) NOT NULL,
        source_system VARCHAR(64) NOT NULL,
        source_type VARCHAR(64) NOT NULL,
        adapter_version VARCHAR(100) NOT NULL,
        effective_from DATE NOT NULL,
        effective_to DATE NULL,
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
        UNIQUE KEY uq_contribution_authority_rule_version (rule_version_id),
        UNIQUE KEY uq_contribution_authority_scope_version (authority_scope_key, version),
        UNIQUE KEY uq_contribution_authority_idempotency (idempotency_key),
        KEY idx_contribution_authority_lookup (
          company_ref,
          business_domain,
          source_system,
          source_type,
          status
        ),
        CONSTRAINT chk_contribution_authority_domain
          CHECK (business_domain IN ('fresh','water','repair','software')),
        CONSTRAINT chk_contribution_authority_currency CHECK (currency = 'CNY'),
        CONSTRAINT chk_contribution_authority_status CHECK (status IN ('approved','superseded')),
        CONSTRAINT chk_contribution_authority_version CHECK (version > 0),
        CONSTRAINT chk_contribution_authority_date_range
          CHECK (effective_to IS NULL OR effective_to >= effective_from),
        CONSTRAINT chk_contribution_authority_hashes CHECK (
          authority_scope_key REGEXP '^[0-9a-f]{64}$'
          AND request_fingerprint REGEXP '^[0-9a-f]{64}$'
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE business_contribution_similarity_clusters (
        cluster_key CHAR(64) NOT NULL,
        created_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (cluster_key),
        CONSTRAINT chk_business_contribution_similarity_cluster_hash
          CHECK (cluster_key REGEXP '^[0-9a-f]{64}$')
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE business_contributions (
        id INT NOT NULL AUTO_INCREMENT,
        business_domain VARCHAR(24) NOT NULL,
        company_ref VARCHAR(100) NOT NULL,
        business_sector_ref VARCHAR(100) NULL,
        store_ref VARCHAR(100) NULL,
        operating_group_id INT NOT NULL,
        responsibility_employee_id_snapshot INT NOT NULL,
        source_authority_version_id INT NOT NULL,
        adapter_version VARCHAR(100) NOT NULL,
        source_system VARCHAR(64) NOT NULL,
        source_type VARCHAR(64) NOT NULL,
        source_id VARCHAR(120) NOT NULL,
        source_version VARCHAR(100) NOT NULL,
        source_record_hash CHAR(64) NOT NULL,
        unique_source_key CHAR(64) NOT NULL,
        similarity_cluster_key CHAR(64) NOT NULL,
        economic_fact_key CHAR(64) NOT NULL,
        authority_snapshot_hash CHAR(64) NOT NULL,
        recognition_period CHAR(7) NOT NULL,
        recognition_at DATETIME(6) NOT NULL,
        customer_ref VARCHAR(100) NULL,
        revenue_cents BIGINT NOT NULL,
        direct_cost_total_cents BIGINT NOT NULL,
        valid_contribution_margin_cents BIGINT NOT NULL,
        currency CHAR(3) NOT NULL DEFAULT 'CNY',
        evidence_bundle_hash CHAR(64) NOT NULL,
        attribution_share_total_bps INT NOT NULL,
        confirmation_status VARCHAR(32) NOT NULL,
        reversal_of_contribution_id INT NULL,
        reversed_by_contribution_id INT NULL,
        change_reason VARCHAR(500) NOT NULL,
        source_channel VARCHAR(50) NOT NULL,
        correlation_id VARCHAR(100) NOT NULL,
        idempotency_key VARCHAR(120) NOT NULL,
        request_fingerprint CHAR(64) NOT NULL,
        confirmation_idempotency_key VARCHAR(120) NULL,
        confirmation_request_fingerprint CHAR(64) NULL,
        confirmation_evidence_ref VARCHAR(500) NULL,
        confirmation_evidence_hash CHAR(64) NULL,
        reversal_idempotency_key VARCHAR(120) NULL,
        reversal_request_fingerprint CHAR(64) NULL,
        version INT NOT NULL DEFAULT 1,
        created_by INT NOT NULL,
        confirmed_by INT NULL,
        confirmed_at DATETIME(6) NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_business_contribution_source (unique_source_key),
        UNIQUE KEY uq_business_contribution_create_idempotency (idempotency_key),
        UNIQUE KEY uq_business_contribution_confirmation_idempotency (confirmation_idempotency_key),
        UNIQUE KEY uq_business_contribution_reversal_idempotency (reversal_idempotency_key),
        UNIQUE KEY uq_business_contribution_reversal_of (reversal_of_contribution_id),
        UNIQUE KEY uq_business_contribution_reversed_by (reversed_by_contribution_id),
        KEY idx_business_contribution_group_period_status (
          operating_group_id,
          recognition_period,
          confirmation_status
        ),
        KEY idx_business_contribution_scope (
          company_ref,
          business_sector_ref,
          store_ref,
          business_domain
        ),
        KEY idx_business_contribution_similarity_cluster (
          similarity_cluster_key,
          confirmation_status
        ),
        KEY idx_business_contribution_authority (source_authority_version_id),
        KEY idx_business_contribution_responsibility (
          responsibility_employee_id_snapshot,
          recognition_period
        ),
        CONSTRAINT chk_business_contribution_domain
          CHECK (business_domain IN ('fresh','water','repair','software')),
        CONSTRAINT chk_business_contribution_period
          CHECK (recognition_period REGEXP '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
        CONSTRAINT chk_business_contribution_currency CHECK (currency = 'CNY'),
        CONSTRAINT chk_business_contribution_share_total CHECK (attribution_share_total_bps = 10000),
        CONSTRAINT chk_business_contribution_version CHECK (version > 0),
        CONSTRAINT chk_business_contribution_amount_formula CHECK (
          valid_contribution_margin_cents = revenue_cents - direct_cost_total_cents
          AND (
            (reversal_of_contribution_id IS NULL AND revenue_cents > 0 AND direct_cost_total_cents >= 0)
            OR
            (reversal_of_contribution_id IS NOT NULL AND revenue_cents < 0 AND direct_cost_total_cents <= 0)
          )
        ),
        CONSTRAINT chk_business_contribution_hashes CHECK (
          source_record_hash REGEXP '^[0-9a-f]{64}$'
          AND unique_source_key REGEXP '^[0-9a-f]{64}$'
          AND similarity_cluster_key REGEXP '^[0-9a-f]{64}$'
          AND economic_fact_key REGEXP '^[0-9a-f]{64}$'
          AND authority_snapshot_hash REGEXP '^[0-9a-f]{64}$'
          AND evidence_bundle_hash REGEXP '^[0-9a-f]{64}$'
          AND request_fingerprint REGEXP '^[0-9a-f]{64}$'
          AND (
            confirmation_request_fingerprint IS NULL
            OR confirmation_request_fingerprint REGEXP '^[0-9a-f]{64}$'
          )
          AND (
            confirmation_evidence_hash IS NULL
            OR confirmation_evidence_hash REGEXP '^[0-9a-f]{64}$'
          )
          AND (
            reversal_request_fingerprint IS NULL
            OR reversal_request_fingerprint REGEXP '^[0-9a-f]{64}$'
          )
        ),
        CONSTRAINT chk_business_contribution_status_payload CHECK (
          (
            confirmation_status = 'pending_confirmation'
            AND reversal_of_contribution_id IS NULL
            AND reversed_by_contribution_id IS NULL
            AND confirmation_idempotency_key IS NULL
            AND confirmation_request_fingerprint IS NULL
            AND confirmation_evidence_ref IS NULL
            AND confirmation_evidence_hash IS NULL
            AND reversal_idempotency_key IS NULL
            AND reversal_request_fingerprint IS NULL
            AND confirmed_by IS NULL
            AND confirmed_at IS NULL
          )
          OR
          (
            confirmation_status = 'voided'
            AND reversal_of_contribution_id IS NULL
            AND reversed_by_contribution_id IS NULL
            AND confirmation_idempotency_key IS NULL
            AND confirmation_request_fingerprint IS NULL
            AND confirmation_evidence_ref IS NULL
            AND confirmation_evidence_hash IS NULL
            AND reversal_idempotency_key IS NULL
            AND reversal_request_fingerprint IS NULL
            AND confirmed_by IS NULL
            AND confirmed_at IS NULL
          )
          OR
          (
            confirmation_status = 'confirmed'
            AND reversed_by_contribution_id IS NULL
            AND confirmation_evidence_ref IS NOT NULL
            AND confirmation_evidence_hash IS NOT NULL
            AND confirmed_by IS NOT NULL
            AND confirmed_at IS NOT NULL
            AND (
              reversal_of_contribution_id IS NOT NULL
              OR (
                confirmation_idempotency_key IS NOT NULL
                AND confirmation_request_fingerprint IS NOT NULL
              )
            )
          )
          OR
          (
            confirmation_status = 'reversed'
            AND reversal_of_contribution_id IS NULL
            AND reversed_by_contribution_id IS NOT NULL
            AND confirmation_idempotency_key IS NOT NULL
            AND confirmation_request_fingerprint IS NOT NULL
            AND confirmation_evidence_ref IS NOT NULL
            AND confirmation_evidence_hash IS NOT NULL
            AND reversal_idempotency_key IS NOT NULL
            AND reversal_request_fingerprint IS NOT NULL
            AND confirmed_by IS NOT NULL
            AND confirmed_at IS NOT NULL
          )
        ),
        CONSTRAINT fk_business_contribution_group
          FOREIGN KEY (operating_group_id) REFERENCES organization_groups(id) ON DELETE RESTRICT,
        CONSTRAINT fk_business_contribution_responsibility_employee
          FOREIGN KEY (responsibility_employee_id_snapshot) REFERENCES employees(id) ON DELETE RESTRICT,
        CONSTRAINT fk_business_contribution_authority
          FOREIGN KEY (source_authority_version_id)
          REFERENCES contribution_source_authority_versions(id) ON DELETE RESTRICT,
        CONSTRAINT fk_business_contribution_reversal_of
          FOREIGN KEY (reversal_of_contribution_id) REFERENCES business_contributions(id) ON DELETE RESTRICT,
        CONSTRAINT fk_business_contribution_reversed_by
          FOREIGN KEY (reversed_by_contribution_id) REFERENCES business_contributions(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE business_contribution_evidence (
        id INT NOT NULL AUTO_INCREMENT,
        contribution_id INT NOT NULL,
        evidence_role VARCHAR(24) NOT NULL,
        cost_category VARCHAR(64) NULL,
        disposition VARCHAR(24) NOT NULL,
        amount_cents BIGINT NOT NULL,
        source_system VARCHAR(64) NOT NULL,
        source_type VARCHAR(64) NOT NULL,
        source_id VARCHAR(120) NOT NULL,
        source_version VARCHAR(100) NOT NULL,
        source_allocation_id VARCHAR(120) NOT NULL,
        evidence_ref VARCHAR(500) NOT NULL,
        evidence_hash CHAR(64) NOT NULL,
        evidence_unique_key CHAR(64) NOT NULL,
        occurred_at DATETIME(6) NOT NULL,
        created_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_business_contribution_evidence_key (evidence_unique_key),
        KEY idx_business_contribution_evidence_contribution (contribution_id, evidence_role),
        CONSTRAINT chk_business_contribution_evidence_hashes CHECK (
          evidence_hash REGEXP '^[0-9a-f]{64}$'
          AND evidence_unique_key REGEXP '^[0-9a-f]{64}$'
        ),
        CONSTRAINT chk_business_contribution_evidence_payload CHECK (
          (
            evidence_role = 'revenue'
            AND cost_category IS NULL
            AND disposition = 'included'
            AND amount_cents > 0
          )
          OR
          (
            evidence_role = 'direct_cost'
            AND cost_category IN (
              'product_purchase','direct_loss','attributable_delivery','special_direct','refund',
              'product_cost','barrel_direct','refund_loss','parts','outsourced','other_direct',
              'rework','third_party','dedicated_server'
            )
            AND disposition IN ('included','not_applicable')
            AND amount_cents >= 0
            AND (disposition = 'included' OR amount_cents = 0)
          )
          OR
          (
            evidence_role = 'reversal'
            AND cost_category IS NULL
            AND disposition = 'included'
          )
        ),
        CONSTRAINT fk_business_contribution_evidence_contribution
          FOREIGN KEY (contribution_id) REFERENCES business_contributions(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE business_contribution_attributions (
        id INT NOT NULL AUTO_INCREMENT,
        contribution_id INT NOT NULL,
        role VARCHAR(32) NOT NULL,
        origin_business_domain VARCHAR(24) NOT NULL,
        employee_id INT NOT NULL,
        employee_group_id_snapshot INT NOT NULL,
        share_bps INT NOT NULL,
        evidence_ref VARCHAR(500) NOT NULL,
        evidence_hash CHAR(64) NOT NULL,
        status VARCHAR(24) NOT NULL,
        created_by INT NOT NULL,
        confirmed_by INT NULL,
        confirmed_at DATETIME(6) NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_business_contribution_attribution_role_employee (
          contribution_id,
          role,
          employee_id
        ),
        KEY idx_business_contribution_attribution_employee (employee_id, status, contribution_id),
        KEY idx_business_contribution_attribution_group_snapshot (employee_group_id_snapshot),
        CONSTRAINT chk_business_contribution_attribution_role
          CHECK (role IN ('lead_originator','business_owner','service_owner')),
        CONSTRAINT chk_business_contribution_attribution_domain
          CHECK (origin_business_domain IN ('fresh','water','repair','software')),
        CONSTRAINT chk_business_contribution_attribution_share
          CHECK (share_bps BETWEEN 1 AND 10000),
        CONSTRAINT chk_business_contribution_attribution_hash
          CHECK (evidence_hash REGEXP '^[0-9a-f]{64}$'),
        CONSTRAINT chk_business_contribution_attribution_status CHECK (
          (
            status = 'pending'
            AND confirmed_by IS NULL
            AND confirmed_at IS NULL
          )
          OR
          (
            status IN ('confirmed','reversed')
            AND confirmed_by IS NOT NULL
            AND confirmed_at IS NOT NULL
          )
          OR
          (
            status = 'voided'
            AND confirmed_by IS NULL
            AND confirmed_at IS NULL
          )
        ),
        CONSTRAINT fk_business_contribution_attribution_contribution
          FOREIGN KEY (contribution_id) REFERENCES business_contributions(id) ON DELETE RESTRICT,
        CONSTRAINT fk_business_contribution_attribution_employee
          FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
        CONSTRAINT fk_business_contribution_attribution_group_snapshot
          FOREIGN KEY (employee_group_id_snapshot) REFERENCES organization_groups(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE business_contribution_anomalies (
        id INT NOT NULL AUTO_INCREMENT,
        contribution_id INT NOT NULL,
        candidate_contribution_id INT NOT NULL,
        anomaly_type VARCHAR(40) NOT NULL,
        pair_key CHAR(64) NOT NULL,
        similarity_cluster_key CHAR(64) NOT NULL,
        economic_fact_key CHAR(64) NOT NULL,
        detection_rule_version VARCHAR(100) NOT NULL,
        detected_payload_hash CHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL,
        resolution VARCHAR(32) NULL,
        canonical_contribution_id INT NULL,
        duplicate_contribution_id INT NULL,
        resolution_reason VARCHAR(500) NULL,
        resolution_evidence_ref VARCHAR(500) NULL,
        resolution_evidence_hash CHAR(64) NULL,
        resolution_idempotency_key VARCHAR(120) NULL,
        resolution_request_fingerprint CHAR(64) NULL,
        version INT NOT NULL DEFAULT 1,
        created_by INT NOT NULL,
        resolved_by INT NULL,
        resolved_at DATETIME(6) NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_business_contribution_anomaly_pair (pair_key),
        UNIQUE KEY uq_business_contribution_anomaly_resolution_idempotency (resolution_idempotency_key),
        KEY idx_business_contribution_anomaly_queue (status, anomaly_type, contribution_id),
        KEY idx_business_contribution_anomaly_candidate_queue (status, candidate_contribution_id),
        CONSTRAINT chk_business_contribution_anomaly_type CHECK (
          anomaly_type IN (
            'similar_economic_fact','cross_business_duplicate','cancel_recreate','split_order_risk'
          )
        ),
        CONSTRAINT chk_business_contribution_anomaly_distinct_pair
          CHECK (contribution_id <> candidate_contribution_id),
        CONSTRAINT chk_business_contribution_anomaly_hashes CHECK (
          pair_key REGEXP '^[0-9a-f]{64}$'
          AND similarity_cluster_key REGEXP '^[0-9a-f]{64}$'
          AND economic_fact_key REGEXP '^[0-9a-f]{64}$'
          AND detected_payload_hash REGEXP '^[0-9a-f]{64}$'
          AND (
            resolution_evidence_hash IS NULL
            OR resolution_evidence_hash REGEXP '^[0-9a-f]{64}$'
          )
          AND (
            resolution_request_fingerprint IS NULL
            OR resolution_request_fingerprint REGEXP '^[0-9a-f]{64}$'
          )
        ),
        CONSTRAINT chk_business_contribution_anomaly_version CHECK (version > 0),
        CONSTRAINT chk_business_contribution_anomaly_status_payload CHECK (
          (
            status = 'open'
            AND resolution IS NULL
            AND canonical_contribution_id IS NULL
            AND duplicate_contribution_id IS NULL
            AND resolution_reason IS NULL
            AND resolution_evidence_ref IS NULL
            AND resolution_evidence_hash IS NULL
            AND resolution_idempotency_key IS NULL
            AND resolution_request_fingerprint IS NULL
            AND resolved_by IS NULL
            AND resolved_at IS NULL
          )
          OR
          (
            status = 'resolved_not_duplicate'
            AND resolution = 'not_duplicate'
            AND canonical_contribution_id IS NULL
            AND duplicate_contribution_id IS NULL
            AND resolution_reason IS NOT NULL
            AND resolution_evidence_ref IS NOT NULL
            AND resolution_evidence_hash IS NOT NULL
            AND resolution_idempotency_key IS NOT NULL
            AND resolution_request_fingerprint IS NOT NULL
            AND resolved_by IS NOT NULL
            AND resolved_at IS NOT NULL
          )
          OR
          (
            status = 'resolved_duplicate'
            AND resolution = 'duplicate_void_draft'
            AND canonical_contribution_id IS NOT NULL
            AND duplicate_contribution_id IS NOT NULL
            AND canonical_contribution_id <> duplicate_contribution_id
            AND canonical_contribution_id IN (contribution_id, candidate_contribution_id)
            AND duplicate_contribution_id IN (contribution_id, candidate_contribution_id)
            AND resolution_reason IS NOT NULL
            AND resolution_evidence_ref IS NOT NULL
            AND resolution_evidence_hash IS NOT NULL
            AND resolution_idempotency_key IS NOT NULL
            AND resolution_request_fingerprint IS NOT NULL
            AND resolved_by IS NOT NULL
            AND resolved_at IS NOT NULL
          )
        ),
        CONSTRAINT fk_business_contribution_anomaly_contribution
          FOREIGN KEY (contribution_id) REFERENCES business_contributions(id) ON DELETE RESTRICT,
        CONSTRAINT fk_business_contribution_anomaly_candidate
          FOREIGN KEY (candidate_contribution_id) REFERENCES business_contributions(id) ON DELETE RESTRICT,
        CONSTRAINT fk_business_contribution_anomaly_canonical
          FOREIGN KEY (canonical_contribution_id) REFERENCES business_contributions(id) ON DELETE RESTRICT,
        CONSTRAINT fk_business_contribution_anomaly_duplicate
          FOREIGN KEY (duplicate_contribution_id) REFERENCES business_contributions(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS business_contribution_anomalies');
    await queryRunner.query('DROP TABLE IF EXISTS business_contribution_attributions');
    await queryRunner.query('DROP TABLE IF EXISTS business_contribution_evidence');
    await queryRunner.query('DROP TABLE IF EXISTS business_contributions');
    await queryRunner.query('DROP TABLE IF EXISTS business_contribution_similarity_clusters');
    await queryRunner.query('DROP TABLE IF EXISTS contribution_source_authority_versions');
  }
}
