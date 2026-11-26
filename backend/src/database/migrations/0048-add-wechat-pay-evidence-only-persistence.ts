import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

const providerEnum = ['wechat_pay_v3', 'wechat_pay_v3_official_like_dummy'];

export class AddWechatPayEvidenceOnlyPersistence00481751104000000
  implements MigrationInterface
{
  name = 'AddWechatPayEvidenceOnlyPersistence00481751104000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createCallbackEvidence(queryRunner);
    await this.createCryptoVerificationAudit(queryRunner);
    await this.createManualReviewTask(queryRunner);
    await this.createSettlementEvidence(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of [
      'wechat_pay_manual_review_task',
      'wechat_pay_settlement_evidence',
      'wechat_pay_crypto_verification_audit',
      'wechat_pay_callback_evidence',
    ]) {
      if (await queryRunner.hasTable(tableName)) {
        await queryRunner.dropTable(tableName);
      }
    }
  }

  private async createCallbackEvidence(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('wechat_pay_callback_evidence')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'wechat_pay_callback_evidence',
        columns: [
          idColumn(),
          sourceColumn(),
          providerColumn(),
          {
            name: 'status',
            type: 'enum',
            enum: [
              'received',
              'signature_failed',
              'decrypt_failed',
              'parsed',
              'linked_to_payment_request',
              'linked_to_collection_order',
              'duplicate',
              'exception_candidate',
              'review_required',
              'archived',
            ],
            default: "'received'",
          },
          { name: 'event_type', type: 'varchar', length: '80', isNullable: true },
          { name: 'resource_type', type: 'varchar', length: '120', isNullable: true },
          { name: 'notification_id_hash', type: 'varchar', length: '128', isNullable: true },
          { name: 'transaction_id_hash', type: 'varchar', length: '128', isNullable: true },
          { name: 'out_trade_no_hash', type: 'varchar', length: '128', isNullable: true },
          { name: 'finance_payment_request_id', type: 'int', isNullable: true },
          { name: 'finance_collection_order_id', type: 'int', isNullable: true },
          { name: 'amount_total_cents', type: 'int', isNullable: true },
          { name: 'payer_total_cents', type: 'int', isNullable: true },
          { name: 'currency', type: 'varchar', length: '12', isNullable: true },
          { name: 'trade_state', type: 'varchar', length: '80', isNullable: true },
          { name: 'success_time', type: 'datetime', isNullable: true },
          payloadHashColumn(),
          fingerprintColumn(),
          sanitizedPayloadColumn(),
          redactionVersionColumn(),
          { name: 'received_at', type: 'datetime', isNullable: true },
          errorCodeColumn(),
          errorReasonColumn(),
          notesColumn(),
          createdAtColumn(),
          updatedAtColumn(),
        ],
      }),
    );

    await queryRunner.createIndices('wechat_pay_callback_evidence', [
      new TableIndex({
        name: 'idx_wechat_pay_callback_evidence_provider_status',
        columnNames: ['provider', 'status'],
      }),
      new TableIndex({
        name: 'idx_wechat_pay_callback_evidence_transaction_hash',
        columnNames: ['transaction_id_hash'],
      }),
      new TableIndex({
        name: 'idx_wechat_pay_callback_evidence_out_trade_hash',
        columnNames: ['out_trade_no_hash'],
      }),
      new TableIndex({
        name: 'idx_wechat_pay_callback_evidence_created_at',
        columnNames: ['created_at'],
      }),
    ]);
  }

  private async createCryptoVerificationAudit(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('wechat_pay_crypto_verification_audit')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'wechat_pay_crypto_verification_audit',
        columns: [
          idColumn(),
          sourceColumn(),
          providerColumn(),
          {
            name: 'status',
            type: 'enum',
            enum: [
              'audit_candidate',
              'signature_pass_candidate',
              'signature_failed',
              'decrypt_pass_candidate',
              'decrypt_failed',
              'replay_candidate',
              'review_required',
              'archived',
            ],
            default: "'audit_candidate'",
          },
          { name: 'callback_evidence_id', type: 'int', isNullable: true },
          {
            name: 'signature_result',
            type: 'enum',
            enum: ['pass_candidate', 'failed', 'not_evaluated', 'review_required'],
            default: "'not_evaluated'",
          },
          {
            name: 'decrypt_result',
            type: 'enum',
            enum: ['pass_candidate', 'failed', 'not_evaluated', 'review_required'],
            default: "'not_evaluated'",
          },
          { name: 'certificate_serial_hash', type: 'varchar', length: '128', isNullable: true },
          { name: 'timestamp_value', type: 'varchar', length: '40', isNullable: true },
          { name: 'timestamp_window_result', type: 'varchar', length: '60', isNullable: true },
          { name: 'nonce_hash', type: 'varchar', length: '128', isNullable: true },
          { name: 'replay_fingerprint_hash', type: 'varchar', length: '128', isNullable: true },
          { name: 'replay_check_result', type: 'varchar', length: '60', isNullable: true },
          payloadHashColumn(),
          fingerprintColumn(),
          sanitizedPayloadColumn(),
          redactionVersionColumn(),
          { name: 'audited_at', type: 'datetime', isNullable: true },
          errorCodeColumn(),
          errorReasonColumn(),
          notesColumn(),
          createdAtColumn(),
          updatedAtColumn(),
        ],
      }),
    );

    await queryRunner.createIndices('wechat_pay_crypto_verification_audit', [
      new TableIndex({
        name: 'idx_wechat_pay_crypto_audit_callback',
        columnNames: ['callback_evidence_id'],
      }),
      new TableIndex({
        name: 'idx_wechat_pay_crypto_audit_provider_status',
        columnNames: ['provider', 'status'],
      }),
      new TableIndex({
        name: 'idx_wechat_pay_crypto_audit_replay_hash',
        columnNames: ['replay_fingerprint_hash'],
      }),
      new TableIndex({
        name: 'idx_wechat_pay_crypto_audit_created_at',
        columnNames: ['created_at'],
      }),
    ]);
  }

  private async createManualReviewTask(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('wechat_pay_manual_review_task')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'wechat_pay_manual_review_task',
        columns: [
          idColumn(),
          sourceColumn(),
          providerColumn(),
          {
            name: 'status',
            type: 'enum',
            enum: [
              'pending_review',
              'assigned',
              'reviewed',
              'approved_candidate',
              'rejected',
              'needs_more_evidence',
              'closed',
            ],
            default: "'pending_review'",
          },
          {
            name: 'task_type',
            type: 'enum',
            enum: ['callback_evidence', 'settlement_evidence', 'exception'],
          },
          {
            name: 'review_reason',
            type: 'enum',
            enum: [
              'amount_mismatch',
              'missing_payment_request',
              'missing_collection_order',
              'paid_after_expired',
              'paid_after_cancelled',
              'decrypt_failed',
              'invalid_signature',
              'duplicate_conflict',
              'bank_settlement_missing',
              'fee_mismatch',
            ],
          },
          { name: 'callback_evidence_id', type: 'int', isNullable: true },
          { name: 'settlement_evidence_id', type: 'int', isNullable: true },
          { name: 'finance_payment_request_id', type: 'int', isNullable: true },
          { name: 'finance_collection_order_id', type: 'int', isNullable: true },
          { name: 'bank_sms_transaction_id', type: 'int', isNullable: true },
          { name: 'finance_reconciliation_link_id', type: 'int', isNullable: true },
          { name: 'priority', type: 'varchar', length: '20', default: "'normal'" },
          { name: 'evidence_fingerprint', type: 'varchar', length: '128' },
          payloadHashColumn(),
          fingerprintColumn(),
          sanitizedPayloadColumn(),
          redactionVersionColumn(),
          { name: 'assigned_to_role', type: 'varchar', length: '80', isNullable: true },
          { name: 'review_summary_redacted', type: 'varchar', length: '500', isNullable: true },
          { name: 'reviewed_at', type: 'datetime', isNullable: true },
          errorCodeColumn(),
          errorReasonColumn(),
          notesColumn(),
          createdAtColumn(),
          updatedAtColumn(),
        ],
      }),
    );

    await queryRunner.createIndices('wechat_pay_manual_review_task', [
      new TableIndex({
        name: 'idx_wechat_pay_manual_review_provider_status',
        columnNames: ['provider', 'status'],
      }),
      new TableIndex({
        name: 'idx_wechat_pay_manual_review_callback',
        columnNames: ['callback_evidence_id'],
      }),
      new TableIndex({
        name: 'idx_wechat_pay_manual_review_settlement',
        columnNames: ['settlement_evidence_id'],
      }),
      new TableIndex({
        name: 'idx_wechat_pay_manual_review_reason',
        columnNames: ['review_reason'],
      }),
      new TableIndex({
        name: 'idx_wechat_pay_manual_review_created_at',
        columnNames: ['created_at'],
      }),
    ]);
  }

  private async createSettlementEvidence(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('wechat_pay_settlement_evidence')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'wechat_pay_settlement_evidence',
        columns: [
          idColumn(),
          sourceColumn(),
          providerColumn(),
          {
            name: 'status',
            type: 'enum',
            enum: [
              'pending_bank_match',
              'bank_matched',
              'fee_candidate',
              'settlement_mismatch',
              'matched_pending_confirmation',
              'review_required',
              'manual_confirmation_terminal_reserved',
            ],
            default: "'pending_bank_match'",
          },
          { name: 'transaction_id_hash', type: 'varchar', length: '128', isNullable: true },
          { name: 'out_trade_no_hash', type: 'varchar', length: '128', isNullable: true },
          { name: 'finance_payment_request_id', type: 'int', isNullable: true },
          { name: 'finance_collection_order_id', type: 'int', isNullable: true },
          { name: 'bank_sms_transaction_id', type: 'int', isNullable: true },
          { name: 'paid_amount', type: 'decimal', precision: 12, scale: 2, isNullable: true },
          {
            name: 'settlement_amount_candidate',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'fee_amount_candidate',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          { name: 'settlement_currency', type: 'varchar', length: '12', isNullable: true },
          { name: 'transaction_bill_hash', type: 'varchar', length: '128', isNullable: true },
          { name: 'fund_bill_hash', type: 'varchar', length: '128', isNullable: true },
          {
            name: 'bank_arrival_fingerprint_hash',
            type: 'varchar',
            length: '128',
            isNullable: true,
          },
          {
            name: 'evidence_source',
            type: 'enum',
            enum: [
              'callback',
              'transaction_bill',
              'fund_bill',
              'bank_sms_candidate',
              'manual_upload',
              'self_check',
            ],
          },
          payloadHashColumn(),
          fingerprintColumn(),
          sanitizedPayloadColumn(),
          redactionVersionColumn(),
          { name: 'received_at', type: 'datetime', isNullable: true },
          errorCodeColumn(),
          errorReasonColumn(),
          notesColumn(),
          createdAtColumn(),
          updatedAtColumn(),
        ],
      }),
    );

    await queryRunner.createIndices('wechat_pay_settlement_evidence', [
      new TableIndex({
        name: 'idx_wechat_pay_settlement_provider_status',
        columnNames: ['provider', 'status'],
      }),
      new TableIndex({
        name: 'idx_wechat_pay_settlement_transaction_hash',
        columnNames: ['transaction_id_hash'],
      }),
      new TableIndex({
        name: 'idx_wechat_pay_settlement_out_trade_hash',
        columnNames: ['out_trade_no_hash'],
      }),
      new TableIndex({
        name: 'idx_wechat_pay_settlement_bank_sms',
        columnNames: ['bank_sms_transaction_id'],
      }),
      new TableIndex({
        name: 'idx_wechat_pay_settlement_created_at',
        columnNames: ['created_at'],
      }),
    ]);
  }
}

function idColumn() {
  return {
    name: 'id',
    type: 'int',
    isPrimary: true,
    isGenerated: true,
    generationStrategy: 'increment' as const,
  };
}

function sourceColumn() {
  return { name: 'source', type: 'varchar', length: '80' };
}

function providerColumn() {
  return {
    name: 'provider',
    type: 'enum',
    enum: providerEnum,
  };
}

function payloadHashColumn() {
  return { name: 'payload_hash', type: 'varchar', length: '128' };
}

function fingerprintColumn() {
  return { name: 'fingerprint', type: 'varchar', length: '128', isUnique: true };
}

function sanitizedPayloadColumn() {
  return { name: 'sanitized_payload', type: 'json', isNullable: true };
}

function redactionVersionColumn() {
  return { name: 'redaction_version', type: 'varchar', length: '40' };
}

function errorCodeColumn() {
  return { name: 'error_code', type: 'varchar', length: '80', isNullable: true };
}

function errorReasonColumn() {
  return { name: 'error_reason', type: 'varchar', length: '500', isNullable: true };
}

function notesColumn() {
  return { name: 'notes', type: 'varchar', length: '500', isNullable: true };
}

function createdAtColumn() {
  return { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' };
}

function updatedAtColumn() {
  return {
    name: 'updated_at',
    type: 'datetime',
    default: 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  };
}
