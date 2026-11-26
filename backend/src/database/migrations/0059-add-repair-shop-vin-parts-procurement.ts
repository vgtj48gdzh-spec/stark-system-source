import { MigrationInterface, QueryRunner } from 'typeorm';

const tables = [
  'repair_supplier_warranty_claims',
  'repair_procurement_allocations',
  'repair_goods_receipts',
  'repair_supplier_shipments',
  'repair_purchase_orders',
  'repair_procurement_decisions',
  'repair_supplier_quotes',
  'repair_supplier_inquiries',
  'repair_procurement_demands',
  'repair_part_fitment_evidence',
  'repair_vehicle_identity_evidence',
] as const;

export class AddRepairShopVinPartsProcurement00591786600000000 implements MigrationInterface {
  name = 'AddRepairShopVinPartsProcurement00591786600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE repair_vehicle_identity_evidence (
        id INT NOT NULL AUTO_INCREMENT,
        vehicle_id INT NOT NULL,
        company_ref VARCHAR(100) NOT NULL,
        business_sector_ref VARCHAR(100) NOT NULL,
        store_ref VARCHAR(100) NOT NULL,
        customer_ref VARCHAR(100) NOT NULL,
        evidence_type VARCHAR(32) NOT NULL,
        provider_code VARCHAR(80) NOT NULL,
        provider_version VARCHAR(80) NULL,
        evidence_ref VARCHAR(255) NOT NULL,
        image_sha256 CHAR(64) NULL,
        vin_candidate CHAR(17) NOT NULL,
        checksum_status VARCHAR(24) NOT NULL,
        confidence DECIMAL(5,2) NOT NULL,
        decode_snapshot JSON NULL,
        request_idempotency_key VARCHAR(96) NOT NULL,
        request_fingerprint CHAR(64) NOT NULL,
        review_status VARCHAR(24) NOT NULL DEFAULT 'review_pending',
        review_note VARCHAR(500) NULL,
        created_by INT NOT NULL,
        reviewed_by INT NULL,
        reviewed_at DATETIME NULL,
        version INT NOT NULL DEFAULT 1,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_repair_vehicle_identity_idempotency (request_idempotency_key),
        KEY idx_repair_vehicle_identity_vehicle (vehicle_id, review_status),
        CONSTRAINT fk_repair_vehicle_identity_vehicle FOREIGN KEY (vehicle_id) REFERENCES repair_vehicle_profiles(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE repair_part_fitment_evidence (
        id INT NOT NULL AUTO_INCREMENT,
        work_order_id INT NOT NULL,
        vehicle_id INT NOT NULL,
        company_ref VARCHAR(100) NOT NULL,
        business_sector_ref VARCHAR(100) NOT NULL,
        store_ref VARCHAR(100) NOT NULL,
        customer_ref VARCHAR(100) NOT NULL,
        source_type VARCHAR(32) NOT NULL,
        provider_code VARCHAR(80) NOT NULL,
        provider_version VARCHAR(80) NULL,
        source_ref VARCHAR(255) NOT NULL,
        oe_number VARCHAR(100) NOT NULL,
        part_name VARCHAR(160) NOT NULL,
        diagram_ref VARCHAR(255) NULL,
        applicability_snapshot JSON NOT NULL,
        confidence DECIMAL(5,2) NOT NULL,
        request_idempotency_key VARCHAR(96) NOT NULL,
        request_fingerprint CHAR(64) NOT NULL,
        fitment_status VARCHAR(24) NOT NULL DEFAULT 'candidate',
        review_note VARCHAR(500) NULL,
        valid_until DATETIME NULL,
        created_by INT NOT NULL,
        reviewed_by INT NULL,
        reviewed_at DATETIME NULL,
        version INT NOT NULL DEFAULT 1,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_repair_part_fitment_idempotency (request_idempotency_key),
        KEY idx_repair_part_fitment_work_order (work_order_id, fitment_status),
        CONSTRAINT fk_repair_fitment_work_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_fitment_vehicle FOREIGN KEY (vehicle_id) REFERENCES repair_vehicle_profiles(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE repair_procurement_demands (
        id INT NOT NULL AUTO_INCREMENT,
        work_order_id INT NOT NULL,
        vehicle_id INT NOT NULL,
        company_ref VARCHAR(100) NOT NULL,
        business_sector_ref VARCHAR(100) NOT NULL,
        store_ref VARCHAR(100) NOT NULL,
        customer_ref VARCHAR(100) NOT NULL,
        plan_version INT NOT NULL,
        quote_version INT NOT NULL,
        plan_item_ref VARCHAR(100) NOT NULL,
        quote_line_ref VARCHAR(100) NOT NULL,
        fitment_evidence_id INT NOT NULL,
        material_id INT NULL,
        oe_number VARCHAR(100) NOT NULL,
        part_name VARCHAR(160) NOT NULL,
        specification VARCHAR(200) NULL,
        quantity DECIMAL(12,2) NOT NULL,
        unit VARCHAR(30) NOT NULL,
        fulfillment_mode VARCHAR(32) NOT NULL,
        special_flag VARCHAR(80) NULL,
        inventory_snapshot JSON NULL,
        request_idempotency_key VARCHAR(96) NOT NULL,
        request_fingerprint CHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'draft',
        created_by INT NOT NULL,
        updated_by INT NULL,
        version INT NOT NULL DEFAULT 1,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_repair_procurement_demand_idempotency (request_idempotency_key),
        KEY idx_repair_procurement_demand_work_order (work_order_id, status),
        CONSTRAINT fk_repair_demand_work_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_demand_vehicle FOREIGN KEY (vehicle_id) REFERENCES repair_vehicle_profiles(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_demand_fitment FOREIGN KEY (fitment_evidence_id) REFERENCES repair_part_fitment_evidence(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_demand_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE repair_supplier_inquiries (
        id INT NOT NULL AUTO_INCREMENT,
        demand_id INT NOT NULL,
        work_order_id INT NOT NULL,
        supplier_id INT NOT NULL,
        supplier_name_snapshot VARCHAR(100) NOT NULL,
        supplier_score_snapshot DECIMAL(5,2) NULL,
        inquiry_no VARCHAR(48) NOT NULL,
        request_snapshot JSON NOT NULL,
        request_idempotency_key VARCHAR(96) NOT NULL,
        request_fingerprint CHAR(64) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'draft',
        requested_at DATETIME NULL,
        created_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_repair_supplier_inquiry_no (inquiry_no),
        UNIQUE KEY uq_repair_supplier_inquiry_idempotency (request_idempotency_key),
        KEY idx_repair_supplier_inquiry_demand (demand_id, status),
        CONSTRAINT fk_repair_inquiry_demand FOREIGN KEY (demand_id) REFERENCES repair_procurement_demands(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_inquiry_work_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_inquiry_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE repair_supplier_quotes (
        id INT NOT NULL AUTO_INCREMENT,
        inquiry_id INT NOT NULL,
        demand_id INT NOT NULL,
        work_order_id INT NOT NULL,
        supplier_id INT NOT NULL,
        quote_version INT NOT NULL,
        unit_price DECIMAL(12,2) NOT NULL,
        quantity DECIMAL(12,2) NOT NULL,
        freight_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        tax_included TINYINT(1) NOT NULL DEFAULT 0,
        lead_time_days INT NOT NULL,
        returnable TINYINT(1) NOT NULL DEFAULT 0,
        warranty_months INT NULL,
        payment_terms VARCHAR(120) NOT NULL,
        valid_until DATETIME NOT NULL,
        source_ref VARCHAR(255) NOT NULL,
        response_snapshot JSON NULL,
        fitment_evidence_id INT NOT NULL,
        request_idempotency_key VARCHAR(96) NOT NULL,
        request_fingerprint CHAR(64) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'candidate',
        created_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_repair_supplier_quote_idempotency (request_idempotency_key),
        UNIQUE KEY uq_repair_supplier_quote_version (inquiry_id, quote_version),
        KEY idx_repair_supplier_quote_demand (demand_id, status),
        CONSTRAINT fk_repair_quote_inquiry FOREIGN KEY (inquiry_id) REFERENCES repair_supplier_inquiries(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_quote_demand FOREIGN KEY (demand_id) REFERENCES repair_procurement_demands(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_quote_work_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_quote_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_quote_fitment FOREIGN KEY (fitment_evidence_id) REFERENCES repair_part_fitment_evidence(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE repair_procurement_decisions (
        id INT NOT NULL AUTO_INCREMENT,
        demand_id INT NOT NULL,
        work_order_id INT NOT NULL,
        decision_version INT NOT NULL,
        selected_quote_id INT NOT NULL,
        approval_mode VARCHAR(24) NOT NULL,
        customer_confirmation_request_id INT NULL,
        approval_request_id INT NULL,
        ai_analysis_snapshot JSON NOT NULL,
        override_reason VARCHAR(500) NULL,
        request_idempotency_key VARCHAR(96) NOT NULL,
        request_fingerprint CHAR(64) NOT NULL,
        decision_status VARCHAR(40) NOT NULL,
        created_by INT NOT NULL,
        updated_by INT NULL,
        version INT NOT NULL DEFAULT 1,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_repair_procurement_decision_idempotency (request_idempotency_key),
        UNIQUE KEY uq_repair_procurement_decision_version (demand_id, decision_version),
        UNIQUE KEY uq_repair_procurement_decision_approval (approval_request_id),
        KEY idx_repair_procurement_decision_work_order (work_order_id, decision_status),
        CONSTRAINT fk_repair_decision_demand FOREIGN KEY (demand_id) REFERENCES repair_procurement_demands(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_decision_work_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_decision_quote FOREIGN KEY (selected_quote_id) REFERENCES repair_supplier_quotes(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_decision_confirmation FOREIGN KEY (customer_confirmation_request_id) REFERENCES repair_confirmation_requests(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_decision_approval FOREIGN KEY (approval_request_id) REFERENCES approval_requests(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE repair_purchase_orders (
        id INT NOT NULL AUTO_INCREMENT,
        order_no VARCHAR(48) NOT NULL,
        work_order_id INT NOT NULL,
        vehicle_id INT NOT NULL,
        company_ref VARCHAR(100) NOT NULL,
        business_sector_ref VARCHAR(100) NOT NULL,
        store_ref VARCHAR(100) NOT NULL,
        customer_ref VARCHAR(100) NOT NULL,
        supplier_id INT NOT NULL,
        supplier_name_snapshot VARCHAR(100) NOT NULL,
        decision_ids JSON NOT NULL,
        line_snapshot JSON NOT NULL,
        approval_request_ids JSON NOT NULL,
        payment_approval_request_id INT NOT NULL,
        payment_intent_id INT NULL,
        payment_state VARCHAR(32) NOT NULL DEFAULT 'not_bound',
        total_amount DECIMAL(12,2) NOT NULL,
        expected_arrival_at DATETIME NULL,
        issue_evidence_ref VARCHAR(255) NULL,
        request_idempotency_key VARCHAR(96) NOT NULL,
        request_fingerprint CHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'approval_complete',
        created_by INT NOT NULL,
        updated_by INT NULL,
        version INT NOT NULL DEFAULT 1,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_repair_purchase_order_no (order_no),
        UNIQUE KEY uq_repair_purchase_order_idempotency (request_idempotency_key),
        UNIQUE KEY uq_repair_purchase_order_payment_approval (payment_approval_request_id),
        KEY idx_repair_purchase_order_work_order (work_order_id, status),
        CONSTRAINT fk_repair_purchase_work_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_purchase_vehicle FOREIGN KEY (vehicle_id) REFERENCES repair_vehicle_profiles(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_purchase_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_purchase_payment_approval FOREIGN KEY (payment_approval_request_id) REFERENCES approval_requests(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_purchase_payment_intent FOREIGN KEY (payment_intent_id) REFERENCES approval_payment_intent(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE repair_supplier_shipments (
        id INT NOT NULL AUTO_INCREMENT,
        purchase_order_id INT NOT NULL,
        work_order_id INT NOT NULL,
        carrier_name VARCHAR(100) NOT NULL,
        tracking_no VARCHAR(100) NOT NULL,
        shipment_evidence_ref VARCHAR(255) NOT NULL,
        request_idempotency_key VARCHAR(96) NOT NULL,
        request_fingerprint CHAR(64) NOT NULL,
        shipped_at DATETIME NOT NULL,
        expected_at DATETIME NULL,
        delivered_at DATETIME NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'shipped',
        created_by INT NOT NULL,
        version INT NOT NULL DEFAULT 1,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_repair_supplier_shipment_idempotency (request_idempotency_key),
        KEY idx_repair_supplier_shipment_order (purchase_order_id, status),
        CONSTRAINT fk_repair_shipment_purchase FOREIGN KEY (purchase_order_id) REFERENCES repair_purchase_orders(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_shipment_work_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE repair_goods_receipts (
        id INT NOT NULL AUTO_INCREMENT,
        receipt_no VARCHAR(48) NOT NULL,
        purchase_order_id INT NOT NULL,
        shipment_id INT NOT NULL,
        work_order_id INT NOT NULL,
        receipt_mode VARCHAR(32) NOT NULL,
        warehouse_id INT NULL,
        inspection_snapshot JSON NOT NULL,
        received_at DATETIME NOT NULL,
        request_idempotency_key VARCHAR(96) NOT NULL,
        request_fingerprint CHAR(64) NOT NULL,
        status VARCHAR(24) NOT NULL,
        created_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_repair_goods_receipt_no (receipt_no),
        UNIQUE KEY uq_repair_goods_receipt_idempotency (request_idempotency_key),
        KEY idx_repair_goods_receipt_order (purchase_order_id, status),
        CONSTRAINT fk_repair_receipt_purchase FOREIGN KEY (purchase_order_id) REFERENCES repair_purchase_orders(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_receipt_shipment FOREIGN KEY (shipment_id) REFERENCES repair_supplier_shipments(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_receipt_work_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_receipt_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE repair_procurement_allocations (
        id INT NOT NULL AUTO_INCREMENT,
        receipt_id INT NOT NULL,
        demand_id INT NOT NULL,
        work_order_id INT NOT NULL,
        material_id INT NULL,
        work_order_material_id INT NULL,
        inventory_transaction_id INT NULL,
        repair_task_id INT NULL,
        quantity DECIMAL(12,2) NOT NULL,
        link_evidence_ref VARCHAR(255) NOT NULL,
        request_idempotency_key VARCHAR(96) NOT NULL,
        request_fingerprint CHAR(64) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'linked',
        installed_at DATETIME NULL,
        created_by INT NOT NULL,
        updated_by INT NULL,
        version INT NOT NULL DEFAULT 1,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_repair_procurement_allocation_idempotency (request_idempotency_key),
        KEY idx_repair_procurement_allocation_receipt (receipt_id, status),
        KEY idx_repair_procurement_allocation_demand (demand_id, status),
        KEY idx_repair_procurement_allocation_inventory (inventory_transaction_id, status),
        KEY idx_repair_procurement_allocation_work_order (work_order_id, status),
        CONSTRAINT fk_repair_allocation_receipt FOREIGN KEY (receipt_id) REFERENCES repair_goods_receipts(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_allocation_demand FOREIGN KEY (demand_id) REFERENCES repair_procurement_demands(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_allocation_work_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_allocation_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_allocation_work_material FOREIGN KEY (work_order_material_id) REFERENCES work_order_materials(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_allocation_inventory FOREIGN KEY (inventory_transaction_id) REFERENCES inventory_transactions(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_allocation_task FOREIGN KEY (repair_task_id) REFERENCES repair_tasks(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE repair_supplier_warranty_claims (
        id INT NOT NULL AUTO_INCREMENT,
        claim_no VARCHAR(48) NOT NULL,
        purchase_order_id INT NOT NULL,
        receipt_id INT NOT NULL,
        allocation_id INT NOT NULL,
        work_order_id INT NOT NULL,
        supplier_id INT NOT NULL,
        repair_warranty_record_id INT NULL,
        issue_snapshot JSON NOT NULL,
        evidence_refs JSON NOT NULL,
        request_idempotency_key VARCHAR(96) NOT NULL,
        request_fingerprint CHAR(64) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'draft',
        created_by INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_repair_supplier_claim_no (claim_no),
        UNIQUE KEY uq_repair_supplier_claim_idempotency (request_idempotency_key),
        KEY idx_repair_supplier_claim_work_order (work_order_id, status),
        CONSTRAINT fk_repair_claim_purchase FOREIGN KEY (purchase_order_id) REFERENCES repair_purchase_orders(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_claim_receipt FOREIGN KEY (receipt_id) REFERENCES repair_goods_receipts(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_claim_allocation FOREIGN KEY (allocation_id) REFERENCES repair_procurement_allocations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_claim_work_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_claim_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
        CONSTRAINT fk_repair_claim_warranty FOREIGN KEY (repair_warranty_record_id) REFERENCES repair_warranty_records(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS \`${table}\``);
    }
  }
}
