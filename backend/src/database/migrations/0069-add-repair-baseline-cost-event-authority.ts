import { MigrationInterface, QueryRunner } from 'typeorm';

const MUTEXES = 'repair_cost_event_mutexes';
const AUTHORITIES = 'repair_cost_event_authorities';
const LINES = 'repair_cost_event_authority_lines';
const EVENTS = 'repair_cost_event_lifecycle_events';
const CLAIMS = 'repair_cost_event_idempotency_claims';

export const REPAIR_COST_EVENT_0069_TABLES = [
  MUTEXES,
  AUTHORITIES,
  LINES,
  EVENTS,
  CLAIMS,
] as const;

const OWNERSHIP_COMMENT_PREFIX =
  'GOV1-S2-0069 repair baseline cost event source-only unwired';

const OWNERSHIP_COMMENTS: Readonly<Record<(typeof REPAIR_COST_EVENT_0069_TABLES)[number], string>> = {
  [MUTEXES]: `${OWNERSHIP_COMMENT_PREFIX}:mutexes`,
  [AUTHORITIES]: `${OWNERSHIP_COMMENT_PREFIX}:authorities`,
  [LINES]: `${OWNERSHIP_COMMENT_PREFIX}:lines`,
  [EVENTS]: `${OWNERSHIP_COMMENT_PREFIX}:events`,
  [CLAIMS]: `${OWNERSHIP_COMMENT_PREFIX}:claims`,
};

const EXPECTED_COLUMNS: Readonly<Record<(typeof REPAIR_COST_EVENT_0069_TABLES)[number], readonly string[]>> = {
  [MUTEXES]: ['work_order_id', 'created_by_user_id', 'created_at'],
  [AUTHORITIES]: [
    'id',
    'authority_ref',
    'economic_root_id',
    'work_order_id',
    'authorized_company_ref',
    'authorized_business_sector_ref',
    'authorized_store_ref',
    'authorized_customer_ref',
    'target_profile_code',
    'rule_version',
    'authority_version',
    'supersedes_authority_id',
    'assignment_authority_id',
    'assignment_authority_version',
    'assignment_content_hash',
    'source_graph_hash',
    'cost_close_watermark_hash',
    'event_close_watermark_hash',
    'total_direct_cost_cents',
    'currency',
    'profile_eligibility',
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
    'approved_at',
    'rejected_at',
    'superseded_at',
    'open_economic_root_id',
    'approved_economic_root_id',
    'approved_supersedes_authority_id',
  ],
  [LINES]: [
    'id',
    'authority_id',
    'category',
    'disposition',
    'amount_cents',
    'occurred_at',
    'source_scope_ref',
    'source_scope_hash',
    'close_watermark_hash',
    'evidence_ref',
    'evidence_hash',
    'line_hash',
    'created_at',
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

const EXPECTED_CONSTRAINTS: Readonly<Record<(typeof REPAIR_COST_EVENT_0069_TABLES)[number], readonly string[]>> = {
  [MUTEXES]: ['PRIMARY', 'fk_rce_mutex_actor', 'fk_rce_mutex_work_order'],
  [AUTHORITIES]: [
    'PRIMARY',
    'chk_rce_authority_amount',
    'chk_rce_authority_hashes',
    'chk_rce_authority_lifecycle',
    'chk_rce_authority_profile',
    'chk_rce_authority_ref',
    'chk_rce_authority_versions',
    'fk_rce_authority_approved_by',
    'fk_rce_authority_assignment',
    'fk_rce_authority_created_by',
    'fk_rce_authority_rejected_by',
    'fk_rce_authority_root',
    'fk_rce_authority_submitted_by',
    'fk_rce_authority_superseded_by',
    'fk_rce_authority_supersedes',
    'fk_rce_authority_work_root',
    'uq_rce_approved_root',
    'uq_rce_approved_supersedes',
    'uq_rce_authority_ref',
    'uq_rce_id_root',
    'uq_rce_open_root',
    'uq_rce_root_version',
  ],
  [LINES]: [
    'PRIMARY',
    'chk_rce_line_category_state',
    'chk_rce_line_hashes',
    'chk_rce_line_scope_ref',
    'fk_rce_line_authority',
    'uq_rce_line_category',
  ],
  [EVENTS]: [
    'PRIMARY',
    'chk_rce_event_hashes',
    'chk_rce_event_ref',
    'chk_rce_event_transition',
    'fk_rce_event_actor',
    'fk_rce_event_authority',
    'uq_rce_event_once',
    'uq_rce_event_ref',
  ],
  [CLAIMS]: [
    'PRIMARY',
    'chk_rce_claim_hash',
    'chk_rce_claim_key',
    'chk_rce_claim_result',
    'fk_rce_claim_actor',
    'fk_rce_claim_authority',
    'fk_rce_claim_event',
    'uq_rce_claim_result',
  ],
};

type TableState0069 = Readonly<{
  table: (typeof REPAIR_COST_EVENT_0069_TABLES)[number];
  exists: boolean;
}>;

export class AddRepairBaselineCostEventAuthority00691792200000000
implements MigrationInterface {
  name = 'AddRepairBaselineCostEventAuthority00691792200000000';

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
    await this.createLines(queryRunner);
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
      throw new Error('repair_cost_event_0069_mysql_required');
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
        'lifecycle_status',
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
        'authority_ref',
        'economic_root_id',
        'work_order_id',
        'authority_version',
        'content_hash',
        'status',
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
        throw new Error(`repair_cost_event_0069_prerequisite_missing:${table}`);
      }
    }
    await this.assertUniqueIndex(
      queryRunner,
      'repair_work_order_profiles',
      ['work_order_id'],
      'repair_cost_event_0069_profile_key_missing',
    );
    await this.assertUniqueIndex(
      queryRunner,
      'business_contribution_economic_fact_roots',
      ['economic_root_id'],
      'repair_cost_event_0069_root_key_missing',
    );
    await this.assertUniqueIndex(
      queryRunner,
      'repair_work_order_economic_lineages',
      ['work_order_id', 'economic_root_id'],
      'repair_cost_event_0069_lineage_key_missing',
    );
    await this.assertUniqueIndex(
      queryRunner,
      'repair_contribution_assignment_authorities',
      ['id', 'economic_root_id'],
      'repair_cost_event_0069_assignment_key_missing',
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
    ) as Array<{ index_name: string; non_unique: string | number; columns_csv: string }>;
    if (!rows.some((row) => Number(row.non_unique) === 0 && row.columns_csv === columns.join(','))) {
      throw new Error(errorCode);
    }
  }

  private async tableStates(queryRunner: QueryRunner): Promise<TableState0069[]> {
    const rows = await queryRunner.query(
      `SELECT TABLE_NAME AS table_name
         FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN (${REPAIR_COST_EVENT_0069_TABLES.map(() => '?').join(',')})`,
      [...REPAIR_COST_EVENT_0069_TABLES],
    ) as Array<{ table_name: string }>;
    const existing = new Set(rows.map((row) => row.table_name));
    return REPAIR_COST_EVENT_0069_TABLES.map((table) => ({ table, exists: existing.has(table) }));
  }

  private async assertOwnedAndEmptyPartialState(
    queryRunner: QueryRunner,
    states: readonly TableState0069[],
  ): Promise<void> {
    for (const state of states) {
      if (!state.exists) continue;
      await this.assertOwned(queryRunner, state.table);
      await this.assertEmpty(queryRunner, state.table, 'partial');
    }
  }

  private async assertOwned(
    queryRunner: QueryRunner,
    table: (typeof REPAIR_COST_EVENT_0069_TABLES)[number],
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
      throw new Error(`repair_cost_event_0069_ownership_conflict:${table}`);
    }
  }

  private async assertEmpty(
    queryRunner: QueryRunner,
    table: (typeof REPAIR_COST_EVENT_0069_TABLES)[number],
    phase: 'partial' | 'down',
  ): Promise<void> {
    const rows = await queryRunner.query(`SELECT COUNT(*) AS row_count FROM \`${table}\``);
    if (BigInt(String(rows[0]?.row_count ?? '0')) !== 0n) {
      throw new Error(`repair_cost_event_0069_${phase}_non_empty:${table}`);
    }
  }

  private async dropExistingInReverseOrder(
    queryRunner: QueryRunner,
    states: readonly TableState0069[],
  ): Promise<void> {
    const existing = new Set(states.filter((state) => state.exists).map((state) => state.table));
    for (const table of [...REPAIR_COST_EVENT_0069_TABLES].reverse()) {
      if (existing.has(table)) await queryRunner.query(`DROP TABLE \`${table}\``);
    }
  }

  private async assertComplete(queryRunner: QueryRunner): Promise<void> {
    const states = await this.tableStates(queryRunner);
    if (!states.every((state) => state.exists)) {
      throw new Error('repair_cost_event_0069_schema_incomplete');
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
        throw new Error(`repair_cost_event_0069_columns_incompatible:${table}`);
      }
      const constraints = await queryRunner.query(
        `SELECT CONSTRAINT_NAME AS constraint_name
           FROM information_schema.TABLE_CONSTRAINTS
          WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ?
          ORDER BY CONSTRAINT_NAME`,
        [table],
      ) as Array<{ constraint_name: string }>;
      const actualConstraints = constraints.map((row) => row.constraint_name).sort();
      const expectedConstraints = [...EXPECTED_CONSTRAINTS[table]].sort();
      if (JSON.stringify(actualConstraints) !== JSON.stringify(expectedConstraints)) {
        throw new Error(`repair_cost_event_0069_constraints_incompatible:${table}`);
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
        throw new Error(`repair_cost_event_0069_check_not_enforced:${table}`);
      }
    }
  }

  private async createMutexes(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`${MUTEXES}\` (
        \`work_order_id\` INT NOT NULL,
        \`created_by_user_id\` INT NOT NULL,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`work_order_id\`),
        KEY \`idx_rce_mutex_actor\` (\`created_by_user_id\`),
        CONSTRAINT \`fk_rce_mutex_work_order\`
          FOREIGN KEY (\`work_order_id\`) REFERENCES \`repair_work_order_profiles\` (\`work_order_id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rce_mutex_actor\`
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
        \`economic_root_id\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`work_order_id\` INT NOT NULL,
        \`authorized_company_ref\` VARCHAR(100) NOT NULL,
        \`authorized_business_sector_ref\` VARCHAR(100) NOT NULL,
        \`authorized_store_ref\` VARCHAR(100) NOT NULL,
        \`authorized_customer_ref\` VARCHAR(100) NOT NULL,
        \`target_profile_code\` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`rule_version\` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`authority_version\` INT NOT NULL,
        \`supersedes_authority_id\` BIGINT NULL,
        \`assignment_authority_id\` BIGINT NOT NULL,
        \`assignment_authority_version\` INT NOT NULL,
        \`assignment_content_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`source_graph_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`cost_close_watermark_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`event_close_watermark_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`total_direct_cost_cents\` BIGINT NOT NULL,
        \`currency\` CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`profile_eligibility\` VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
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
        \`approved_at\` DATETIME(6) NULL,
        \`rejected_at\` DATETIME(6) NULL,
        \`superseded_at\` DATETIME(6) NULL,
        \`open_economic_root_id\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin
          GENERATED ALWAYS AS (
            CASE WHEN \`status\` IN ('draft','submitted') THEN \`economic_root_id\` ELSE NULL END
          ) STORED,
        \`approved_economic_root_id\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin
          GENERATED ALWAYS AS (
            CASE WHEN \`status\` = 'approved' THEN \`economic_root_id\` ELSE NULL END
          ) STORED,
        \`approved_supersedes_authority_id\` BIGINT
          GENERATED ALWAYS AS (
            CASE WHEN \`status\` = 'approved' THEN \`supersedes_authority_id\` ELSE NULL END
          ) STORED,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_rce_authority_ref\` (\`authority_ref\`),
        UNIQUE KEY \`uq_rce_id_root\` (\`id\`, \`economic_root_id\`),
        UNIQUE KEY \`uq_rce_root_version\` (\`economic_root_id\`, \`authority_version\`),
        UNIQUE KEY \`uq_rce_open_root\` (\`open_economic_root_id\`),
        UNIQUE KEY \`uq_rce_approved_root\` (\`approved_economic_root_id\`),
        UNIQUE KEY \`uq_rce_approved_supersedes\` (\`approved_supersedes_authority_id\`),
        KEY \`idx_rce_work_root\` (\`work_order_id\`, \`economic_root_id\`),
        KEY \`idx_rce_assignment_root\` (\`assignment_authority_id\`, \`economic_root_id\`),
        KEY \`idx_rce_created_by\` (\`created_by_user_id\`),
        KEY \`idx_rce_submitted_by\` (\`submitted_by_user_id\`),
        KEY \`idx_rce_approved_by\` (\`approved_by_user_id\`),
        KEY \`idx_rce_rejected_by\` (\`rejected_by_user_id\`),
        KEY \`idx_rce_superseded_by\` (\`superseded_by_user_id\`),
        CONSTRAINT \`fk_rce_authority_root\`
          FOREIGN KEY (\`economic_root_id\`) REFERENCES \`business_contribution_economic_fact_roots\` (\`economic_root_id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rce_authority_work_root\`
          FOREIGN KEY (\`work_order_id\`, \`economic_root_id\`)
          REFERENCES \`repair_work_order_economic_lineages\` (\`work_order_id\`, \`economic_root_id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rce_authority_assignment\`
          FOREIGN KEY (\`assignment_authority_id\`, \`economic_root_id\`)
          REFERENCES \`repair_contribution_assignment_authorities\` (\`id\`, \`economic_root_id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rce_authority_supersedes\`
          FOREIGN KEY (\`supersedes_authority_id\`, \`economic_root_id\`)
          REFERENCES \`${AUTHORITIES}\` (\`id\`, \`economic_root_id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rce_authority_created_by\`
          FOREIGN KEY (\`created_by_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rce_authority_submitted_by\`
          FOREIGN KEY (\`submitted_by_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rce_authority_approved_by\`
          FOREIGN KEY (\`approved_by_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rce_authority_rejected_by\`
          FOREIGN KEY (\`rejected_by_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rce_authority_superseded_by\`
          FOREIGN KEY (\`superseded_by_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`chk_rce_authority_ref\` CHECK (
          REGEXP_LIKE(\`authority_ref\`, '^[0-9a-f]{64}$', 'c')
        ),
        CONSTRAINT \`chk_rce_authority_hashes\` CHECK (
          REGEXP_LIKE(\`economic_root_id\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`assignment_content_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`source_graph_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`cost_close_watermark_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`event_close_watermark_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`content_hash\`, '^[0-9a-f]{64}$', 'c')
        ),
        CONSTRAINT \`chk_rce_authority_profile\` CHECK (
          \`target_profile_code\` = 'repair_zero_external_direct_cost_v1'
          AND \`rule_version\` = 'gov1-s2-repair-baseline-cost-event-v1'
          AND \`currency\` = 'CNY'
        ),
        CONSTRAINT \`chk_rce_authority_versions\` CHECK (
          \`authority_version\` > 0 AND \`assignment_authority_version\` > 0
          AND \`expected_work_order_version\` > 0
        ),
        CONSTRAINT \`chk_rce_authority_amount\` CHECK (
          \`total_direct_cost_cents\` >= 0
          AND ((\`profile_eligibility\` = 'eligible' AND \`total_direct_cost_cents\` = 0)
            OR (\`profile_eligibility\` = 'blocked_external_cost'
              AND \`total_direct_cost_cents\` > 0))
        ),
        CONSTRAINT \`chk_rce_authority_lifecycle\` CHECK (
          (\`status\` = 'draft' AND \`submitted_by_user_id\` IS NULL AND \`approved_by_user_id\` IS NULL
            AND \`rejected_by_user_id\` IS NULL AND \`superseded_by_user_id\` IS NULL
            AND \`submitted_at\` IS NULL AND \`approved_at\` IS NULL AND \`rejected_at\` IS NULL
            AND \`superseded_at\` IS NULL)
          OR (\`status\` = 'submitted' AND \`submitted_by_user_id\` IS NOT NULL
            AND \`submitted_at\` IS NOT NULL AND \`approved_by_user_id\` IS NULL
            AND \`rejected_by_user_id\` IS NULL AND \`superseded_by_user_id\` IS NULL
            AND \`approved_at\` IS NULL AND \`rejected_at\` IS NULL AND \`superseded_at\` IS NULL)
          OR (\`status\` = 'approved' AND \`submitted_by_user_id\` IS NOT NULL
            AND \`approved_by_user_id\` IS NOT NULL AND \`submitted_at\` IS NOT NULL
            AND \`approved_at\` IS NOT NULL AND \`rejected_by_user_id\` IS NULL
            AND \`superseded_by_user_id\` IS NULL AND \`rejected_at\` IS NULL
            AND \`superseded_at\` IS NULL)
          OR (\`status\` = 'rejected' AND \`submitted_by_user_id\` IS NOT NULL
            AND \`rejected_by_user_id\` IS NOT NULL AND \`submitted_at\` IS NOT NULL
            AND \`rejected_at\` IS NOT NULL AND \`approved_by_user_id\` IS NULL
            AND \`superseded_by_user_id\` IS NULL AND \`approved_at\` IS NULL
            AND \`superseded_at\` IS NULL)
          OR (\`status\` = 'superseded' AND \`submitted_by_user_id\` IS NOT NULL
            AND \`approved_by_user_id\` IS NOT NULL AND \`superseded_by_user_id\` IS NOT NULL
            AND \`submitted_at\` IS NOT NULL AND \`approved_at\` IS NOT NULL
            AND \`superseded_at\` IS NOT NULL AND \`rejected_by_user_id\` IS NULL
            AND \`rejected_at\` IS NULL)
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='${OWNERSHIP_COMMENTS[AUTHORITIES]}'
    `);
  }

  private async createLines(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`${LINES}\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`authority_id\` BIGINT NOT NULL,
        \`category\` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`disposition\` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`amount_cents\` BIGINT NOT NULL,
        \`occurred_at\` DATETIME(6) NULL,
        \`source_scope_ref\` VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`source_scope_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`close_watermark_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`evidence_ref\` VARCHAR(73) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`evidence_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`line_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_rce_line_category\` (\`authority_id\`, \`category\`),
        CONSTRAINT \`fk_rce_line_authority\`
          FOREIGN KEY (\`authority_id\`) REFERENCES \`${AUTHORITIES}\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`chk_rce_line_category_state\` CHECK (
          (\`category\` IN ('parts','outsourced','other_direct')
            AND ((\`disposition\` = 'not_applicable' AND \`amount_cents\` = 0 AND \`occurred_at\` IS NULL)
              OR (\`disposition\` = 'confirmed_cost' AND \`amount_cents\` > 0 AND \`occurred_at\` IS NOT NULL)))
          OR (\`category\` IN ('refund','rework') AND \`disposition\` = 'not_applicable'
            AND \`amount_cents\` = 0 AND \`occurred_at\` IS NULL)
        ),
        CONSTRAINT \`chk_rce_line_scope_ref\` CHECK (
          REGEXP_LIKE(\`source_scope_ref\`, '^scope:[a-z0-9][a-z0-9:_-]{2,89}$', 'c')
        ),
        CONSTRAINT \`chk_rce_line_hashes\` CHECK (
          REGEXP_LIKE(\`source_scope_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`close_watermark_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`evidence_ref\`, '^evidence:[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`evidence_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`line_hash\`, '^[0-9a-f]{64}$', 'c')
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='${OWNERSHIP_COMMENTS[LINES]}'
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
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_rce_event_ref\` (\`event_ref\`),
        UNIQUE KEY \`uq_rce_event_once\` (\`authority_id\`, \`event_type\`, \`request_fingerprint\`),
        KEY \`idx_rce_event_actor\` (\`actor_user_id\`),
        CONSTRAINT \`fk_rce_event_authority\`
          FOREIGN KEY (\`authority_id\`) REFERENCES \`${AUTHORITIES}\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rce_event_actor\`
          FOREIGN KEY (\`actor_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`chk_rce_event_ref\` CHECK (
          REGEXP_LIKE(\`event_ref\`, '^[0-9a-f]{64}$', 'c')
        ),
        CONSTRAINT \`chk_rce_event_hashes\` CHECK (
          REGEXP_LIKE(\`evidence_ref\`, '^evidence:[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`evidence_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`request_fingerprint\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`authority_content_hash\`, '^[0-9a-f]{64}$', 'c')
        ),
        CONSTRAINT \`chk_rce_event_transition\` CHECK (
          (\`event_type\` = 'drafted' AND \`from_status\` IS NULL AND \`to_status\` = 'draft')
          OR (\`event_type\` = 'submitted' AND \`from_status\` = 'draft' AND \`to_status\` = 'submitted')
          OR (\`event_type\` = 'approved' AND \`from_status\` = 'submitted' AND \`to_status\` = 'approved')
          OR (\`event_type\` = 'rejected' AND \`from_status\` = 'submitted' AND \`to_status\` = 'rejected')
          OR (\`event_type\` = 'superseded' AND \`from_status\` = 'approved' AND \`to_status\` = 'superseded')
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
        UNIQUE KEY \`uq_rce_claim_result\` (\`authority_id\`, \`phase\`),
        KEY \`idx_rce_claim_actor\` (\`actor_user_id\`),
        KEY \`idx_rce_claim_event\` (\`lifecycle_event_id\`),
        CONSTRAINT \`fk_rce_claim_actor\`
          FOREIGN KEY (\`actor_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rce_claim_authority\`
          FOREIGN KEY (\`authority_id\`) REFERENCES \`${AUTHORITIES}\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_rce_claim_event\`
          FOREIGN KEY (\`lifecycle_event_id\`) REFERENCES \`${EVENTS}\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`chk_rce_claim_key\` CHECK (
          REGEXP_LIKE(\`idempotency_key\`, '^repair-cost-event-idempotency:[0-9a-f]{64}$', 'c')
          AND \`phase\` IN ('draft','submit','approve','reject')
        ),
        CONSTRAINT \`chk_rce_claim_hash\` CHECK (
          REGEXP_LIKE(\`request_fingerprint\`, '^[0-9a-f]{64}$', 'c')
        ),
        CONSTRAINT \`chk_rce_claim_result\` CHECK (
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
