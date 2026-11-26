import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive source only. No backfill, authority issuance or runtime activation. */
export class AddMaterialPayableRecordingGuards1799999999072 implements MigrationInterface {
  name = 'AddMaterialPayableRecordingGuards1799999999072';
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE material_payable_source_guards (
        id INT NOT NULL AUTO_INCREMENT,
        purchase_order_id INT NOT NULL,
        payment_intent_id INT NOT NULL,
        content_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        evidence_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        status ENUM('pending','verified','held') NOT NULL DEFAULT 'pending',
        created_by INT NOT NULL,
        reviewed_by INT NULL,
        reviewed_at DATETIME(3) NULL,
        review_log_id INT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_material_payable_purchase (purchase_order_id),
        UNIQUE KEY uq_material_payable_intent (payment_intent_id),
        UNIQUE KEY uq_material_payable_source_review (review_log_id),
        CONSTRAINT fk_material_payable_purchase FOREIGN KEY (purchase_order_id) REFERENCES repair_purchase_orders(id),
        CONSTRAINT fk_material_payable_intent FOREIGN KEY (payment_intent_id) REFERENCES approval_payment_intent(id),
        CONSTRAINT fk_material_payable_source_review FOREIGN KEY (review_log_id) REFERENCES operation_logs(id)
      ) ENGINE=InnoDB
    `);
    await runner.query(`
      CREATE TABLE material_payment_receipt_guards (
        id INT NOT NULL AUTO_INCREMENT,
        bank_account_registry_id INT NOT NULL,
        registry_authority_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        transaction_identity_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        company_id INT NOT NULL,
        supplier_id INT NOT NULL,
        currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        paid_at DATETIME(3) NOT NULL,
        content_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        evidence_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        status ENUM('pending','verified','held') NOT NULL DEFAULT 'pending',
        created_by INT NOT NULL,
        reviewed_by INT NULL,
        reviewed_at DATETIME(3) NULL,
        review_log_id INT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_material_payment_transaction (transaction_identity_hash),
        UNIQUE KEY uq_material_payment_receipt_review (review_log_id),
        CONSTRAINT ck_material_payment_receipt_amount CHECK (amount > 0),
        CONSTRAINT fk_material_payment_receipt_review FOREIGN KEY (review_log_id) REFERENCES operation_logs(id)
      ) ENGINE=InnoDB
    `);
    await runner.query(`
      CREATE TABLE material_payout_installments (
        id INT NOT NULL AUTO_INCREMENT,
        source_id INT NOT NULL,
        receipt_id INT NULL,
        installment_ref CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        state ENUM('reserved','unknown','verified') NOT NULL DEFAULT 'reserved',
        content_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        evidence_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        created_by INT NOT NULL,
        reviewed_by INT NULL,
        reviewed_at DATETIME(3) NULL,
        review_log_id INT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_material_payout_installment_ref (installment_ref),
        UNIQUE KEY uq_material_payout_source_receipt (source_id, receipt_id),
        UNIQUE KEY uq_material_payout_installment_review (review_log_id),
        KEY idx_material_payout_receipt (receipt_id, id),
        CONSTRAINT ck_material_payout_installment_amount CHECK (amount > 0),
        CONSTRAINT ck_material_payout_verified_receipt CHECK (state <> 'verified' OR receipt_id IS NOT NULL),
        CONSTRAINT fk_material_payout_source FOREIGN KEY (source_id) REFERENCES material_payable_source_guards(id),
        CONSTRAINT fk_material_payout_receipt FOREIGN KEY (receipt_id) REFERENCES material_payment_receipt_guards(id),
        CONSTRAINT fk_material_payout_installment_review FOREIGN KEY (review_log_id) REFERENCES operation_logs(id)
      ) ENGINE=InnoDB
    `);
    await runner.query(`
      ALTER TABLE payout_records
        ADD COLUMN material_installment_id INT NULL,
        ADD COLUMN request_idempotency_key VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NULL,
        ADD COLUMN request_fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
        ADD UNIQUE KEY uq_payout_material_installment (material_installment_id),
        ADD UNIQUE KEY uq_payout_request_idempotency (request_idempotency_key),
        ADD KEY idx_payout_approval_id (approval_request_id, id),
        ADD CONSTRAINT fk_payout_material_installment FOREIGN KEY (material_installment_id) REFERENCES material_payout_installments(id),
        ADD CONSTRAINT ck_payout_guard_tuple CHECK (
          (material_installment_id IS NULL AND request_idempotency_key IS NULL AND request_fingerprint IS NULL) OR
          (material_installment_id IS NOT NULL AND request_idempotency_key IS NOT NULL AND request_fingerprint IS NOT NULL)
        )
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    // Never erase financial evidence on rollback. Disposable empty schemas only.
    for (const table of [
      'material_payout_installments', 'material_payment_receipt_guards', 'material_payable_source_guards',
    ]) {
      const [row] = await runner.query(`SELECT COUNT(*) AS count FROM ${table}`);
      if (Number(row.count) !== 0) throw new Error('0072 rollback blocked: retained material payable evidence');
    }
    const [payout] = await runner.query('SELECT COUNT(*) AS count FROM payout_records WHERE material_installment_id IS NOT NULL OR request_idempotency_key IS NOT NULL OR request_fingerprint IS NOT NULL');
    if (Number(payout.count) !== 0) throw new Error('0072 rollback blocked: retained payout evidence');
    await runner.query(`
      ALTER TABLE payout_records
        DROP CHECK ck_payout_guard_tuple,
        DROP FOREIGN KEY fk_payout_material_installment,
        DROP INDEX uq_payout_material_installment,
        DROP INDEX uq_payout_request_idempotency,
        DROP INDEX idx_payout_approval_id,
        DROP COLUMN material_installment_id,
        DROP COLUMN request_idempotency_key,
        DROP COLUMN request_fingerprint
    `);
    await runner.query('DROP TABLE material_payout_installments');
    await runner.query('DROP TABLE material_payment_receipt_guards');
    await runner.query('DROP TABLE material_payable_source_guards');
  }
}
