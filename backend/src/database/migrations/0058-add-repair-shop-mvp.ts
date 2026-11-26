import { MigrationInterface, QueryRunner } from 'typeorm';

const tables = [
  'repair_ai_drafts',
  'repair_knowledge_references',
  'repair_warranty_records',
  'repair_delivery_records',
  'repair_part_links',
  'repair_labor_items',
  'repair_tasks',
  'repair_quality_inspections',
  'repair_confirmation_requests',
  'repair_document_versions',
  'repair_work_order_profiles',
  'repair_vehicle_customer_links',
  'repair_vehicle_plate_histories',
  'repair_vehicle_profiles',
  'business_scope_grants',
  'customer_organization_relationships',
  'customer_master_records',
  'store_sector_assignments',
  'business_stores',
  'company_sector_assignments',
  'business_sectors',
  'business_company_refs',
] as const;

export class AddRepairShopMvp00581786300000000 implements MigrationInterface {
  name = 'AddRepairShopMvp00581786300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE business_company_refs (
        id INT NOT NULL AUTO_INCREMENT,
        company_ref VARCHAR(100) NOT NULL,
        company_registry_id INT NOT NULL,
        display_name_snapshot VARCHAR(200) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'active',
        valid_from DATETIME NOT NULL,
        valid_until DATETIME NULL,
        evidence_ref VARCHAR(255) NOT NULL,
        version INT NOT NULL DEFAULT 1,
        created_by INT NOT NULL,
        reviewed_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_business_company_ref (company_ref),
        UNIQUE KEY uq_business_company_registry_id (company_registry_id),
        CONSTRAINT fk_business_company_registry FOREIGN KEY (company_registry_id) REFERENCES company_registry(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE business_sectors (
        id INT NOT NULL AUTO_INCREMENT,
        business_sector_ref VARCHAR(100) NOT NULL,
        code VARCHAR(64) NOT NULL,
        name VARCHAR(120) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'active',
        version INT NOT NULL DEFAULT 1,
        created_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_business_sector_ref (business_sector_ref),
        UNIQUE KEY uq_business_sector_code (code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE company_sector_assignments (
        id INT NOT NULL AUTO_INCREMENT,
        company_ref VARCHAR(100) NOT NULL,
        business_sector_ref VARCHAR(100) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'active',
        valid_from DATETIME NOT NULL,
        valid_until DATETIME NULL,
        authorization_source VARCHAR(255) NOT NULL,
        reviewed_by INT NOT NULL,
        version INT NOT NULL DEFAULT 1,
        created_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_company_sector_assignment (company_ref, business_sector_ref),
        CONSTRAINT fk_company_sector_company FOREIGN KEY (company_ref) REFERENCES business_company_refs(company_ref) ON DELETE RESTRICT,
        CONSTRAINT fk_company_sector_sector FOREIGN KEY (business_sector_ref) REFERENCES business_sectors(business_sector_ref) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE business_stores (
        id INT NOT NULL AUTO_INCREMENT,
        store_ref VARCHAR(100) NOT NULL,
        company_ref VARCHAR(100) NOT NULL,
        code VARCHAR(64) NOT NULL,
        name VARCHAR(160) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'active',
        valid_from DATETIME NOT NULL,
        valid_until DATETIME NULL,
        version INT NOT NULL DEFAULT 1,
        created_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_business_store_ref (store_ref),
        UNIQUE KEY uq_business_store_company_code (company_ref, code),
        CONSTRAINT fk_business_store_company FOREIGN KEY (company_ref) REFERENCES business_company_refs(company_ref) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE store_sector_assignments (
        id INT NOT NULL AUTO_INCREMENT,
        store_ref VARCHAR(100) NOT NULL,
        business_sector_ref VARCHAR(100) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'active',
        valid_from DATETIME NOT NULL,
        valid_until DATETIME NULL,
        authorization_source VARCHAR(255) NOT NULL,
        reviewed_by INT NOT NULL,
        version INT NOT NULL DEFAULT 1,
        created_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_store_sector_assignment (store_ref, business_sector_ref),
        CONSTRAINT fk_store_sector_store FOREIGN KEY (store_ref) REFERENCES business_stores(store_ref) ON DELETE RESTRICT,
        CONSTRAINT fk_store_sector_sector FOREIGN KEY (business_sector_ref) REFERENCES business_sectors(business_sector_ref) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE customer_master_records (
        id INT NOT NULL AUTO_INCREMENT,
        customer_ref VARCHAR(100) NOT NULL,
        display_name VARCHAR(120) NOT NULL,
        mobile_masked VARCHAR(32) NULL,
        legacy_identification_binding_id INT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'active',
        version INT NOT NULL DEFAULT 1,
        created_by INT NOT NULL,
        reviewed_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_customer_master_ref (customer_ref),
        UNIQUE KEY uq_customer_master_legacy_binding (legacy_identification_binding_id),
        CONSTRAINT fk_customer_master_legacy_binding FOREIGN KEY (legacy_identification_binding_id) REFERENCES customer_identification_bindings(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE customer_organization_relationships (
        id INT NOT NULL AUTO_INCREMENT,
        customer_ref VARCHAR(100) NOT NULL,
        company_ref VARCHAR(100) NOT NULL,
        store_ref VARCHAR(100) NULL,
        store_scope_key VARCHAR(100) GENERATED ALWAYS AS (COALESCE(store_ref, '*')) STORED,
        status VARCHAR(24) NOT NULL DEFAULT 'active',
        valid_from DATETIME NOT NULL,
        valid_until DATETIME NULL,
        relationship_source VARCHAR(255) NOT NULL,
        version INT NOT NULL DEFAULT 1,
        created_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_customer_organization_relationship (customer_ref, company_ref, store_scope_key),
        KEY idx_customer_organization_scope (company_ref, store_ref, status),
        CONSTRAINT fk_customer_org_customer FOREIGN KEY (customer_ref) REFERENCES customer_master_records(customer_ref) ON DELETE RESTRICT,
        CONSTRAINT fk_customer_org_company FOREIGN KEY (company_ref) REFERENCES business_company_refs(company_ref) ON DELETE RESTRICT,
        CONSTRAINT fk_customer_org_store FOREIGN KEY (store_ref) REFERENCES business_stores(store_ref) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE business_scope_grants (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        employee_id INT NOT NULL,
        company_ref VARCHAR(100) NOT NULL,
        business_sector_ref VARCHAR(100) NULL,
        store_ref VARCHAR(100) NULL,
        customer_ref VARCHAR(100) NULL,
        effect VARCHAR(16) NOT NULL,
        permissions JSON NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'active',
        valid_from DATETIME NOT NULL,
        valid_until DATETIME NULL,
        authorization_source VARCHAR(255) NOT NULL,
        reviewed_by INT NOT NULL,
        remark VARCHAR(500) NULL,
        version INT NOT NULL DEFAULT 1,
        created_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        KEY idx_business_scope_grant_subject (user_id, employee_id, status),
        KEY idx_business_scope_grant_scope (company_ref, business_sector_ref, store_ref, customer_ref),
        CONSTRAINT fk_business_scope_grant_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_business_scope_grant_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
        CONSTRAINT fk_business_scope_grant_company FOREIGN KEY (company_ref) REFERENCES business_company_refs(company_ref) ON DELETE RESTRICT,
        CONSTRAINT fk_business_scope_grant_sector FOREIGN KEY (business_sector_ref) REFERENCES business_sectors(business_sector_ref) ON DELETE RESTRICT,
        CONSTRAINT fk_business_scope_grant_store FOREIGN KEY (store_ref) REFERENCES business_stores(store_ref) ON DELETE RESTRICT,
        CONSTRAINT fk_business_scope_grant_customer FOREIGN KEY (customer_ref) REFERENCES customer_master_records(customer_ref) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE repair_vehicle_profiles (
        id INT NOT NULL AUTO_INCREMENT,
        company_ref VARCHAR(100) NOT NULL,
        business_sector_ref VARCHAR(100) NOT NULL,
        initial_service_store_ref VARCHAR(100) NOT NULL,
        company_display_snapshot VARCHAR(200) NOT NULL,
        business_sector_display_snapshot VARCHAR(120) NOT NULL,
        initial_service_store_display_snapshot VARCHAR(160) NOT NULL,
        scope_snapshot_version JSON NOT NULL,
        plate_number VARCHAR(32) NOT NULL,
        vin VARCHAR(64) NULL,
        brand VARCHAR(80) NULL,
        model VARCHAR(120) NULL,
        model_year INT NULL,
        engine_code VARCHAR(64) NULL,
        sales_market VARCHAR(32) NULL,
        odometer_km INT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        version INT NOT NULL DEFAULT 1,
        created_by INT NOT NULL,
        updated_by INT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_repair_vehicle_company_vin (company_ref, vin),
        KEY idx_repair_vehicle_company_plate (company_ref, plate_number),
        CONSTRAINT fk_repair_vehicle_company FOREIGN KEY (company_ref) REFERENCES business_company_refs(company_ref) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_vehicle_sector FOREIGN KEY (business_sector_ref) REFERENCES business_sectors(business_sector_ref) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_vehicle_initial_service_store FOREIGN KEY (initial_service_store_ref) REFERENCES business_stores(store_ref) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE repair_vehicle_plate_histories (
        id INT NOT NULL AUTO_INCREMENT,
        vehicle_id INT NOT NULL,
        company_ref VARCHAR(100) NOT NULL,
        plate_number VARCHAR(32) NOT NULL,
        valid_from DATETIME NOT NULL,
        valid_until DATETIME NULL,
        current_plate_key TINYINT GENERATED ALWAYS AS (IF(valid_until IS NULL, 1, NULL)) STORED,
        source_evidence_ref VARCHAR(255) NOT NULL,
        reviewed_by INT NOT NULL,
        created_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_repair_vehicle_current_plate (vehicle_id, current_plate_key),
        KEY idx_repair_vehicle_plate_history_vehicle (vehicle_id, valid_from),
        KEY idx_repair_vehicle_plate_history_lookup (company_ref, plate_number),
        CONSTRAINT fk_repair_vehicle_plate_history_vehicle FOREIGN KEY (vehicle_id) REFERENCES repair_vehicle_profiles(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_vehicle_plate_history_company FOREIGN KEY (company_ref) REFERENCES business_company_refs(company_ref) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE repair_vehicle_customer_links (
        id INT NOT NULL AUTO_INCREMENT,
        vehicle_id INT NOT NULL,
        company_ref VARCHAR(100) NOT NULL,
        business_sector_ref VARCHAR(100) NOT NULL,
        store_ref VARCHAR(100) NOT NULL,
        customer_ref VARCHAR(100) NOT NULL,
        relationship_type VARCHAR(24) NOT NULL,
        confirmation_status VARCHAR(24) NOT NULL DEFAULT 'confirmed',
        status VARCHAR(24) NOT NULL DEFAULT 'active',
        valid_from DATETIME NOT NULL,
        valid_until DATETIME NULL,
        active_link_key TINYINT GENERATED ALWAYS AS (IF(status = 'active' AND valid_until IS NULL, 1, NULL)) STORED,
        relationship_source VARCHAR(255) NOT NULL,
        reviewed_by INT NOT NULL,
        closed_by INT NULL,
        closure_evidence_ref VARCHAR(255) NULL,
        created_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_repair_vehicle_active_customer_link (vehicle_id, customer_ref, relationship_type, active_link_key),
        KEY idx_repair_vehicle_customer_link_customer (company_ref, customer_ref, status),
        KEY idx_repair_vehicle_customer_link_vehicle (vehicle_id, status),
        CONSTRAINT fk_repair_vehicle_customer_link_vehicle FOREIGN KEY (vehicle_id) REFERENCES repair_vehicle_profiles(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_vehicle_customer_link_company FOREIGN KEY (company_ref) REFERENCES business_company_refs(company_ref) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_vehicle_customer_link_sector FOREIGN KEY (business_sector_ref) REFERENCES business_sectors(business_sector_ref) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_vehicle_customer_link_store FOREIGN KEY (store_ref) REFERENCES business_stores(store_ref) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_vehicle_customer_link_customer FOREIGN KEY (customer_ref) REFERENCES customer_master_records(customer_ref) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE repair_work_order_profiles (
        id INT NOT NULL AUTO_INCREMENT,
        work_order_id INT NOT NULL,
        company_ref VARCHAR(100) NOT NULL,
        business_sector_ref VARCHAR(100) NOT NULL,
        store_ref VARCHAR(100) NOT NULL,
        customer_ref VARCHAR(100) NOT NULL,
        company_display_snapshot VARCHAR(200) NOT NULL,
        business_sector_display_snapshot VARCHAR(120) NOT NULL,
        store_display_snapshot VARCHAR(160) NOT NULL,
        customer_display_snapshot VARCHAR(120) NOT NULL,
        scope_snapshot_version JSON NOT NULL,
        scope_resolution_evidence_ref VARCHAR(255) NOT NULL,
        legacy_customer_binding_id INT NOT NULL,
        scope_resolved_at DATETIME NOT NULL,
        vehicle_id INT NOT NULL,
        lifecycle_status VARCHAR(40) NOT NULL,
        suspended_from_status VARCHAR(40) NULL,
        suspended_at DATETIME NULL,
        suspended_by INT NULL,
        suspension_reason VARCHAR(500) NULL,
        resumed_at DATETIME NULL,
        resumed_by INT NULL,
        resume_reason VARCHAR(500) NULL,
        active_plan_version INT NULL,
        active_quote_version INT NULL,
        active_explanation_version INT NULL,
        customer_confirmation_state VARCHAR(32) NOT NULL DEFAULT 'not_requested',
        version INT NOT NULL DEFAULT 1,
        knowledge_catalog_version INT NOT NULL DEFAULT 1,
        created_by INT NOT NULL,
        updated_by INT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_repair_work_order_profile_work_order (work_order_id),
        KEY idx_repair_work_order_scope (company_ref, business_sector_ref, store_ref),
        KEY idx_repair_profile_customer_binding (legacy_customer_binding_id),
        CONSTRAINT fk_repair_profile_work_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_profile_vehicle FOREIGN KEY (vehicle_id) REFERENCES repair_vehicle_profiles(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_profile_customer_binding FOREIGN KEY (legacy_customer_binding_id) REFERENCES customer_identification_bindings(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_profile_company FOREIGN KEY (company_ref) REFERENCES business_company_refs(company_ref) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_profile_sector FOREIGN KEY (business_sector_ref) REFERENCES business_sectors(business_sector_ref) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_profile_store FOREIGN KEY (store_ref) REFERENCES business_stores(store_ref) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_profile_customer FOREIGN KEY (customer_ref) REFERENCES customer_master_records(customer_ref) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE repair_document_versions (
        id INT NOT NULL AUTO_INCREMENT,
        work_order_id INT NOT NULL,
        document_type VARCHAR(40) NOT NULL,
        version INT NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'review_pending',
        summary VARCHAR(500) NOT NULL,
        payload JSON NOT NULL,
        source_references JSON NULL,
        generated_by VARCHAR(16) NOT NULL DEFAULT 'human',
        created_by INT NOT NULL,
        reviewed_by INT NULL,
        reviewed_at DATETIME NULL,
        review_note VARCHAR(500) NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_repair_document_version (work_order_id, document_type, version),
        KEY idx_repair_document_lookup (work_order_id, document_type, status),
        CONSTRAINT fk_repair_document_work_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE repair_confirmation_requests (
        id INT NOT NULL AUTO_INCREMENT,
        work_order_id INT NOT NULL,
        plan_version INT NOT NULL,
        quote_version INT NOT NULL,
        explanation_version INT NOT NULL,
        request_idempotency_key VARCHAR(96) NOT NULL,
        request_fingerprint CHAR(64) NOT NULL,
        channel VARCHAR(24) NOT NULL,
        recipient_masked VARCHAR(100) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'pending',
        message VARCHAR(500) NULL,
        decision_evidence_ref VARCHAR(255) NULL,
        decision_note VARCHAR(500) NULL,
        requested_by INT NOT NULL,
        requested_at DATETIME NOT NULL,
        decided_by INT NULL,
        decided_at DATETIME NULL,
        version INT NOT NULL DEFAULT 1,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_repair_confirmation_idempotency (request_idempotency_key),
        KEY idx_repair_confirmation_work_order (work_order_id, status),
        CONSTRAINT fk_repair_confirmation_work_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE repair_quality_inspections (
        id INT NOT NULL AUTO_INCREMENT,
        work_order_id INT NOT NULL,
        result VARCHAR(16) NOT NULL,
        checklist JSON NOT NULL,
        road_test_result VARCHAR(500) NULL,
        rework_reason VARCHAR(1000) NULL,
        rework_plan_item_refs JSON NULL,
        inspected_by_employee_id INT NOT NULL,
        created_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        KEY idx_repair_quality_work_order (work_order_id, created_at),
        CONSTRAINT fk_repair_quality_work_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_quality_employee FOREIGN KEY (inspected_by_employee_id) REFERENCES employees(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE repair_tasks (
        id INT NOT NULL AUTO_INCREMENT,
        work_order_id INT NOT NULL,
        plan_version INT NOT NULL,
        plan_item_ref VARCHAR(100) NOT NULL,
        rework_of_inspection_id INT NULL,
        title VARCHAR(160) NOT NULL,
        system_name VARCHAR(100) NULL,
        technician_employee_id INT NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'pending',
        safety_notes VARCHAR(1000) NULL,
        completion_evidence JSON NULL,
        version INT NOT NULL DEFAULT 1,
        created_by INT NOT NULL,
        updated_by INT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        KEY idx_repair_task_plan_item_execution (work_order_id, plan_version, plan_item_ref, rework_of_inspection_id),
        KEY idx_repair_tasks_work_order (work_order_id, status),
        CONSTRAINT fk_repair_task_work_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_task_rework_inspection FOREIGN KEY (rework_of_inspection_id) REFERENCES repair_quality_inspections(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_task_technician FOREIGN KEY (technician_employee_id) REFERENCES employees(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE repair_labor_items (
        id INT NOT NULL AUTO_INCREMENT,
        work_order_id INT NOT NULL,
        task_id INT NOT NULL,
        technician_employee_id INT NOT NULL,
        labor_code VARCHAR(64) NOT NULL,
        name VARCHAR(160) NOT NULL,
        standard_hours DECIMAL(8,2) NOT NULL,
        actual_hours DECIMAL(8,2) NOT NULL,
        hourly_rate DECIMAL(12,2) NOT NULL,
        quote_line_ref VARCHAR(100) NOT NULL,
        created_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        KEY idx_repair_labor_work_order (work_order_id, task_id),
        UNIQUE KEY uq_repair_labor_task_code (work_order_id, task_id, labor_code),
        CONSTRAINT fk_repair_labor_work_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_labor_task FOREIGN KEY (task_id) REFERENCES repair_tasks(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_labor_technician FOREIGN KEY (technician_employee_id) REFERENCES employees(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE repair_part_links (
        id INT NOT NULL AUTO_INCREMENT,
        work_order_id INT NOT NULL,
        task_id INT NOT NULL,
        work_order_material_id INT NOT NULL,
        quote_line_ref VARCHAR(100) NOT NULL,
        usage_note VARCHAR(500) NULL,
        created_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_repair_part_link_material (work_order_id, work_order_material_id),
        CONSTRAINT fk_repair_part_work_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_part_task FOREIGN KEY (task_id) REFERENCES repair_tasks(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_part_material FOREIGN KEY (work_order_material_id) REFERENCES work_order_materials(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE repair_delivery_records (
        id INT NOT NULL AUTO_INCREMENT,
        work_order_id INT NOT NULL,
        checklist JSON NOT NULL,
        plan_version INT NOT NULL,
        quote_version INT NOT NULL,
        explanation_version INT NOT NULL,
        finance_evidence_refs JSON NOT NULL,
        quote_total_snapshot DECIMAL(12,2) NOT NULL,
        finance_ready_amount_snapshot DECIMAL(12,2) NOT NULL,
        final_odometer_km INT NOT NULL,
        repair_summary VARCHAR(1000) NOT NULL,
        unresolved_reminders JSON NOT NULL,
        customer_ack_evidence_ref VARCHAR(255) NOT NULL,
        delivered_by_employee_id INT NOT NULL,
        delivered_at DATETIME NOT NULL,
        created_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_repair_delivery_work_order (work_order_id),
        CONSTRAINT fk_repair_delivery_work_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_delivery_employee FOREIGN KEY (delivered_by_employee_id) REFERENCES employees(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE repair_warranty_records (
        id INT NOT NULL AUTO_INCREMENT,
        work_order_id INT NOT NULL,
        warranty_type VARCHAR(24) NOT NULL,
        coverage_snapshot JSON NOT NULL,
        starts_at DATETIME NOT NULL,
        ends_at DATETIME NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'active',
        claim_note VARCHAR(1000) NULL,
        created_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        KEY idx_repair_warranty_work_order (work_order_id, status),
        CONSTRAINT fk_repair_warranty_work_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE repair_knowledge_references (
        id INT NOT NULL AUTO_INCREMENT,
        reference_type VARCHAR(24) NOT NULL,
        title VARCHAR(255) NOT NULL,
        url VARCHAR(500) NOT NULL,
        source_authority VARCHAR(160) NOT NULL,
        authority_rank INT NOT NULL,
        tags JSON NOT NULL,
        applicability JSON NOT NULL,
        revision VARCHAR(100) NULL,
        effective_at DATETIME NULL,
        verified_at DATETIME NULL,
        valid_until DATETIME NULL,
        review_status VARCHAR(32) NOT NULL DEFAULT 'review_pending',
        review_reason VARCHAR(500) NULL,
        risk_notice VARCHAR(500) NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_by INT NOT NULL,
        reviewed_by INT NULL,
        version INT NOT NULL DEFAULT 1,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        KEY idx_repair_knowledge_type_active (reference_type, active),
        KEY idx_repair_knowledge_review_rank (review_status, authority_rank, valid_until)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE repair_ai_drafts (
        id INT NOT NULL AUTO_INCREMENT,
        work_order_id INT NOT NULL,
        draft_type VARCHAR(40) NOT NULL,
        request_idempotency_key VARCHAR(96) NOT NULL,
        request_fingerprint CHAR(64) NOT NULL,
        input_snapshot JSON NOT NULL,
        output_snapshot JSON NOT NULL,
        knowledge_reference_ids JSON NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'draft',
        requires_human_review TINYINT(1) NOT NULL DEFAULT 1,
        created_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_repair_ai_draft_idempotency (request_idempotency_key),
        KEY idx_repair_ai_draft_work_order (work_order_id, draft_type),
        CONSTRAINT fk_repair_ai_draft_work_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS \`${table}\``);
    }
  }
}
