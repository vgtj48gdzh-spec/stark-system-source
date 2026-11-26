import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  normalizeMysqlCheckClause as normalizeCheckClause,
  normalizeMysqlInformationSchemaCheckClause as normalizeActualCheckClause,
} from '../../common/utils/mysql-check-clause.util';
import { authorityCheckCompatibilityProblem } from '../../common/utils/mysql-check-clause-diagnostic.util';

const OLD_PAYMENT_CHANNEL_TYPE =
  "enum('enterprise_wechat','wechat','alipay','mini_program','old_qr','other')";
const NEW_PAYMENT_CHANNEL_TYPE =
  "enum('enterprise_wechat','wechat','alipay','mini_program','old_qr','other','bank_transfer')";

type MigrationState = {
  registryReviewColumns: boolean;
  registryReviewAuthorityTable: boolean;
  registryReviewReverseForeignKey: boolean;
  stageOne: boolean;
  authorityTable: boolean;
  reverseForeignKey: boolean;
  wechatSuggestionAnchor: boolean;
};

const REGISTRY_REVIEW_COLUMNS: AuthorityColumnSpec[] = [
  { name: 'last_edited_by', type: 'int', nullable: 'YES', default: null, extra: null, isText: false },
  { name: 'content_version', type: 'int', nullable: 'NO', default: '1', extra: null, isText: false },
  { name: 'formal_review_authority_id', type: 'int', nullable: 'YES', default: null, extra: null, isText: false },
  { name: 'formal_review_authority_hash', type: 'char(64)', nullable: 'YES', default: null, extra: null, isText: true },
];

const REGISTRY_REVIEW_INDEXES: Array<{ name: string; columns: string[]; nonUnique: 0 | 1 }> = [
  {
    name: 'uq_bank_account_registry_formal_review_authority',
    columns: ['formal_review_authority_id'],
    nonUnique: 0,
  },
];

const REGISTRY_REVIEW_CHECKS: Array<[string, string]> = [
  ['chk_bar_content_version', 'content_version > 0'],
  [
    'chk_bar_formal_review_anchor',
    '(formal_review_authority_id is null and formal_review_authority_hash is null) or (formal_review_authority_id > 0 and formal_review_authority_hash is not null and char_length(formal_review_authority_hash) = 64)',
  ],
];

const REGISTRY_REVIEW_AUTHORITY_COLUMNS: AuthorityColumnSpec[] = [
  { name: 'id', type: 'int', nullable: 'NO', default: null, extra: 'auto_increment', isText: false },
  { name: 'registry_id', type: 'int', nullable: 'NO', default: null, extra: null, isText: false },
  { name: 'content_version', type: 'int', nullable: 'NO', default: null, extra: null, isText: false },
  { name: 'content_snapshot_hash', type: 'char(64)', nullable: 'NO', default: null, extra: null, isText: true },
  { name: 'decision', type: "enum('approved','rejected')", nullable: 'NO', default: null, extra: null, isText: true },
  { name: 'reviewed_by', type: 'int', nullable: 'NO', default: null, extra: null, isText: false },
  { name: 'reviewed_at', type: 'datetime(6)', nullable: 'NO', default: null, extra: null, isText: false },
  { name: 'remark', type: 'varchar(500)', nullable: 'YES', default: null, extra: null, isText: true },
  { name: 'authority_hash', type: 'char(64)', nullable: 'NO', default: null, extra: null, isText: true },
  { name: 'created_at', type: 'datetime(6)', nullable: 'NO', default: 'current_timestamp(6)', extra: 'default_generated', isText: false },
];

const REGISTRY_REVIEW_AUTHORITY_INDEXES: Array<{
  name: string;
  columns: string[];
  nonUnique: 0 | 1;
}> = [
  { name: 'PRIMARY', columns: ['id'], nonUnique: 0 },
  { name: 'uq_barra_registry_version', columns: ['registry_id', 'content_version'], nonUnique: 0 },
  { name: 'uq_barra_authority_hash', columns: ['authority_hash'], nonUnique: 0 },
  { name: 'fk_barra_reviewed_by', columns: ['reviewed_by'], nonUnique: 1 },
];

const REGISTRY_REVIEW_AUTHORITY_FOREIGN_KEYS: Array<[string, string, string, string]> = [
  ['fk_barra_registry', 'registry_id', 'bank_account_registry', 'id'],
  ['fk_barra_reviewed_by', 'reviewed_by', 'users', 'id'],
];

const REGISTRY_REVIEW_AUTHORITY_CHECKS: Array<[string, string]> = [
  ['chk_barra_content_version', 'content_version > 0'],
  ['chk_barra_content_hash', 'char_length(content_snapshot_hash) = 64'],
  ['chk_barra_authority_hash', 'char_length(authority_hash) = 64'],
];

type AuthorityColumnSpec = {
  name: string;
  type: string;
  nullable: 'YES' | 'NO';
  default: string | null; // normalized expected COLUMN_DEFAULT; null = expect SQL NULL
  extra: 'auto_increment' | 'default_generated' | null; // null = expect empty EXTRA
  isText: boolean; // char/varchar -> utf8mb4 / utf8mb4_0900_ai_ci
};

const AUTHORITY_COLUMNS: AuthorityColumnSpec[] = [
  { name: 'id', type: 'int', nullable: 'NO', default: null, extra: 'auto_increment', isText: false },
  { name: 'collection_order_id', type: 'int', nullable: 'NO', default: null, extra: null, isText: false },
  { name: 'source_mode', type: 'varchar(64)', nullable: 'NO', default: null, extra: null, isText: true },
  { name: 'source_version', type: 'varchar(32)', nullable: 'NO', default: null, extra: null, isText: true },
  { name: 'company_id', type: 'int', nullable: 'NO', default: null, extra: null, isText: false },
  { name: 'company_ref', type: 'varchar(100)', nullable: 'NO', default: null, extra: null, isText: true },
  { name: 'business_sector_ref', type: 'varchar(100)', nullable: 'YES', default: null, extra: null, isText: true },
  { name: 'store_ref', type: 'varchar(100)', nullable: 'YES', default: null, extra: null, isText: true },
  { name: 'customer_ref', type: 'varchar(100)', nullable: 'YES', default: null, extra: null, isText: true },
  { name: 'profile_scope_snapshot_hash', type: 'char(64)', nullable: 'NO', default: null, extra: null, isText: true },
  { name: 'profile_scope_version', type: 'int', nullable: 'NO', default: null, extra: null, isText: false },
  { name: 'work_order_id', type: 'int', nullable: 'NO', default: null, extra: null, isText: false },
  { name: 'bank_transaction_id', type: 'int', nullable: 'NO', default: null, extra: null, isText: false },
  { name: 'reconciliation_link_id', type: 'int', nullable: 'NO', default: null, extra: null, isText: false },
  { name: 'bank_account_registry_id', type: 'int', nullable: 'NO', default: null, extra: null, isText: false },
  { name: 'bank_account_registry_updated_at', type: 'datetime(6)', nullable: 'NO', default: null, extra: null, isText: false },
  { name: 'bank_account_registry_snapshot_hash', type: 'char(64)', nullable: 'NO', default: null, extra: null, isText: true },
  { name: 'gross_cents', type: 'bigint', nullable: 'NO', default: null, extra: null, isText: false },
  { name: 'net_cents', type: 'bigint', nullable: 'NO', default: null, extra: null, isText: false },
  { name: 'fee_cents', type: 'bigint', nullable: 'NO', default: null, extra: null, isText: false },
  { name: 'currency', type: 'char(3)', nullable: 'NO', default: 'cny', extra: null, isText: true },
  { name: 'bank_snapshot_hash', type: 'char(64)', nullable: 'NO', default: null, extra: null, isText: true },
  { name: 'link_snapshot_hash', type: 'char(64)', nullable: 'NO', default: null, extra: null, isText: true },
  { name: 'work_order_snapshot_hash', type: 'char(64)', nullable: 'NO', default: null, extra: null, isText: true },
  { name: 'canonical_snapshot_hash', type: 'char(64)', nullable: 'NO', default: null, extra: null, isText: true },
  { name: 'source_occurred_at', type: 'datetime(6)', nullable: 'NO', default: null, extra: null, isText: false },
  { name: 'authority_confirmed_at', type: 'datetime(6)', nullable: 'NO', default: null, extra: null, isText: false },
  { name: 'confirmed_by', type: 'int', nullable: 'NO', default: null, extra: null, isText: false },
  { name: 'reason_code', type: 'varchar(64)', nullable: 'NO', default: null, extra: null, isText: true },
  { name: 'created_at', type: 'datetime(6)', nullable: 'NO', default: 'current_timestamp(6)', extra: 'default_generated', isText: false },
];

const AUTHORITY_INDEXES: Array<{ name: string; column: string; nonUnique: 0 | 1 }> = [
  { name: 'PRIMARY', column: 'id', nonUnique: 0 },
  { name: 'uq_fcca_collection_order', column: 'collection_order_id', nonUnique: 0 },
  { name: 'uq_fcca_bank_transaction', column: 'bank_transaction_id', nonUnique: 0 },
  { name: 'uq_fcca_reconciliation_link', column: 'reconciliation_link_id', nonUnique: 0 },
  { name: 'idx_fcca_work_order', column: 'work_order_id', nonUnique: 1 },
  // MySQL auto-creates a secondary index named after the confirmed_by FK.
  { name: 'fk_fcca_confirmed_by', column: 'confirmed_by', nonUnique: 1 },
  // MySQL auto-creates a secondary index named after the bank_account_registry FK.
  { name: 'fk_fcca_bank_account_registry', column: 'bank_account_registry_id', nonUnique: 1 },
];

const AUTHORITY_CHECKS: Array<[string, string]> = [
  ['chk_fcca_source_mode', "source_mode = 'bank_transfer_one_to_one_v1'"],
  ['chk_fcca_source_version', "source_version = 'v1'"],
  ['chk_fcca_reason_code', "reason_code = 'repair_bank_collection_confirmed'"],
  ['chk_fcca_amounts', 'gross_cents > 0 and net_cents = gross_cents and fee_cents = 0'],
  ['chk_fcca_currency', "currency = 'cny'"],
  ['chk_fcca_registry_anchor', 'bank_account_registry_id > 0'],
  ['chk_fcca_hashes', 'char_length(bank_snapshot_hash) = 64 and char_length(link_snapshot_hash) = 64 and char_length(work_order_snapshot_hash) = 64 and char_length(canonical_snapshot_hash) = 64 and char_length(profile_scope_snapshot_hash) = 64 and char_length(bank_account_registry_snapshot_hash) = 64'],
];

type WechatSuggestionColumnSpec = {
  name: string;
  type: string;
  nullable: 'YES' | 'NO';
  default: string | null;
  extra: 'auto_increment' | 'default_generated' | null;
  isChar: boolean;
};

const WECHAT_SUGGESTION_COLUMNS: WechatSuggestionColumnSpec[] = [
  { name: 'bank_match_suggestion_version', type: 'int unsigned', nullable: 'NO', default: '0', extra: null, isChar: false },
  { name: 'bank_match_suggestion_bank_sms_transaction_id', type: 'int', nullable: 'YES', default: null, extra: null, isChar: false },
  { name: 'bank_match_suggestion_registry_id', type: 'int', nullable: 'YES', default: null, extra: null, isChar: false },
  { name: 'bank_match_suggestion_registry_updated_at', type: 'datetime(6)', nullable: 'YES', default: null, extra: null, isChar: false },
  { name: 'bank_match_suggestion_snapshot_hash', type: 'char(64)', nullable: 'YES', default: null, extra: null, isChar: true },
  { name: 'bank_match_suggested_at', type: 'datetime(6)', nullable: 'YES', default: null, extra: null, isChar: false },
];

const WECHAT_SUGGESTION_INDEXES: Array<{
  name: string;
  columns: string[];
  nonUnique: 0 | 1;
}> = [
  {
    name: 'idx_wsb_bank_match_suggestion_anchor',
    columns: [
      'bank_match_suggestion_bank_sms_transaction_id',
      'bank_match_suggestion_registry_id',
      'bank_match_suggestion_version',
    ],
    nonUnique: 1,
  },
  {
    name: 'uq_wsb_suggestion_bank_sms_transaction',
    columns: ['bank_match_suggestion_bank_sms_transaction_id'],
    nonUnique: 0,
  },
  {
    // MySQL creates this support index because no declared index starts with
    // bank_match_suggestion_registry_id.
    name: 'fk_wsb_suggestion_registry',
    columns: ['bank_match_suggestion_registry_id'],
    nonUnique: 1,
  },
];

const WECHAT_SUGGESTION_FOREIGN_KEYS: Array<[string, string, string, string]> = [
  ['fk_wsb_suggestion_bank_sms_transaction', 'bank_match_suggestion_bank_sms_transaction_id', 'bank_sms_transaction', 'id'],
  ['fk_wsb_suggestion_registry', 'bank_match_suggestion_registry_id', 'bank_account_registry', 'id'],
];

const WECHAT_SUGGESTION_CHECK: [string, string] = [
  'chk_wsb_bank_match_suggestion_anchor',
  "(match_status in ('suggested','confirmed') and bank_match_suggestion_version > 0 and bank_match_suggestion_bank_sms_transaction_id is not null and bank_match_suggestion_bank_sms_transaction_id > 0 and bank_match_suggestion_registry_id is not null and bank_match_suggestion_registry_id > 0 and bank_match_suggestion_registry_updated_at is not null and bank_match_suggestion_snapshot_hash is not null and bank_match_suggested_at is not null and char_length(bank_match_suggestion_snapshot_hash) = 64) or (match_status not in ('suggested','confirmed') and bank_match_suggestion_version = 0 and bank_match_suggestion_bank_sms_transaction_id is null and bank_match_suggestion_registry_id is null and bank_match_suggestion_registry_updated_at is null and bank_match_suggestion_snapshot_hash is null and bank_match_suggested_at is null)",
];

function normalizeColumnDefault(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).toLowerCase().replace(/\s+/g, ' ').trim();
  return normalized.startsWith('(') && normalized.endsWith(')')
    ? normalized.slice(1, -1).trim()
    : normalized;
}

function normalizeExtra(value: unknown): string | null {
  const normalized = String(value ?? '').toLowerCase().trim();
  return normalized.length === 0 ? null : normalized;
}

function isRestrictiveRule(rule: unknown): boolean {
  const normalized = String(rule ?? '').toUpperCase();
  return normalized === 'RESTRICT' || normalized === 'NO ACTION';
}

export class AddFinanceCollectionConfirmationAuthority00651790000000000
  implements MigrationInterface
{
  name = 'AddFinanceCollectionConfirmationAuthority00651790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    let state = await this.inspectState(queryRunner);
    await this.assertWechatRowsSafeBeforeDdl(queryRunner, state.wechatSuggestionAnchor);

    if (!state.registryReviewColumns) {
      await queryRunner.query(`
        ALTER TABLE \`bank_account_registry\`
          ADD COLUMN \`last_edited_by\` INT NULL,
          ADD COLUMN \`content_version\` INT NOT NULL DEFAULT 1,
          ADD COLUMN \`formal_review_authority_id\` INT NULL,
          ADD COLUMN \`formal_review_authority_hash\`
            CHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
          ADD UNIQUE KEY \`uq_bank_account_registry_formal_review_authority\` (\`formal_review_authority_id\`),
          ADD CONSTRAINT \`chk_bar_content_version\` CHECK (\`content_version\` > 0),
          ADD CONSTRAINT \`chk_bar_formal_review_anchor\` CHECK (
            (\`formal_review_authority_id\` IS NULL AND \`formal_review_authority_hash\` IS NULL)
            OR (
              \`formal_review_authority_id\` > 0
              AND \`formal_review_authority_hash\` IS NOT NULL
              AND CHAR_LENGTH(\`formal_review_authority_hash\`) = 64
            )
          )
      `);
      state = await this.inspectState(queryRunner);
      this.assertState(state.registryReviewColumns, '0065_registry_review_columns_not_applied');
    }
    await queryRunner.query(`
      UPDATE \`bank_account_registry\`
      SET \`last_edited_by\` = \`created_by\`,
          \`updated_at\` = \`updated_at\`
      WHERE \`last_edited_by\` IS NULL AND \`created_by\` IS NOT NULL
    `);

    if (!state.registryReviewAuthorityTable) {
      await queryRunner.query(`
        CREATE TABLE \`bank_account_registry_review_authority\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`registry_id\` INT NOT NULL,
          \`content_version\` INT NOT NULL,
          \`content_snapshot_hash\` CHAR(64) NOT NULL,
          \`decision\` ENUM('approved','rejected') NOT NULL,
          \`reviewed_by\` INT NOT NULL,
          \`reviewed_at\` DATETIME(6) NOT NULL,
          \`remark\` VARCHAR(500) NULL,
          \`authority_hash\` CHAR(64) NOT NULL,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uq_barra_registry_version\` (\`registry_id\`, \`content_version\`),
          UNIQUE KEY \`uq_barra_authority_hash\` (\`authority_hash\`),
          CONSTRAINT \`fk_barra_registry\` FOREIGN KEY (\`registry_id\`)
            REFERENCES \`bank_account_registry\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
          CONSTRAINT \`fk_barra_reviewed_by\` FOREIGN KEY (\`reviewed_by\`)
            REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
          CONSTRAINT \`chk_barra_content_version\` CHECK (\`content_version\` > 0),
          CONSTRAINT \`chk_barra_content_hash\` CHECK (CHAR_LENGTH(\`content_snapshot_hash\`) = 64),
          CONSTRAINT \`chk_barra_authority_hash\` CHECK (CHAR_LENGTH(\`authority_hash\`) = 64)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `);
      state = await this.inspectState(queryRunner);
      this.assertState(
        state.registryReviewAuthorityTable,
        '0065_registry_review_authority_table_not_applied',
      );
    }

    if (!state.registryReviewReverseForeignKey) {
      await queryRunner.query(`
        ALTER TABLE \`bank_account_registry\`
          ADD CONSTRAINT \`fk_bar_formal_review_authority\`
            FOREIGN KEY (\`formal_review_authority_id\`)
            REFERENCES \`bank_account_registry_review_authority\` (\`id\`)
            ON DELETE RESTRICT ON UPDATE RESTRICT
      `);
      state = await this.inspectState(queryRunner);
      this.assertState(
        state.registryReviewReverseForeignKey,
        '0065_registry_review_reverse_fk_not_applied',
      );
    }

    if (!state.stageOne) {
      await queryRunner.query(`
        ALTER TABLE \`finance_collection_order\`
          ADD COLUMN \`formal_confirmation_authority_id\` INT NULL,
          ADD UNIQUE KEY \`uq_fco_formal_confirmation_authority\` (\`formal_confirmation_authority_id\`),
          MODIFY COLUMN \`payment_channel\`
            ENUM('enterprise_wechat','wechat','alipay','mini_program','old_qr','other','bank_transfer') NULL,
          ALGORITHM=INPLACE, LOCK=NONE
      `);
      state = await this.inspectState(queryRunner);
      this.assertState(state.stageOne, '0065_stage_one_not_applied');
    }

    if (!state.authorityTable) {
      await queryRunner.query(`
        CREATE TABLE \`finance_collection_confirmation_authorities\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`collection_order_id\` INT NOT NULL,
          \`source_mode\` VARCHAR(64) NOT NULL,
          \`source_version\` VARCHAR(32) NOT NULL,
          \`company_id\` INT NOT NULL,
          \`company_ref\` VARCHAR(100) NOT NULL,
          \`business_sector_ref\` VARCHAR(100) NULL,
          \`store_ref\` VARCHAR(100) NULL,
          \`customer_ref\` VARCHAR(100) NULL,
          \`profile_scope_snapshot_hash\` CHAR(64) NOT NULL,
          \`profile_scope_version\` INT NOT NULL,
          \`work_order_id\` INT NOT NULL,
          \`bank_transaction_id\` INT NOT NULL,
          \`reconciliation_link_id\` INT NOT NULL,
          \`bank_account_registry_id\` INT NOT NULL,
          \`bank_account_registry_updated_at\` DATETIME(6) NOT NULL,
          \`bank_account_registry_snapshot_hash\` CHAR(64) NOT NULL,
          \`gross_cents\` BIGINT NOT NULL,
          \`net_cents\` BIGINT NOT NULL,
          \`fee_cents\` BIGINT NOT NULL,
          \`currency\` CHAR(3) NOT NULL DEFAULT 'CNY',
          \`bank_snapshot_hash\` CHAR(64) NOT NULL,
          \`link_snapshot_hash\` CHAR(64) NOT NULL,
          \`work_order_snapshot_hash\` CHAR(64) NOT NULL,
          \`canonical_snapshot_hash\` CHAR(64) NOT NULL,
          \`source_occurred_at\` DATETIME(6) NOT NULL,
          \`authority_confirmed_at\` DATETIME(6) NOT NULL,
          \`confirmed_by\` INT NOT NULL,
          \`reason_code\` VARCHAR(64) NOT NULL,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uq_fcca_collection_order\` (\`collection_order_id\`),
          UNIQUE KEY \`uq_fcca_bank_transaction\` (\`bank_transaction_id\`),
          UNIQUE KEY \`uq_fcca_reconciliation_link\` (\`reconciliation_link_id\`),
          KEY \`idx_fcca_work_order\` (\`work_order_id\`),
          CONSTRAINT \`fk_fcca_collection_order\` FOREIGN KEY (\`collection_order_id\`)
            REFERENCES \`finance_collection_order\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
          CONSTRAINT \`fk_fcca_bank_transaction\` FOREIGN KEY (\`bank_transaction_id\`)
            REFERENCES \`bank_sms_transaction\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
          CONSTRAINT \`fk_fcca_reconciliation_link\` FOREIGN KEY (\`reconciliation_link_id\`)
            REFERENCES \`finance_reconciliation_link\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
          CONSTRAINT \`fk_fcca_work_order\` FOREIGN KEY (\`work_order_id\`)
            REFERENCES \`work_orders\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
          CONSTRAINT \`fk_fcca_confirmed_by\` FOREIGN KEY (\`confirmed_by\`)
            REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
          CONSTRAINT \`fk_fcca_bank_account_registry\` FOREIGN KEY (\`bank_account_registry_id\`)
            REFERENCES \`bank_account_registry\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
          CONSTRAINT \`chk_fcca_source_mode\` CHECK (\`source_mode\` = 'bank_transfer_one_to_one_v1'),
          CONSTRAINT \`chk_fcca_source_version\` CHECK (\`source_version\` = 'v1'),
          CONSTRAINT \`chk_fcca_reason_code\` CHECK (\`reason_code\` = 'repair_bank_collection_confirmed'),
          CONSTRAINT \`chk_fcca_amounts\` CHECK (
            \`gross_cents\` > 0 AND \`net_cents\` = \`gross_cents\` AND \`fee_cents\` = 0
          ),
          CONSTRAINT \`chk_fcca_currency\` CHECK (\`currency\` = 'cny'),
          CONSTRAINT \`chk_fcca_registry_anchor\` CHECK (\`bank_account_registry_id\` > 0),
          CONSTRAINT \`chk_fcca_hashes\` CHECK (
            CHAR_LENGTH(\`bank_snapshot_hash\`) = 64 AND
            CHAR_LENGTH(\`link_snapshot_hash\`) = 64 AND
            CHAR_LENGTH(\`work_order_snapshot_hash\`) = 64 AND
            CHAR_LENGTH(\`canonical_snapshot_hash\`) = 64 AND
            CHAR_LENGTH(\`profile_scope_snapshot_hash\`) = 64 AND
            CHAR_LENGTH(\`bank_account_registry_snapshot_hash\`) = 64
          )
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `);
      state = await this.inspectState(queryRunner);
      this.assertState(state.authorityTable, '0065_authority_table_not_applied');
    }

    if (!state.reverseForeignKey) {
      await queryRunner.query(`
        ALTER TABLE \`finance_collection_order\`
          ADD CONSTRAINT \`fk_fco_formal_confirmation_authority\`
            FOREIGN KEY (\`formal_confirmation_authority_id\`)
            REFERENCES \`finance_collection_confirmation_authorities\` (\`id\`)
            ON DELETE RESTRICT ON UPDATE RESTRICT
      `);
      state = await this.inspectState(queryRunner);
      this.assertState(state.reverseForeignKey, '0065_reverse_fk_not_applied');
    }

    if (!state.wechatSuggestionAnchor) {
      await queryRunner.query(`
        ALTER TABLE \`wechat_settlement_batch\`
          ADD COLUMN \`bank_match_suggestion_version\` INT UNSIGNED NOT NULL DEFAULT 0,
          ADD COLUMN \`bank_match_suggestion_bank_sms_transaction_id\` INT NULL,
          ADD COLUMN \`bank_match_suggestion_registry_id\` INT NULL,
          ADD COLUMN \`bank_match_suggestion_registry_updated_at\` DATETIME(6) NULL,
          ADD COLUMN \`bank_match_suggestion_snapshot_hash\` CHAR(64) NULL,
          ADD COLUMN \`bank_match_suggested_at\` DATETIME(6) NULL,
          ADD KEY \`idx_wsb_bank_match_suggestion_anchor\` (
            \`bank_match_suggestion_bank_sms_transaction_id\`,
            \`bank_match_suggestion_registry_id\`,
            \`bank_match_suggestion_version\`
          ),
          ADD UNIQUE KEY \`uq_wsb_suggestion_bank_sms_transaction\` (
            \`bank_match_suggestion_bank_sms_transaction_id\`
          ),
          ADD CONSTRAINT \`fk_wsb_suggestion_bank_sms_transaction\` FOREIGN KEY (\`bank_match_suggestion_bank_sms_transaction_id\`)
            REFERENCES \`bank_sms_transaction\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
          ADD CONSTRAINT \`fk_wsb_suggestion_registry\` FOREIGN KEY (\`bank_match_suggestion_registry_id\`)
            REFERENCES \`bank_account_registry\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
          ADD CONSTRAINT \`chk_wsb_bank_match_suggestion_anchor\` CHECK (
            (
              \`match_status\` IN ('suggested', 'confirmed')
              AND \`bank_match_suggestion_version\` > 0
              AND \`bank_match_suggestion_bank_sms_transaction_id\` IS NOT NULL
              AND \`bank_match_suggestion_bank_sms_transaction_id\` > 0
              AND \`bank_match_suggestion_registry_id\` IS NOT NULL
              AND \`bank_match_suggestion_registry_id\` > 0
              AND \`bank_match_suggestion_registry_updated_at\` IS NOT NULL
              AND \`bank_match_suggestion_snapshot_hash\` IS NOT NULL
              AND \`bank_match_suggested_at\` IS NOT NULL
              AND CHAR_LENGTH(\`bank_match_suggestion_snapshot_hash\`) = 64
            ) OR (
              \`match_status\` NOT IN ('suggested', 'confirmed')
              AND \`bank_match_suggestion_version\` = 0
              AND \`bank_match_suggestion_bank_sms_transaction_id\` IS NULL
              AND \`bank_match_suggestion_registry_id\` IS NULL
              AND \`bank_match_suggestion_registry_updated_at\` IS NULL
              AND \`bank_match_suggestion_snapshot_hash\` IS NULL
              AND \`bank_match_suggested_at\` IS NULL
            )
          )
      `);
      state = await this.inspectState(queryRunner);
      this.assertState(state.wechatSuggestionAnchor, '0065_wechat_suggestion_anchor_not_applied');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    let state = await this.inspectState(queryRunner);
    const registryReviewAuthorityCount = state.registryReviewAuthorityTable
      ? await this.readCount(
          queryRunner,
          'SELECT COUNT(*) AS `count` FROM `bank_account_registry_review_authority`',
        )
      : 0;
    const registryReviewAnchorCount = state.registryReviewColumns
      ? await this.readCount(
          queryRunner,
          'SELECT COUNT(*) AS `count` FROM `bank_account_registry` ' +
            'WHERE `formal_review_authority_id` IS NOT NULL ' +
            'OR `formal_review_authority_hash` IS NOT NULL',
        )
      : 0;
    const registryReviewProvenanceCount = state.registryReviewColumns
      ? await this.readCount(
          queryRunner,
          'SELECT COUNT(*) AS `count` FROM `bank_account_registry` ' +
            'WHERE `content_version` <> 1 ' +
            'OR NOT (`last_edited_by` <=> `created_by`)',
        )
      : 0;
    const authorityCount = state.authorityTable
      ? await this.readCount(
          queryRunner,
          'SELECT COUNT(*) AS \`count\` FROM \`finance_collection_confirmation_authorities\`',
        )
      : 0;
    const anchorCount = state.stageOne
      ? await this.readCount(
          queryRunner,
          'SELECT COUNT(*) AS \`count\` FROM \`finance_collection_order\` WHERE \`formal_confirmation_authority_id\` IS NOT NULL',
        )
      : 0;
    const bankTransferCount = state.stageOne
      ? await this.readCount(
          queryRunner,
          "SELECT COUNT(*) AS \`count\` FROM \`finance_collection_order\` WHERE \`payment_channel\` = 'bank_transfer'",
        )
      : 0;
    const wechatAnchorRowCount = state.wechatSuggestionAnchor
      ? await this.readCount(
          queryRunner,
          'SELECT COUNT(*) AS \`count\` FROM \`wechat_settlement_batch\` ' +
            'WHERE \`bank_match_suggestion_version\` > 0 ' +
            'OR \`bank_match_suggestion_bank_sms_transaction_id\` IS NOT NULL ' +
            'OR \`bank_match_suggestion_registry_id\` IS NOT NULL ' +
            'OR \`bank_match_suggestion_registry_updated_at\` IS NOT NULL ' +
            'OR \`bank_match_suggestion_snapshot_hash\` IS NOT NULL ' +
            'OR \`bank_match_suggested_at\` IS NOT NULL',
        )
      : 0;
    if (
      registryReviewAuthorityCount > 0 ||
      registryReviewAnchorCount > 0 ||
      registryReviewProvenanceCount > 0 ||
      authorityCount > 0 ||
      anchorCount > 0 ||
      bankTransferCount > 0 ||
      wechatAnchorRowCount > 0
    ) {
      throw new Error(
        'finance_collection_confirmation_0065_down_blocked:' +
          `registry_review_authority_rows=${registryReviewAuthorityCount},registry_review_anchors=${registryReviewAnchorCount},` +
          `registry_review_provenance_rows=${registryReviewProvenanceCount},` +
          `authority_rows=${authorityCount},authority_anchors=${anchorCount},bank_transfer_rows=${bankTransferCount},wechat_anchor_rows=${wechatAnchorRowCount}`,
      );
    }

    if (state.wechatSuggestionAnchor) {
      await queryRunner.query(`
        ALTER TABLE \`wechat_settlement_batch\`
          DROP FOREIGN KEY \`fk_wsb_suggestion_bank_sms_transaction\`,
          DROP FOREIGN KEY \`fk_wsb_suggestion_registry\`,
          DROP CHECK \`chk_wsb_bank_match_suggestion_anchor\`,
          DROP INDEX \`idx_wsb_bank_match_suggestion_anchor\`,
          DROP INDEX \`uq_wsb_suggestion_bank_sms_transaction\`,
          DROP COLUMN \`bank_match_suggestion_version\`,
          DROP COLUMN \`bank_match_suggestion_bank_sms_transaction_id\`,
          DROP COLUMN \`bank_match_suggestion_registry_id\`,
          DROP COLUMN \`bank_match_suggestion_registry_updated_at\`,
          DROP COLUMN \`bank_match_suggestion_snapshot_hash\`,
          DROP COLUMN \`bank_match_suggested_at\`
      `);
      state = await this.inspectState(queryRunner);
      this.assertState(!state.wechatSuggestionAnchor, '0065_wechat_suggestion_anchor_not_removed');
    }

    if (state.reverseForeignKey) {
      await queryRunner.query(`
        ALTER TABLE \`finance_collection_order\`
          DROP FOREIGN KEY \`fk_fco_formal_confirmation_authority\`
      `);
      state = await this.inspectState(queryRunner);
      this.assertState(!state.reverseForeignKey, '0065_reverse_fk_not_removed');
    }

    if (state.stageOne) {
      await queryRunner.query(`
        ALTER TABLE \`finance_collection_order\`
          DROP INDEX \`uq_fco_formal_confirmation_authority\`,
          DROP COLUMN \`formal_confirmation_authority_id\`,
          MODIFY COLUMN \`payment_channel\`
            ENUM('enterprise_wechat','wechat','alipay','mini_program','old_qr','other') NULL
      `);
      state = await this.inspectState(queryRunner);
      this.assertState(!state.stageOne, '0065_stage_one_not_removed');
    }

    if (state.authorityTable) {
      await queryRunner.query('DROP TABLE \`finance_collection_confirmation_authorities\`');
      state = await this.inspectState(queryRunner);
      this.assertState(!state.authorityTable, '0065_authority_table_not_removed');
    }

    if (state.registryReviewReverseForeignKey) {
      await queryRunner.query(`
        ALTER TABLE \`bank_account_registry\`
          DROP FOREIGN KEY \`fk_bar_formal_review_authority\`
      `);
      state = await this.inspectState(queryRunner);
      this.assertState(
        !state.registryReviewReverseForeignKey,
        '0065_registry_review_reverse_fk_not_removed',
      );
    }

    if (state.registryReviewAuthorityTable) {
      await queryRunner.query('DROP TABLE \`bank_account_registry_review_authority\`');
      state = await this.inspectState(queryRunner);
      this.assertState(
        !state.registryReviewAuthorityTable,
        '0065_registry_review_authority_table_not_removed',
      );
    }

    if (state.registryReviewColumns) {
      await queryRunner.query(`
        ALTER TABLE \`bank_account_registry\`
          DROP CHECK \`chk_bar_content_version\`,
          DROP CHECK \`chk_bar_formal_review_anchor\`,
          DROP INDEX \`uq_bank_account_registry_formal_review_authority\`,
          DROP COLUMN \`last_edited_by\`,
          DROP COLUMN \`content_version\`,
          DROP COLUMN \`formal_review_authority_id\`,
          DROP COLUMN \`formal_review_authority_hash\`
      `);
      state = await this.inspectState(queryRunner);
      this.assertState(!state.registryReviewColumns, '0065_registry_review_columns_not_removed');
    }
  }

  private async inspectState(queryRunner: QueryRunner): Promise<MigrationState> {
    const registryReviewColumns = await this.assertRegistryReviewColumnsCompatible(queryRunner);
    const registryReviewAuthorityTable =
      await this.assertRegistryReviewAuthorityTableCompatible(queryRunner);
    const registryReviewReverseForeignKey =
      await this.assertRegistryReviewReverseForeignKeyCompatible(queryRunner);
    if (
      registryReviewReverseForeignKey &&
      (!registryReviewColumns || !registryReviewAuthorityTable)
    ) {
      throw new Error(
        'finance_collection_confirmation_0065_incompatible:registry_review_reverse_fk_without_schema',
      );
    }

    const [orderTable] = await queryRunner.query(`
      SELECT TABLE_NAME AS tableName
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'finance_collection_order'
    `);
    if (!orderTable) {
      throw new Error('finance_collection_confirmation_0065_incompatible:order_table_missing');
    }

    const orderColumns = await queryRunner.query(`
      SELECT COLUMN_NAME AS columnName, COLUMN_TYPE AS columnType, IS_NULLABLE AS isNullable,
             COLUMN_DEFAULT AS columnDefault, EXTRA AS extra,
             CHARACTER_SET_NAME AS characterSet, COLLATION_NAME AS collation
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'finance_collection_order'
        AND COLUMN_NAME IN ('formal_confirmation_authority_id', 'payment_channel')
      ORDER BY ORDINAL_POSITION
    `);
    const formalColumn = orderColumns.find(
      (row: Record<string, unknown>) => row.columnName === 'formal_confirmation_authority_id',
    );
    const paymentColumn = orderColumns.find(
      (row: Record<string, unknown>) => row.columnName === 'payment_channel',
    );
    if (!paymentColumn) {
      throw new Error('finance_collection_confirmation_0065_incompatible:payment_channel_missing');
    }
    const orderIndexRows = await queryRunner.query(`
      SELECT INDEX_NAME AS indexName, NON_UNIQUE AS nonUnique,
             SEQ_IN_INDEX AS seqInIndex, COLUMN_NAME AS columnName, SUB_PART AS subPart,
             INDEX_TYPE AS indexType, IS_VISIBLE AS isVisible
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'finance_collection_order'
        AND INDEX_NAME IN (
          SELECT DISTINCT related.INDEX_NAME
          FROM information_schema.STATISTICS related
          WHERE related.TABLE_SCHEMA = DATABASE()
            AND related.TABLE_NAME = 'finance_collection_order'
            AND related.COLUMN_NAME = 'formal_confirmation_authority_id'
        )
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `);
    const allOrderCheckRows = (await queryRunner.query(`
      SELECT tc.CONSTRAINT_NAME AS constraintName, cc.CHECK_CLAUSE AS checkClause,
             tc.ENFORCED AS enforced
      FROM information_schema.TABLE_CONSTRAINTS tc
      JOIN information_schema.CHECK_CONSTRAINTS cc
        ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
       AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
      WHERE tc.CONSTRAINT_SCHEMA = DATABASE()
        AND tc.TABLE_NAME = 'finance_collection_order'
        AND tc.CONSTRAINT_TYPE = 'CHECK'
    `)) as Array<Record<string, unknown>>;
    const orderCheckRows = allOrderCheckRows.filter((row) =>
      normalizeActualCheckClause(row.checkClause).includes('formal_confirmation_authority_id'),
    );
    const formalExact = Boolean(
      formalColumn &&
        String(formalColumn.columnType).toLowerCase() === 'int' &&
        formalColumn.isNullable === 'YES' &&
        normalizeColumnDefault(formalColumn.columnDefault) === null &&
        normalizeExtra(formalColumn.extra) === null,
    );
    const paymentExact = Boolean(
      paymentColumn.isNullable === 'YES' &&
        normalizeColumnDefault(paymentColumn.columnDefault) === null &&
        normalizeExtra(paymentColumn.extra) === null,
    );
    const indexExact =
      orderIndexRows.length === 1 &&
      orderIndexRows[0].indexName === 'uq_fco_formal_confirmation_authority' &&
      Number(orderIndexRows[0].nonUnique) === 0 &&
      Number(orderIndexRows[0].seqInIndex) === 1 &&
      orderIndexRows[0].columnName === 'formal_confirmation_authority_id' &&
      orderIndexRows[0].subPart == null &&
      String(orderIndexRows[0].indexType).toUpperCase() === 'BTREE' &&
      String(orderIndexRows[0].isVisible).toUpperCase() === 'YES';
    const paymentType = String(paymentColumn.columnType).toLowerCase();
    const stageOne =
      formalExact &&
      paymentExact &&
      indexExact &&
      orderCheckRows.length === 0 &&
      paymentType === NEW_PAYMENT_CHANNEL_TYPE;
    const pristineStageOne =
      !formalColumn &&
      orderIndexRows.length === 0 &&
      orderCheckRows.length === 0 &&
      paymentType === OLD_PAYMENT_CHANNEL_TYPE;
    if (!stageOne && !pristineStageOne) {
      throw new Error(
        `finance_collection_confirmation_0065_incompatible:stage_one:${JSON.stringify({
          formalColumn: formalColumn ?? null,
          paymentColumn: paymentColumn ?? null,
          orderIndexRows,
          orderCheckRows,
          paymentType,
        })}`,
      );
    }

    const [authorityTableRow] = await queryRunner.query(`
      SELECT ENGINE AS engine, TABLE_COLLATION AS tableCollation
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'finance_collection_confirmation_authorities'
    `);
    const authorityTable = Boolean(authorityTableRow);
    if (authorityTable) {
      await this.assertAuthorityTableCompatible(queryRunner, authorityTableRow);
    }

    const reverseRows = await queryRunner.query(`
      SELECT kcu.CONSTRAINT_NAME AS constraintName,
             kcu.COLUMN_NAME AS columnName,
             kcu.REFERENCED_TABLE_NAME AS referencedTableName,
             kcu.REFERENCED_COLUMN_NAME AS referencedColumnName,
             rc.DELETE_RULE AS deleteRule,
             rc.UPDATE_RULE AS updateRule
      FROM information_schema.KEY_COLUMN_USAGE kcu
      JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
        ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
       AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      WHERE kcu.CONSTRAINT_SCHEMA = DATABASE()
        AND kcu.TABLE_NAME = 'finance_collection_order'
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
        AND kcu.CONSTRAINT_NAME IN (
          SELECT related.CONSTRAINT_NAME
          FROM information_schema.KEY_COLUMN_USAGE related
          WHERE related.CONSTRAINT_SCHEMA = DATABASE()
            AND related.TABLE_NAME = 'finance_collection_order'
            AND related.COLUMN_NAME = 'formal_confirmation_authority_id'
            AND related.REFERENCED_TABLE_NAME IS NOT NULL
        )
      ORDER BY kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
    `);
    const reverseForeignKey =
      reverseRows.length === 1 &&
      reverseRows[0].constraintName === 'fk_fco_formal_confirmation_authority' &&
      reverseRows[0].columnName === 'formal_confirmation_authority_id' &&
      reverseRows[0].referencedTableName === 'finance_collection_confirmation_authorities' &&
      reverseRows[0].referencedColumnName === 'id' &&
      isRestrictiveRule(reverseRows[0].deleteRule) &&
      isRestrictiveRule(reverseRows[0].updateRule);
    if (reverseRows.length > 0 && !reverseForeignKey) {
      throw new Error('finance_collection_confirmation_0065_incompatible:reverse_fk_shape');
    }
    if (reverseForeignKey && (!stageOne || !authorityTable)) {
      throw new Error('finance_collection_confirmation_0065_incompatible:orphan_reverse_fk');
    }

    const wechatSuggestionAnchor = await this.assertWechatSuggestionAnchorCompatible(queryRunner);

    return {
      registryReviewColumns,
      registryReviewAuthorityTable,
      registryReviewReverseForeignKey,
      stageOne,
      authorityTable,
      reverseForeignKey,
      wechatSuggestionAnchor,
    };
  }

  private async assertRegistryReviewColumnsCompatible(
    queryRunner: QueryRunner,
  ): Promise<boolean> {
    const [registryTable] = await queryRunner.query(`
      SELECT TABLE_NAME AS tableName
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bank_account_registry'
    `);
    if (!registryTable) {
      throw new Error(
        'finance_collection_confirmation_0065_incompatible:bank_account_registry_missing',
      );
    }

    const columnNames = REGISTRY_REVIEW_COLUMNS.map((column) => `'${column.name}'`).join(',');
    const columns = (await queryRunner.query(`
      SELECT COLUMN_NAME AS columnName, COLUMN_TYPE AS columnType,
             IS_NULLABLE AS isNullable, COLUMN_DEFAULT AS columnDefault, EXTRA AS extra,
             CHARACTER_SET_NAME AS characterSet, COLLATION_NAME AS collation
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'bank_account_registry'
        AND COLUMN_NAME IN (${columnNames})
      ORDER BY ORDINAL_POSITION
    `)) as Array<Record<string, unknown>>;
    const indexRows = (await queryRunner.query(`
      SELECT INDEX_NAME AS indexName, NON_UNIQUE AS nonUnique,
             SEQ_IN_INDEX AS seqInIndex, COLUMN_NAME AS columnName, SUB_PART AS subPart,
             INDEX_TYPE AS indexType, IS_VISIBLE AS isVisible
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'bank_account_registry'
        AND INDEX_NAME IN (
          SELECT DISTINCT related.INDEX_NAME
          FROM information_schema.STATISTICS related
          WHERE related.TABLE_SCHEMA = DATABASE()
            AND related.TABLE_NAME = 'bank_account_registry'
            AND related.COLUMN_NAME IN (${columnNames})
        )
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `)) as Array<Record<string, unknown>>;
    const allCheckRows = (await queryRunner.query(`
      SELECT tc.CONSTRAINT_NAME AS constraintName, cc.CHECK_CLAUSE AS checkClause,
             tc.ENFORCED AS enforced
      FROM information_schema.TABLE_CONSTRAINTS tc
      JOIN information_schema.CHECK_CONSTRAINTS cc
        ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
       AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
      WHERE tc.CONSTRAINT_SCHEMA = DATABASE()
        AND tc.TABLE_NAME = 'bank_account_registry'
        AND tc.CONSTRAINT_TYPE = 'CHECK'
    `)) as Array<Record<string, unknown>>;
    const checkRows = allCheckRows.filter((row) => {
      const clause = normalizeActualCheckClause(row.checkClause);
      return REGISTRY_REVIEW_COLUMNS.some((column) => clause.includes(column.name));
    });

    if (columns.length === 0 && indexRows.length === 0 && checkRows.length === 0) {
      return false;
    }
    if (columns.length !== REGISTRY_REVIEW_COLUMNS.length) {
      throw new Error(
        'finance_collection_confirmation_0065_incompatible:registry_review_column_count',
      );
    }
    const byName = new Map(columns.map((column) => [column.columnName, column]));
    for (const spec of REGISTRY_REVIEW_COLUMNS) {
      const actual = byName.get(spec.name);
      const actualDefault = normalizeColumnDefault(actual?.columnDefault);
      const actualExtra = normalizeExtra(actual?.extra);
      const charsetOk = spec.isText
        ? String(actual?.characterSet ?? '').toLowerCase() === 'utf8mb4' &&
          String(actual?.collation ?? '').toLowerCase() === 'utf8mb4_0900_ai_ci'
        : actual?.characterSet == null && actual?.collation == null;
      const extraOk =
        spec.extra === null ? actualExtra === null : (actualExtra ?? '').includes(spec.extra);
      if (
        actual?.columnName !== spec.name ||
        String(actual?.columnType).toLowerCase() !== spec.type ||
        actual?.isNullable !== spec.nullable ||
        actualDefault !== spec.default ||
        !extraOk ||
        !charsetOk
      ) {
        throw new Error(
          `finance_collection_confirmation_0065_incompatible:registry_review_column:${spec.name}`,
        );
      }
    }

    const expectedIndexRows = REGISTRY_REVIEW_INDEXES.reduce(
      (sum, spec) => sum + spec.columns.length,
      0,
    );
    if (indexRows.length !== expectedIndexRows) {
      throw new Error(
        'finance_collection_confirmation_0065_incompatible:registry_review_index_count',
      );
    }
    for (const spec of REGISTRY_REVIEW_INDEXES) {
      const rows = indexRows.filter((row) => row.indexName === spec.name);
      if (
        rows.length !== spec.columns.length ||
        !rows.every(
          (row, index) =>
            row.columnName === spec.columns[index] &&
            Number(row.seqInIndex) === index + 1 &&
            Number(row.nonUnique) === spec.nonUnique &&
            row.subPart == null &&
            String(row.indexType).toUpperCase() === 'BTREE' &&
            String(row.isVisible).toUpperCase() === 'YES',
        )
      ) {
        throw new Error(
          `finance_collection_confirmation_0065_incompatible:registry_review_index:${spec.name}`,
        );
      }
    }

    if (checkRows.length !== REGISTRY_REVIEW_CHECKS.length) {
      throw new Error(
        'finance_collection_confirmation_0065_incompatible:registry_review_check_count',
      );
    }
    for (const [name, expectedClause] of REGISTRY_REVIEW_CHECKS) {
      const row = checkRows.find((candidate) => candidate.constraintName === name);
      if (
        !row ||
        String(row.enforced).toUpperCase() !== 'YES' ||
        normalizeActualCheckClause(row.checkClause) !== normalizeCheckClause(expectedClause)
      ) {
        throw new Error(
          `finance_collection_confirmation_0065_incompatible:registry_review_check:${name}`,
        );
      }
    }
    return true;
  }

  private async assertRegistryReviewAuthorityTableCompatible(
    queryRunner: QueryRunner,
  ): Promise<boolean> {
    const [table] = (await queryRunner.query(`
      SELECT ENGINE AS engine, TABLE_COLLATION AS tableCollation
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'bank_account_registry_review_authority'
    `)) as Array<Record<string, unknown>>;
    if (!table) return false;
    if (
      String(table.engine).toUpperCase() !== 'INNODB' ||
      String(table.tableCollation).toLowerCase() !== 'utf8mb4_0900_ai_ci'
    ) {
      throw new Error(
        'finance_collection_confirmation_0065_incompatible:registry_review_authority_engine',
      );
    }

    const columns = (await queryRunner.query(`
      SELECT COLUMN_NAME AS columnName, COLUMN_TYPE AS columnType,
             IS_NULLABLE AS isNullable, COLUMN_DEFAULT AS columnDefault, EXTRA AS extra,
             CHARACTER_SET_NAME AS characterSet, COLLATION_NAME AS collation
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'bank_account_registry_review_authority'
      ORDER BY ORDINAL_POSITION
    `)) as Array<Record<string, unknown>>;
    if (columns.length !== REGISTRY_REVIEW_AUTHORITY_COLUMNS.length) {
      throw new Error(
        'finance_collection_confirmation_0065_incompatible:registry_review_authority_column_count',
      );
    }
    for (let index = 0; index < REGISTRY_REVIEW_AUTHORITY_COLUMNS.length; index += 1) {
      const spec = REGISTRY_REVIEW_AUTHORITY_COLUMNS[index];
      const actual = columns[index];
      const charsetOk = spec.isText
        ? String(actual?.characterSet ?? '').toLowerCase() === 'utf8mb4' &&
          String(actual?.collation ?? '').toLowerCase() === 'utf8mb4_0900_ai_ci'
        : actual?.characterSet == null && actual?.collation == null;
      const actualExtra = normalizeExtra(actual?.extra);
      const extraOk =
        spec.extra === null ? actualExtra === null : (actualExtra ?? '').includes(spec.extra);
      if (
        actual?.columnName !== spec.name ||
        String(actual?.columnType).toLowerCase() !== spec.type ||
        actual?.isNullable !== spec.nullable ||
        normalizeColumnDefault(actual?.columnDefault) !== spec.default ||
        !extraOk ||
        !charsetOk
      ) {
        throw new Error(
          `finance_collection_confirmation_0065_incompatible:registry_review_authority_column:${spec.name}`,
        );
      }
    }

    const indexRows = (await queryRunner.query(`
      SELECT INDEX_NAME AS indexName, NON_UNIQUE AS nonUnique,
             SEQ_IN_INDEX AS seqInIndex, COLUMN_NAME AS columnName, SUB_PART AS subPart,
             INDEX_TYPE AS indexType, IS_VISIBLE AS isVisible
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'bank_account_registry_review_authority'
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `)) as Array<Record<string, unknown>>;
    const expectedIndexRows = REGISTRY_REVIEW_AUTHORITY_INDEXES.reduce(
      (sum, spec) => sum + spec.columns.length,
      0,
    );
    if (indexRows.length !== expectedIndexRows) {
      throw new Error(
        'finance_collection_confirmation_0065_incompatible:registry_review_authority_index_count',
      );
    }
    for (const spec of REGISTRY_REVIEW_AUTHORITY_INDEXES) {
      const rows = indexRows.filter((row) => row.indexName === spec.name);
      if (
        rows.length !== spec.columns.length ||
        !rows.every(
          (row, index) =>
            row.columnName === spec.columns[index] &&
            Number(row.seqInIndex) === index + 1 &&
            Number(row.nonUnique) === spec.nonUnique &&
            row.subPart == null &&
            String(row.indexType).toUpperCase() === 'BTREE' &&
            String(row.isVisible).toUpperCase() === 'YES',
        )
      ) {
        throw new Error(
          `finance_collection_confirmation_0065_incompatible:registry_review_authority_index:${spec.name}`,
        );
      }
    }

    const foreignRows = (await queryRunner.query(`
      SELECT kcu.CONSTRAINT_NAME AS constraintName,
             kcu.COLUMN_NAME AS columnName,
             kcu.REFERENCED_TABLE_NAME AS referencedTableName,
             kcu.REFERENCED_COLUMN_NAME AS referencedColumnName,
             rc.DELETE_RULE AS deleteRule,
             rc.UPDATE_RULE AS updateRule
      FROM information_schema.KEY_COLUMN_USAGE kcu
      JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
        ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
       AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      WHERE kcu.CONSTRAINT_SCHEMA = DATABASE()
        AND kcu.TABLE_NAME = 'bank_account_registry_review_authority'
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
    `)) as Array<Record<string, unknown>>;
    if (foreignRows.length !== REGISTRY_REVIEW_AUTHORITY_FOREIGN_KEYS.length) {
      throw new Error(
        'finance_collection_confirmation_0065_incompatible:registry_review_authority_foreign_key_count',
      );
    }
    for (const [name, column, referencedTable, referencedColumn] of
      REGISTRY_REVIEW_AUTHORITY_FOREIGN_KEYS) {
      const row = foreignRows.find((candidate) => candidate.constraintName === name);
      if (
        !row ||
        row.columnName !== column ||
        row.referencedTableName !== referencedTable ||
        row.referencedColumnName !== referencedColumn ||
        !isRestrictiveRule(row.deleteRule) ||
        !isRestrictiveRule(row.updateRule)
      ) {
        throw new Error(
          `finance_collection_confirmation_0065_incompatible:registry_review_authority_foreign_key:${name}`,
        );
      }
    }

    const checkRows = (await queryRunner.query(`
      SELECT tc.CONSTRAINT_NAME AS constraintName, cc.CHECK_CLAUSE AS checkClause,
             tc.ENFORCED AS enforced
      FROM information_schema.TABLE_CONSTRAINTS tc
      JOIN information_schema.CHECK_CONSTRAINTS cc
        ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
       AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
      WHERE tc.CONSTRAINT_SCHEMA = DATABASE()
        AND tc.TABLE_NAME = 'bank_account_registry_review_authority'
        AND tc.CONSTRAINT_TYPE = 'CHECK'
      ORDER BY tc.CONSTRAINT_NAME
    `)) as Array<Record<string, unknown>>;
    if (checkRows.length !== REGISTRY_REVIEW_AUTHORITY_CHECKS.length) {
      throw new Error(
        'finance_collection_confirmation_0065_incompatible:registry_review_authority_check_count',
      );
    }
    for (const [name, expectedClause] of REGISTRY_REVIEW_AUTHORITY_CHECKS) {
      const row = checkRows.find((candidate) => candidate.constraintName === name);
      if (
        !row ||
        String(row.enforced).toUpperCase() !== 'YES' ||
        normalizeActualCheckClause(row.checkClause) !== normalizeCheckClause(expectedClause)
      ) {
        throw new Error(
          `finance_collection_confirmation_0065_incompatible:registry_review_authority_check:${name}`,
        );
      }
    }
    return true;
  }

  private async assertRegistryReviewReverseForeignKeyCompatible(
    queryRunner: QueryRunner,
  ): Promise<boolean> {
    const rows = (await queryRunner.query(`
      SELECT kcu.CONSTRAINT_NAME AS constraintName,
             kcu.COLUMN_NAME AS columnName,
             kcu.REFERENCED_TABLE_NAME AS referencedTableName,
             kcu.REFERENCED_COLUMN_NAME AS referencedColumnName,
             rc.DELETE_RULE AS deleteRule,
             rc.UPDATE_RULE AS updateRule
      FROM information_schema.KEY_COLUMN_USAGE kcu
      JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
        ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
       AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      WHERE kcu.CONSTRAINT_SCHEMA = DATABASE()
        AND kcu.TABLE_NAME = 'bank_account_registry'
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
        AND kcu.CONSTRAINT_NAME IN (
          SELECT related.CONSTRAINT_NAME
          FROM information_schema.KEY_COLUMN_USAGE related
          WHERE related.CONSTRAINT_SCHEMA = DATABASE()
            AND related.TABLE_NAME = 'bank_account_registry'
            AND related.COLUMN_NAME = 'formal_review_authority_id'
            AND related.REFERENCED_TABLE_NAME IS NOT NULL
        )
    `)) as Array<Record<string, unknown>>;
    if (rows.length === 0) return false;
    if (rows.length !== 1) {
      throw new Error(
        'finance_collection_confirmation_0065_incompatible:registry_review_reverse_fk_count',
      );
    }
    const row = rows[0];
    if (
      row.constraintName !== 'fk_bar_formal_review_authority' ||
      row.columnName !== 'formal_review_authority_id' ||
      row.referencedTableName !== 'bank_account_registry_review_authority' ||
      row.referencedColumnName !== 'id' ||
      !isRestrictiveRule(row.deleteRule) ||
      !isRestrictiveRule(row.updateRule)
    ) {
      throw new Error(
        'finance_collection_confirmation_0065_incompatible:registry_review_reverse_fk_shape',
      );
    }
    return true;
  }

  private async assertAuthorityTableCompatible(
    queryRunner: QueryRunner,
    tableRow: Record<string, unknown>,
  ) {
    if (
      String(tableRow.engine).toUpperCase() !== 'INNODB' ||
      String(tableRow.tableCollation).toLowerCase() !== 'utf8mb4_0900_ai_ci'
    ) {
      throw new Error('finance_collection_confirmation_0065_incompatible:authority_table_engine');
    }

    const columns = await queryRunner.query(`
      SELECT COLUMN_NAME AS columnName, COLUMN_TYPE AS columnType,
             IS_NULLABLE AS isNullable, COLUMN_DEFAULT AS columnDefault, EXTRA AS extra,
             CHARACTER_SET_NAME AS characterSet, COLLATION_NAME AS collation
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'finance_collection_confirmation_authorities'
      ORDER BY ORDINAL_POSITION
    `);
    if (columns.length !== AUTHORITY_COLUMNS.length) {
      throw new Error('finance_collection_confirmation_0065_incompatible:authority_column_count');
    }
    for (let index = 0; index < AUTHORITY_COLUMNS.length; index += 1) {
      const spec = AUTHORITY_COLUMNS[index];
      const actual = columns[index];
      const actualExtra = normalizeExtra(actual?.extra);
      const actualDefault = normalizeColumnDefault(actual?.columnDefault);
      const charsetOk = spec.isText
        ? String(actual?.characterSet ?? '').toLowerCase() === 'utf8mb4' &&
          String(actual?.collation ?? '').toLowerCase() === 'utf8mb4_0900_ai_ci'
        : actual?.characterSet == null && actual?.collation == null;
      const extraOk =
        spec.extra === null
          ? actualExtra === null
          : (actualExtra ?? '').includes(spec.extra);
      if (
        actual?.columnName !== spec.name ||
        String(actual?.columnType).toLowerCase() !== spec.type ||
        actual?.isNullable !== spec.nullable ||
        actualDefault !== spec.default ||
        !extraOk ||
        !charsetOk
      ) {
        throw new Error(
          `finance_collection_confirmation_0065_incompatible:authority_column:${spec.name}`,
        );
      }
    }

    const indexRows = await queryRunner.query(`
      SELECT INDEX_NAME AS indexName, NON_UNIQUE AS nonUnique,
             SEQ_IN_INDEX AS seqInIndex, COLUMN_NAME AS columnName, SUB_PART AS subPart,
             INDEX_TYPE AS indexType, IS_VISIBLE AS isVisible
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'finance_collection_confirmation_authorities'
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `);
    const indexNames = new Set(indexRows.map((row: Record<string, unknown>) => row.indexName));
    if (indexNames.size !== AUTHORITY_INDEXES.length) {
      throw new Error('finance_collection_confirmation_0065_incompatible:index_count');
    }
    for (const spec of AUTHORITY_INDEXES) {
      const rows = indexRows.filter(
        (row: Record<string, unknown>) => row.indexName === spec.name,
      );
      if (
        rows.length !== 1 ||
        rows[0].columnName !== spec.column ||
        Number(rows[0].nonUnique) !== spec.nonUnique ||
        Number(rows[0].seqInIndex) !== 1 ||
        rows[0].subPart != null ||
        String(rows[0].indexType).toUpperCase() !== 'BTREE' ||
        String(rows[0].isVisible).toUpperCase() !== 'YES'
      ) {
        throw new Error(`finance_collection_confirmation_0065_incompatible:index:${spec.name}`);
      }
    }

    const foreignRows = await queryRunner.query(`
      SELECT kcu.CONSTRAINT_NAME AS constraintName,
             kcu.COLUMN_NAME AS columnName,
             kcu.REFERENCED_TABLE_NAME AS referencedTableName,
             kcu.REFERENCED_COLUMN_NAME AS referencedColumnName,
             rc.DELETE_RULE AS deleteRule,
             rc.UPDATE_RULE AS updateRule
      FROM information_schema.KEY_COLUMN_USAGE kcu
      JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
        ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
       AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      WHERE kcu.CONSTRAINT_SCHEMA = DATABASE()
        AND kcu.TABLE_NAME = 'finance_collection_confirmation_authorities'
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
    `);
    const expectedForeignKeys: Array<[string, string, string, string]> = [
      ['fk_fcca_collection_order', 'collection_order_id', 'finance_collection_order', 'id'],
      ['fk_fcca_bank_transaction', 'bank_transaction_id', 'bank_sms_transaction', 'id'],
      ['fk_fcca_reconciliation_link', 'reconciliation_link_id', 'finance_reconciliation_link', 'id'],
      ['fk_fcca_work_order', 'work_order_id', 'work_orders', 'id'],
      ['fk_fcca_confirmed_by', 'confirmed_by', 'users', 'id'],
      ['fk_fcca_bank_account_registry', 'bank_account_registry_id', 'bank_account_registry', 'id'],
    ];
    if (foreignRows.length !== expectedForeignKeys.length) {
      throw new Error('finance_collection_confirmation_0065_incompatible:foreign_key_count');
    }
    for (const [
      constraintName,
      columnName,
      referencedTableName,
      referencedColumnName,
    ] of expectedForeignKeys) {
      const row = foreignRows.find(
        (item: Record<string, unknown>) => item.constraintName === constraintName,
      );
      if (
        !row ||
        row.columnName !== columnName ||
        row.referencedTableName !== referencedTableName ||
        row.referencedColumnName !== referencedColumnName ||
        !isRestrictiveRule(row.deleteRule) ||
        !isRestrictiveRule(row.updateRule)
      ) {
        throw new Error(
          `finance_collection_confirmation_0065_incompatible:foreign_key:${constraintName}`,
        );
      }
    }

    const checkRows = await queryRunner.query(`
      SELECT tc.CONSTRAINT_NAME AS constraintName, cc.CHECK_CLAUSE AS checkClause,
             tc.ENFORCED AS enforced
      FROM information_schema.TABLE_CONSTRAINTS tc
      JOIN information_schema.CHECK_CONSTRAINTS cc
        ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
       AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
      WHERE tc.CONSTRAINT_SCHEMA = DATABASE()
        AND tc.TABLE_NAME = 'finance_collection_confirmation_authorities'
        AND tc.CONSTRAINT_TYPE = 'CHECK'
      ORDER BY tc.CONSTRAINT_NAME
    `);
    for (const [name, expectedClause] of AUTHORITY_CHECKS) {
      const row = checkRows.find(
        (item: Record<string, unknown>) => item.constraintName === name,
      );
      const problem = authorityCheckCompatibilityProblem(name, expectedClause, row);
      if (problem) {
        throw new Error(problem);
      }
    }
    if (checkRows.length !== AUTHORITY_CHECKS.length) {
      throw new Error('finance_collection_confirmation_0065_incompatible:check_constraint_count');
    }
  }

  /**
   * Inspect the wechat_settlement_batch bank-match suggestion anchor stage.
   * Returns true for the exact applied schema and false for the pristine
   * (nothing applied) schema; any partial / wrong shape throws incompatible.
   *
   * Every index/FK/CHECK involving a new column is enumerated. The allowlist
   * includes the explicit composite index, the one-bank-one-batch unique index,
   * and MySQL's registry-FK support index. Any additional object is drift.
   */
  private async assertWechatSuggestionAnchorCompatible(
    queryRunner: QueryRunner,
  ): Promise<boolean> {
    const [wsbTable] = await queryRunner.query(`
      SELECT TABLE_NAME AS tableName
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wechat_settlement_batch'
    `);
    if (!wsbTable) {
      throw new Error('finance_collection_confirmation_0065_incompatible:wechat_settlement_batch_missing');
    }

    const columns = await queryRunner.query(`
      SELECT COLUMN_NAME AS columnName, COLUMN_TYPE AS columnType, IS_NULLABLE AS isNullable,
             COLUMN_DEFAULT AS columnDefault, EXTRA AS extra,
             CHARACTER_SET_NAME AS characterSet, COLLATION_NAME AS collation
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'wechat_settlement_batch'
        AND COLUMN_NAME IN (
          'bank_match_suggestion_version',
          'bank_match_suggestion_bank_sms_transaction_id',
          'bank_match_suggestion_registry_id',
          'bank_match_suggestion_registry_updated_at',
          'bank_match_suggestion_snapshot_hash',
          'bank_match_suggested_at'
        )
      ORDER BY ORDINAL_POSITION
    `);
    const columnByName = new Map(
      (columns as Array<Record<string, unknown>>).map((row) => [row.columnName, row]),
    );

    const indexRows = await queryRunner.query(`
      SELECT INDEX_NAME AS indexName, NON_UNIQUE AS nonUnique,
             SEQ_IN_INDEX AS seqInIndex, COLUMN_NAME AS columnName, SUB_PART AS subPart,
             INDEX_TYPE AS indexType, IS_VISIBLE AS isVisible
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'wechat_settlement_batch'
        AND INDEX_NAME IN (
          SELECT DISTINCT related.INDEX_NAME
          FROM information_schema.STATISTICS related
          WHERE related.TABLE_SCHEMA = DATABASE()
            AND related.TABLE_NAME = 'wechat_settlement_batch'
            AND related.COLUMN_NAME IN (
              'bank_match_suggestion_version',
              'bank_match_suggestion_bank_sms_transaction_id',
              'bank_match_suggestion_registry_id',
              'bank_match_suggestion_registry_updated_at',
              'bank_match_suggestion_snapshot_hash',
              'bank_match_suggested_at'
            )
        )
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `) as Array<Record<string, unknown>>;

    const foreignRows = await queryRunner.query(`
      SELECT kcu.CONSTRAINT_NAME AS constraintName,
             kcu.COLUMN_NAME AS columnName,
             kcu.REFERENCED_TABLE_NAME AS referencedTableName,
             kcu.REFERENCED_COLUMN_NAME AS referencedColumnName,
             rc.DELETE_RULE AS deleteRule,
             rc.UPDATE_RULE AS updateRule
      FROM information_schema.KEY_COLUMN_USAGE kcu
      JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
        ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
       AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      WHERE kcu.CONSTRAINT_SCHEMA = DATABASE()
        AND kcu.TABLE_NAME = 'wechat_settlement_batch'
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
        AND kcu.COLUMN_NAME IN (
          'bank_match_suggestion_version',
          'bank_match_suggestion_bank_sms_transaction_id',
          'bank_match_suggestion_registry_id',
          'bank_match_suggestion_registry_updated_at',
          'bank_match_suggestion_snapshot_hash',
          'bank_match_suggested_at'
        )
      ORDER BY kcu.CONSTRAINT_NAME
    `) as Array<Record<string, unknown>>;

    const checkRows = await queryRunner.query(`
      SELECT tc.CONSTRAINT_NAME AS constraintName, cc.CHECK_CLAUSE AS checkClause,
             tc.ENFORCED AS enforced
      FROM information_schema.TABLE_CONSTRAINTS tc
      JOIN information_schema.CHECK_CONSTRAINTS cc
        ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
       AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
      WHERE tc.CONSTRAINT_SCHEMA = DATABASE()
        AND tc.TABLE_NAME = 'wechat_settlement_batch'
        AND tc.CONSTRAINT_TYPE = 'CHECK'
    `) as Array<Record<string, unknown>>;

    const relatedCheckRows = checkRows.filter((row) => {
      const clause = normalizeActualCheckClause(row.checkClause);
      return WECHAT_SUGGESTION_COLUMNS.some((column) => clause.includes(column.name));
    });

    const pristine =
      columnByName.size === 0 &&
      indexRows.length === 0 &&
      foreignRows.length === 0 &&
      relatedCheckRows.length === 0;
    if (pristine) {
      return false;
    }

    if (columnByName.size !== WECHAT_SUGGESTION_COLUMNS.length) {
      throw new Error('finance_collection_confirmation_0065_incompatible:wechat_suggestion_column_count');
    }
    for (const spec of WECHAT_SUGGESTION_COLUMNS) {
      const actual = columnByName.get(spec.name);
      const actualExtra = normalizeExtra(actual?.extra);
      const actualDefault = normalizeColumnDefault(actual?.columnDefault);
      const charsetOk = spec.isChar
        ? String(actual?.characterSet ?? '').toLowerCase() === 'utf8mb4'
        : actual?.characterSet == null && actual?.collation == null;
      const extraOk =
        spec.extra === null
          ? actualExtra === null
          : (actualExtra ?? '').includes(spec.extra);
      if (
        actual?.columnName !== spec.name ||
        String(actual?.columnType).toLowerCase() !== spec.type ||
        actual?.isNullable !== spec.nullable ||
        actualDefault !== spec.default ||
        !extraOk ||
        !charsetOk
      ) {
        throw new Error(
          `finance_collection_confirmation_0065_incompatible:wechat_suggestion_column:${spec.name}`,
        );
      }
    }

    const expectedIndexRowCount = WECHAT_SUGGESTION_INDEXES.reduce(
      (sum, spec) => sum + spec.columns.length,
      0,
    );
    if (indexRows.length !== expectedIndexRowCount) {
      throw new Error('finance_collection_confirmation_0065_incompatible:wechat_suggestion_index_count');
    }
    for (const spec of WECHAT_SUGGESTION_INDEXES) {
      const rows = indexRows.filter((row) => row.indexName === spec.name);
      if (
        rows.length !== spec.columns.length ||
        !rows.every(
          (row, index) =>
            row.columnName === spec.columns[index] &&
            Number(row.seqInIndex) === index + 1 &&
            Number(row.nonUnique) === spec.nonUnique &&
            row.subPart == null &&
            String(row.indexType).toUpperCase() === 'BTREE' &&
            String(row.isVisible).toUpperCase() === 'YES',
        )
      ) {
        throw new Error(
          `finance_collection_confirmation_0065_incompatible:wechat_suggestion_index:${spec.name}`,
        );
      }
    }

    if (foreignRows.length !== WECHAT_SUGGESTION_FOREIGN_KEYS.length) {
      throw new Error('finance_collection_confirmation_0065_incompatible:wechat_suggestion_foreign_key_count');
    }
    for (const [constraintName, columnName, referencedTableName, referencedColumnName] of WECHAT_SUGGESTION_FOREIGN_KEYS) {
      const row = foreignRows.find((item) => item.constraintName === constraintName);
      if (
        !row ||
        row.columnName !== columnName ||
        row.referencedTableName !== referencedTableName ||
        row.referencedColumnName !== referencedColumnName ||
        !isRestrictiveRule(row.deleteRule) ||
        !isRestrictiveRule(row.updateRule)
      ) {
        throw new Error(
          `finance_collection_confirmation_0065_incompatible:wechat_suggestion_foreign_key:${constraintName}`,
        );
      }
    }

    if (relatedCheckRows.length === 0) {
      throw new Error(
        authorityCheckCompatibilityProblem(
          WECHAT_SUGGESTION_CHECK[0],
          WECHAT_SUGGESTION_CHECK[1],
        ) ?? 'finance_collection_confirmation_0065_incompatible:wechat_suggestion_check_missing',
      );
    }
    if (relatedCheckRows.length !== 1) {
      throw new Error('finance_collection_confirmation_0065_incompatible:wechat_suggestion_check_count');
    }
    const checkRow = relatedCheckRows[0];
    if (checkRow.constraintName !== WECHAT_SUGGESTION_CHECK[0]) {
      throw new Error('finance_collection_confirmation_0065_incompatible:wechat_suggestion_check_name');
    }
    const checkProblem = authorityCheckCompatibilityProblem(
      WECHAT_SUGGESTION_CHECK[0],
      WECHAT_SUGGESTION_CHECK[1],
      checkRow,
    );
    if (checkProblem) {
      throw new Error(checkProblem);
    }

    return true;
  }

  private async assertWechatRowsSafeBeforeDdl(
    queryRunner: QueryRunner,
    anchorSchemaApplied: boolean,
  ) {
    const unsafeCount = anchorSchemaApplied
      ? await this.readCount(
          queryRunner,
          `SELECT COUNT(*) AS \`count\` FROM \`wechat_settlement_batch\`
           WHERE (
             \`match_status\` IN ('suggested', 'confirmed') AND NOT (
               \`bank_match_suggestion_version\` > 0
               AND \`bank_match_suggestion_bank_sms_transaction_id\` > 0
               AND \`bank_match_suggestion_registry_id\` > 0
               AND \`bank_match_suggestion_registry_updated_at\` IS NOT NULL
               AND \`bank_match_suggestion_snapshot_hash\` IS NOT NULL
               AND CHAR_LENGTH(\`bank_match_suggestion_snapshot_hash\`) = 64
               AND \`bank_match_suggested_at\` IS NOT NULL
             )
           ) OR (
             \`match_status\` NOT IN ('suggested', 'confirmed') AND NOT (
               \`bank_match_suggestion_version\` = 0
               AND \`bank_match_suggestion_bank_sms_transaction_id\` IS NULL
               AND \`bank_match_suggestion_registry_id\` IS NULL
               AND \`bank_match_suggestion_registry_updated_at\` IS NULL
               AND \`bank_match_suggestion_snapshot_hash\` IS NULL
               AND \`bank_match_suggested_at\` IS NULL
             )
           )`,
        )
      : await this.readCount(
          queryRunner,
          "SELECT COUNT(*) AS `count` FROM `wechat_settlement_batch` WHERE `match_status` IN ('suggested', 'confirmed')",
        );
    if (unsafeCount > 0) {
      throw new Error(
        `finance_collection_confirmation_0065_legacy_wechat_anchor_rows:${unsafeCount}`,
      );
    }
  }

  private async readCount(queryRunner: QueryRunner, sql: string) {
    const [row] = await queryRunner.query(sql);
    return Number(row?.count ?? 0);
  }

  private assertState(condition: boolean, code: string) {
    if (!condition) throw new Error(code);
  }
}
