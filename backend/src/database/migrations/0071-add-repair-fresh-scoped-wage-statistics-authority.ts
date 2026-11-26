import { MigrationInterface, QueryRunner } from 'typeorm';

const MUTEXES = 'wage_statistics_scope_mutexes';
const AUTHORITIES = 'wage_statistics_scope_authorities';
const REQUIRED_DOMAINS = 'wage_statistics_required_domain_lines';
const EVENTS = 'wage_statistics_scope_lifecycle_events';
const CLAIMS = 'wage_statistics_scope_idempotency_claims';

const GROUP_TARGETS = 'group_targets';
const GROUP_TARGET_BINDING_INDEX = 'uq_group_target_exact_scope_binding';
const GROUP_TARGET_BINDING_COLUMNS = [
  'id',
  'group_id',
  'settlement_period',
  'calculation_version',
] as const;

export const REPAIR_FRESH_SCOPED_WAGE_STATISTICS_0071_TABLES = [
  MUTEXES,
  AUTHORITIES,
  REQUIRED_DOMAINS,
  EVENTS,
  CLAIMS,
] as const;

const OWNERSHIP_COMMENT_PREFIX =
  'GOV1-S2-0071 repair/fresh scoped wage statistics authority source-only unwired';

const OWNERSHIP_COMMENTS: Readonly<
  Record<(typeof REPAIR_FRESH_SCOPED_WAGE_STATISTICS_0071_TABLES)[number], string>
> = {
  [MUTEXES]: `${OWNERSHIP_COMMENT_PREFIX}:mutexes`,
  [AUTHORITIES]: `${OWNERSHIP_COMMENT_PREFIX}:authorities`,
  [REQUIRED_DOMAINS]: `${OWNERSHIP_COMMENT_PREFIX}:required-domain-lines`,
  [EVENTS]: `${OWNERSHIP_COMMENT_PREFIX}:events`,
  [CLAIMS]: `${OWNERSHIP_COMMENT_PREFIX}:claims`,
};

const EXPECTED_COLUMNS: Readonly<
  Record<
    (typeof REPAIR_FRESH_SCOPED_WAGE_STATISTICS_0071_TABLES)[number],
    readonly string[]
  >
> = {
  [MUTEXES]: [
    'group_id',
    'settlement_period',
    'created_by_user_id',
    'created_at',
  ],
  [AUTHORITIES]: [
    'id',
    'authority_ref',
    'group_id',
    'settlement_period',
    'authority_version',
    'supersedes_authority_id',
    'group_target_id',
    'group_target_calculation_version',
    'required_domain_count',
    'required_domains_hash',
    'data_completeness_watermark_hash',
    'settlement_complete_domain_count',
    'settlement_coverage_status',
    'enterprise_formal_domain_count',
    'enterprise_ready_domain_count',
    'enterprise_coverage_status',
    'group_target_scope_hash',
    'content_hash',
    'status',
    'created_by_user_id',
    'submitted_by_user_id',
    'approved_by_user_id',
    'rejected_by_user_id',
    'frozen_by_user_id',
    'superseded_by_user_id',
    'created_at',
    'submitted_at',
    'approved_at',
    'rejected_at',
    'frozen_at',
    'superseded_at',
    'open_group_id',
    'open_settlement_period',
    'active_group_id',
    'active_settlement_period',
    'approved_supersedes_authority_id',
  ],
  [REQUIRED_DOMAINS]: [
    'id',
    'authority_id',
    'group_id',
    'settlement_period',
    'business_domain',
    'domain_order',
    'adapter_contract_version',
    'source_cursor',
    'source_cursor_hash',
    'data_complete_through_at',
    'unresolved_cost_count',
    'unresolved_refund_count',
    'unresolved_attribution_count',
    'unresolved_duplicate_count',
    'completeness_status',
    'watermark_hash',
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

const SQL_DEFINITION_IDENTIFIERS_0071 = new Set<string>([
  'request_fingerprint',
  ...Object.values(EXPECTED_COLUMNS).flatMap((columns) => [...columns]),
]);

const MYSQL_0071_UTF8MB4_ESCAPED_LITERAL_PREFIX = "_utf8mb4\\'";
const MYSQL_0071_ASCII_ESCAPED_LITERAL_PREFIX = "_ascii\\'";

const EXPECTED_COLUMN_TYPES: Readonly<Record<Table0071, readonly string[]>> = {
  [MUTEXES]: ['int', 'char(7)', 'int', 'datetime(6)'],
  [AUTHORITIES]: [
    'bigint', 'char(64)', 'int', 'char(7)', 'int', 'bigint', 'int', 'int',
    'int', 'char(64)', 'char(64)', 'int', 'varchar(24)', 'int', 'int',
    'varchar(24)', 'char(64)', 'char(64)', 'varchar(16)', 'int', 'int', 'int',
    'int', 'int', 'int', 'datetime(6)', 'datetime(6)', 'datetime(6)',
    'datetime(6)', 'datetime(6)', 'datetime(6)', 'int', 'char(7)', 'int',
    'char(7)', 'bigint',
  ],
  [REQUIRED_DOMAINS]: [
    'bigint', 'bigint', 'int', 'char(7)', 'varchar(16)', 'int', 'varchar(64)',
    'varchar(191)', 'char(64)', 'datetime(6)', 'int', 'int', 'int', 'int',
    'varchar(16)', 'char(64)', 'char(64)', 'datetime(6)',
  ],
  [EVENTS]: [
    'bigint', 'char(64)', 'bigint', 'varchar(16)', 'varchar(16)', 'varchar(16)',
    'int', 'varchar(64)', 'varchar(73)', 'char(64)', 'char(64)', 'char(64)',
    'datetime(6)',
  ],
  [CLAIMS]: [
    'varchar(128)', 'varchar(16)', 'char(64)', 'int', 'varchar(16)', 'bigint',
    'bigint', 'datetime(6)', 'datetime(6)',
  ],
};

const NULLABLE_COLUMNS: Readonly<Record<Table0071, readonly string[]>> = {
  [MUTEXES]: [],
  [AUTHORITIES]: [
    'supersedes_authority_id', 'submitted_by_user_id', 'approved_by_user_id',
    'rejected_by_user_id', 'frozen_by_user_id', 'superseded_by_user_id',
    'submitted_at', 'approved_at', 'rejected_at', 'frozen_at', 'superseded_at',
    'open_group_id', 'open_settlement_period', 'active_group_id',
    'active_settlement_period', 'approved_supersedes_authority_id',
  ],
  [REQUIRED_DOMAINS]: [],
  [EVENTS]: ['from_status'],
  [CLAIMS]: ['authority_id', 'lifecycle_event_id', 'completed_at'],
};

const GENERATED_EXPRESSIONS: Readonly<Record<string, string>> = {
  open_group_id: "CASE WHEN (status IN ('draft','submitted')) THEN group_id ELSE NULL END",
  open_settlement_period:
    "CASE WHEN (status IN ('draft','submitted')) THEN settlement_period ELSE NULL END",
  active_group_id: "CASE WHEN (status IN ('approved','frozen')) THEN group_id ELSE NULL END",
  active_settlement_period:
    "CASE WHEN (status IN ('approved','frozen')) THEN settlement_period ELSE NULL END",
  approved_supersedes_authority_id:
    "CASE WHEN (status IN ('approved','frozen')) THEN supersedes_authority_id ELSE NULL END",
};

const EXPECTED_CONSTRAINTS: Readonly<
  Record<
    (typeof REPAIR_FRESH_SCOPED_WAGE_STATISTICS_0071_TABLES)[number],
    readonly string[]
  >
> = {
  [MUTEXES]: [
    'PRIMARY',
    'chk_wss_mutex_period',
    'fk_wss_mutex_actor',
    'fk_wss_mutex_group',
  ],
  [AUTHORITIES]: [
    'PRIMARY',
    'chk_wss_authority_coverage',
    'chk_wss_authority_hashes',
    'chk_wss_authority_lifecycle',
    'chk_wss_authority_period',
    'chk_wss_authority_ref',
    'chk_wss_authority_versions',
    'fk_wss_authority_approved_by',
    'fk_wss_authority_created_by',
    'fk_wss_authority_frozen_by',
    'fk_wss_authority_group',
    'fk_wss_authority_group_target_exact',
    'fk_wss_authority_rejected_by',
    'fk_wss_authority_submitted_by',
    'fk_wss_authority_superseded_by',
    'fk_wss_authority_supersedes',
    'uq_wss_authority_active_scope',
    'uq_wss_authority_id_scope',
    'uq_wss_authority_open_scope',
    'uq_wss_authority_ref',
    'uq_wss_authority_scope_version',
    'uq_wss_authority_supersedes',
  ],
  [REQUIRED_DOMAINS]: [
    'PRIMARY',
    'chk_wss_domain_completeness',
    'chk_wss_domain_hashes',
    'chk_wss_domain_identity',
    'chk_wss_domain_period',
    'chk_wss_domain_source',
    'fk_wss_domain_authority_scope',
    'uq_wss_domain_authority_domain',
    'uq_wss_domain_authority_order',
  ],
  [EVENTS]: [
    'PRIMARY',
    'chk_wss_event_hashes',
    'chk_wss_event_ref',
    'chk_wss_event_transition',
    'fk_wss_event_actor',
    'fk_wss_event_authority',
    'uq_wss_event_once',
    'uq_wss_event_ref',
  ],
  [CLAIMS]: [
    'PRIMARY',
    'chk_wss_claim_hash',
    'chk_wss_claim_key',
    'chk_wss_claim_result',
    'fk_wss_claim_actor',
    'fk_wss_claim_authority',
    'fk_wss_claim_event',
    'uq_wss_claim_result',
  ],
};

type Table0071 =
  (typeof REPAIR_FRESH_SCOPED_WAGE_STATISTICS_0071_TABLES)[number];
type TableState0071 = Readonly<{ table: Table0071; exists: boolean }>;

const EXPECTED_UNIQUE_INDEXES: Readonly<
  Record<Table0071, Readonly<Record<string, readonly string[]>>>
> = {
  [MUTEXES]: {
    PRIMARY: ['group_id', 'settlement_period'],
  },
  [AUTHORITIES]: {
    PRIMARY: ['id'],
    uq_wss_authority_ref: ['authority_ref'],
    uq_wss_authority_id_scope: ['id', 'group_id', 'settlement_period'],
    uq_wss_authority_scope_version: [
      'group_id',
      'settlement_period',
      'authority_version',
    ],
    uq_wss_authority_open_scope: ['open_group_id', 'open_settlement_period'],
    uq_wss_authority_active_scope: [
      'active_group_id',
      'active_settlement_period',
    ],
    uq_wss_authority_supersedes: ['approved_supersedes_authority_id'],
  },
  [REQUIRED_DOMAINS]: {
    PRIMARY: ['id'],
    uq_wss_domain_authority_domain: ['authority_id', 'business_domain'],
    uq_wss_domain_authority_order: ['authority_id', 'domain_order'],
  },
  [EVENTS]: {
    PRIMARY: ['id'],
    uq_wss_event_ref: ['event_ref'],
    uq_wss_event_once: ['authority_id', 'event_type', 'request_fingerprint'],
  },
  [CLAIMS]: {
    PRIMARY: ['idempotency_key'],
    uq_wss_claim_result: ['authority_id', 'phase'],
  },
};

const ASCII_BIN_COLUMNS = new Set([
  `${AUTHORITIES}.authority_ref`,
  `${AUTHORITIES}.required_domains_hash`,
  `${AUTHORITIES}.data_completeness_watermark_hash`,
  `${AUTHORITIES}.settlement_coverage_status`,
  `${AUTHORITIES}.enterprise_coverage_status`,
  `${AUTHORITIES}.group_target_scope_hash`,
  `${AUTHORITIES}.content_hash`,
  `${AUTHORITIES}.status`,
  `${REQUIRED_DOMAINS}.business_domain`,
  `${REQUIRED_DOMAINS}.adapter_contract_version`,
  `${REQUIRED_DOMAINS}.source_cursor`,
  `${REQUIRED_DOMAINS}.source_cursor_hash`,
  `${REQUIRED_DOMAINS}.completeness_status`,
  `${REQUIRED_DOMAINS}.watermark_hash`,
  `${REQUIRED_DOMAINS}.line_hash`,
  `${EVENTS}.event_ref`,
  `${EVENTS}.event_type`,
  `${EVENTS}.from_status`,
  `${EVENTS}.to_status`,
  `${EVENTS}.reason_code`,
  `${EVENTS}.evidence_ref`,
  `${EVENTS}.evidence_hash`,
  `${EVENTS}.request_fingerprint`,
  `${EVENTS}.authority_content_hash`,
  `${CLAIMS}.idempotency_key`,
  `${CLAIMS}.phase`,
  `${CLAIMS}.request_fingerprint`,
  `${CLAIMS}.state`,
]);

const EXPECTED_CHECK_CLAUSES: Readonly<Record<string, string>> = {
  chk_wss_mutex_period:
    "REGEXP_LIKE(settlement_period, '^20[0-9]{2}-(0[1-9]|1[0-2])$', 'c')",
  chk_wss_authority_ref:
    "REGEXP_LIKE(authority_ref, '^[0-9a-f]{64}$', 'c')",
  chk_wss_authority_period:
    "REGEXP_LIKE(settlement_period, '^20[0-9]{2}-(0[1-9]|1[0-2])$', 'c')",
  chk_wss_authority_hashes: `
    REGEXP_LIKE(required_domains_hash, '^[0-9a-f]{64}$', 'c')
    AND REGEXP_LIKE(data_completeness_watermark_hash, '^[0-9a-f]{64}$', 'c')
    AND REGEXP_LIKE(group_target_scope_hash, '^[0-9a-f]{64}$', 'c')
    AND REGEXP_LIKE(content_hash, '^[0-9a-f]{64}$', 'c')`,
  chk_wss_authority_versions: `
    authority_version > 0 AND group_target_calculation_version > 0
    AND (required_domain_count BETWEEN 1 AND 2)`,
  chk_wss_authority_coverage: `
    (settlement_complete_domain_count BETWEEN 0 AND required_domain_count)
    AND ((settlement_coverage_status = 'complete'
      AND settlement_complete_domain_count = required_domain_count)
      OR (settlement_coverage_status = 'incomplete'
      AND settlement_complete_domain_count < required_domain_count))
    AND enterprise_formal_domain_count = 4
    AND (enterprise_ready_domain_count BETWEEN 0 AND 4)
    AND ((enterprise_coverage_status = 'complete' AND enterprise_ready_domain_count = 4)
      OR (enterprise_coverage_status = 'incomplete' AND enterprise_ready_domain_count < 4))`,
  chk_wss_authority_lifecycle: `
    (status = 'draft' AND submitted_by_user_id IS NULL AND approved_by_user_id IS NULL
      AND rejected_by_user_id IS NULL AND frozen_by_user_id IS NULL
      AND superseded_by_user_id IS NULL AND submitted_at IS NULL
      AND approved_at IS NULL AND rejected_at IS NULL AND frozen_at IS NULL
      AND superseded_at IS NULL)
    OR (status = 'submitted' AND submitted_by_user_id IS NOT NULL
      AND submitted_at IS NOT NULL AND submitted_by_user_id = created_by_user_id
      AND approved_by_user_id IS NULL AND rejected_by_user_id IS NULL
      AND frozen_by_user_id IS NULL AND superseded_by_user_id IS NULL
      AND approved_at IS NULL AND rejected_at IS NULL AND frozen_at IS NULL
      AND superseded_at IS NULL)
    OR (status = 'approved' AND submitted_by_user_id IS NOT NULL
      AND submitted_at IS NOT NULL AND submitted_by_user_id = created_by_user_id
      AND approved_by_user_id IS NOT NULL AND approved_at IS NOT NULL
      AND approved_by_user_id <> created_by_user_id
      AND approved_by_user_id <> submitted_by_user_id
      AND rejected_by_user_id IS NULL AND frozen_by_user_id IS NULL
      AND superseded_by_user_id IS NULL AND rejected_at IS NULL
      AND frozen_at IS NULL AND superseded_at IS NULL)
    OR (status = 'rejected' AND submitted_by_user_id IS NOT NULL
      AND submitted_at IS NOT NULL AND submitted_by_user_id = created_by_user_id
      AND rejected_by_user_id IS NOT NULL AND rejected_at IS NOT NULL
      AND rejected_by_user_id <> created_by_user_id
      AND rejected_by_user_id <> submitted_by_user_id
      AND approved_by_user_id IS NULL AND frozen_by_user_id IS NULL
      AND superseded_by_user_id IS NULL AND approved_at IS NULL
      AND frozen_at IS NULL AND superseded_at IS NULL)
    OR (status = 'frozen' AND submitted_by_user_id IS NOT NULL
      AND submitted_at IS NOT NULL AND submitted_by_user_id = created_by_user_id
      AND approved_by_user_id IS NOT NULL AND approved_at IS NOT NULL
      AND frozen_by_user_id IS NOT NULL AND frozen_at IS NOT NULL
      AND approved_by_user_id <> created_by_user_id
      AND approved_by_user_id <> submitted_by_user_id
      AND frozen_by_user_id <> created_by_user_id
      AND frozen_by_user_id <> submitted_by_user_id
      AND rejected_by_user_id IS NULL AND superseded_by_user_id IS NULL
      AND rejected_at IS NULL AND superseded_at IS NULL)
    OR (status = 'superseded' AND submitted_by_user_id IS NOT NULL
      AND submitted_at IS NOT NULL AND submitted_by_user_id = created_by_user_id
      AND approved_by_user_id IS NOT NULL AND approved_at IS NOT NULL
      AND approved_by_user_id <> created_by_user_id
      AND approved_by_user_id <> submitted_by_user_id
      AND superseded_by_user_id IS NOT NULL AND superseded_at IS NOT NULL
      AND superseded_by_user_id <> created_by_user_id
      AND superseded_by_user_id <> submitted_by_user_id
      AND rejected_by_user_id IS NULL AND rejected_at IS NULL
      AND ((frozen_by_user_id IS NULL AND frozen_at IS NULL)
        OR (frozen_by_user_id IS NOT NULL AND frozen_at IS NOT NULL)))`,
  chk_wss_domain_identity:
    "business_domain IN ('repair','fresh') AND (domain_order BETWEEN 1 AND 2)",
  chk_wss_domain_period:
    "REGEXP_LIKE(settlement_period, '^20[0-9]{2}-(0[1-9]|1[0-2])$', 'c')",
  chk_wss_domain_source: `
    (CHAR_LENGTH(adapter_contract_version) BETWEEN 1 AND 64)
    AND (CHAR_LENGTH(source_cursor) BETWEEN 1 AND 191)`,
  chk_wss_domain_hashes: `
    REGEXP_LIKE(source_cursor_hash, '^[0-9a-f]{64}$', 'c')
    AND REGEXP_LIKE(watermark_hash, '^[0-9a-f]{64}$', 'c')
    AND REGEXP_LIKE(line_hash, '^[0-9a-f]{64}$', 'c')`,
  chk_wss_domain_completeness: `
    unresolved_cost_count >= 0 AND unresolved_refund_count >= 0
    AND unresolved_attribution_count >= 0 AND unresolved_duplicate_count >= 0
    AND ((completeness_status = 'complete' AND unresolved_cost_count = 0
      AND unresolved_refund_count = 0 AND unresolved_attribution_count = 0
      AND unresolved_duplicate_count = 0)
      OR (completeness_status = 'incomplete' AND (unresolved_cost_count > 0
        OR unresolved_refund_count > 0 OR unresolved_attribution_count > 0
        OR unresolved_duplicate_count > 0)))`,
  chk_wss_event_ref: "REGEXP_LIKE(event_ref, '^[0-9a-f]{64}$', 'c')",
  chk_wss_event_hashes: `
    REGEXP_LIKE(evidence_ref, '^evidence:[0-9a-f]{64}$', 'c')
    AND REGEXP_LIKE(evidence_hash, '^[0-9a-f]{64}$', 'c')
    AND REGEXP_LIKE(request_fingerprint, '^[0-9a-f]{64}$', 'c')
    AND REGEXP_LIKE(authority_content_hash, '^[0-9a-f]{64}$', 'c')`,
  chk_wss_event_transition: `
    (event_type = 'drafted' AND from_status IS NULL AND to_status = 'draft')
    OR (event_type = 'submitted' AND from_status = 'draft' AND to_status = 'submitted')
    OR (event_type = 'approved' AND from_status = 'submitted' AND to_status = 'approved')
    OR (event_type = 'rejected' AND from_status = 'submitted' AND to_status = 'rejected')
    OR (event_type = 'frozen' AND from_status = 'approved' AND to_status = 'frozen')
    OR (event_type = 'superseded' AND from_status IN ('approved','frozen')
      AND to_status = 'superseded')`,
  chk_wss_claim_key: `
    REGEXP_LIKE(idempotency_key, '^wage-scope-idempotency:[0-9a-f]{64}$', 'c')
    AND phase IN ('draft','submit','approve','reject','freeze','supersede')`,
  chk_wss_claim_hash:
    "REGEXP_LIKE(request_fingerprint, '^[0-9a-f]{64}$', 'c')",
  chk_wss_claim_result: `
    (state = 'claimed' AND authority_id IS NULL AND lifecycle_event_id IS NULL
      AND completed_at IS NULL)
    OR (state = 'completed' AND authority_id IS NOT NULL
      AND lifecycle_event_id IS NOT NULL AND completed_at IS NOT NULL)`,
};

const EXPECTED_FOREIGN_KEYS: Readonly<Record<
  string,
  readonly [Table0071, readonly string[], string, readonly string[]]
>> = {
  fk_wss_mutex_group: [MUTEXES, ['group_id'], 'organization_groups', ['id']],
  fk_wss_mutex_actor: [MUTEXES, ['created_by_user_id'], 'users', ['id']],
  fk_wss_authority_group: [AUTHORITIES, ['group_id'], 'organization_groups', ['id']],
  fk_wss_authority_group_target_exact: [
    AUTHORITIES,
    ['group_target_id', 'group_id', 'settlement_period', 'group_target_calculation_version'],
    GROUP_TARGETS,
    ['id', 'group_id', 'settlement_period', 'calculation_version'],
  ],
  fk_wss_authority_supersedes: [
    AUTHORITIES,
    ['supersedes_authority_id', 'group_id', 'settlement_period'],
    AUTHORITIES,
    ['id', 'group_id', 'settlement_period'],
  ],
  fk_wss_authority_created_by: [AUTHORITIES, ['created_by_user_id'], 'users', ['id']],
  fk_wss_authority_submitted_by: [AUTHORITIES, ['submitted_by_user_id'], 'users', ['id']],
  fk_wss_authority_approved_by: [AUTHORITIES, ['approved_by_user_id'], 'users', ['id']],
  fk_wss_authority_rejected_by: [AUTHORITIES, ['rejected_by_user_id'], 'users', ['id']],
  fk_wss_authority_frozen_by: [AUTHORITIES, ['frozen_by_user_id'], 'users', ['id']],
  fk_wss_authority_superseded_by: [AUTHORITIES, ['superseded_by_user_id'], 'users', ['id']],
  fk_wss_domain_authority_scope: [
    REQUIRED_DOMAINS,
    ['authority_id', 'group_id', 'settlement_period'],
    AUTHORITIES,
    ['id', 'group_id', 'settlement_period'],
  ],
  fk_wss_event_authority: [EVENTS, ['authority_id'], AUTHORITIES, ['id']],
  fk_wss_event_actor: [EVENTS, ['actor_user_id'], 'users', ['id']],
  fk_wss_claim_actor: [CLAIMS, ['actor_user_id'], 'users', ['id']],
  fk_wss_claim_authority: [CLAIMS, ['authority_id'], AUTHORITIES, ['id']],
  fk_wss_claim_event: [CLAIMS, ['lifecycle_event_id'], EVENTS, ['id']],
};

export class AddRepairFreshScopedWageStatisticsAuthority00711792400000000
implements MigrationInterface {
  name = 'AddRepairFreshScopedWageStatisticsAuthority00711792400000000';

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
      await this.assertRecoverableBindingIndex(queryRunner);
      await this.dropExistingInReverseOrder(queryRunner, states);
    } else {
      await this.assertBindingIndexAbsentForFreshInstall(queryRunner);
    }
    await this.createMutexes(queryRunner);
    await this.ensureExactGroupTargetBindingIndex(queryRunner);
    await this.createAuthorities(queryRunner);
    await this.createRequiredDomainLines(queryRunner);
    await this.createEvents(queryRunner);
    await this.createClaims(queryRunner);
    await this.assertComplete(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    this.assertMysql(queryRunner);
    const states = await this.tableStates(queryRunner);
    const hasOwnedState = states.some((state) => state.exists);
    if (hasOwnedState) await this.assertExactBindingIndexForDown(queryRunner);
    for (const state of states) {
      if (!state.exists) continue;
      await this.assertOwned(queryRunner, state.table);
      await this.assertEmpty(queryRunner, state.table, 'down');
    }
    await this.dropExistingInReverseOrder(queryRunner, states);
    if (hasOwnedState) await this.dropExactGroupTargetBindingIndex(queryRunner);
  }

  private async assertExactBindingIndexForDown(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const named = (await this.indexRows(queryRunner, GROUP_TARGETS)).filter(
      (row) => row.index_name === GROUP_TARGET_BINDING_INDEX,
    );
    if (named.length === 0) {
      throw new Error(
        'wage_statistics_scope_0071_down_target_binding_index_missing',
      );
    }
    this.assertExactBindingIndexRows(named);
  }

  private assertMysql(queryRunner: QueryRunner): void {
    if (queryRunner.connection.options.type !== 'mysql') {
      throw new Error('wage_statistics_scope_0071_mysql_required');
    }
  }

  private async assertPrerequisites(queryRunner: QueryRunner): Promise<void> {
    const required: Readonly<Record<string, readonly string[]>> = {
      users: ['id'],
      organization_groups: ['id'],
      group_targets: [
        'id',
        'group_id',
        'settlement_period',
        'calculation_version',
        'calculation_status',
        'locked_at',
        'request_fingerprint',
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
        throw new Error(`wage_statistics_scope_0071_prerequisite_missing:${table}`);
      }
    }
    await this.assertAnyUniqueIndex(
      queryRunner,
      GROUP_TARGETS,
      ['group_id', 'settlement_period', 'calculation_version'],
      'wage_statistics_scope_0071_target_scope_key_missing',
    );
    const fingerprint = await queryRunner.query(
      `SELECT COLUMN_TYPE AS column_type, IS_NULLABLE AS is_nullable,
              COLUMN_DEFAULT AS column_default, CHARACTER_SET_NAME AS character_set_name,
              COLLATION_NAME AS collation_name
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'group_targets'
          AND COLUMN_NAME = 'request_fingerprint'`,
    ) as Array<{
      column_type: string;
      is_nullable: string;
      column_default: unknown;
      character_set_name: string | null;
      collation_name: string | null;
    }>;
    if (
      fingerprint.length !== 1 ||
      fingerprint[0].column_type.toLowerCase() !== 'char(64)' ||
      fingerprint[0].is_nullable !== 'NO' ||
      fingerprint[0].column_default != null ||
      fingerprint[0].character_set_name !== 'utf8mb4' ||
      fingerprint[0].collation_name !== 'utf8mb4_unicode_ci'
    ) {
      throw new Error('wage_statistics_scope_0071_target_fingerprint_signature_invalid');
    }
    const checks = await queryRunner.query(
      `SELECT tc.ENFORCED AS enforced, cc.CHECK_CLAUSE AS check_clause
         FROM information_schema.TABLE_CONSTRAINTS tc
         JOIN information_schema.CHECK_CONSTRAINTS cc
           ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
          AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
        WHERE tc.CONSTRAINT_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'group_targets'
          AND tc.CONSTRAINT_NAME = 'chk_group_target_request_fingerprint'
          AND tc.CONSTRAINT_TYPE = 'CHECK'`,
    ) as Array<{ enforced: string; check_clause: string }>;
    if (
      checks.length !== 1 ||
      checks[0].enforced !== 'YES' ||
      !this.isExactFingerprintCheck(checks[0].check_clause)
    ) {
      throw new Error('wage_statistics_scope_0071_target_fingerprint_check_invalid');
    }
  }

  private isExactFingerprintCheck(clause: string): boolean {
    if (clause.toLowerCase().includes('_ascii')) return false;
    const normalized = this.normalizeSqlDefinition(clause);
    return normalized === this.normalizeSqlDefinition(
      "request_fingerprint REGEXP '^[0-9a-f]{64}$'",
    ) || normalized === this.normalizeSqlDefinition(
      "REGEXP_LIKE(request_fingerprint, '^[0-9a-f]{64}$')",
    );
  }

  private isExactGeneratedMetadata(columnName: string, value: unknown): boolean {
    const expected = GENERATED_EXPRESSIONS[columnName];
    return expected != null &&
      this.normalizeSqlDefinition(value) === this.normalizeSqlDefinition(expected);
  }

  private async assertBindingIndexAbsentForFreshInstall(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const named = (await this.indexRows(queryRunner, GROUP_TARGETS)).filter(
      (row) => row.index_name === GROUP_TARGET_BINDING_INDEX,
    );
    if (named.length === 0) return;
    this.assertExactBindingIndexRows(named);
    throw new Error('wage_statistics_scope_0071_target_binding_index_preexisting');
  }

  private async assertRecoverableBindingIndex(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const named = (await this.indexRows(queryRunner, GROUP_TARGETS)).filter(
      (row) => row.index_name === GROUP_TARGET_BINDING_INDEX,
    );
    if (named.length === 0) return;
    this.assertExactBindingIndexRows(named);
  }

  private async assertAnyUniqueIndex(
    queryRunner: QueryRunner,
    table: string,
    columns: readonly string[],
    errorCode: string,
  ): Promise<void> {
    const rows = await this.indexRows(queryRunner, table);
    if (
      !rows.some(
        (row) =>
          Number(row.non_unique) === 0 &&
          row.columns_csv === columns.join(','),
      )
    ) {
      throw new Error(errorCode);
    }
  }

  private async ensureExactGroupTargetBindingIndex(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const named = (await this.indexRows(queryRunner, GROUP_TARGETS)).filter(
      (row) => row.index_name === GROUP_TARGET_BINDING_INDEX,
    );
    if (named.length === 0) {
      await queryRunner.query(
        `ALTER TABLE \`${GROUP_TARGETS}\`
           ADD UNIQUE KEY \`${GROUP_TARGET_BINDING_INDEX}\`
             (\`id\`, \`group_id\`, \`settlement_period\`, \`calculation_version\`)`,
      );
      return;
    }
    this.assertExactBindingIndexRows(named);
  }

  private async dropExactGroupTargetBindingIndex(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const named = (await this.indexRows(queryRunner, GROUP_TARGETS)).filter(
      (row) => row.index_name === GROUP_TARGET_BINDING_INDEX,
    );
    if (named.length === 0) return;
    this.assertExactBindingIndexRows(named);
    await queryRunner.query(
      `ALTER TABLE \`${GROUP_TARGETS}\` DROP INDEX \`${GROUP_TARGET_BINDING_INDEX}\``,
    );
  }

  private assertExactBindingIndexRows(
    rows: ReadonlyArray<{
      index_name: string;
      non_unique: string | number;
      columns_csv: string;
    }>,
  ): void {
    if (
      rows.length !== 1 ||
      Number(rows[0].non_unique) !== 0 ||
      rows[0].columns_csv !== GROUP_TARGET_BINDING_COLUMNS.join(',')
    ) {
      throw new Error('wage_statistics_scope_0071_target_binding_index_conflict');
    }
  }

  private async indexRows(
    queryRunner: QueryRunner,
    table: string,
  ): Promise<Array<{
    index_name: string;
    non_unique: string | number;
    columns_csv: string;
  }>> {
    return queryRunner.query(
      `SELECT INDEX_NAME AS index_name, NON_UNIQUE AS non_unique,
              GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS columns_csv
         FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        GROUP BY INDEX_NAME, NON_UNIQUE`,
      [table],
    );
  }

  private async tableStates(queryRunner: QueryRunner): Promise<TableState0071[]> {
    const rows = await queryRunner.query(
      `SELECT TABLE_NAME AS table_name
         FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN (${REPAIR_FRESH_SCOPED_WAGE_STATISTICS_0071_TABLES.map(() => '?').join(',')})`,
      [...REPAIR_FRESH_SCOPED_WAGE_STATISTICS_0071_TABLES],
    ) as Array<{ table_name: string }>;
    const existing = new Set(rows.map((row) => row.table_name));
    return REPAIR_FRESH_SCOPED_WAGE_STATISTICS_0071_TABLES.map((table) => ({
      table,
      exists: existing.has(table),
    }));
  }

  private async assertOwnedAndEmptyPartialState(
    queryRunner: QueryRunner,
    states: readonly TableState0071[],
  ): Promise<void> {
    for (const state of states) {
      if (!state.exists) continue;
      await this.assertOwned(queryRunner, state.table);
      await this.assertEmpty(queryRunner, state.table, 'partial');
    }
  }

  private async assertOwned(
    queryRunner: QueryRunner,
    table: Table0071,
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
      throw new Error(`wage_statistics_scope_0071_ownership_conflict:${table}`);
    }
  }

  private async assertEmpty(
    queryRunner: QueryRunner,
    table: Table0071,
    phase: 'partial' | 'down',
  ): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS row_count FROM \`${table}\``,
    );
    if (BigInt(String(rows[0]?.row_count ?? '0')) !== 0n) {
      throw new Error(`wage_statistics_scope_0071_${phase}_non_empty:${table}`);
    }
  }

  private async dropExistingInReverseOrder(
    queryRunner: QueryRunner,
    states: readonly TableState0071[],
  ): Promise<void> {
    const existing = new Set(
      states.filter((state) => state.exists).map((state) => state.table),
    );
    for (const table of [
      ...REPAIR_FRESH_SCOPED_WAGE_STATISTICS_0071_TABLES,
    ].reverse()) {
      if (existing.has(table)) {
        await queryRunner.query(`DROP TABLE \`${table}\``);
      }
    }
  }

  private async assertComplete(queryRunner: QueryRunner): Promise<void> {
    const states = await this.tableStates(queryRunner);
    if (!states.every((state) => state.exists)) {
      throw new Error('wage_statistics_scope_0071_schema_incomplete');
    }
    const namedIndex = (await this.indexRows(queryRunner, GROUP_TARGETS)).filter(
      (row) => row.index_name === GROUP_TARGET_BINDING_INDEX,
    );
    this.assertExactBindingIndexRows(namedIndex);
    for (const { table } of states) {
      await this.assertOwned(queryRunner, table);
      const columns = await queryRunner.query(
        `SELECT COLUMN_NAME AS column_name, COLUMN_TYPE AS column_type,
                IS_NULLABLE AS is_nullable, COLUMN_DEFAULT AS column_default,
                EXTRA AS extra, GENERATION_EXPRESSION AS generation_expression,
                CHARACTER_SET_NAME AS character_set_name,
                COLLATION_NAME AS collation_name
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION`,
        [table],
      ) as Array<{
        column_name: string;
        column_type: string;
        is_nullable: string;
        column_default: unknown;
        extra: string;
        generation_expression: string;
        character_set_name: string | null;
        collation_name: string | null;
      }>;
      const actualColumns = columns.map((row) => row.column_name);
      if (JSON.stringify(actualColumns) !== JSON.stringify(EXPECTED_COLUMNS[table])) {
        throw new Error(`wage_statistics_scope_0071_columns_incompatible:${table}`);
      }
      const nullable = new Set(NULLABLE_COLUMNS[table]);
      columns.forEach((column, index) => {
        const expectedName = EXPECTED_COLUMNS[table][index];
        const expectedType = EXPECTED_COLUMN_TYPES[table][index];
        const expectedNullable = nullable.has(expectedName) ? 'YES' : 'NO';
        const expectedDefault = expectedName === 'created_at' ? 'CURRENT_TIMESTAMP(6)' : null;
        const actualDefault = column.column_default == null
          ? null
          : String(column.column_default).toUpperCase();
        const generated = GENERATED_EXPRESSIONS[expectedName];
        const actualGeneration = String(column.generation_expression ?? '');
        const generationMismatch = generated == null
          ? actualGeneration.trim() !== ''
          : !this.isExactGeneratedMetadata(expectedName, actualGeneration);
        const extra = String(column.extra ?? '').toUpperCase().trim();
        const expectedAutoIncrement =
          expectedName === 'id' && table !== CLAIMS;
        const expectedStringColumn = /^(?:char|varchar)\(/.test(expectedType);
        const expectedAscii = ASCII_BIN_COLUMNS.has(`${table}.${expectedName}`);
        const expectedCharacterSet = expectedStringColumn
          ? expectedAscii ? 'ascii' : 'utf8mb4'
          : null;
        const expectedCollation = expectedStringColumn
          ? expectedAscii ? 'ascii_bin' : 'utf8mb4_unicode_ci'
          : null;
        const allowedExtra = expectedAutoIncrement
          ? extra === 'AUTO_INCREMENT'
          : generated != null
            ? extra === 'STORED GENERATED'
            : expectedName === 'created_at'
              ? extra === '' || extra === 'DEFAULT_GENERATED'
              : extra === '';
        if (
          column.column_type.toLowerCase() !== expectedType ||
          column.is_nullable !== expectedNullable ||
          actualDefault !== expectedDefault ||
          column.character_set_name !== expectedCharacterSet ||
          column.collation_name !== expectedCollation ||
          !allowedExtra ||
          generationMismatch
        ) {
          throw new Error(
            `wage_statistics_scope_0071_column_signature_incompatible:${table}:${expectedName}`,
          );
        }
      });
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
        throw new Error(`wage_statistics_scope_0071_constraints_incompatible:${table}`);
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
        throw new Error(`wage_statistics_scope_0071_check_not_enforced:${table}`);
      }
    }
    await this.assertExactCheckDefinitions(queryRunner);
    await this.assertExactForeignKeys(queryRunner);
    await this.assertExactUniqueIndexes(queryRunner);
  }

  private isMysql0071EscapedMetadataLiteral(value: string): boolean {
    switch (value) {
      case '^20[0-9]{2}-(0[1-9]|1[0-2])$':
      case '^[0-9a-f]{64}$':
      case '^evidence:[0-9a-f]{64}$':
      case '^wage-scope-idempotency:[0-9a-f]{64}$':
      case 'c':
      case 'complete':
      case 'incomplete':
      case 'draft':
      case 'drafted':
      case 'submit':
      case 'approve':
      case 'reject':
      case 'freeze':
      case 'supersede':
      case 'submitted':
      case 'approved':
      case 'rejected':
      case 'frozen':
      case 'superseded':
      case 'repair':
      case 'fresh':
      case 'claimed':
      case 'completed':
        return true;
      default:
        return false;
    }
  }

  private decodeMysql0071EscapedMetadataLiterals(
    raw: string,
  ): Readonly<{ text: string; opaque: boolean }> {
    let output = '';
    let index = 0;
    while (index < raw.length) {
      const prefix = raw.startsWith(MYSQL_0071_UTF8MB4_ESCAPED_LITERAL_PREFIX, index)
        ? MYSQL_0071_UTF8MB4_ESCAPED_LITERAL_PREFIX
        : raw.startsWith(MYSQL_0071_ASCII_ESCAPED_LITERAL_PREFIX, index)
          ? MYSQL_0071_ASCII_ESCAPED_LITERAL_PREFIX
          : null;
      if (prefix) {
        const before = index === 0 ? '' : raw[index - 1];
        if (before && !/[\s(,=]/.test(before)) return { text: raw, opaque: true };
        const valueStart = index + prefix.length;
        const close = raw.indexOf("\\'", valueStart);
        if (close < 0) return { text: raw, opaque: true };
        const literal = raw.slice(valueStart, close);
        const end = close + 2;
        const after = raw[end] ?? '';
        if (
          !this.isMysql0071EscapedMetadataLiteral(literal) ||
          (after && !/[\s),]/.test(after))
        ) {
          return { text: raw, opaque: true };
        }
        output += `'${literal}'`;
        index = end;
        continue;
      }

      const character = raw[index];
      if (character === "'" || character === '"' || character === '`') {
        const quote = character;
        const start = index;
        index += 1;
        let closed = false;
        while (index < raw.length) {
          if (raw[index] === '\\' && quote !== '`') {
            return { text: raw, opaque: true };
          }
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
        if (!closed) return { text: raw, opaque: true };
        output += raw.slice(start, index);
        continue;
      }
      if (character === '\\') return { text: raw, opaque: true };
      output += character;
      index += 1;
    }
    return { text: output, opaque: false };
  }

  private sqlCharsetIntroducerLength(raw: string, index: number): number {
    const prefix = raw.startsWith('_utf8mb4', index)
      ? '_utf8mb4'
      : raw.startsWith('_ascii', index)
        ? '_ascii'
        : null;
    if (!prefix || raw[index + prefix.length] !== "'") return 0;
    const before = index === 0 ? '' : raw[index - 1];
    if (before && !/[\s(,=]/.test(before)) return 0;
    let cursor = index + prefix.length + 1;
    while (cursor < raw.length) {
      const character = raw[cursor];
      if (character === '\\' || character.charCodeAt(0) > 0x7f) return 0;
      if (character === "'") {
        if (raw[cursor + 1] === "'") {
          cursor += 2;
          continue;
        }
        return prefix.length;
      }
      cursor += 1;
    }
    return 0;
  }

  private normalizeSqlDefinitionLexemes(value: string): string | null {
    const decoded = this.decodeMysql0071EscapedMetadataLiterals(value);
    if (decoded.opaque) return null;
    const raw = decoded.text;
    let output = '';
    let previousTokenKind: 'atom' | 'operator' | 'punctuation' | null = null;
    const appendToken = (
      token: string,
      kind: 'atom' | 'operator' | 'punctuation',
    ): void => {
      if (
        (previousTokenKind === 'atom' && kind === 'atom') ||
        (previousTokenKind === 'operator' && kind === 'operator')
      ) {
        output += ' ';
      }
      output += token;
      previousTokenKind = kind;
    };
    let index = 0;
    while (index < raw.length) {
      const character = raw[index];
      if (/\s/.test(character)) {
        index += 1;
        continue;
      }
      const introducerLength = this.sqlCharsetIntroducerLength(raw, index);
      if (introducerLength > 0) {
        index += introducerLength;
        continue;
      }
      if (character === "'") {
        const start = index;
        index += 1;
        let closed = false;
        while (index < raw.length) {
          if (raw[index] === '\\') return null;
          if (raw[index] === "'") {
            if (raw[index + 1] === "'") {
              index += 2;
              continue;
            }
            index += 1;
            closed = true;
            break;
          }
          index += 1;
        }
        if (!closed) return null;
        appendToken(raw.slice(start, index), 'atom');
        continue;
      }
      if (character === '`') {
        const close = raw.indexOf('`', index + 1);
        if (close < 0 || raw[close + 1] === '`') return null;
        const identifier = raw.slice(index + 1, close);
        const canonical = identifier.toLowerCase();
        const before = index === 0 ? '' : raw[index - 1];
        const after = raw[close + 1] ?? '';
        if (
          !/^[A-Za-z_][A-Za-z0-9_$]*$/.test(identifier) ||
          /[A-Za-z0-9_$]/.test(before) ||
          /[A-Za-z0-9_$]/.test(after) ||
          !SQL_DEFINITION_IDENTIFIERS_0071.has(canonical)
        ) {
          return null;
        }
        appendToken(canonical, 'atom');
        index = close + 1;
        continue;
      }
      if (character === '"' || character === '\\') return null;
      if (/[A-Za-z_]/.test(character)) {
        let end = index + 1;
        while (end < raw.length && /[A-Za-z0-9_$]/.test(raw[end])) end += 1;
        const word = raw.slice(index, end).toLowerCase();
        appendToken(word === 'and' ? '&&' : word === 'or' ? '||' : word,
          word === 'and' || word === 'or' ? 'operator' : 'atom');
        index = end;
        continue;
      }
      if (/[0-9]/.test(character)) {
        let end = index + 1;
        while (end < raw.length && /[0-9]/.test(raw[end])) end += 1;
        appendToken(raw.slice(index, end), 'atom');
        index = end;
        continue;
      }
      if (character === '(' || character === ')' || character === ',') {
        appendToken(character, 'punctuation');
        index += 1;
        continue;
      }
      const operator = raw.slice(index).match(/^(?:>=|<=|<>|!=|&&|\|\||[=<>+\-*/])/u)?.[0];
      if (!operator) return null;
      appendToken(operator, 'operator');
      index += operator.length;
    }
    return output;
  }

  private normalizeSqlDefinition(value: unknown): string {
    const raw = String(value ?? '');
    let normalized = this.normalizeSqlDefinitionLexemes(raw);
    if (normalized == null) return `wss_sql_definition_opaque:${raw}`;
    normalized = this.stripFullyWrappingParentheses(normalized);
    let changed = true;
    while (changed) {
      changed = false;
      const stack: number[] = [];
      let quoted = false;
      for (let index = 0; index < normalized.length; index += 1) {
        const character = normalized[index];
        if (character === "'") {
          if (quoted && normalized[index + 1] === "'") {
            index += 1;
            continue;
          }
          quoted = !quoted;
          continue;
        }
        if (quoted) continue;
        if (character === '(') stack.push(index);
        if (character !== ')') continue;
        const open = stack.pop();
        if (open == null || !this.isSqlGroupingParenthesis(normalized, open)) continue;
        const inner = normalized.slice(open + 1, index);
        const unwrappedInner = this.stripFullyWrappingParentheses(inner);
        if (unwrappedInner !== inner) {
          normalized = this.joinSqlCanonicalFragments(
            normalized.slice(0, open),
            unwrappedInner,
            normalized.slice(index + 1),
          );
          normalized = this.stripFullyWrappingParentheses(normalized);
          changed = true;
          break;
        }
        if (this.hasTopLevelStructuralOperator(inner)) continue;
        normalized = this.joinSqlCanonicalFragments(
          normalized.slice(0, open),
          inner,
          normalized.slice(index + 1),
        );
        normalized = this.stripFullyWrappingParentheses(normalized);
        changed = true;
        break;
      }
    }
    return normalized;
  }

  private joinSqlCanonicalFragments(...fragments: string[]): string {
    let joined = '';
    for (const fragment of fragments) {
      if (fragment.length === 0) continue;
      const left = joined[joined.length - 1] ?? '';
      const right = fragment[0] ?? '';
      if (
        (/[A-Za-z0-9_$']/.test(left) && /[A-Za-z0-9_$']/.test(right)) ||
        (/[=<>+\-*/&|!]/.test(left) && /[=<>+\-*/&|!]/.test(right))
      ) {
        joined += ' ';
      }
      joined += fragment;
    }
    return joined;
  }

  private stripFullyWrappingParentheses(value: string): string {
    let current = value;
    while (current.startsWith('(') && current.endsWith(')')) {
      let depth = 0;
      let quoted = false;
      let wrapsAll = true;
      for (let index = 0; index < current.length; index += 1) {
        const character = current[index];
        if (character === "'") {
          if (quoted && current[index + 1] === "'") {
            index += 1;
            continue;
          }
          quoted = !quoted;
          continue;
        }
        if (quoted) continue;
        if (character === '(') depth += 1;
        if (character === ')') depth -= 1;
        if (depth === 0 && index < current.length - 1) {
          wrapsAll = false;
          break;
        }
      }
      if (!wrapsAll || depth !== 0 || quoted) break;
      current = current.slice(1, -1);
    }
    return current;
  }

  private isSqlGroupingParenthesis(value: string, open: number): boolean {
    if (
      open === 0 ||
      value[open - 1] === '(' ||
      value[open - 1] === ',' ||
      value[open - 1] === '&' ||
      value[open - 1] === '|'
    ) return true;
    let cursor = open - 1;
    while (cursor >= 0 && /[a-z0-9_]/.test(value[cursor])) cursor -= 1;
    const precedingWord = value.slice(cursor + 1, open);
    return precedingWord === 'and' || precedingWord === 'or' || precedingWord === 'not';
  }

  private hasTopLevelStructuralOperator(value: string): boolean {
    let depth = 0;
    let quoted = false;
    for (let index = 0; index < value.length; index += 1) {
      const character = value[index];
      if (character === "'") {
        if (quoted && value[index + 1] === "'") {
          index += 1;
          continue;
        }
        quoted = !quoted;
        continue;
      }
      if (quoted) continue;
      if (character === '(') depth += 1;
      if (character === ')') depth -= 1;
      if (depth !== 0) continue;
      if ('+-*/'.includes(character)) return true;
      if (value.startsWith('&&', index) || value.startsWith('||', index)) return true;
    }
    return false;
  }

  private isExactCheckMetadata(constraintName: string, value: unknown): boolean {
    const expected = EXPECTED_CHECK_CLAUSES[constraintName];
    return expected != null &&
      this.normalizeSqlDefinition(value) === this.normalizeSqlDefinition(expected);
  }

  private async assertExactCheckDefinitions(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT tc.CONSTRAINT_NAME AS constraint_name, tc.ENFORCED AS enforced,
              cc.CHECK_CLAUSE AS check_clause
         FROM information_schema.TABLE_CONSTRAINTS tc
         JOIN information_schema.CHECK_CONSTRAINTS cc
           ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
          AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
        WHERE tc.CONSTRAINT_SCHEMA = DATABASE()
          AND tc.TABLE_NAME IN (${REPAIR_FRESH_SCOPED_WAGE_STATISTICS_0071_TABLES.map(() => '?').join(',')})
          AND tc.CONSTRAINT_TYPE = 'CHECK'
        ORDER BY tc.CONSTRAINT_NAME`,
      [...REPAIR_FRESH_SCOPED_WAGE_STATISTICS_0071_TABLES],
    ) as Array<{ constraint_name: string; enforced: string; check_clause: string }>;
    const expectedNames = Object.keys(EXPECTED_CHECK_CLAUSES).sort();
    if (JSON.stringify(rows.map((row) => row.constraint_name)) !== JSON.stringify(expectedNames)) {
      throw new Error('wage_statistics_scope_0071_check_definition_set_incompatible');
    }
    const incompatible = rows.filter((row) =>
      row.enforced !== 'YES' ||
      !this.isExactCheckMetadata(row.constraint_name, row.check_clause));
    if (incompatible.length > 0) {
      throw new Error(
        `wage_statistics_scope_0071_check_definition_incompatible:` +
          incompatible[0].constraint_name,
      );
    }
  }

  private async assertExactForeignKeys(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT k.TABLE_NAME AS table_name, k.CONSTRAINT_NAME AS constraint_name,
              GROUP_CONCAT(k.COLUMN_NAME ORDER BY k.ORDINAL_POSITION SEPARATOR ',') AS child_columns,
              k.REFERENCED_TABLE_NAME AS referenced_table,
              GROUP_CONCAT(k.REFERENCED_COLUMN_NAME ORDER BY k.ORDINAL_POSITION SEPARATOR ',') AS parent_columns,
              r.UPDATE_RULE AS update_rule, r.DELETE_RULE AS delete_rule
         FROM information_schema.KEY_COLUMN_USAGE k
         JOIN information_schema.REFERENTIAL_CONSTRAINTS r
           ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
          AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
        WHERE k.CONSTRAINT_SCHEMA = DATABASE()
          AND k.TABLE_NAME IN (${REPAIR_FRESH_SCOPED_WAGE_STATISTICS_0071_TABLES.map(() => '?').join(',')})
          AND k.REFERENCED_TABLE_NAME IS NOT NULL
        GROUP BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.REFERENCED_TABLE_NAME,
                 r.UPDATE_RULE, r.DELETE_RULE
        ORDER BY k.CONSTRAINT_NAME`,
      [...REPAIR_FRESH_SCOPED_WAGE_STATISTICS_0071_TABLES],
    ) as Array<{
      table_name: Table0071;
      constraint_name: string;
      child_columns: string;
      referenced_table: string;
      parent_columns: string;
      update_rule: string;
      delete_rule: string;
    }>;
    const expectedNames = Object.keys(EXPECTED_FOREIGN_KEYS).sort();
    if (JSON.stringify(rows.map((row) => row.constraint_name)) !== JSON.stringify(expectedNames)) {
      throw new Error('wage_statistics_scope_0071_foreign_key_set_incompatible');
    }
    for (const row of rows) {
      const expected = EXPECTED_FOREIGN_KEYS[row.constraint_name];
      if (
        row.table_name !== expected[0] ||
        row.child_columns !== expected[1].join(',') ||
        row.referenced_table !== expected[2] ||
        row.parent_columns !== expected[3].join(',') ||
        row.update_rule !== 'RESTRICT' ||
        row.delete_rule !== 'RESTRICT'
      ) {
        throw new Error(
          `wage_statistics_scope_0071_foreign_key_incompatible:${row.constraint_name}`,
        );
      }
    }
  }

  private async assertExactUniqueIndexes(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query(
      `SELECT TABLE_NAME AS table_name, INDEX_NAME AS index_name,
              NON_UNIQUE AS non_unique,
              GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS columns_csv
         FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN (${REPAIR_FRESH_SCOPED_WAGE_STATISTICS_0071_TABLES.map(() => '?').join(',')})
          AND NON_UNIQUE = 0
        GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
        ORDER BY TABLE_NAME, INDEX_NAME`,
      [...REPAIR_FRESH_SCOPED_WAGE_STATISTICS_0071_TABLES],
    ) as Array<{
      table_name: Table0071;
      index_name: string;
      non_unique: string | number;
      columns_csv: string;
    }>;
    const actual = new Map(
      rows.map((row) => [`${row.table_name}.${row.index_name}`, row]),
    );
    const expected = new Map<string, readonly string[]>();
    for (const table of REPAIR_FRESH_SCOPED_WAGE_STATISTICS_0071_TABLES) {
      for (const [indexName, columns] of Object.entries(
        EXPECTED_UNIQUE_INDEXES[table],
      )) {
        expected.set(`${table}.${indexName}`, columns);
      }
    }
    if (
      JSON.stringify([...actual.keys()].sort()) !==
      JSON.stringify([...expected.keys()].sort())
    ) {
      throw new Error('wage_statistics_scope_0071_unique_index_set_incompatible');
    }
    for (const [key, columns] of expected) {
      const row = actual.get(key);
      if (
        row == null ||
        Number(row.non_unique) !== 0 ||
        row.columns_csv !== columns.join(',')
      ) {
        throw new Error(`wage_statistics_scope_0071_unique_index_incompatible:${key}`);
      }
    }
  }

  private async createMutexes(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`${MUTEXES}\` (
        \`group_id\` INT NOT NULL,
        \`settlement_period\` CHAR(7) NOT NULL,
        \`created_by_user_id\` INT NOT NULL,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`group_id\`, \`settlement_period\`),
        KEY \`idx_wss_mutex_actor\` (\`created_by_user_id\`),
        CONSTRAINT \`fk_wss_mutex_group\`
          FOREIGN KEY (\`group_id\`) REFERENCES \`organization_groups\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_wss_mutex_actor\`
          FOREIGN KEY (\`created_by_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`chk_wss_mutex_period\` CHECK (
          REGEXP_LIKE(\`settlement_period\`, '^20[0-9]{2}-(0[1-9]|1[0-2])$', 'c')
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='${OWNERSHIP_COMMENTS[MUTEXES]}'
    `);
  }

  private async createAuthorities(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`${AUTHORITIES}\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`authority_ref\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`group_id\` INT NOT NULL,
        \`settlement_period\` CHAR(7) NOT NULL,
        \`authority_version\` INT NOT NULL,
        \`supersedes_authority_id\` BIGINT NULL,
        \`group_target_id\` INT NOT NULL,
        \`group_target_calculation_version\` INT NOT NULL,
        \`required_domain_count\` INT NOT NULL,
        \`required_domains_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`data_completeness_watermark_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`settlement_complete_domain_count\` INT NOT NULL,
        \`settlement_coverage_status\` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`enterprise_formal_domain_count\` INT NOT NULL,
        \`enterprise_ready_domain_count\` INT NOT NULL,
        \`enterprise_coverage_status\` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`group_target_scope_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`content_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`status\` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`created_by_user_id\` INT NOT NULL,
        \`submitted_by_user_id\` INT NULL,
        \`approved_by_user_id\` INT NULL,
        \`rejected_by_user_id\` INT NULL,
        \`frozen_by_user_id\` INT NULL,
        \`superseded_by_user_id\` INT NULL,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`submitted_at\` DATETIME(6) NULL,
        \`approved_at\` DATETIME(6) NULL,
        \`rejected_at\` DATETIME(6) NULL,
        \`frozen_at\` DATETIME(6) NULL,
        \`superseded_at\` DATETIME(6) NULL,
        \`open_group_id\` INT
          GENERATED ALWAYS AS (
            CASE WHEN \`status\` IN ('draft','submitted') THEN \`group_id\` ELSE NULL END
          ) STORED,
        \`open_settlement_period\` CHAR(7)
          GENERATED ALWAYS AS (
            CASE WHEN \`status\` IN ('draft','submitted') THEN \`settlement_period\` ELSE NULL END
          ) STORED,
        \`active_group_id\` INT
          GENERATED ALWAYS AS (
            CASE WHEN \`status\` IN ('approved','frozen') THEN \`group_id\` ELSE NULL END
          ) STORED,
        \`active_settlement_period\` CHAR(7)
          GENERATED ALWAYS AS (
            CASE WHEN \`status\` IN ('approved','frozen') THEN \`settlement_period\` ELSE NULL END
          ) STORED,
        \`approved_supersedes_authority_id\` BIGINT
          GENERATED ALWAYS AS (
            CASE WHEN \`status\` IN ('approved','frozen') THEN \`supersedes_authority_id\` ELSE NULL END
          ) STORED,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_wss_authority_ref\` (\`authority_ref\`),
        UNIQUE KEY \`uq_wss_authority_id_scope\` (\`id\`, \`group_id\`, \`settlement_period\`),
        UNIQUE KEY \`uq_wss_authority_scope_version\`
          (\`group_id\`, \`settlement_period\`, \`authority_version\`),
        UNIQUE KEY \`uq_wss_authority_open_scope\`
          (\`open_group_id\`, \`open_settlement_period\`),
        UNIQUE KEY \`uq_wss_authority_active_scope\`
          (\`active_group_id\`, \`active_settlement_period\`),
        UNIQUE KEY \`uq_wss_authority_supersedes\` (\`approved_supersedes_authority_id\`),
        KEY \`idx_wss_authority_group_target\`
          (\`group_target_id\`, \`group_id\`, \`settlement_period\`, \`group_target_calculation_version\`),
        KEY \`idx_wss_authority_created_by\` (\`created_by_user_id\`),
        KEY \`idx_wss_authority_submitted_by\` (\`submitted_by_user_id\`),
        KEY \`idx_wss_authority_approved_by\` (\`approved_by_user_id\`),
        KEY \`idx_wss_authority_rejected_by\` (\`rejected_by_user_id\`),
        KEY \`idx_wss_authority_frozen_by\` (\`frozen_by_user_id\`),
        KEY \`idx_wss_authority_superseded_by\` (\`superseded_by_user_id\`),
        KEY \`idx_wss_authority_supersedes\`
          (\`supersedes_authority_id\`, \`group_id\`, \`settlement_period\`),
        CONSTRAINT \`fk_wss_authority_group\`
          FOREIGN KEY (\`group_id\`) REFERENCES \`organization_groups\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_wss_authority_group_target_exact\`
          FOREIGN KEY (\`group_target_id\`, \`group_id\`, \`settlement_period\`, \`group_target_calculation_version\`)
          REFERENCES \`group_targets\` (
            \`id\`, \`group_id\`, \`settlement_period\`, \`calculation_version\`
          ) ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_wss_authority_supersedes\`
          FOREIGN KEY (\`supersedes_authority_id\`, \`group_id\`, \`settlement_period\`)
          REFERENCES \`${AUTHORITIES}\` (\`id\`, \`group_id\`, \`settlement_period\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_wss_authority_created_by\`
          FOREIGN KEY (\`created_by_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_wss_authority_submitted_by\`
          FOREIGN KEY (\`submitted_by_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_wss_authority_approved_by\`
          FOREIGN KEY (\`approved_by_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_wss_authority_rejected_by\`
          FOREIGN KEY (\`rejected_by_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_wss_authority_frozen_by\`
          FOREIGN KEY (\`frozen_by_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_wss_authority_superseded_by\`
          FOREIGN KEY (\`superseded_by_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`chk_wss_authority_ref\` CHECK (
          REGEXP_LIKE(\`authority_ref\`, '^[0-9a-f]{64}$', 'c')
        ),
        CONSTRAINT \`chk_wss_authority_period\` CHECK (
          REGEXP_LIKE(\`settlement_period\`, '^20[0-9]{2}-(0[1-9]|1[0-2])$', 'c')
        ),
        CONSTRAINT \`chk_wss_authority_hashes\` CHECK (
          REGEXP_LIKE(\`required_domains_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`data_completeness_watermark_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`group_target_scope_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`content_hash\`, '^[0-9a-f]{64}$', 'c')
        ),
        CONSTRAINT \`chk_wss_authority_versions\` CHECK (
          \`authority_version\` > 0
          AND \`group_target_calculation_version\` > 0
          AND \`required_domain_count\` BETWEEN 1 AND 2
        ),
        CONSTRAINT \`chk_wss_authority_coverage\` CHECK (
          \`settlement_complete_domain_count\` BETWEEN 0 AND \`required_domain_count\`
          AND ((\`settlement_coverage_status\` = 'complete'
                AND \`settlement_complete_domain_count\` = \`required_domain_count\`)
            OR (\`settlement_coverage_status\` = 'incomplete'
                AND \`settlement_complete_domain_count\` < \`required_domain_count\`))
          AND \`enterprise_formal_domain_count\` = 4
          AND \`enterprise_ready_domain_count\` BETWEEN 0 AND 4
          AND ((\`enterprise_coverage_status\` = 'complete'
                AND \`enterprise_ready_domain_count\` = 4)
            OR (\`enterprise_coverage_status\` = 'incomplete'
                AND \`enterprise_ready_domain_count\` < 4))
        ),
        CONSTRAINT \`chk_wss_authority_lifecycle\` CHECK (
          (\`status\` = 'draft'
            AND \`submitted_by_user_id\` IS NULL AND \`approved_by_user_id\` IS NULL
            AND \`rejected_by_user_id\` IS NULL AND \`frozen_by_user_id\` IS NULL
            AND \`superseded_by_user_id\` IS NULL AND \`submitted_at\` IS NULL
            AND \`approved_at\` IS NULL AND \`rejected_at\` IS NULL
            AND \`frozen_at\` IS NULL AND \`superseded_at\` IS NULL)
          OR (\`status\` = 'submitted'
            AND \`submitted_by_user_id\` IS NOT NULL AND \`submitted_at\` IS NOT NULL
            AND \`submitted_by_user_id\` = \`created_by_user_id\`
            AND \`approved_by_user_id\` IS NULL AND \`rejected_by_user_id\` IS NULL
            AND \`frozen_by_user_id\` IS NULL AND \`superseded_by_user_id\` IS NULL
            AND \`approved_at\` IS NULL AND \`rejected_at\` IS NULL
            AND \`frozen_at\` IS NULL AND \`superseded_at\` IS NULL)
          OR (\`status\` = 'approved'
            AND \`submitted_by_user_id\` IS NOT NULL AND \`submitted_at\` IS NOT NULL
            AND \`submitted_by_user_id\` = \`created_by_user_id\`
            AND \`approved_by_user_id\` IS NOT NULL AND \`approved_at\` IS NOT NULL
            AND \`approved_by_user_id\` <> \`created_by_user_id\`
            AND \`approved_by_user_id\` <> \`submitted_by_user_id\`
            AND \`rejected_by_user_id\` IS NULL AND \`frozen_by_user_id\` IS NULL
            AND \`superseded_by_user_id\` IS NULL AND \`rejected_at\` IS NULL
            AND \`frozen_at\` IS NULL AND \`superseded_at\` IS NULL)
          OR (\`status\` = 'rejected'
            AND \`submitted_by_user_id\` IS NOT NULL AND \`submitted_at\` IS NOT NULL
            AND \`submitted_by_user_id\` = \`created_by_user_id\`
            AND \`rejected_by_user_id\` IS NOT NULL AND \`rejected_at\` IS NOT NULL
            AND \`rejected_by_user_id\` <> \`created_by_user_id\`
            AND \`rejected_by_user_id\` <> \`submitted_by_user_id\`
            AND \`approved_by_user_id\` IS NULL AND \`frozen_by_user_id\` IS NULL
            AND \`superseded_by_user_id\` IS NULL AND \`approved_at\` IS NULL
            AND \`frozen_at\` IS NULL AND \`superseded_at\` IS NULL)
          OR (\`status\` = 'frozen'
            AND \`submitted_by_user_id\` IS NOT NULL AND \`submitted_at\` IS NOT NULL
            AND \`submitted_by_user_id\` = \`created_by_user_id\`
            AND \`approved_by_user_id\` IS NOT NULL AND \`approved_at\` IS NOT NULL
            AND \`frozen_by_user_id\` IS NOT NULL AND \`frozen_at\` IS NOT NULL
            AND \`approved_by_user_id\` <> \`created_by_user_id\`
            AND \`approved_by_user_id\` <> \`submitted_by_user_id\`
            AND \`frozen_by_user_id\` <> \`created_by_user_id\`
            AND \`frozen_by_user_id\` <> \`submitted_by_user_id\`
            AND \`rejected_by_user_id\` IS NULL AND \`superseded_by_user_id\` IS NULL
            AND \`rejected_at\` IS NULL AND \`superseded_at\` IS NULL)
          OR (\`status\` = 'superseded'
            AND \`submitted_by_user_id\` IS NOT NULL AND \`submitted_at\` IS NOT NULL
            AND \`submitted_by_user_id\` = \`created_by_user_id\`
            AND \`approved_by_user_id\` IS NOT NULL AND \`approved_at\` IS NOT NULL
            AND \`approved_by_user_id\` <> \`created_by_user_id\`
            AND \`approved_by_user_id\` <> \`submitted_by_user_id\`
            AND \`superseded_by_user_id\` IS NOT NULL AND \`superseded_at\` IS NOT NULL
            AND \`superseded_by_user_id\` <> \`created_by_user_id\`
            AND \`superseded_by_user_id\` <> \`submitted_by_user_id\`
            AND \`rejected_by_user_id\` IS NULL AND \`rejected_at\` IS NULL
            AND ((\`frozen_by_user_id\` IS NULL AND \`frozen_at\` IS NULL)
              OR (\`frozen_by_user_id\` IS NOT NULL AND \`frozen_at\` IS NOT NULL)))
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='${OWNERSHIP_COMMENTS[AUTHORITIES]}'
    `);
  }

  private async createRequiredDomainLines(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`${REQUIRED_DOMAINS}\` (
        \`id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`authority_id\` BIGINT NOT NULL,
        \`group_id\` INT NOT NULL,
        \`settlement_period\` CHAR(7) NOT NULL,
        \`business_domain\` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`domain_order\` INT NOT NULL,
        \`adapter_contract_version\` VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`source_cursor\` VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`source_cursor_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`data_complete_through_at\` DATETIME(6) NOT NULL,
        \`unresolved_cost_count\` INT NOT NULL,
        \`unresolved_refund_count\` INT NOT NULL,
        \`unresolved_attribution_count\` INT NOT NULL,
        \`unresolved_duplicate_count\` INT NOT NULL,
        \`completeness_status\` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`watermark_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`line_hash\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_wss_domain_authority_domain\`
          (\`authority_id\`, \`business_domain\`),
        UNIQUE KEY \`uq_wss_domain_authority_order\`
          (\`authority_id\`, \`domain_order\`),
        KEY \`idx_wss_domain_authority_scope\`
          (\`authority_id\`, \`group_id\`, \`settlement_period\`),
        CONSTRAINT \`fk_wss_domain_authority_scope\`
          FOREIGN KEY (\`authority_id\`, \`group_id\`, \`settlement_period\`)
          REFERENCES \`${AUTHORITIES}\` (\`id\`, \`group_id\`, \`settlement_period\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`chk_wss_domain_identity\` CHECK (
          \`business_domain\` IN ('repair','fresh')
          AND \`domain_order\` BETWEEN 1 AND 2
        ),
        CONSTRAINT \`chk_wss_domain_period\` CHECK (
          REGEXP_LIKE(\`settlement_period\`, '^20[0-9]{2}-(0[1-9]|1[0-2])$', 'c')
        ),
        CONSTRAINT \`chk_wss_domain_source\` CHECK (
          CHAR_LENGTH(\`adapter_contract_version\`) BETWEEN 1 AND 64
          AND CHAR_LENGTH(\`source_cursor\`) BETWEEN 1 AND 191
        ),
        CONSTRAINT \`chk_wss_domain_hashes\` CHECK (
          REGEXP_LIKE(\`source_cursor_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`watermark_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`line_hash\`, '^[0-9a-f]{64}$', 'c')
        ),
        CONSTRAINT \`chk_wss_domain_completeness\` CHECK (
          \`unresolved_cost_count\` >= 0
          AND \`unresolved_refund_count\` >= 0
          AND \`unresolved_attribution_count\` >= 0
          AND \`unresolved_duplicate_count\` >= 0
          AND ((\`completeness_status\` = 'complete'
                AND \`unresolved_cost_count\` = 0
                AND \`unresolved_refund_count\` = 0
                AND \`unresolved_attribution_count\` = 0
                AND \`unresolved_duplicate_count\` = 0)
            OR (\`completeness_status\` = 'incomplete'
                AND (\`unresolved_cost_count\` > 0
                  OR \`unresolved_refund_count\` > 0
                  OR \`unresolved_attribution_count\` > 0
                  OR \`unresolved_duplicate_count\` > 0)))
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='${OWNERSHIP_COMMENTS[REQUIRED_DOMAINS]}'
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
        UNIQUE KEY \`uq_wss_event_ref\` (\`event_ref\`),
        UNIQUE KEY \`uq_wss_event_once\`
          (\`authority_id\`, \`event_type\`, \`request_fingerprint\`),
        KEY \`idx_wss_event_actor\` (\`actor_user_id\`),
        CONSTRAINT \`fk_wss_event_authority\`
          FOREIGN KEY (\`authority_id\`) REFERENCES \`${AUTHORITIES}\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_wss_event_actor\`
          FOREIGN KEY (\`actor_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`chk_wss_event_ref\` CHECK (
          REGEXP_LIKE(\`event_ref\`, '^[0-9a-f]{64}$', 'c')
        ),
        CONSTRAINT \`chk_wss_event_hashes\` CHECK (
          REGEXP_LIKE(\`evidence_ref\`, '^evidence:[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`evidence_hash\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`request_fingerprint\`, '^[0-9a-f]{64}$', 'c')
          AND REGEXP_LIKE(\`authority_content_hash\`, '^[0-9a-f]{64}$', 'c')
        ),
        CONSTRAINT \`chk_wss_event_transition\` CHECK (
          (\`event_type\` = 'drafted' AND \`from_status\` IS NULL AND \`to_status\` = 'draft')
          OR (\`event_type\` = 'submitted' AND \`from_status\` = 'draft'
            AND \`to_status\` = 'submitted')
          OR (\`event_type\` = 'approved' AND \`from_status\` = 'submitted'
            AND \`to_status\` = 'approved')
          OR (\`event_type\` = 'rejected' AND \`from_status\` = 'submitted'
            AND \`to_status\` = 'rejected')
          OR (\`event_type\` = 'frozen' AND \`from_status\` = 'approved'
            AND \`to_status\` = 'frozen')
          OR (\`event_type\` = 'superseded' AND \`from_status\` IN ('approved','frozen')
            AND \`to_status\` = 'superseded')
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
        UNIQUE KEY \`uq_wss_claim_result\` (\`authority_id\`, \`phase\`),
        KEY \`idx_wss_claim_actor\` (\`actor_user_id\`),
        KEY \`idx_wss_claim_event\` (\`lifecycle_event_id\`),
        CONSTRAINT \`fk_wss_claim_actor\`
          FOREIGN KEY (\`actor_user_id\`) REFERENCES \`users\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_wss_claim_authority\`
          FOREIGN KEY (\`authority_id\`) REFERENCES \`${AUTHORITIES}\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`fk_wss_claim_event\`
          FOREIGN KEY (\`lifecycle_event_id\`) REFERENCES \`${EVENTS}\` (\`id\`)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT \`chk_wss_claim_key\` CHECK (
          REGEXP_LIKE(\`idempotency_key\`, '^wage-scope-idempotency:[0-9a-f]{64}$', 'c')
          AND \`phase\` IN ('draft','submit','approve','reject','freeze','supersede')
        ),
        CONSTRAINT \`chk_wss_claim_hash\` CHECK (
          REGEXP_LIKE(\`request_fingerprint\`, '^[0-9a-f]{64}$', 'c')
        ),
        CONSTRAINT \`chk_wss_claim_result\` CHECK (
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
