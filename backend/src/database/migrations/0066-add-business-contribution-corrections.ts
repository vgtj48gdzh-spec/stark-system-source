import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  normalizeMysqlCheckClause as normalizeCheckClause,
  normalizeMysqlInformationSchemaCheckClause as normalizeActualCheckClause,
} from '../../common/utils/mysql-check-clause.util';

type TableState0066 = Readonly<{
  identityRegistryExists: boolean;
  correctionsExists: boolean;
}>;

const IDENTITY_TABLE_0066 = 'business_contribution_identity_allocations';
const CORRECTION_TABLE_0066 = 'business_contribution_corrections';
const SCHEMA_DIAGNOSTIC_SEGMENT_LIMIT_0066 = 2048;

export class AddBusinessContributionCorrections00661790000001000
  implements MigrationInterface
{
  name = 'AddBusinessContributionCorrections00661790000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const state = await this.readTableState(queryRunner);
    if (state.correctionsExists && !state.identityRegistryExists) {
      throw new Error(
        'business_contribution_0066_state_incompatible:corrections_without_identity_registry',
      );
    }

    // Compatibility is proven before this invocation's first DDL or DML.
    await this.assertIdentityBackfillSafe(queryRunner);
    if (state.identityRegistryExists) {
      await this.assertIdentityRegistrySchema(queryRunner);
    }
    if (state.correctionsExists) {
      await this.assertCorrectionSchema(queryRunner);
    }
    if (state.identityRegistryExists) {
      await this.assertIdentityRegistryCompatible(
        queryRunner,
        state.correctionsExists,
      );
    }
    if (state.correctionsExists) {
      await this.assertIdentityRegistryComplete(queryRunner, true);
      return;
    }

    if (!state.identityRegistryExists) {
      await queryRunner.query(`
      CREATE TABLE \`business_contribution_identity_allocations\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`identity_kind\` ENUM('source','evidence') CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`identity_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`owner_kind\` ENUM('contribution','contribution_evidence','correction') CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`owner_id\` INT NOT NULL,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_bcia_identity\` (\`identity_kind\`, \`identity_hash\`),
        KEY \`idx_bcia_owner\` (\`owner_kind\`, \`owner_id\`, \`identity_kind\`),
        CONSTRAINT \`chk_bcia_hash\` CHECK (
          REGEXP_LIKE(\`identity_hash\`, '^[0-9a-f]{64}$', 'c')
        ),
        CONSTRAINT \`chk_bcia_owner\` CHECK (
          \`owner_id\` > 0
          AND (
            (\`identity_kind\` = 'source' AND \`owner_kind\` = 'contribution')
            OR (\`identity_kind\` = 'evidence' AND \`owner_kind\` = 'contribution_evidence')
            OR \`owner_kind\` = 'correction'
          )
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await this.assertIdentityRegistrySchema(queryRunner);
    }

    await queryRunner.query(`
      INSERT INTO \`business_contribution_identity_allocations\` (
        \`identity_kind\`, \`identity_hash\`, \`owner_kind\`, \`owner_id\`
      )
      SELECT
        expected.identity_kind,
        expected.identity_hash,
        expected.owner_kind,
        expected.owner_id
      FROM (
        SELECT
          'source' AS identity_kind,
          \`unique_source_key\` AS identity_hash,
          'contribution' AS owner_kind,
          \`id\` AS owner_id
        FROM \`business_contributions\`
        UNION ALL
        SELECT
          'evidence' AS identity_kind,
          \`evidence_unique_key\` AS identity_hash,
          'contribution_evidence' AS owner_kind,
          \`id\` AS owner_id
        FROM \`business_contribution_evidence\`
      ) expected
      LEFT JOIN \`business_contribution_identity_allocations\` actual
        ON actual.identity_kind = expected.identity_kind
       AND actual.identity_hash = expected.identity_hash
       AND actual.owner_kind = expected.owner_kind
       AND actual.owner_id = expected.owner_id
      WHERE actual.id IS NULL
      ORDER BY expected.identity_kind, expected.identity_hash, expected.owner_id
    `);
    await this.assertIdentityRegistryCompatible(queryRunner, false);
    await this.assertIdentityRegistryComplete(queryRunner, false);

    await queryRunner.query(`
      CREATE TABLE \`business_contribution_corrections\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`original_contribution_id\` INT NOT NULL,
        \`correction_type\` ENUM('customer_refund','rework_direct_cost','supplier_cost_recovery','full_void') CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`sequence\` INT NOT NULL,
        \`revenue_delta_cents\` BIGINT NOT NULL,
        \`direct_cost_delta_cents\` BIGINT NOT NULL,
        \`margin_delta_cents\` BIGINT NOT NULL,
        \`business_domain\` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`company_ref\` VARCHAR(100) NOT NULL,
        \`business_sector_ref\` VARCHAR(100) NULL,
        \`store_ref\` VARCHAR(100) NULL,
        \`customer_ref\` VARCHAR(100) NULL,
        \`operating_group_id\` INT NOT NULL,
        \`source_authority_version_id\` INT NOT NULL,
        \`adapter_version\` VARCHAR(100) NOT NULL,
        \`source_system\` VARCHAR(64) NOT NULL,
        \`source_type\` VARCHAR(64) NOT NULL,
        \`source_id\` VARCHAR(120) NOT NULL,
        \`source_version\` VARCHAR(100) NOT NULL,
        \`source_record_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`source_allocation_id\` VARCHAR(120) NOT NULL,
        \`unique_source_key\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`evidence_unique_key\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`economic_fact_key\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`authority_snapshot_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`evidence_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`evidence_ref\` VARCHAR(500) NOT NULL,
        \`attribution_snapshot_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`occurred_at\` DATETIME(6) NOT NULL,
        \`recognition_period\` CHAR(7) NOT NULL,
        \`recognition_at\` DATETIME(6) NOT NULL,
        \`currency\` CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'CNY',
        \`idempotency_key\` VARCHAR(120) NOT NULL,
        \`request_fingerprint\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`created_by\` INT NOT NULL,
        \`reason\` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`source_channel\` VARCHAR(50) NOT NULL,
        \`correlation_id\` VARCHAR(100) NOT NULL,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_bcc_idempotency\` (\`idempotency_key\`),
        UNIQUE KEY \`uq_bcc_original_sequence\` (\`original_contribution_id\`, \`sequence\`),
        UNIQUE KEY \`uq_bcc_source_identity\` (\`unique_source_key\`),
        UNIQUE KEY \`uq_bcc_evidence\` (\`evidence_unique_key\`),
        KEY \`idx_bcc_original_period\` (\`original_contribution_id\`, \`recognition_period\`),
        KEY \`idx_bcc_economic_fact\` (\`economic_fact_key\`, \`correction_type\`),
        KEY \`idx_bcc_group_period\` (\`operating_group_id\`, \`recognition_period\`, \`id\`),
        KEY \`idx_bcc_authority\` (\`source_authority_version_id\`),
        CONSTRAINT \`fk_bcc_original_contribution\` FOREIGN KEY (\`original_contribution_id\`)
          REFERENCES \`business_contributions\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
        CONSTRAINT \`fk_bcc_group\` FOREIGN KEY (\`operating_group_id\`)
          REFERENCES \`organization_groups\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
        CONSTRAINT \`fk_bcc_authority\` FOREIGN KEY (\`source_authority_version_id\`)
          REFERENCES \`contribution_source_authority_versions\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
        CONSTRAINT \`chk_bcc_domain\` CHECK (
          \`business_domain\` IN ('fresh','water','repair','software')
        ),
        CONSTRAINT \`chk_bcc_delta_shape\` CHECK (
          (\`correction_type\` = 'customer_refund' AND \`revenue_delta_cents\` < 0 AND \`direct_cost_delta_cents\` = 0)
          OR (\`correction_type\` = 'rework_direct_cost' AND \`revenue_delta_cents\` = 0 AND \`direct_cost_delta_cents\` > 0)
          OR (\`correction_type\` = 'supplier_cost_recovery' AND \`revenue_delta_cents\` = 0 AND \`direct_cost_delta_cents\` < 0)
          OR (\`correction_type\` = 'full_void' AND \`revenue_delta_cents\` < 0 AND \`direct_cost_delta_cents\` <= 0)
        ),
        CONSTRAINT \`chk_bcc_margin_delta\` CHECK (
          \`margin_delta_cents\` = \`revenue_delta_cents\` - \`direct_cost_delta_cents\`
        ),
        CONSTRAINT \`chk_bcc_sequence\` CHECK (\`sequence\` > 0),
        CONSTRAINT \`chk_bcc_period\` CHECK (
          \`recognition_period\` REGEXP '^20[0-9]{2}-(0[1-9]|1[0-2])$'
        ),
        CONSTRAINT \`chk_bcc_time_order\` CHECK (\`recognition_at\` >= \`occurred_at\`),
        CONSTRAINT \`chk_bcc_currency\` CHECK (\`currency\` = 'CNY'),
        CONSTRAINT \`chk_bcc_reason_code\` CHECK (
          (\`correction_type\` = 'customer_refund' AND \`reason\` = 'correction.customer_refund')
          OR (\`correction_type\` = 'rework_direct_cost' AND \`reason\` = 'correction.rework_direct_cost')
          OR (\`correction_type\` = 'supplier_cost_recovery' AND \`reason\` = 'correction.supplier_cost_recovery')
          OR (\`correction_type\` = 'full_void' AND \`reason\` = 'correction.full_void')
        ),
        CONSTRAINT \`chk_bcc_hashes\` CHECK (
          REGEXP_LIKE(\`source_record_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`unique_source_key\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`evidence_unique_key\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`economic_fact_key\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`authority_snapshot_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`evidence_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`attribution_snapshot_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`request_fingerprint\`, '^[0-9a-f]{64}$', 'c')
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await this.assertCorrectionSchema(queryRunner);
    await this.assertIdentityRegistryComplete(queryRunner, true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const state = await this.readTableState(queryRunner);
    if (!state.identityRegistryExists && !state.correctionsExists) return;
    if (state.correctionsExists && !state.identityRegistryExists) {
      throw new Error(
        'business_contribution_0066_down_state_incompatible:corrections_without_identity_registry',
      );
    }

    // Validate every surviving object before the first DROP. Registry-only is
    // a valid partial-up or partial-down state, so a legal subset may drop.
    await this.assertIdentityBackfillSafe(queryRunner);
    await this.assertIdentityRegistrySchema(queryRunner);
    if (state.correctionsExists) {
      await this.assertCorrectionSchema(queryRunner);
      await this.assertIdentityRegistryCompatible(queryRunner, true);
      await this.assertIdentityRegistryComplete(queryRunner, true);
      const [row] = await queryRunner.query(
        'SELECT COUNT(*) AS \`count\` FROM \`business_contribution_corrections\`',
      );
      const count = BigInt(String(row?.count ?? '0'));
      if (count > 0n) {
        throw new Error(
          `business_contribution_corrections_0066_down_blocked:correction_rows=${count}`,
        );
      }
      await queryRunner.query('DROP TABLE \`business_contribution_corrections\`');
    } else {
      await this.assertIdentityRegistryCompatible(queryRunner, false);
    }
    await queryRunner.query('DROP TABLE \`business_contribution_identity_allocations\`');
  }

  private async readTableState(queryRunner: QueryRunner): Promise<TableState0066> {
    const rows = await queryRunner.query(
      `SELECT TABLE_NAME AS table_name, TABLE_TYPE AS table_type
         FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN (?, ?)
        ORDER BY TABLE_NAME`,
      [IDENTITY_TABLE_0066, CORRECTION_TABLE_0066],
    );
    const nonTables = rows.filter(
      (row: any) => String(row.table_type) !== 'BASE TABLE',
    );
    if (nonTables.length > 0) {
      throw new Error(
        `business_contribution_0066_state_incompatible:non_table_object=${String(nonTables[0].table_name)}`,
      );
    }
    const names = new Set(rows.map((row: any) => String(row.table_name)));
    return {
      identityRegistryExists: names.has(IDENTITY_TABLE_0066),
      correctionsExists: names.has(CORRECTION_TABLE_0066),
    };
  }

  private async assertIdentityRegistryCompatible(
    queryRunner: QueryRunner,
    includeCorrections: boolean,
  ): Promise<void> {
    const correctionJoins = includeCorrections
      ? `
        LEFT JOIN \`business_contribution_corrections\` correction_source
          ON allocation.owner_kind = 'correction'
         AND allocation.identity_kind = 'source'
         AND correction_source.id = allocation.owner_id
         AND correction_source.unique_source_key = allocation.identity_hash
        LEFT JOIN \`business_contribution_corrections\` correction_evidence
          ON allocation.owner_kind = 'correction'
         AND allocation.identity_kind = 'evidence'
         AND correction_evidence.id = allocation.owner_id
         AND correction_evidence.evidence_unique_key = allocation.identity_hash`
      : '';
    const correctionValidity = includeCorrections
      ? 'OR correction_source.id IS NOT NULL OR correction_evidence.id IS NOT NULL'
      : '';
    const [row] = await queryRunner.query(`
      SELECT COUNT(*) AS \`invalid_count\`
      FROM \`business_contribution_identity_allocations\` allocation
      LEFT JOIN \`business_contributions\` contribution
        ON allocation.identity_kind = 'source'
       AND allocation.owner_kind = 'contribution'
       AND contribution.id = allocation.owner_id
       AND contribution.unique_source_key = allocation.identity_hash
      LEFT JOIN \`business_contribution_evidence\` evidence
        ON allocation.identity_kind = 'evidence'
       AND allocation.owner_kind = 'contribution_evidence'
       AND evidence.id = allocation.owner_id
       AND evidence.evidence_unique_key = allocation.identity_hash
      ${correctionJoins}
      WHERE NOT (
        contribution.id IS NOT NULL
        OR evidence.id IS NOT NULL
        ${correctionValidity}
      )
    `);
    const invalidCount = BigInt(String(row?.invalid_count ?? '0'));
    if (invalidCount > 0n) {
      throw new Error(
        `business_contribution_identity_0066_registry_incompatible:invalid_rows=${invalidCount}`,
      );
    }
  }

  private async assertIdentityRegistryComplete(
    queryRunner: QueryRunner,
    includeCorrections: boolean,
  ): Promise<void> {
    const correctionExpected = includeCorrections
      ? ' + (SELECT COUNT(*) * 2 FROM `business_contribution_corrections`)'
      : '';
    const [row] = await queryRunner.query(`
      SELECT
        (
          (SELECT COUNT(*) FROM \`business_contributions\`)
          + (SELECT COUNT(*) FROM \`business_contribution_evidence\`)
          ${correctionExpected}
        ) AS \`expected_count\`,
        (SELECT COUNT(*) FROM \`business_contribution_identity_allocations\`)
          AS \`actual_count\`
    `);
    const expectedCount = BigInt(String(row?.expected_count ?? '0'));
    const actualCount = BigInt(String(row?.actual_count ?? '0'));
    if (actualCount !== expectedCount) {
      throw new Error(
        `business_contribution_identity_0066_backfill_count_mismatch:expected=${expectedCount}:actual=${actualCount}`,
      );
    }
  }

  private async assertIdentityRegistrySchema(queryRunner: QueryRunner): Promise<void> {
    await this.assertTableOptions(queryRunner, IDENTITY_TABLE_0066);
    await this.assertExactColumns(queryRunner, IDENTITY_TABLE_0066, [
      'id|int|NO|<null>|auto_increment|<null>|<null>',
      "identity_kind|enum('source','evidence')|NO|<null>||ascii|ascii_bin",
      'identity_hash|char(64)|NO|<null>||ascii|ascii_bin',
      "owner_kind|enum('contribution','contribution_evidence','correction')|NO|<null>||ascii|ascii_bin",
      'owner_id|int|NO|<null>||<null>|<null>',
      'created_at|datetime(6)|NO|current_timestamp(6)|default_generated|<null>|<null>',
    ]);
    await this.assertExactIndexes(queryRunner, IDENTITY_TABLE_0066, [
      'PRIMARY|0|1|id|BTREE|<null>|YES',
      'idx_bcia_owner|1|1|owner_kind|BTREE|<null>|YES',
      'idx_bcia_owner|1|2|owner_id|BTREE|<null>|YES',
      'idx_bcia_owner|1|3|identity_kind|BTREE|<null>|YES',
      'uq_bcia_identity|0|1|identity_kind|BTREE|<null>|YES',
      'uq_bcia_identity|0|2|identity_hash|BTREE|<null>|YES',
    ]);
    await this.assertExactForeignKeys(queryRunner, IDENTITY_TABLE_0066, []);
    await this.assertExactChecks(
      queryRunner,
      IDENTITY_TABLE_0066,
      new Map([
        [
          'chk_bcia_hash',
          "regexp_like(\`identity_hash\`,'^[0-9a-f]{64}$','c')",
        ],
        [
          'chk_bcia_owner',
          "\`owner_id\` > 0 AND ((\`identity_kind\` = 'source' AND \`owner_kind\` = 'contribution') OR (\`identity_kind\` = 'evidence' AND \`owner_kind\` = 'contribution_evidence') OR \`owner_kind\` = 'correction')",
        ],
      ]),
    );
  }

  private async assertCorrectionSchema(queryRunner: QueryRunner): Promise<void> {
    await this.assertTableOptions(queryRunner, CORRECTION_TABLE_0066);
    await this.assertExactColumns(queryRunner, CORRECTION_TABLE_0066, [
      'id|int|NO|<null>|auto_increment|<null>|<null>',
      'original_contribution_id|int|NO|<null>||<null>|<null>',
      "correction_type|enum('customer_refund','rework_direct_cost','supplier_cost_recovery','full_void')|NO|<null>||ascii|ascii_bin",
      'sequence|int|NO|<null>||<null>|<null>',
      'revenue_delta_cents|bigint|NO|<null>||<null>|<null>',
      'direct_cost_delta_cents|bigint|NO|<null>||<null>|<null>',
      'margin_delta_cents|bigint|NO|<null>||<null>|<null>',
      'business_domain|varchar(24)|NO|<null>||ascii|ascii_bin',
      'company_ref|varchar(100)|NO|<null>||utf8mb4|utf8mb4_unicode_ci',
      'business_sector_ref|varchar(100)|YES|<null>||utf8mb4|utf8mb4_unicode_ci',
      'store_ref|varchar(100)|YES|<null>||utf8mb4|utf8mb4_unicode_ci',
      'customer_ref|varchar(100)|YES|<null>||utf8mb4|utf8mb4_unicode_ci',
      'operating_group_id|int|NO|<null>||<null>|<null>',
      'source_authority_version_id|int|NO|<null>||<null>|<null>',
      'adapter_version|varchar(100)|NO|<null>||utf8mb4|utf8mb4_unicode_ci',
      'source_system|varchar(64)|NO|<null>||utf8mb4|utf8mb4_unicode_ci',
      'source_type|varchar(64)|NO|<null>||utf8mb4|utf8mb4_unicode_ci',
      'source_id|varchar(120)|NO|<null>||utf8mb4|utf8mb4_unicode_ci',
      'source_version|varchar(100)|NO|<null>||utf8mb4|utf8mb4_unicode_ci',
      'source_record_hash|char(64)|NO|<null>||ascii|ascii_bin',
      'source_allocation_id|varchar(120)|NO|<null>||utf8mb4|utf8mb4_unicode_ci',
      'unique_source_key|char(64)|NO|<null>||ascii|ascii_bin',
      'evidence_unique_key|char(64)|NO|<null>||ascii|ascii_bin',
      'economic_fact_key|char(64)|NO|<null>||ascii|ascii_bin',
      'authority_snapshot_hash|char(64)|NO|<null>||ascii|ascii_bin',
      'evidence_hash|char(64)|NO|<null>||ascii|ascii_bin',
      'evidence_ref|varchar(500)|NO|<null>||utf8mb4|utf8mb4_unicode_ci',
      'attribution_snapshot_hash|char(64)|NO|<null>||ascii|ascii_bin',
      'occurred_at|datetime(6)|NO|<null>||<null>|<null>',
      'recognition_period|char(7)|NO|<null>||utf8mb4|utf8mb4_unicode_ci',
      'recognition_at|datetime(6)|NO|<null>||<null>|<null>',
      'currency|char(3)|NO|CNY||ascii|ascii_bin',
      'idempotency_key|varchar(120)|NO|<null>||utf8mb4|utf8mb4_unicode_ci',
      'request_fingerprint|char(64)|NO|<null>||ascii|ascii_bin',
      'created_by|int|NO|<null>||<null>|<null>',
      'reason|varchar(64)|NO|<null>||ascii|ascii_bin',
      'source_channel|varchar(50)|NO|<null>||utf8mb4|utf8mb4_unicode_ci',
      'correlation_id|varchar(100)|NO|<null>||utf8mb4|utf8mb4_unicode_ci',
      'created_at|datetime(6)|NO|current_timestamp(6)|default_generated|<null>|<null>',
    ]);
    await this.assertExactIndexes(queryRunner, CORRECTION_TABLE_0066, [
      'PRIMARY|0|1|id|BTREE|<null>|YES',
      'uq_bcc_idempotency|0|1|idempotency_key|BTREE|<null>|YES',
      'uq_bcc_original_sequence|0|1|original_contribution_id|BTREE|<null>|YES',
      'uq_bcc_original_sequence|0|2|sequence|BTREE|<null>|YES',
      'uq_bcc_source_identity|0|1|unique_source_key|BTREE|<null>|YES',
      'uq_bcc_evidence|0|1|evidence_unique_key|BTREE|<null>|YES',
      'idx_bcc_original_period|1|1|original_contribution_id|BTREE|<null>|YES',
      'idx_bcc_original_period|1|2|recognition_period|BTREE|<null>|YES',
      'idx_bcc_economic_fact|1|1|economic_fact_key|BTREE|<null>|YES',
      'idx_bcc_economic_fact|1|2|correction_type|BTREE|<null>|YES',
      'idx_bcc_group_period|1|1|operating_group_id|BTREE|<null>|YES',
      'idx_bcc_group_period|1|2|recognition_period|BTREE|<null>|YES',
      'idx_bcc_group_period|1|3|id|BTREE|<null>|YES',
      'idx_bcc_authority|1|1|source_authority_version_id|BTREE|<null>|YES',
    ]);
    await this.assertExactForeignKeys(queryRunner, CORRECTION_TABLE_0066, [
      'fk_bcc_original_contribution|original_contribution_id|business_contributions|id|RESTRICT|RESTRICT',
      'fk_bcc_group|operating_group_id|organization_groups|id|RESTRICT|RESTRICT',
      'fk_bcc_authority|source_authority_version_id|contribution_source_authority_versions|id|RESTRICT|RESTRICT',
    ]);
    await this.assertExactChecks(
      queryRunner,
      CORRECTION_TABLE_0066,
      new Map([
        [
          'chk_bcc_domain',
          "\`business_domain\` IN ('fresh','water','repair','software')",
        ],
        [
          'chk_bcc_delta_shape',
          `(\`correction_type\` = 'customer_refund' AND \`revenue_delta_cents\` < 0 AND \`direct_cost_delta_cents\` = 0)
          OR (\`correction_type\` = 'rework_direct_cost' AND \`revenue_delta_cents\` = 0 AND \`direct_cost_delta_cents\` > 0)
          OR (\`correction_type\` = 'supplier_cost_recovery' AND \`revenue_delta_cents\` = 0 AND \`direct_cost_delta_cents\` < 0)
          OR (\`correction_type\` = 'full_void' AND \`revenue_delta_cents\` < 0 AND \`direct_cost_delta_cents\` <= 0)`,
        ],
        [
          'chk_bcc_margin_delta',
          '\`margin_delta_cents\` = (\`revenue_delta_cents\` - \`direct_cost_delta_cents\`)',
        ],
        ['chk_bcc_sequence', '\`sequence\` > 0'],
        [
          'chk_bcc_period',
          "regexp_like(\`recognition_period\`,'^20[0-9]{2}-(0[1-9]|1[0-2])$')",
        ],
        ['chk_bcc_time_order', '\`recognition_at\` >= \`occurred_at\`'],
        ['chk_bcc_currency', "\`currency\` = 'CNY'"],
        [
          'chk_bcc_reason_code',
          `(\`correction_type\` = 'customer_refund' AND \`reason\` = 'correction.customer_refund')
          OR (\`correction_type\` = 'rework_direct_cost' AND \`reason\` = 'correction.rework_direct_cost')
          OR (\`correction_type\` = 'supplier_cost_recovery' AND \`reason\` = 'correction.supplier_cost_recovery')
          OR (\`correction_type\` = 'full_void' AND \`reason\` = 'correction.full_void')`,
        ],
        [
          'chk_bcc_hashes',
          `regexp_like(\`source_record_hash\`,'^[0-9a-f]{64}$','c')
          AND regexp_like(\`unique_source_key\`,'^[0-9a-f]{64}$','c')
          AND regexp_like(\`evidence_unique_key\`,'^[0-9a-f]{64}$','c')
          AND regexp_like(\`economic_fact_key\`,'^[0-9a-f]{64}$','c')
          AND regexp_like(\`authority_snapshot_hash\`,'^[0-9a-f]{64}$','c')
          AND regexp_like(\`evidence_hash\`,'^[0-9a-f]{64}$','c')
          AND regexp_like(\`attribution_snapshot_hash\`,'^[0-9a-f]{64}$','c')
          AND regexp_like(\`request_fingerprint\`,'^[0-9a-f]{64}$','c')`,
        ],
      ]),
    );
  }

  private async assertTableOptions(
    queryRunner: QueryRunner,
    tableName: string,
  ): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT TABLE_TYPE AS table_type, ENGINE AS engine,
              TABLE_COLLATION AS table_collation, ROW_FORMAT AS row_format,
              CREATE_OPTIONS AS create_options
         FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tableName],
    );
    const actual = rows.map(
      (row: any) =>
        `${String(row.table_type)}|${String(row.engine)}|${String(row.table_collation)}|${String(row.row_format)}|${String(row.create_options ?? '')}`,
    );
    this.assertExact(
      `${tableName}:table_options`,
      actual,
      ['BASE TABLE|InnoDB|utf8mb4_unicode_ci|Dynamic|'],
    );
  }

  private async assertExactColumns(
    queryRunner: QueryRunner,
    tableName: string,
    expected: readonly string[],
  ): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT COLUMN_NAME AS column_name, COLUMN_TYPE AS column_type,
              IS_NULLABLE AS is_nullable, COLUMN_DEFAULT AS column_default,
              EXTRA AS extra, CHARACTER_SET_NAME AS character_set_name,
              COLLATION_NAME AS collation_name
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION`,
      [tableName],
    );
    const nullableString = (value: unknown): string =>
      value === null ? '<null>' : String(value);
    const actual = rows.map((row: any) => {
      const rawDefault = nullableString(row.column_default);
      const defaultValue = rawDefault.toLowerCase().startsWith('current_timestamp')
        ? rawDefault.toLowerCase()
        : rawDefault;
      return [
        String(row.column_name),
        String(row.column_type).toLowerCase(),
        String(row.is_nullable),
        defaultValue,
        String(row.extra ?? '').toLowerCase(),
        nullableString(row.character_set_name),
        nullableString(row.collation_name),
      ].join('|');
    });
    this.assertExact(`${tableName}:columns`, actual, expected);
  }

  private async assertExactIndexes(
    queryRunner: QueryRunner,
    tableName: string,
    expected: readonly string[],
  ): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT INDEX_NAME AS index_name, NON_UNIQUE AS non_unique,
              SEQ_IN_INDEX AS seq_in_index, COLUMN_NAME AS column_name,
              INDEX_TYPE AS index_type, SUB_PART AS sub_part,
              IS_VISIBLE AS is_visible
         FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tableName],
    );
    const actual = rows.map((row: any) =>
      [
        String(row.index_name),
        String(row.non_unique),
        String(row.seq_in_index),
        String(row.column_name),
        String(row.index_type),
        row.sub_part === null ? '<null>' : String(row.sub_part),
        String(row.is_visible),
      ].join('|'),
    );
    this.assertExact(
      `${tableName}:indexes`,
      actual.sort(),
      [...expected].sort(),
    );
  }

  private async assertExactForeignKeys(
    queryRunner: QueryRunner,
    tableName: string,
    expected: readonly string[],
  ): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT kcu.CONSTRAINT_NAME AS constraint_name,
              kcu.COLUMN_NAME AS column_name,
              kcu.REFERENCED_TABLE_NAME AS referenced_table_name,
              kcu.REFERENCED_COLUMN_NAME AS referenced_column_name,
              rc.UPDATE_RULE AS update_rule, rc.DELETE_RULE AS delete_rule
         FROM information_schema.KEY_COLUMN_USAGE kcu
         JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
           ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
          AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
          AND rc.TABLE_NAME = kcu.TABLE_NAME
        WHERE kcu.TABLE_SCHEMA = DATABASE()
          AND kcu.TABLE_NAME = ?
          AND kcu.REFERENCED_TABLE_NAME IS NOT NULL`,
      [tableName],
    );
    const actual = rows.map((row: any) =>
      [
        String(row.constraint_name),
        String(row.column_name),
        String(row.referenced_table_name),
        String(row.referenced_column_name),
        String(row.update_rule),
        String(row.delete_rule),
      ].join('|'),
    );
    this.assertExact(
      `${tableName}:foreign_keys`,
      actual.sort(),
      [...expected].sort(),
    );
  }

  private async assertExactChecks(
    queryRunner: QueryRunner,
    tableName: string,
    expected: ReadonlyMap<string, string>,
  ): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT tc.CONSTRAINT_NAME AS constraint_name,
              cc.CHECK_CLAUSE AS check_clause, tc.ENFORCED AS enforced
         FROM information_schema.TABLE_CONSTRAINTS tc
         JOIN information_schema.CHECK_CONSTRAINTS cc
           ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
          AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
        WHERE tc.TABLE_SCHEMA = DATABASE()
          AND tc.TABLE_NAME = ?
          AND tc.CONSTRAINT_TYPE = 'CHECK'`,
      [tableName],
    );
    this.assertExact(
      `${tableName}:check_names`,
      rows.map((row: any) => String(row.constraint_name)).sort(),
      [...expected.keys()].sort(),
    );
    for (const row of rows) {
      const name = String(row.constraint_name);
      if (String(row.enforced) !== 'YES') {
        this.incompatible(`${tableName}:${name}:not_enforced`);
      }
      const expectedClause = expected.get(name);
      const actualClause = normalizeActualCheckClause(
        this.decode0066EscapedMetadataLiterals(String(row.check_clause)),
      );
      const expectedCanonical =
        expectedClause === undefined ? undefined : normalizeCheckClause(expectedClause);
      if (expectedCanonical === undefined || actualClause !== expectedCanonical) {
        const actualDiagnostic = this.schemaDiagnosticSegment(actualClause);
        const expectedDiagnostic = this.schemaDiagnosticSegment(expectedCanonical);
        this.incompatible(
          `${tableName}:${name}:definition:actual=${actualDiagnostic}:expected=${expectedDiagnostic}`,
        );
      }
    }
  }

  private decode0066EscapedMetadataLiterals(raw: string): string {
    const allowed = new Set([
      'source',
      'evidence',
      'contribution',
      'contribution_evidence',
      'correction',
      'fresh',
      'water',
      'repair',
      'software',
      'customer_refund',
      'rework_direct_cost',
      'supplier_cost_recovery',
      'full_void',
      'CNY',
      'c',
      'correction.customer_refund',
      'correction.rework_direct_cost',
      'correction.supplier_cost_recovery',
      'correction.full_void',
      '^[0-9a-f]{64}$',
      '^20[0-9]{2}-(0[1-9]|1[0-2])$',
    ]);
    const prefix = "_utf8mb4\\'";
    let output = '';
    let index = 0;
    while (index < raw.length) {
      const char = raw[index];
      if (char === "'" || char === '"' || char === '`') {
        const quote = char;
        const start = index;
        index += 1;
        let closed = false;
        while (index < raw.length) {
          if (raw[index] === '\\' && quote !== '`') return raw;
          if (raw[index] === quote) {
            if (raw[index + 1] === quote) {
              index += 2;
              continue;
            }
            index += 1;
            closed = true;
            break;
          }
          index += 1;
        }
        if (!closed) return raw;
        output += raw.slice(start, index);
        continue;
      }
      if (raw.startsWith(prefix, index)) {
        const before = index === 0 ? '' : raw[index - 1];
        if (before && !/[\s(,=]/.test(before)) return raw;
        const valueStart = index + prefix.length;
        const close = raw.indexOf("\\'", valueStart);
        if (close < 0) return raw;
        const value = raw.slice(valueStart, close);
        const end = close + 2;
        const after = raw[end] ?? '';
        if (!allowed.has(value) || (after && !/[\s),]/.test(after))) return raw;
        output += `'${value}'`;
        index = end;
        continue;
      }
      if (char === '\\') return raw;
      output += char;
      index += 1;
    }
    return output;
  }

  private assertExact(label: string, actual: unknown, expected: unknown): void {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      const actualDiagnostic = this.schemaDiagnosticSegment(actual);
      const expectedDiagnostic = this.schemaDiagnosticSegment(expected);
      this.incompatible(
        `${label}:actual=${actualDiagnostic}:expected=${expectedDiagnostic}`,
      );
    }
  }

  private schemaDiagnosticSegment(value: unknown): string {
    const serialized = JSON.stringify(value) ?? String(value);
    return serialized
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')
      .slice(0, SCHEMA_DIAGNOSTIC_SEGMENT_LIMIT_0066);
  }

  private incompatible(detail: string): never {
    throw new Error(`business_contribution_0066_schema_incompatible:${detail}`);
  }

  private async assertIdentityBackfillSafe(queryRunner: QueryRunner): Promise<void> {
    const duplicates = await queryRunner.query(`
      SELECT
        identity_kind,
        identity_hash,
        COUNT(*) AS \`duplicate_count\`
      FROM (
        SELECT 'source' AS identity_kind, \`unique_source_key\` AS identity_hash
        FROM \`business_contributions\`
        UNION ALL
        SELECT 'evidence' AS identity_kind, \`evidence_unique_key\` AS identity_hash
        FROM \`business_contribution_evidence\`
      ) identity_rows
      GROUP BY identity_kind, identity_hash
      HAVING COUNT(*) > 1
      ORDER BY identity_kind, identity_hash
      LIMIT 1
    `);
    if (duplicates.length > 0) {
      const duplicate = duplicates[0];
      throw new Error(
        `business_contribution_identity_0066_backfill_conflict:kind=${String(duplicate.identity_kind)}:count=${String(duplicate.duplicate_count)}`,
      );
    }

    const [invalid] = await queryRunner.query(`
      SELECT
        COALESCE(SUM(
          CASE WHEN NOT REGEXP_LIKE(identity_hash, '^[0-9a-f]{64}$', 'c')
            THEN 1 ELSE 0 END
        ), 0) AS \`invalid_hash_count\`,
        COALESCE(SUM(
          CASE WHEN owner_id <= 0 THEN 1 ELSE 0 END
        ), 0) AS \`invalid_owner_count\`
      FROM (
        SELECT \`unique_source_key\` AS identity_hash, \`id\` AS owner_id
        FROM \`business_contributions\`
        UNION ALL
        SELECT \`evidence_unique_key\` AS identity_hash, \`id\` AS owner_id
        FROM \`business_contribution_evidence\`
      ) identity_rows
    `);
    const invalidHashCount = BigInt(String(invalid?.invalid_hash_count ?? '0'));
    const invalidOwnerCount = BigInt(String(invalid?.invalid_owner_count ?? '0'));
    if (invalidHashCount > 0n || invalidOwnerCount > 0n) {
      throw new Error(
        `business_contribution_identity_0066_backfill_invalid:hashes=${invalidHashCount}:owners=${invalidOwnerCount}`,
      );
    }
  }
}
