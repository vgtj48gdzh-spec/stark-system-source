import { MigrationInterface, QueryRunner } from 'typeorm';

const MUTEXES = 'repair_correction_authority_mutexes';
const AUTHORITIES = 'repair_typed_correction_authorities';
const MAPPINGS = 'repair_typed_correction_mapping_plans';
const EVENTS = 'repair_typed_correction_lifecycle_events';
const CLAIMS = 'repair_typed_correction_idempotency_claims';

export const REPAIR_TYPED_CORRECTION_0070_TABLES = [
  MUTEXES,
  AUTHORITIES,
  MAPPINGS,
  EVENTS,
  CLAIMS,
] as const;

const OWNERSHIP_COMMENT_PREFIX =
  'GOV1-S2-0070 repair typed correction authority source-only unwired';

const OWNERSHIP_COMMENTS: Readonly<
  Record<(typeof REPAIR_TYPED_CORRECTION_0070_TABLES)[number], string>
> = {
  [MUTEXES]: `${OWNERSHIP_COMMENT_PREFIX}:mutexes`,
  [AUTHORITIES]: `${OWNERSHIP_COMMENT_PREFIX}:authorities`,
  [MAPPINGS]: `${OWNERSHIP_COMMENT_PREFIX}:mapping-plans`,
  [EVENTS]: `${OWNERSHIP_COMMENT_PREFIX}:events`,
  [CLAIMS]: `${OWNERSHIP_COMMENT_PREFIX}:claims`,
};

const EXPECTED_COLUMNS: Readonly<
  Record<(typeof REPAIR_TYPED_CORRECTION_0070_TABLES)[number], readonly string[]>
> = {
  [MUTEXES]: ['economic_root_id', 'created_by_user_id', 'created_at'],
  [AUTHORITIES]: [
    'id',
    'authority_ref',
    'correction_root_id',
    'economic_root_id',
    'original_contribution_id',
    'work_order_id',
    'authorized_company_ref',
    'authorized_business_sector_ref',
    'authorized_store_ref',
    'authorized_customer_ref',
    'correction_type',
    'rule_version',
    'authority_version',
    'supersedes_authority_id',
    'assignment_authority_id',
    'assignment_authority_version',
    'assignment_content_hash',
    'baseline_cost_authority_id',
    'baseline_cost_authority_version',
    'baseline_cost_content_hash',
    'original_contribution_version',
    'original_economic_fact_key',
    'original_authority_snapshot_hash',
    'original_attribution_snapshot_hash',
    'source_system',
    'source_type',
    'source_id',
    'source_version',
    'source_record_hash',
    'source_fact_key',
    'source_fact_hash',
    'source_amount_cents',
    'source_previous_cost_cents',
    'source_revised_cost_cents',
    'primary_evidence_ref',
    'primary_evidence_hash',
    'secondary_evidence_ref',
    'secondary_evidence_hash',
    'occurred_at',
    'revenue_delta_cents',
    'direct_cost_delta_cents',
    'margin_delta_cents',
    'correction_ledger_watermark_hash',
    'content_hash',
    'expected_work_order_version',
    'status',
    'created_by_user_id',
    'submitted_by_user_id',
    'approved_by_user_id',
    'rejected_by_user_id',
    'superseded_by_user_id',
    'server_observed_at',
    'created_at',
    'submitted_at',
    'confirmed_at',
    'rejected_at',
    'superseded_at',
    'open_correction_root_id',
    'approved_correction_root_id',
    'approved_source_fact_key',
    'approved_supersedes_authority_id',
  ],
  [MAPPINGS]: [
    'id',
    'authority_id',
    'correction_root_id',
    'economic_root_id',
    'original_contribution_id',
    'correction_type',
    'generic_target_kind',
    'generic_mapping_key',
    'correction_sequence',
    'revenue_delta_cents',
    'direct_cost_delta_cents',
    'margin_delta_cents',
    'occurred_at',
    'cumulative_revenue_before_cents',
    'cumulative_direct_cost_before_cents',
    'cumulative_revenue_after_cents',
    'cumulative_direct_cost_after_cents',
    'economic_period',
    'recognition_period',
    'recognition_at',
    'deferred_from_period',
    'catch_up_mode',
    'skipped_locked_period_count',
    'skipped_locked_periods_hash',
    'ledger_watermark_hash',
    'mapping_hash',
    'materialization_state',
    'status',
    'supersedes_mapping_id',
    'superseded_by_mapping_id',
    'created_at',
    'superseded_at',
    'active_correction_root_id',
    'active_original_contribution_id',
    'active_correction_sequence',
  ],
  [EVENTS]: [
    'id',
    'event_ref',
    'authority_id',
    'event_type',
    'from_status',
    'to_status',
    'actor_user_id',
    'reason_code',
    'evidence_ref',
    'evidence_hash',
    'request_fingerprint',
    'authority_content_hash',
    'mapping_hash',
    'created_at',
  ],
  [CLAIMS]: [
    'idempotency_key',
    'phase',
    'request_fingerprint',
    'actor_user_id',
    'state',
    'authority_id',
    'lifecycle_event_id',
    'created_at',
    'completed_at',
  ],
};

const EXPECTED_CONSTRAINTS: Readonly<
  Record<(typeof REPAIR_TYPED_CORRECTION_0070_TABLES)[number], readonly string[]>
> = {
  [MUTEXES]: ['PRIMARY', 'fk_rtc_mutex_actor', 'fk_rtc_mutex_root'],
  [AUTHORITIES]: [
    'PRIMARY',
    'chk_rtc_authority_delta',
    'chk_rtc_authority_hashes',
    'chk_rtc_authority_lifecycle',
    'chk_rtc_authority_ref',
    'chk_rtc_authority_source_shape',
    'chk_rtc_authority_time',
    'chk_rtc_authority_versions',
    'fk_rtc_authority_approved_by',
    'fk_rtc_authority_assignment',
    'fk_rtc_authority_baseline',
    'fk_rtc_authority_contribution',
    'fk_rtc_authority_created_by',
    'fk_rtc_authority_rejected_by',
    'fk_rtc_authority_root',
    'fk_rtc_authority_submitted_by',
    'fk_rtc_authority_superseded_by',
    'fk_rtc_authority_supersedes',
    'fk_rtc_authority_work_root',
    'uq_rtc_approved_root',
    'uq_rtc_approved_source',
    'uq_rtc_approved_supersedes',
    'uq_rtc_authority_ref',
    'uq_rtc_id_correction_root',
    'uq_rtc_open_root',
    'uq_rtc_root_version',
  ],
  [MAPPINGS]: [
    'PRIMARY',
    'chk_rtc_mapping_balance',
    'chk_rtc_mapping_catch_up',
    'chk_rtc_mapping_hashes',
    'chk_rtc_mapping_lifecycle',
    'chk_rtc_mapping_periods',
    'chk_rtc_mapping_target',
    'fk_rtc_mapping_authority',
    'fk_rtc_mapping_contribution',
    'fk_rtc_mapping_root',
    'fk_rtc_mapping_supersedes',
    'uq_rtc_active_root',
    'uq_rtc_active_sequence',
    'uq_rtc_mapping_authority',
    'uq_rtc_mapping_id_root',
    'uq_rtc_mapping_key',
  ],
  [EVENTS]: [
    'PRIMARY',
    'chk_rtc_event_hashes',
    'chk_rtc_event_ref',
    'chk_rtc_event_transition',
    'fk_rtc_event_actor',
    'fk_rtc_event_authority',
    'uq_rtc_event_once',
    'uq_rtc_event_ref',
  ],
  [CLAIMS]: [
    'PRIMARY',
    'chk_rtc_claim_hash',
    'chk_rtc_claim_key',
    'chk_rtc_claim_result',
    'fk_rtc_claim_actor',
    'fk_rtc_claim_authority',
    'fk_rtc_claim_event',
    'uq_rtc_claim_result',
  ],
};

type TableState0070 = Readonly<{
  table: (typeof REPAIR_TYPED_CORRECTION_0070_TABLES)[number];
  exists: boolean;
}>;

export class AddRepairTypedCorrectionAuthority00701792300000000
implements MigrationInterface {
  name = 'AddRepairTypedCorrectionAuthority00701792300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    this.assertMysql(queryRunner);
    await this.assertPrerequisites(queryRunner);
    const states = await this.tableStates(queryRunner);
    if (states.every((state) => state.exists)) {
      await this.assertComplete(queryRunner);
      return;
    }
    if (states.some((state) => state.exists)) {
      await this.assertOwnedAndEmptyPartialState(queryRunner, states);
      await this.dropExistingInReverseOrder(queryRunner, states);
    }
    await this.createMutexes(queryRunner);
    await this.createAuthorities(queryRunner);
    await this.createMappings(queryRunner);
    await this.createEvents(queryRunner);
    await this.createClaims(queryRunner);
    await this.assertComplete(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    this.assertMysql(queryRunner);
    const states = await this.tableStates(queryRunner);
    for (const state of states) {
      if (!state.exists) continue;
      await this.assertOwned(queryRunner, state.table);
      await this.assertEmpty(queryRunner, state.table, 'down');
    }
    await this.dropExistingInReverseOrder(queryRunner, states);
  }

  private assertMysql(queryRunner: QueryRunner): void {
    if (queryRunner.connection.options.type !== 'mysql') {
      throw new Error('repair_typed_correction_0070_mysql_required');
    }
  }

  private async assertPrerequisites(queryRunner: QueryRunner): Promise<void> {
    const required: Readonly<Record<string, readonly string[]>> = {
      users: ['id'],
      repair_work_order_profiles: [
        'work_order_id',
        'company_ref',
        'business_sector_ref',
        'store_ref',
        'customer_ref',
        'version',
      ],
      business_contribution_economic_fact_roots: [
        'economic_root_id',
        'business_domain',
        'origin_work_order_id',
      ],
      repair_work_order_economic_lineages: ['work_order_id', 'economic_root_id'],
      repair_contribution_assignment_authorities: [
        'id',
        'economic_root_id',
        'authority_version',
        'content_hash',
        'status',
      ],
      repair_cost_event_authorities: [
        'id',
        'economic_root_id',
        'authority_version',
        'content_hash',
        'status',
      ],
      business_contributions: [
        'id',
        'canonical_economic_fact_root_id',
        'economic_fact_key',
        'authority_snapshot_hash',
        'version',
        'confirmation_status',
        'revenue_cents',
        'direct_cost_total_cents',
      ],
      business_contribution_corrections: [
        'id',
        'original_contribution_id',
        'sequence',
        'correction_type',
        'revenue_delta_cents',
        'direct_cost_delta_cents',
        'margin_delta_cents',
      ],
    };
    for (const [table, columns] of Object.entries(required)) {
      const rows = await queryRunner.query(
        `SELECT COLUMN_NAME AS column_name
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION`,
        [table],
      ) as Array<{ column_name: string }>;
      const actual = new Set(rows.map((row) => row.column_name));
      if (columns.some((column) => !actual.has(column))) {
        throw new Error(`repair_typed_correction_0070_prerequisite_missing:${table}`);
      }
    }
    await this.assertUniqueIndex(
      queryRunner,
      'business_contribution_economic_fact_roots',
      ['economic_root_id'],
      'repair_typed_correction_0070_root_key_missing',
    );
    await this.assertUniqueIndex(
      queryRunner,
      'repair_work_order_economic_lineages',
      ['work_order_id', 'economic_root_id'],
      'repair_typed_correction_0070_lineage_key_missing',
    );
    await this.assertUniqueIndex(
      queryRunner,
      'repair_contribution_assignment_authorities',
      ['id', 'economic_root_id'],
      'repair_typed_correction_0070_assignment_key_missing',
    );
    await this.assertUniqueIndex(
      queryRunner,
      'repair_cost_event_authorities',
      ['id', 'economic_root_id'],
      'repair_typed_correction_0070_baseline_key_missing',
    );
    await this.assertUniqueIndex(
      queryRunner,
      'business_contributions',
      ['id'],
      'repair_typed_correction_0070_contribution_key_missing',
    );
  }

  private async assertUniqueIndex(
    queryRunner: QueryRunner,
    table: string,
    columns: readonly string[],
    errorCode: string,
  ): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT INDEX_NAME AS index_name, NON_UNIQUE AS non_unique,
              GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS columns_csv
         FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        GROUP BY INDEX_NAME, NON_UNIQUE`,
      [table],
    ) as Array<{ non_unique: string | number; columns_csv: string }>;
    if (!rows.some((row) => Number(row.non_unique) === 0 && row.columns_csv === columns.join(','))) {
      throw new Error(errorCode);
    }
  }

  private async tableStates(queryRunner: QueryRunner): Promise<TableState0070[]> {
    const rows = await queryRunner.query(
      `SELECT TABLE_NAME AS table_name
         FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN (${REPAIR_TYPED_CORRECTION_0070_TABLES.map(() => '?').join(',')})`,
      [...REPAIR_TYPED_CORRECTION_0070_TABLES],
    ) as Array<{ table_name: string }>;
    const existing = new Set(rows.map((row) => row.table_name));
    return REPAIR_TYPED_CORRECTION_0070_TABLES.map((table) => ({
      table,
      exists: existing.has(table),
    }));
  }

  private async assertOwnedAndEmptyPartialState(
    queryRunner: QueryRunner,
    states: readonly TableState0070[],
  ): Promise<void> {
    for (const state of states) {
      if (!state.exists) continue;
      await this.assertOwned(queryRunner, state.table);
      await this.assertEmpty(queryRunner, state.table, 'partial');
    }
  }

  private async assertOwned(
    queryRunner: QueryRunner,
    table: (typeof REPAIR_TYPED_CORRECTION_0070_TABLES)[number],
  ): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT TABLE_COMMENT AS table_comment, ENGINE AS engine
         FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table],
    ) as Array<{ table_comment: string; engine: string }>;
    if (
      rows.length !== 1 ||
      rows[0].table_comment !== OWNERSHIP_COMMENTS[table] ||
      String(rows[0].engine).toUpperCase() !== 'INNODB'
    ) {
      throw new Error(`repair_typed_correction_0070_ownership_conflict:${table}`);
    }
  }

  private async assertEmpty(
    queryRunner: QueryRunner,
    table: (typeof REPAIR_TYPED_CORRECTION_0070_TABLES)[number],
    phase: 'partial' | 'down',
  ): Promise<void> {
    const rows = await queryRunner.query(`SELECT COUNT(*) AS row_count FROM \`${table}\``);
    if (BigInt(String(rows[0]?.row_count ?? '0')) !== 0n) {
      throw new Error(`repair_typed_correction_0070_${phase}_non_empty:${table}`);
    }
  }

  private async dropExistingInReverseOrder(
    queryRunner: QueryRunner,
    states: readonly TableState0070[],
  ): Promise<void> {
    const existing = new Set(states.filter((state) => state.exists).map((state) => state.table));
    for (const table of [...REPAIR_TYPED_CORRECTION_0070_TABLES].reverse()) {
      if (existing.has(table)) await queryRunner.query(`DROP TABLE \`${table}\``);
    }
  }

  private async assertComplete(queryRunner: QueryRunner): Promise<void> {
    const states = await this.tableStates(queryRunner);
    if (!states.every((state) => state.exists)) {
      throw new Error('repair_typed_correction_0070_schema_incomplete');
    }
    for (const { table } of states) {
      await this.assertOwned(queryRunner, table);
      const columns = await queryRunner.query(
        `SELECT COLUMN_NAME AS column_name
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION`,
        [table],
      ) as Array<{ column_name: string }>;
      if (
        JSON.stringify(columns.map((row) => row.column_name)) !==
        JSON.stringify(EXPECTED_COLUMNS[table])
      ) {
        throw new Error(`repair_typed_correction_0070_columns_incompatible:${table}`);
      }
      const constraints = await queryRunner.query(
        `SELECT CONSTRAINT_NAME AS constraint_name
           FROM information_schema.TABLE_CONSTRAINTS
          WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ?
          ORDER BY CONSTRAINT_NAME`,
        [table],
      ) as Array<{ constraint_name: string }>;
      const actual = constraints.map((row) => row.constraint_name).sort();
      const expected = [...EXPECTED_CONSTRAINTS[table]].sort();
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`repair_typed_correction_0070_constraints_incompatible:${table}`);
      }
      const disabledChecks = await queryRunner.query(
        `SELECT tc.CONSTRAINT_NAME AS constraint_name
           FROM information_schema.TABLE_CONSTRAINTS tc
           JOIN information_schema.CHECK_CONSTRAINTS cc
             ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
            AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
          WHERE tc.CONSTRAINT_SCHEMA = DATABASE() AND tc.TABLE_NAME = ?
            AND tc.CONSTRAINT_TYPE = 'CHECK' AND tc.ENFORCED <> 'YES'`,
        [table],
      );
      if (disabledChecks.length !== 0) {
        throw new Error(`repair_typed_correction_0070_check_not_enforced:${table}`);
      }
    }
  }

  private async createMutexes(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`${MUTEXES}\` (
        \`economic_root_id\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`created_by_user_id\` INT NOT NULL,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`economic_root_id\`),
        KEY \`idx_rtc_mutex_actor\` (\`created_by_user_id\`),
        CONSTRAINT \`fk_rtc_mutex_root\`
          FOREIGN KEY (\`economic_root_id\`)
          REFERENCES \`business_contribution_economic_fact_roots\` (\`economic_root_id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rtc_mutex_actor\`
          FOREIGN KEY (\`created_by_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='${OWNERSHIP_COMMENTS[MUTEXES]}'
    `);
  }

  private async createAuthorities(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`${AUTHORITIES}\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`authority_ref\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`correction_root_id\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`economic_root_id\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`original_contribution_id\` INT NOT NULL,
        \`work_order_id\` INT NOT NULL,
        \`authorized_company_ref\` VARCHAR(100) NOT NULL,
        \`authorized_business_sector_ref\` VARCHAR(100) NOT NULL,
        \`authorized_store_ref\` VARCHAR(100) NOT NULL,
        \`authorized_customer_ref\` VARCHAR(100) NOT NULL,
        \`correction_type\` VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`rule_version\` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`authority_version\` INT NOT NULL,
        \`supersedes_authority_id\` BIGINT NULL,
        \`assignment_authority_id\` BIGINT NOT NULL,
        \`assignment_authority_version\` INT NOT NULL,
        \`assignment_content_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`baseline_cost_authority_id\` BIGINT NOT NULL,
        \`baseline_cost_authority_version\` INT NOT NULL,
        \`baseline_cost_content_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`original_contribution_version\` INT NOT NULL,
        \`original_economic_fact_key\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`original_authority_snapshot_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`original_attribution_snapshot_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`source_system\` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`source_type\` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`source_id\` VARCHAR(120) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`source_version\` VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`source_record_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`source_fact_key\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`source_fact_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`source_amount_cents\` BIGINT NULL,
        \`source_previous_cost_cents\` BIGINT NULL,
        \`source_revised_cost_cents\` BIGINT NULL,
        \`primary_evidence_ref\` VARCHAR(73) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`primary_evidence_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`secondary_evidence_ref\` VARCHAR(73) CHARACTER SET ascii COLLATE ascii_bin NULL,
        \`secondary_evidence_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
        \`occurred_at\` DATETIME(6) NOT NULL,
        \`revenue_delta_cents\` BIGINT NOT NULL,
        \`direct_cost_delta_cents\` BIGINT NOT NULL,
        \`margin_delta_cents\` BIGINT NOT NULL,
        \`correction_ledger_watermark_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`content_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`expected_work_order_version\` INT NOT NULL,
        \`status\` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`created_by_user_id\` INT NOT NULL,
        \`submitted_by_user_id\` INT NULL,
        \`approved_by_user_id\` INT NULL,
        \`rejected_by_user_id\` INT NULL,
        \`superseded_by_user_id\` INT NULL,
        \`server_observed_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`submitted_at\` DATETIME(6) NULL,
        \`confirmed_at\` DATETIME(6) NULL,
        \`rejected_at\` DATETIME(6) NULL,
        \`superseded_at\` DATETIME(6) NULL,
        \`open_correction_root_id\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin
          GENERATED ALWAYS AS (
            CASE WHEN \`status\` IN ('draft','submitted') THEN \`correction_root_id\` ELSE NULL END
          ) STORED,
        \`approved_correction_root_id\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin
          GENERATED ALWAYS AS (
            CASE WHEN \`status\` = 'approved' THEN \`correction_root_id\` ELSE NULL END
          ) STORED,
        \`approved_source_fact_key\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin
          GENERATED ALWAYS AS (
            CASE WHEN \`status\` = 'approved' THEN \`source_fact_key\` ELSE NULL END
          ) STORED,
        \`approved_supersedes_authority_id\` BIGINT
          GENERATED ALWAYS AS (
            CASE WHEN \`status\` = 'approved' THEN \`supersedes_authority_id\` ELSE NULL END
          ) STORED,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_rtc_authority_ref\` (\`authority_ref\`),
        UNIQUE KEY \`uq_rtc_id_correction_root\` (\`id\`, \`correction_root_id\`),
        UNIQUE KEY \`uq_rtc_root_version\` (\`correction_root_id\`, \`authority_version\`),
        UNIQUE KEY \`uq_rtc_open_root\` (\`open_correction_root_id\`),
        UNIQUE KEY \`uq_rtc_approved_root\` (\`approved_correction_root_id\`),
        UNIQUE KEY \`uq_rtc_approved_source\` (\`approved_source_fact_key\`),
        UNIQUE KEY \`uq_rtc_approved_supersedes\` (\`approved_supersedes_authority_id\`),
        KEY \`idx_rtc_economic_root\` (\`economic_root_id\`, \`correction_root_id\`),
        KEY \`idx_rtc_contribution\` (\`original_contribution_id\`, \`id\`),
        KEY \`idx_rtc_work_root\` (\`work_order_id\`, \`economic_root_id\`),
        KEY \`idx_rtc_assignment_root\` (\`assignment_authority_id\`, \`economic_root_id\`),
        KEY \`idx_rtc_baseline_root\` (\`baseline_cost_authority_id\`, \`economic_root_id\`),
        KEY \`idx_rtc_created_by\` (\`created_by_user_id\`),
        KEY \`idx_rtc_submitted_by\` (\`submitted_by_user_id\`),
        KEY \`idx_rtc_approved_by\` (\`approved_by_user_id\`),
        KEY \`idx_rtc_rejected_by\` (\`rejected_by_user_id\`),
        KEY \`idx_rtc_superseded_by\` (\`superseded_by_user_id\`),
        CONSTRAINT \`fk_rtc_authority_root\`
          FOREIGN KEY (\`economic_root_id\`)
          REFERENCES \`business_contribution_economic_fact_roots\` (\`economic_root_id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rtc_authority_work_root\`
          FOREIGN KEY (\`work_order_id\`, \`economic_root_id\`)
          REFERENCES \`repair_work_order_economic_lineages\` (\`work_order_id\`, \`economic_root_id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rtc_authority_contribution\`
          FOREIGN KEY (\`original_contribution_id\`) REFERENCES \`business_contributions\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rtc_authority_assignment\`
          FOREIGN KEY (\`assignment_authority_id\`, \`economic_root_id\`)
          REFERENCES \`repair_contribution_assignment_authorities\` (\`id\`, \`economic_root_id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rtc_authority_baseline\`
          FOREIGN KEY (\`baseline_cost_authority_id\`, \`economic_root_id\`)
          REFERENCES \`repair_cost_event_authorities\` (\`id\`, \`economic_root_id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rtc_authority_supersedes\`
          FOREIGN KEY (\`supersedes_authority_id\`, \`correction_root_id\`)
          REFERENCES \`${AUTHORITIES}\` (\`id\`, \`correction_root_id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rtc_authority_created_by\`
          FOREIGN KEY (\`created_by_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rtc_authority_submitted_by\`
          FOREIGN KEY (\`submitted_by_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rtc_authority_approved_by\`
          FOREIGN KEY (\`approved_by_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rtc_authority_rejected_by\`
          FOREIGN KEY (\`rejected_by_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rtc_authority_superseded_by\`
          FOREIGN KEY (\`superseded_by_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`chk_rtc_authority_ref\` CHECK (
          REGEXP_LIKE(\`authority_ref\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`correction_root_id\`, '^[0-9a-f]{64}$', 'c')
        ),
        CONSTRAINT \`chk_rtc_authority_hashes\` CHECK (
          REGEXP_LIKE(\`economic_root_id\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`assignment_content_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`baseline_cost_content_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`original_economic_fact_key\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`original_authority_snapshot_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`original_attribution_snapshot_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`source_record_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`source_fact_key\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`source_fact_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`primary_evidence_ref\`, '^evidence:[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`primary_evidence_hash\`, '^[0-9a-f]{64}$', 'c')
          AND (\`secondary_evidence_ref\` IS NULL
            OR REGEXP_LIKE(\`secondary_evidence_ref\`, '^evidence:[0-9a-f]{64}$', 'c'))
          AND (\`secondary_evidence_hash\` IS NULL
            OR REGEXP_LIKE(\`secondary_evidence_hash\`, '^[0-9a-f]{64}$', 'c'))
          AND REGEXP_LIKE(\`correction_ledger_watermark_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`content_hash\`, '^[0-9a-f]{64}$', 'c')
        ),
        CONSTRAINT \`chk_rtc_authority_versions\` CHECK (
          \`rule_version\` = 'gov1-s2-repair-typed-correction-v1'
          AND \`authority_version\` > 0
          AND \`assignment_authority_version\` > 0
          AND \`baseline_cost_authority_version\` > 0
          AND \`original_contribution_version\` > 0
          AND \`expected_work_order_version\` > 0
        ),
        CONSTRAINT \`chk_rtc_authority_source_shape\` CHECK (
          (\`correction_type\` IN ('customer_refund','rework_direct_cost','supplier_cost_recovery')
            AND \`source_amount_cents\` > 0
            AND \`source_previous_cost_cents\` IS NULL
            AND \`source_revised_cost_cents\` IS NULL
            AND \`secondary_evidence_ref\` IS NULL
            AND \`secondary_evidence_hash\` IS NULL)
          OR (\`correction_type\` = 'direct_cost_adjustment'
            AND \`source_amount_cents\` IS NULL
            AND \`source_previous_cost_cents\` >= 0
            AND \`source_revised_cost_cents\` >= 0
            AND \`source_previous_cost_cents\` <> \`source_revised_cost_cents\`
            AND \`secondary_evidence_ref\` IS NULL
            AND \`secondary_evidence_hash\` IS NULL)
          OR (\`correction_type\` = 'full_void'
            AND \`source_amount_cents\` IS NULL
            AND \`source_previous_cost_cents\` IS NULL
            AND \`source_revised_cost_cents\` IS NULL
            AND \`secondary_evidence_ref\` IS NOT NULL
            AND \`secondary_evidence_hash\` IS NOT NULL)
        ),
        CONSTRAINT \`chk_rtc_authority_delta\` CHECK (
          \`margin_delta_cents\` = \`revenue_delta_cents\` - \`direct_cost_delta_cents\`
          AND (
            (\`correction_type\` = 'customer_refund'
              AND \`revenue_delta_cents\` < 0 AND \`direct_cost_delta_cents\` = 0)
            OR (\`correction_type\` = 'rework_direct_cost'
              AND \`revenue_delta_cents\` = 0 AND \`direct_cost_delta_cents\` > 0)
            OR (\`correction_type\` = 'supplier_cost_recovery'
              AND \`revenue_delta_cents\` = 0 AND \`direct_cost_delta_cents\` < 0)
            OR (\`correction_type\` = 'direct_cost_adjustment'
              AND \`revenue_delta_cents\` = 0 AND \`direct_cost_delta_cents\` <> 0)
            OR (\`correction_type\` = 'full_void'
              AND \`revenue_delta_cents\` < 0 AND \`direct_cost_delta_cents\` <= 0)
          )
        ),
        CONSTRAINT \`chk_rtc_authority_time\` CHECK (
          \`occurred_at\` <= \`server_observed_at\`
          AND (\`confirmed_at\` IS NULL OR \`server_observed_at\` <= \`confirmed_at\`)
        ),
        CONSTRAINT \`chk_rtc_authority_lifecycle\` CHECK (
          (\`status\` = 'draft' AND \`submitted_by_user_id\` IS NULL
            AND \`approved_by_user_id\` IS NULL AND \`rejected_by_user_id\` IS NULL
            AND \`superseded_by_user_id\` IS NULL AND \`submitted_at\` IS NULL
            AND \`confirmed_at\` IS NULL AND \`rejected_at\` IS NULL
            AND \`superseded_at\` IS NULL)
          OR (\`status\` = 'submitted' AND \`submitted_by_user_id\` IS NOT NULL
            AND \`submitted_at\` IS NOT NULL AND \`approved_by_user_id\` IS NULL
            AND \`rejected_by_user_id\` IS NULL AND \`superseded_by_user_id\` IS NULL
            AND \`confirmed_at\` IS NULL AND \`rejected_at\` IS NULL
            AND \`superseded_at\` IS NULL)
          OR (\`status\` = 'approved' AND \`submitted_by_user_id\` IS NOT NULL
            AND \`approved_by_user_id\` IS NOT NULL AND \`submitted_at\` IS NOT NULL
            AND \`confirmed_at\` IS NOT NULL AND \`rejected_by_user_id\` IS NULL
            AND \`superseded_by_user_id\` IS NULL AND \`rejected_at\` IS NULL
            AND \`superseded_at\` IS NULL)
          OR (\`status\` = 'rejected' AND \`submitted_by_user_id\` IS NOT NULL
            AND \`rejected_by_user_id\` IS NOT NULL AND \`submitted_at\` IS NOT NULL
            AND \`rejected_at\` IS NOT NULL AND \`approved_by_user_id\` IS NULL
            AND \`superseded_by_user_id\` IS NULL AND \`confirmed_at\` IS NULL
            AND \`superseded_at\` IS NULL)
          OR (\`status\` = 'superseded' AND \`submitted_by_user_id\` IS NOT NULL
            AND \`approved_by_user_id\` IS NOT NULL AND \`superseded_by_user_id\` IS NOT NULL
            AND \`submitted_at\` IS NOT NULL AND \`confirmed_at\` IS NOT NULL
            AND \`superseded_at\` IS NOT NULL AND \`rejected_by_user_id\` IS NULL
            AND \`rejected_at\` IS NULL)
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='${OWNERSHIP_COMMENTS[AUTHORITIES]}'
    `);
  }

  private async createMappings(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`${MAPPINGS}\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`authority_id\` BIGINT NOT NULL,
        \`correction_root_id\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`economic_root_id\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`original_contribution_id\` INT NOT NULL,
        \`correction_type\` VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`generic_target_kind\` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`generic_mapping_key\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`correction_sequence\` INT NOT NULL,
        \`revenue_delta_cents\` BIGINT NOT NULL,
        \`direct_cost_delta_cents\` BIGINT NOT NULL,
        \`margin_delta_cents\` BIGINT NOT NULL,
        \`occurred_at\` DATETIME(6) NOT NULL,
        \`cumulative_revenue_before_cents\` BIGINT NOT NULL,
        \`cumulative_direct_cost_before_cents\` BIGINT NOT NULL,
        \`cumulative_revenue_after_cents\` BIGINT NOT NULL,
        \`cumulative_direct_cost_after_cents\` BIGINT NOT NULL,
        \`economic_period\` CHAR(7) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`recognition_period\` CHAR(7) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`recognition_at\` DATETIME(6) NOT NULL,
        \`deferred_from_period\` CHAR(7) CHARACTER SET ascii COLLATE ascii_bin NULL,
        \`catch_up_mode\` VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`skipped_locked_period_count\` INT NOT NULL,
        \`skipped_locked_periods_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`ledger_watermark_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`mapping_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`materialization_state\` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`status\` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`supersedes_mapping_id\` BIGINT NULL,
        \`superseded_by_mapping_id\` BIGINT NULL,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`superseded_at\` DATETIME(6) NULL,
        \`active_correction_root_id\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin
          GENERATED ALWAYS AS (
            CASE WHEN \`status\` = 'active' THEN \`correction_root_id\` ELSE NULL END
          ) STORED,
        \`active_original_contribution_id\` INT
          GENERATED ALWAYS AS (
            CASE WHEN \`status\` = 'active' THEN \`original_contribution_id\` ELSE NULL END
          ) STORED,
        \`active_correction_sequence\` INT
          GENERATED ALWAYS AS (
            CASE WHEN \`status\` = 'active' THEN \`correction_sequence\` ELSE NULL END
          ) STORED,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_rtc_mapping_authority\` (\`authority_id\`),
        UNIQUE KEY \`uq_rtc_mapping_key\` (\`generic_mapping_key\`),
        UNIQUE KEY \`uq_rtc_mapping_id_root\` (\`id\`, \`correction_root_id\`),
        UNIQUE KEY \`uq_rtc_active_root\` (\`active_correction_root_id\`),
        UNIQUE KEY \`uq_rtc_active_sequence\`
          (\`active_original_contribution_id\`, \`active_correction_sequence\`),
        KEY \`idx_rtc_mapping_economic_root\` (\`economic_root_id\`, \`correction_sequence\`),
        KEY \`idx_rtc_mapping_contribution\` (\`original_contribution_id\`, \`correction_sequence\`),
        KEY \`idx_rtc_mapping_supersedes\` (\`supersedes_mapping_id\`, \`correction_root_id\`),
        KEY \`idx_rtc_mapping_superseded_by\` (\`superseded_by_mapping_id\`, \`correction_root_id\`),
        CONSTRAINT \`fk_rtc_mapping_authority\`
          FOREIGN KEY (\`authority_id\`, \`correction_root_id\`)
          REFERENCES \`${AUTHORITIES}\` (\`id\`, \`correction_root_id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rtc_mapping_root\`
          FOREIGN KEY (\`economic_root_id\`)
          REFERENCES \`business_contribution_economic_fact_roots\` (\`economic_root_id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rtc_mapping_contribution\`
          FOREIGN KEY (\`original_contribution_id\`) REFERENCES \`business_contributions\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rtc_mapping_supersedes\`
          FOREIGN KEY (\`supersedes_mapping_id\`, \`correction_root_id\`)
          REFERENCES \`${MAPPINGS}\` (\`id\`, \`correction_root_id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`chk_rtc_mapping_hashes\` CHECK (
          REGEXP_LIKE(\`correction_root_id\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`economic_root_id\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`generic_mapping_key\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`skipped_locked_periods_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`ledger_watermark_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`mapping_hash\`, '^[0-9a-f]{64}$', 'c')
        ),
        CONSTRAINT \`chk_rtc_mapping_target\` CHECK (
          \`materialization_state\` = 'planned_unwired'
          AND \`correction_sequence\` > 0
          AND ((\`correction_type\` = 'full_void' AND \`generic_target_kind\` = 'full_reversal')
            OR (\`correction_type\` IN ('customer_refund','rework_direct_cost',
                  'supplier_cost_recovery','direct_cost_adjustment')
              AND \`generic_target_kind\` = 'typed_correction'))
        ),
        CONSTRAINT \`chk_rtc_mapping_balance\` CHECK (
          \`margin_delta_cents\` = \`revenue_delta_cents\` - \`direct_cost_delta_cents\`
          AND \`cumulative_revenue_after_cents\` =
            \`cumulative_revenue_before_cents\` + \`revenue_delta_cents\`
          AND \`cumulative_direct_cost_after_cents\` =
            \`cumulative_direct_cost_before_cents\` + \`direct_cost_delta_cents\`
          AND \`cumulative_revenue_before_cents\` >= 0
          AND \`cumulative_direct_cost_before_cents\` >= 0
          AND \`cumulative_revenue_after_cents\` >= 0
          AND \`cumulative_direct_cost_after_cents\` >= 0
          AND (\`correction_type\` <> 'full_void'
            OR (\`cumulative_revenue_after_cents\` = 0
              AND \`cumulative_direct_cost_after_cents\` = 0))
        ),
        CONSTRAINT \`chk_rtc_mapping_periods\` CHECK (
          REGEXP_LIKE(\`economic_period\`, '^20[0-9]{2}-(0[1-9]|1[0-2])$', 'c')
          AND REGEXP_LIKE(\`recognition_period\`, '^20[0-9]{2}-(0[1-9]|1[0-2])$', 'c')
          AND (\`deferred_from_period\` IS NULL
            OR REGEXP_LIKE(\`deferred_from_period\`, '^20[0-9]{2}-(0[1-9]|1[0-2])$', 'c'))
          AND \`recognition_at\` >= \`occurred_at\`
        ),
        CONSTRAINT \`chk_rtc_mapping_catch_up\` CHECK (
          (\`catch_up_mode\` = 'same_period' AND \`deferred_from_period\` IS NULL
            AND \`economic_period\` = \`recognition_period\`
            AND \`skipped_locked_period_count\` = 0)
          OR (\`catch_up_mode\` = 'locked_period_catch_up'
            AND \`deferred_from_period\` = \`economic_period\`
            AND \`recognition_period\` > \`economic_period\`
            AND \`skipped_locked_period_count\` > 0)
        ),
        CONSTRAINT \`chk_rtc_mapping_lifecycle\` CHECK (
          (\`status\` IN ('prepared','active') AND \`superseded_by_mapping_id\` IS NULL
            AND \`superseded_at\` IS NULL)
          OR (\`status\` = 'superseded' AND \`superseded_by_mapping_id\` IS NOT NULL
            AND \`superseded_at\` IS NOT NULL)
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='${OWNERSHIP_COMMENTS[MAPPINGS]}'
    `);
  }

  private async createEvents(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`${EVENTS}\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`event_ref\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`authority_id\` BIGINT NOT NULL,
        \`event_type\` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`from_status\` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL,
        \`to_status\` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`actor_user_id\` INT NOT NULL,
        \`reason_code\` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`evidence_ref\` VARCHAR(73) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`evidence_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`request_fingerprint\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`authority_content_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`mapping_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_rtc_event_ref\` (\`event_ref\`),
        UNIQUE KEY \`uq_rtc_event_once\` (\`authority_id\`, \`event_type\`, \`request_fingerprint\`),
        KEY \`idx_rtc_event_actor\` (\`actor_user_id\`),
        CONSTRAINT \`fk_rtc_event_authority\`
          FOREIGN KEY (\`authority_id\`) REFERENCES \`${AUTHORITIES}\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rtc_event_actor\`
          FOREIGN KEY (\`actor_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`chk_rtc_event_ref\` CHECK (
          REGEXP_LIKE(\`event_ref\`, '^[0-9a-f]{64}$', 'c')
        ),
        CONSTRAINT \`chk_rtc_event_hashes\` CHECK (
          REGEXP_LIKE(\`evidence_ref\`, '^evidence:[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`evidence_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`request_fingerprint\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`authority_content_hash\`, '^[0-9a-f]{64}$', 'c')
          AND (\`mapping_hash\` IS NULL
            OR REGEXP_LIKE(\`mapping_hash\`, '^[0-9a-f]{64}$', 'c'))
        ),
        CONSTRAINT \`chk_rtc_event_transition\` CHECK (
          (\`event_type\` = 'drafted' AND \`from_status\` IS NULL
            AND \`to_status\` = 'draft' AND \`mapping_hash\` IS NULL)
          OR (\`event_type\` = 'submitted' AND \`from_status\` = 'draft'
            AND \`to_status\` = 'submitted' AND \`mapping_hash\` IS NULL)
          OR (\`event_type\` = 'approved' AND \`from_status\` = 'submitted'
            AND \`to_status\` = 'approved' AND \`mapping_hash\` IS NOT NULL)
          OR (\`event_type\` = 'rejected' AND \`from_status\` = 'submitted'
            AND \`to_status\` = 'rejected' AND \`mapping_hash\` IS NULL)
          OR (\`event_type\` = 'superseded' AND \`from_status\` = 'approved'
            AND \`to_status\` = 'superseded' AND \`mapping_hash\` IS NOT NULL)
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='${OWNERSHIP_COMMENTS[EVENTS]}'
    `);
  }

  private async createClaims(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`${CLAIMS}\` (
        \`idempotency_key\` VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`phase\` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`request_fingerprint\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`actor_user_id\` INT NOT NULL,
        \`state\` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`authority_id\` BIGINT NULL,
        \`lifecycle_event_id\` BIGINT NULL,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`completed_at\` DATETIME(6) NULL,
        PRIMARY KEY (\`idempotency_key\`),
        UNIQUE KEY \`uq_rtc_claim_result\` (\`authority_id\`, \`phase\`),
        KEY \`idx_rtc_claim_actor\` (\`actor_user_id\`),
        KEY \`idx_rtc_claim_event\` (\`lifecycle_event_id\`),
        CONSTRAINT \`fk_rtc_claim_actor\`
          FOREIGN KEY (\`actor_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rtc_claim_authority\`
          FOREIGN KEY (\`authority_id\`) REFERENCES \`${AUTHORITIES}\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rtc_claim_event\`
          FOREIGN KEY (\`lifecycle_event_id\`) REFERENCES \`${EVENTS}\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`chk_rtc_claim_key\` CHECK (
          REGEXP_LIKE(\`idempotency_key\`, '^repair-correction-idempotency:[0-9a-f]{64}$', 'c')
          AND \`phase\` IN ('draft','submit','approve','reject')
        ),
        CONSTRAINT \`chk_rtc_claim_hash\` CHECK (
          REGEXP_LIKE(\`request_fingerprint\`, '^[0-9a-f]{64}$', 'c')
        ),
        CONSTRAINT \`chk_rtc_claim_result\` CHECK (
          (\`state\` = 'claimed' AND \`authority_id\` IS NULL
            AND \`lifecycle_event_id\` IS NULL AND \`completed_at\` IS NULL)
          OR (\`state\` = 'completed' AND \`authority_id\` IS NOT NULL
            AND \`lifecycle_event_id\` IS NOT NULL AND \`completed_at\` IS NOT NULL)
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='${OWNERSHIP_COMMENTS[CLAIMS]}'
    `);
  }
}
