import { MigrationInterface, QueryRunner } from 'typeorm';

const MUTEXES = 'repair_contribution_assignment_mutexes';
const AUTHORITIES = 'repair_contribution_assignment_authorities';
const ATTRIBUTIONS = 'repair_contribution_assignment_attributions';
const EVENTS = 'repair_contribution_assignment_lifecycle_events';
const CLAIMS = 'repair_contribution_assignment_idempotency_claims';

export const REPAIR_ASSIGNMENT_0068_TABLES = [
  MUTEXES,
  AUTHORITIES,
  ATTRIBUTIONS,
  EVENTS,
  CLAIMS,
] as const;

const OWNERSHIP_COMMENT_PREFIX =
  'GOV1-S2-0068 repair responsibility attribution source-only unwired';

const OWNERSHIP_COMMENTS: Readonly<Record<(typeof REPAIR_ASSIGNMENT_0068_TABLES)[number], string>> = {
  [MUTEXES]: `${OWNERSHIP_COMMENT_PREFIX}:mutexes`,
  [AUTHORITIES]: `${OWNERSHIP_COMMENT_PREFIX}:authorities`,
  [ATTRIBUTIONS]: `${OWNERSHIP_COMMENT_PREFIX}:attributions`,
  [EVENTS]: `${OWNERSHIP_COMMENT_PREFIX}:events`,
  [CLAIMS]: `${OWNERSHIP_COMMENT_PREFIX}:claims`,
};

const EXPECTED_COLUMNS: Readonly<Record<(typeof REPAIR_ASSIGNMENT_0068_TABLES)[number], readonly string[]>> = {
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
    'profile_code',
    'authority_version',
    'supersedes_authority_id',
    'responsibility_employee_id',
    'responsibility_effective_from',
    'responsibility_effective_to',
    'responsibility_evidence_ref',
    'responsibility_evidence_hash',
    'attribution_rule_version',
    'content_hash',
    'expected_work_order_version',
    'status',
    'created_by_user_id',
    'submitted_by_user_id',
    'approved_by_user_id',
    'rejected_by_user_id',
    'superseded_by_user_id',
    'created_at',
    'submitted_at',
    'approved_at',
    'rejected_at',
    'superseded_at',
    'open_economic_root_id',
    'approved_economic_root_id',
    'approved_supersedes_authority_id',
  ],
  [ATTRIBUTIONS]: [
    'id',
    'authority_id',
    'role',
    'employee_id',
    'share_bps',
    'effective_from',
    'effective_to',
    'rule_version',
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

const EXPECTED_CONSTRAINTS: Readonly<Record<(typeof REPAIR_ASSIGNMENT_0068_TABLES)[number], readonly string[]>> = {
  [MUTEXES]: [
    'PRIMARY',
    'fk_repair_assignment_mutex_actor',
    'fk_repair_assignment_mutex_work_order',
  ],
  [AUTHORITIES]: [
    'PRIMARY',
    'chk_repair_assignment_authority_hashes',
    'chk_repair_assignment_authority_interval',
    'chk_repair_assignment_authority_lifecycle',
    'chk_repair_assignment_authority_profile',
    'chk_repair_assignment_authority_ref',
    'chk_repair_assignment_authority_versions',
    'fk_repair_assignment_authority_approved_by',
    'fk_repair_assignment_authority_created_by',
    'fk_repair_assignment_authority_rejected_by',
    'fk_repair_assignment_authority_responsible',
    'fk_repair_assignment_authority_root',
    'fk_repair_assignment_authority_submitted_by',
    'fk_repair_assignment_authority_superseded_by',
    'fk_repair_assignment_authority_supersedes',
    'fk_repair_assignment_authority_work_root',
    'uq_repair_assignment_approved_root',
    'uq_repair_assignment_approved_supersedes',
    'uq_repair_assignment_authority_ref',
    'uq_repair_assignment_id_root',
    'uq_repair_assignment_open_root',
    'uq_repair_assignment_root_version',
  ],
  [ATTRIBUTIONS]: [
    'PRIMARY',
    'chk_repair_assignment_attribution_hashes',
    'chk_repair_assignment_attribution_interval',
    'chk_repair_assignment_attribution_role',
    'chk_repair_assignment_attribution_share',
    'fk_repair_assignment_attribution_authority',
    'fk_repair_assignment_attribution_employee',
    'uq_repair_assignment_attribution_line',
  ],
  [EVENTS]: [
    'PRIMARY',
    'chk_repair_assignment_event_hashes',
    'chk_repair_assignment_event_ref',
    'chk_repair_assignment_event_transition',
    'fk_repair_assignment_event_actor',
    'fk_repair_assignment_event_authority',
    'uq_repair_assignment_event_once',
    'uq_repair_assignment_event_ref',
  ],
  [CLAIMS]: [
    'PRIMARY',
    'chk_repair_assignment_claim_hash',
    'chk_repair_assignment_claim_key',
    'chk_repair_assignment_claim_result',
    'fk_repair_assignment_claim_actor',
    'fk_repair_assignment_claim_authority',
    'fk_repair_assignment_claim_event',
    'uq_repair_assignment_claim_result',
  ],
};

type TableState0068 = Readonly<{ table: (typeof REPAIR_ASSIGNMENT_0068_TABLES)[number]; exists: boolean }>;

export class AddRepairResponsibilityAttributionAuthority00681792100000000
implements MigrationInterface {
  name = 'AddRepairResponsibilityAttributionAuthority00681792100000000';

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
    await this.createAttributions(queryRunner);
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
      throw new Error('repair_assignment_0068_mysql_required');
    }
  }

  private async assertPrerequisites(queryRunner: QueryRunner): Promise<void> {
    const required: Readonly<Record<string, readonly string[]>> = {
      users: ['id'],
      employees: ['id', 'linked_user_id', 'status'],
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
      user_roles: ['user_id', 'role_id'],
      roles: ['id', 'code'],
      business_scope_grants: [
        'user_id',
        'employee_id',
        'company_ref',
        'business_sector_ref',
        'store_ref',
        'customer_ref',
        'effect',
        'permissions',
        'status',
        'valid_from',
        'valid_until',
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
        throw new Error(`repair_assignment_0068_prerequisite_missing:${table}`);
      }
    }
    await this.assertUniqueIndex(
      queryRunner,
      'repair_work_order_profiles',
      ['work_order_id'],
      'repair_assignment_0068_profile_key_missing',
    );
    await this.assertUniqueIndex(
      queryRunner,
      'business_contribution_economic_fact_roots',
      ['economic_root_id'],
      'repair_assignment_0068_root_key_missing',
    );
    await this.assertUniqueIndex(
      queryRunner,
      'repair_work_order_economic_lineages',
      ['work_order_id', 'economic_root_id'],
      'repair_assignment_0068_lineage_key_missing',
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
    if (
      !rows.some(
        (row) => Number(row.non_unique) === 0 && row.columns_csv === columns.join(','),
      )
    ) {
      throw new Error(errorCode);
    }
  }

  private async tableStates(queryRunner: QueryRunner): Promise<TableState0068[]> {
    const rows = await queryRunner.query(
      `SELECT TABLE_NAME AS table_name
         FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN (${REPAIR_ASSIGNMENT_0068_TABLES.map(() => '?').join(',')})`,
      [...REPAIR_ASSIGNMENT_0068_TABLES],
    ) as Array<{ table_name: string }>;
    const existing = new Set(rows.map((row) => row.table_name));
    return REPAIR_ASSIGNMENT_0068_TABLES.map((table) => ({ table, exists: existing.has(table) }));
  }

  private async assertOwnedAndEmptyPartialState(
    queryRunner: QueryRunner,
    states: readonly TableState0068[],
  ): Promise<void> {
    for (const state of states) {
      if (!state.exists) continue;
      await this.assertOwned(queryRunner, state.table);
      await this.assertEmpty(queryRunner, state.table, 'partial');
    }
  }

  private async assertOwned(
    queryRunner: QueryRunner,
    table: (typeof REPAIR_ASSIGNMENT_0068_TABLES)[number],
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
      throw new Error(`repair_assignment_0068_ownership_conflict:${table}`);
    }
  }

  private async assertEmpty(
    queryRunner: QueryRunner,
    table: (typeof REPAIR_ASSIGNMENT_0068_TABLES)[number],
    phase: 'partial' | 'down',
  ): Promise<void> {
    const rows = await queryRunner.query(`SELECT COUNT(*) AS row_count FROM \`${table}\``);
    if (BigInt(String(rows[0]?.row_count ?? '0')) !== 0n) {
      throw new Error(`repair_assignment_0068_${phase}_non_empty:${table}`);
    }
  }

  private async dropExistingInReverseOrder(
    queryRunner: QueryRunner,
    states: readonly TableState0068[],
  ): Promise<void> {
    const existing = new Set(states.filter((state) => state.exists).map((state) => state.table));
    for (const table of [...REPAIR_ASSIGNMENT_0068_TABLES].reverse()) {
      if (existing.has(table)) await queryRunner.query(`DROP TABLE \`${table}\``);
    }
  }

  private async assertComplete(queryRunner: QueryRunner): Promise<void> {
    const states = await this.tableStates(queryRunner);
    if (!states.every((state) => state.exists)) {
      throw new Error('repair_assignment_0068_schema_incomplete');
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
      const actualColumns = columns.map((row) => row.column_name);
      if (JSON.stringify(actualColumns) !== JSON.stringify(EXPECTED_COLUMNS[table])) {
        throw new Error(`repair_assignment_0068_columns_incompatible:${table}`);
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
        throw new Error(`repair_assignment_0068_constraints_incompatible:${table}`);
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
        throw new Error(`repair_assignment_0068_check_not_enforced:${table}`);
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
        KEY \`idx_repair_assignment_mutex_actor\` (\`created_by_user_id\`),
        CONSTRAINT \`fk_repair_assignment_mutex_work_order\`
          FOREIGN KEY (\`work_order_id\`) REFERENCES \`repair_work_order_profiles\` (\`work_order_id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_repair_assignment_mutex_actor\`
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
        \`profile_code\` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`authority_version\` INT NOT NULL,
        \`supersedes_authority_id\` BIGINT NULL,
        \`responsibility_employee_id\` INT NOT NULL,
        \`responsibility_effective_from\` DATETIME(3) NOT NULL,
        \`responsibility_effective_to\` DATETIME(3) NULL,
        \`responsibility_evidence_ref\` VARCHAR(73) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`responsibility_evidence_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`attribution_rule_version\` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`content_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`expected_work_order_version\` INT NOT NULL,
        \`status\` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`created_by_user_id\` INT NOT NULL,
        \`submitted_by_user_id\` INT NULL,
        \`approved_by_user_id\` INT NULL,
        \`rejected_by_user_id\` INT NULL,
        \`superseded_by_user_id\` INT NULL,
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
        UNIQUE KEY \`uq_repair_assignment_authority_ref\` (\`authority_ref\`),
        UNIQUE KEY \`uq_repair_assignment_id_root\` (\`id\`, \`economic_root_id\`),
        UNIQUE KEY \`uq_repair_assignment_root_version\` (\`economic_root_id\`, \`authority_version\`),
        UNIQUE KEY \`uq_repair_assignment_open_root\` (\`open_economic_root_id\`),
        UNIQUE KEY \`uq_repair_assignment_approved_root\` (\`approved_economic_root_id\`),
        UNIQUE KEY \`uq_repair_assignment_approved_supersedes\` (\`approved_supersedes_authority_id\`),
        KEY \`idx_repair_assignment_work_root\` (\`work_order_id\`, \`economic_root_id\`),
        KEY \`idx_repair_assignment_responsible\` (\`responsibility_employee_id\`),
        KEY \`idx_repair_assignment_created_by\` (\`created_by_user_id\`),
        KEY \`idx_repair_assignment_submitted_by\` (\`submitted_by_user_id\`),
        KEY \`idx_repair_assignment_approved_by\` (\`approved_by_user_id\`),
        KEY \`idx_repair_assignment_rejected_by\` (\`rejected_by_user_id\`),
        KEY \`idx_repair_assignment_superseded_by\` (\`superseded_by_user_id\`),
        CONSTRAINT \`fk_repair_assignment_authority_root\`
          FOREIGN KEY (\`economic_root_id\`) REFERENCES \`business_contribution_economic_fact_roots\` (\`economic_root_id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_repair_assignment_authority_work_root\`
          FOREIGN KEY (\`work_order_id\`, \`economic_root_id\`)
          REFERENCES \`repair_work_order_economic_lineages\` (\`work_order_id\`, \`economic_root_id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_repair_assignment_authority_supersedes\`
          FOREIGN KEY (\`supersedes_authority_id\`, \`economic_root_id\`)
          REFERENCES \`${AUTHORITIES}\` (\`id\`, \`economic_root_id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_repair_assignment_authority_responsible\`
          FOREIGN KEY (\`responsibility_employee_id\`) REFERENCES \`employees\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_repair_assignment_authority_created_by\`
          FOREIGN KEY (\`created_by_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_repair_assignment_authority_submitted_by\`
          FOREIGN KEY (\`submitted_by_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_repair_assignment_authority_approved_by\`
          FOREIGN KEY (\`approved_by_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_repair_assignment_authority_rejected_by\`
          FOREIGN KEY (\`rejected_by_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_repair_assignment_authority_superseded_by\`
          FOREIGN KEY (\`superseded_by_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`chk_repair_assignment_authority_ref\` CHECK (
          REGEXP_LIKE(\`authority_ref\`, '^[0-9a-f]{64}$', 'c')
        ),
        CONSTRAINT \`chk_repair_assignment_authority_hashes\` CHECK (
          REGEXP_LIKE(\`economic_root_id\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`responsibility_evidence_ref\`, '^evidence:[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`responsibility_evidence_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`content_hash\`, '^[0-9a-f]{64}$', 'c')
        ),
        CONSTRAINT \`chk_repair_assignment_authority_profile\` CHECK (
          \`profile_code\` = 'repair_zero_external_direct_cost_v1'
          AND \`attribution_rule_version\` = 'gov1-s2-repair-three-role-attribution-v1'
        ),
        CONSTRAINT \`chk_repair_assignment_authority_versions\` CHECK (
          \`authority_version\` > 0 AND \`expected_work_order_version\` > 0
        ),
        CONSTRAINT \`chk_repair_assignment_authority_interval\` CHECK (
          \`responsibility_effective_to\` IS NULL
          OR \`responsibility_effective_to\` > \`responsibility_effective_from\`
        ),
        CONSTRAINT \`chk_repair_assignment_authority_lifecycle\` CHECK (
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

  private async createAttributions(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`${ATTRIBUTIONS}\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`authority_id\` BIGINT NOT NULL,
        \`role\` VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`employee_id\` INT NOT NULL,
        \`share_bps\` INT NOT NULL,
        \`effective_from\` DATETIME(3) NOT NULL,
        \`effective_to\` DATETIME(3) NULL,
        \`rule_version\` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`evidence_ref\` VARCHAR(73) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`evidence_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`line_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_repair_assignment_attribution_line\` (\`authority_id\`, \`role\`, \`employee_id\`),
        KEY \`idx_repair_assignment_attribution_employee\` (\`employee_id\`),
        CONSTRAINT \`fk_repair_assignment_attribution_authority\`
          FOREIGN KEY (\`authority_id\`) REFERENCES \`${AUTHORITIES}\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_repair_assignment_attribution_employee\`
          FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`chk_repair_assignment_attribution_role\` CHECK (
          \`role\` IN ('lead_originator','business_owner','service_owner')
          AND \`rule_version\` = 'gov1-s2-repair-three-role-attribution-v1'
        ),
        CONSTRAINT \`chk_repair_assignment_attribution_share\` CHECK (
          \`share_bps\` > 0 AND \`share_bps\` <= 10000
        ),
        CONSTRAINT \`chk_repair_assignment_attribution_interval\` CHECK (
          \`effective_to\` IS NULL OR \`effective_to\` > \`effective_from\`
        ),
        CONSTRAINT \`chk_repair_assignment_attribution_hashes\` CHECK (
          REGEXP_LIKE(\`evidence_ref\`, '^evidence:[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`evidence_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`line_hash\`, '^[0-9a-f]{64}$', 'c')
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='${OWNERSHIP_COMMENTS[ATTRIBUTIONS]}'
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
        UNIQUE KEY \`uq_repair_assignment_event_ref\` (\`event_ref\`),
        UNIQUE KEY \`uq_repair_assignment_event_once\` (\`authority_id\`, \`event_type\`, \`request_fingerprint\`),
        KEY \`idx_repair_assignment_event_actor\` (\`actor_user_id\`),
        CONSTRAINT \`fk_repair_assignment_event_authority\`
          FOREIGN KEY (\`authority_id\`) REFERENCES \`${AUTHORITIES}\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_repair_assignment_event_actor\`
          FOREIGN KEY (\`actor_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`chk_repair_assignment_event_ref\` CHECK (
          REGEXP_LIKE(\`event_ref\`, '^[0-9a-f]{64}$', 'c')
        ),
        CONSTRAINT \`chk_repair_assignment_event_hashes\` CHECK (
          REGEXP_LIKE(\`evidence_ref\`, '^evidence:[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`evidence_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`request_fingerprint\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`authority_content_hash\`, '^[0-9a-f]{64}$', 'c')
        ),
        CONSTRAINT \`chk_repair_assignment_event_transition\` CHECK (
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
        UNIQUE KEY \`uq_repair_assignment_claim_result\` (\`authority_id\`, \`phase\`),
        KEY \`idx_repair_assignment_claim_actor\` (\`actor_user_id\`),
        KEY \`idx_repair_assignment_claim_event\` (\`lifecycle_event_id\`),
        CONSTRAINT \`fk_repair_assignment_claim_actor\`
          FOREIGN KEY (\`actor_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_repair_assignment_claim_authority\`
          FOREIGN KEY (\`authority_id\`) REFERENCES \`${AUTHORITIES}\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_repair_assignment_claim_event\`
          FOREIGN KEY (\`lifecycle_event_id\`) REFERENCES \`${EVENTS}\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`chk_repair_assignment_claim_key\` CHECK (
          REGEXP_LIKE(\`idempotency_key\`, '^repair-assignment-idempotency:[0-9a-f]{64}$', 'c')
          AND \`phase\` IN ('draft','submit','approve','reject')
        ),
        CONSTRAINT \`chk_repair_assignment_claim_hash\` CHECK (
          REGEXP_LIKE(\`request_fingerprint\`, '^[0-9a-f]{64}$', 'c')
        ),
        CONSTRAINT \`chk_repair_assignment_claim_result\` CHECK (
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
