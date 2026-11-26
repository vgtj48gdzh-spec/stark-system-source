import { createHash } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { normalizeMysqlCheckClause } from '../../common/utils/mysql-check-clause.util';

const ROOTS = 'business_contribution_economic_fact_roots';
const DECISIONS = 'repair_economic_lineage_decisions';
const CLAIMS = 'repair_economic_lineage_idempotency_claims';
const MUTEXES = 'repair_economic_lineage_mutexes';
const BINDINGS = 'repair_work_order_economic_lineages';
const CONTRIBUTIONS = 'business_contributions';
const ROOT_COLUMN = 'canonical_economic_fact_root_id';
const MYSQL_0067_UTF8MB4_ESCAPED_LITERAL_PREFIX = "_utf8mb4\\'";
const MYSQL_0067_ASCII_ESCAPED_LITERAL_PREFIX = "_ascii\\'";
const CHECK_CLAUSE_DIAGNOSTIC_LIMIT_0067 = 2048;

type CheckClauseMetadataRow0067 = Readonly<{
  checkClause: unknown;
  enforced: unknown;
}>;

function isMysql0067EscapedMetadataLiteral(value: string): boolean {
  switch (value) {
    case 'repair':
    case 'proposal':
    case 'approval':
    case 'origin':
    case 'cancel_recreate':
    case 'initial_registration':
    case 'cancelled_recreated_same_economic_fact':
    case 'lineage_verified':
    case 'recreated':
    case 'c':
    case '^[0-9a-f]{64}$':
    case '^evidence:[0-9a-f]{64}$':
    case '^lineage-idempotency:[0-9a-f]{64}$':
      return true;
    default:
      return false;
  }
}

function isMysql0067AsciiEscapedMetadataLiteral(value: string): boolean {
  switch (value) {
    case '^[0-9a-f]{64}$':
    case '^evidence:[0-9a-f]{64}$':
    case '^lineage-idempotency:[0-9a-f]{64}$':
      return true;
    default:
      return false;
  }
}

function decodeMysql0067EscapedMetadataLiterals(raw: string): string {
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
    const literalPrefix = raw.startsWith(
      MYSQL_0067_UTF8MB4_ESCAPED_LITERAL_PREFIX,
      index,
    )
      ? MYSQL_0067_UTF8MB4_ESCAPED_LITERAL_PREFIX
      : raw.startsWith(MYSQL_0067_ASCII_ESCAPED_LITERAL_PREFIX, index)
        ? MYSQL_0067_ASCII_ESCAPED_LITERAL_PREFIX
        : null;
    if (literalPrefix) {
      const before = index === 0 ? '' : raw[index - 1];
      if (before && !/[\s(,=]/.test(before)) return raw;
      const valueStart = index + literalPrefix.length;
      const close = raw.indexOf("\\'", valueStart);
      if (close < 0) return raw;
      const value = raw.slice(valueStart, close);
      const end = close + 2;
      const after = raw[end] ?? '';
      if (
        !isMysql0067EscapedMetadataLiteral(value) ||
        (literalPrefix === MYSQL_0067_ASCII_ESCAPED_LITERAL_PREFIX &&
          !isMysql0067AsciiEscapedMetadataLiteral(value)) ||
        (after && !/[\s),]/.test(after))
      ) {
        return raw;
      }
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

function normalizeRepairEconomicLineage0067InformationSchemaCheckClause(
  clause: unknown,
): string {
  const raw = String(clause ?? '');
  return normalizeMysqlCheckClause(decodeMysql0067EscapedMetadataLiterals(raw));
}

function sha256CheckClause0067(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function boundedCheckClauseSegment0067(value: string) {
  return {
    length: value.length,
    sha256: sha256CheckClause0067(value),
    value: value.slice(0, CHECK_CLAUSE_DIAGNOSTIC_LIMIT_0067),
    truncated: value.length > CHECK_CLAUSE_DIAGNOSTIC_LIMIT_0067,
  };
}

function firstCheckClauseDifferenceOffset0067(actual: string, expected: string): number {
  const sharedLength = Math.min(actual.length, expected.length);
  for (let index = 0; index < sharedLength; index += 1) {
    if (actual[index] !== expected[index]) return index;
  }
  return actual.length === expected.length ? -1 : sharedLength;
}

function repairEconomicLineage0067CheckCompatibilityProblem(
  table: string,
  constraintName: string,
  expectedClause: string,
  row?: CheckClauseMetadataRow0067,
): string | null {
  const prefix =
    `repair_economic_lineage_0067_schema_incompatible:${table}:check:${constraintName}`;
  if (!row) return `${prefix}:missing`;

  const enforced = String(row.enforced ?? '');
  if (enforced.toUpperCase() !== 'YES') {
    return `${prefix}:not_enforced:${JSON.stringify({ enforced })}`;
  }

  const rawClause = String(row.checkClause ?? '');
  const decodedClause = decodeMysql0067EscapedMetadataLiterals(rawClause);
  const actualCanonical =
    normalizeRepairEconomicLineage0067InformationSchemaCheckClause(rawClause);
  const expectedCanonical = normalizeMysqlCheckClause(expectedClause);
  if (actualCanonical === expectedCanonical) return null;

  // CHECK text is fixed schema metadata, never a business row. Keep every
  // field bounded and JSON-escaped so disposable CI can reveal the exact
  // MySQL printer form without weakening the fail-closed comparison.
  const diagnostic = {
    constraintName,
    enforced,
    firstDiffOffset: firstCheckClauseDifferenceOffset0067(
      actualCanonical,
      expectedCanonical,
    ),
    raw: boundedCheckClauseSegment0067(rawClause),
    decoded: boundedCheckClauseSegment0067(decodedClause),
    actualCanonical: boundedCheckClauseSegment0067(actualCanonical),
    expectedCanonical: boundedCheckClauseSegment0067(expectedCanonical),
  };
  return `${prefix}:clause_mismatch:${JSON.stringify(diagnostic)}`;
}

type ColumnSpec = Readonly<{
  name: string;
  type: string;
  nullable: 'YES' | 'NO';
  defaultValue: string | null;
  extra: string;
  generationExpression: string;
  charset: string | null;
  collation: string | null;
}>;

const COLUMN_SPEC_FIELDS: readonly (keyof ColumnSpec)[] = [
  'name',
  'type',
  'nullable',
  'defaultValue',
  'extra',
  'generationExpression',
  'charset',
  'collation',
];

function column(
  name: string,
  type: string,
  nullable: 'YES' | 'NO',
  options: Partial<Omit<ColumnSpec, 'name' | 'type' | 'nullable'>> = {},
): ColumnSpec {
  return {
    name,
    type,
    nullable,
    defaultValue: options.defaultValue ?? null,
    extra: options.extra ?? '',
    generationExpression: options.generationExpression ?? '',
    charset: options.charset ?? null,
    collation: options.collation ?? null,
  };
}

const ascii = (
  name: string,
  type: string,
  nullable: 'YES' | 'NO',
  options: Partial<Omit<ColumnSpec, 'name' | 'type' | 'nullable' | 'charset' | 'collation'>> = {},
) => column(name, type, nullable, { ...options, charset: 'ascii', collation: 'ascii_bin' });

const unicode = (name: string, type: string, nullable: 'YES' | 'NO') =>
  column(name, type, nullable, { charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' });

const ROOT_COLUMNS: readonly ColumnSpec[] = [
  ascii('economic_root_id', 'char(64)', 'NO'),
  ascii('business_domain', 'varchar(24)', 'NO', { defaultValue: 'repair' }),
  column('origin_work_order_id', 'int', 'NO'),
  unicode('company_ref', 'varchar(100)', 'NO'),
  unicode('business_sector_ref', 'varchar(100)', 'NO'),
  unicode('store_ref', 'varchar(100)', 'NO'),
  unicode('customer_ref', 'varchar(100)', 'NO'),
  column('vehicle_id', 'int', 'NO'),
  column('created_by_user_id', 'int', 'NO'),
  column('created_at', 'datetime(6)', 'NO', {
    defaultValue: 'current_timestamp(6)',
    extra: 'default_generated',
  }),
];

const DECISION_COLUMNS: readonly ColumnSpec[] = [
  column('id', 'bigint', 'NO', { extra: 'auto_increment' }),
  ascii('decision_ref', 'char(64)', 'NO'),
  ascii('phase', 'varchar(16)', 'NO'),
  column('proposal_decision_id', 'bigint', 'YES'),
  ascii('proposal_phase_key', 'varchar(16)', 'NO', { defaultValue: 'proposal' }),
  ascii('relation_type', 'varchar(32)', 'NO'),
  column('predecessor_work_order_id', 'int', 'YES'),
  column('predecessor_key', 'int', 'YES', {
    extra: 'stored generated',
    generationExpression: 'coalesce(predecessor_work_order_id,0)',
  }),
  column('target_work_order_id', 'int', 'NO'),
  unicode('authorized_company_ref', 'varchar(100)', 'NO'),
  unicode('authorized_business_sector_ref', 'varchar(100)', 'NO'),
  unicode('authorized_store_ref', 'varchar(100)', 'NO'),
  unicode('authorized_customer_ref', 'varchar(100)', 'NO'),
  ascii('reason_code', 'varchar(64)', 'NO'),
  ascii('evidence_ref', 'varchar(73)', 'NO'),
  ascii('evidence_hash', 'char(64)', 'NO'),
  ascii('idempotency_key', 'char(84)', 'NO'),
  ascii('request_fingerprint', 'char(64)', 'NO'),
  column('expected_predecessor_version', 'int', 'YES'),
  column('expected_predecessor_version_key', 'int', 'YES', {
    extra: 'stored generated',
    generationExpression: 'coalesce(expected_predecessor_version,0)',
  }),
  column('expected_target_version', 'int', 'NO'),
  ascii('economic_root_id', 'char(64)', 'YES'),
  column('actor_user_id', 'int', 'NO'),
  column('version', 'int', 'NO', { defaultValue: '1' }),
  column('created_at', 'datetime(6)', 'NO', {
    defaultValue: 'current_timestamp(6)',
    extra: 'default_generated',
  }),
];

const CLAIM_COLUMNS: readonly ColumnSpec[] = [
  column('id', 'bigint', 'NO', { extra: 'auto_increment' }),
  ascii('idempotency_key', 'char(84)', 'NO'),
  ascii('phase', 'varchar(16)', 'NO'),
  ascii('request_fingerprint', 'char(64)', 'NO'),
  column('actor_user_id', 'int', 'NO'),
  column('created_at', 'datetime(6)', 'NO', {
    defaultValue: 'current_timestamp(6)',
    extra: 'default_generated',
  }),
];

const MUTEX_COLUMNS: readonly ColumnSpec[] = [
  column('work_order_id', 'int', 'NO'),
  column('created_by_user_id', 'int', 'NO'),
  column('created_at', 'datetime(6)', 'NO', {
    defaultValue: 'current_timestamp(6)',
    extra: 'default_generated',
  }),
];

const BINDING_COLUMNS: readonly ColumnSpec[] = [
  column('work_order_id', 'int', 'NO'),
  ascii('economic_root_id', 'char(64)', 'NO'),
  column('root_origin_work_order_id', 'int', 'NO'),
  ascii('lineage_role', 'varchar(16)', 'NO'),
  ascii('accepted_phase', 'varchar(16)', 'NO', { defaultValue: 'approval' }),
  ascii('relation_type', 'varchar(32)', 'NO'),
  column('predecessor_work_order_id', 'int', 'YES'),
  column('predecessor_key', 'int', 'YES', {
    extra: 'stored generated',
    generationExpression: 'coalesce(predecessor_work_order_id,0)',
  }),
  column('accepted_decision_id', 'bigint', 'NO'),
  column('created_at', 'datetime(6)', 'NO', {
    defaultValue: 'current_timestamp(6)',
    extra: 'default_generated',
  }),
];

type IndexSpec = Readonly<{ unique: boolean; columns: readonly string[] }>;
type ForeignKeySpec = Readonly<{
  columns: readonly string[];
  table: string;
  referencedColumns: readonly string[];
  updateRule: string;
  deleteRule: string;
}>;

const indexes: Readonly<Record<string, Readonly<Record<string, IndexSpec>>>> = {
  [ROOTS]: {
    PRIMARY: { unique: true, columns: ['economic_root_id'] },
    uq_bc_economic_root_origin_work_order: { unique: true, columns: ['origin_work_order_id'] },
    uq_bc_economic_root_origin_pair: {
      unique: true,
      columns: ['origin_work_order_id', 'economic_root_id'],
    },
    idx_bc_economic_root_scope: {
      unique: false,
      columns: ['company_ref', 'business_sector_ref', 'store_ref', 'customer_ref'],
    },
    idx_bc_economic_root_vehicle: { unique: false, columns: ['vehicle_id'] },
    idx_bc_economic_root_created_by: { unique: false, columns: ['created_by_user_id'] },
  },
  [DECISIONS]: {
    PRIMARY: { unique: true, columns: ['id'] },
    uq_repair_lineage_decision_ref: { unique: true, columns: ['decision_ref'] },
    uq_repair_lineage_decision_idempotency: { unique: true, columns: ['idempotency_key'] },
    uq_repair_lineage_proposal_resolution: { unique: true, columns: ['proposal_decision_id'] },
    uq_repair_lineage_proposal_semantics: {
      unique: true,
      columns: [
        'id',
        'phase',
        'target_work_order_id',
        'relation_type',
        'predecessor_key',
        'authorized_company_ref',
        'authorized_business_sector_ref',
        'authorized_store_ref',
        'authorized_customer_ref',
        'expected_predecessor_version_key',
        'expected_target_version',
      ],
    },
    idx_repair_lineage_approval_proposal_semantics: {
      unique: false,
      columns: [
        'proposal_decision_id',
        'proposal_phase_key',
        'target_work_order_id',
        'relation_type',
        'predecessor_key',
        'authorized_company_ref',
        'authorized_business_sector_ref',
        'authorized_store_ref',
        'authorized_customer_ref',
        'expected_predecessor_version_key',
        'expected_target_version',
      ],
    },
    uq_repair_lineage_accepted_semantics: {
      unique: true,
      columns: [
        'id',
        'phase',
        'target_work_order_id',
        'economic_root_id',
        'relation_type',
        'predecessor_key',
      ],
    },
    idx_repair_lineage_decision_target: { unique: false, columns: ['target_work_order_id'] },
    idx_repair_lineage_decision_predecessor: {
      unique: false,
      columns: ['predecessor_work_order_id'],
    },
    idx_repair_lineage_decision_root: { unique: false, columns: ['economic_root_id'] },
    idx_repair_lineage_decision_actor: { unique: false, columns: ['actor_user_id'] },
  },
  [CLAIMS]: {
    PRIMARY: { unique: true, columns: ['id'] },
    uq_repair_lineage_idempotency_claim_key: {
      unique: true,
      columns: ['idempotency_key'],
    },
    idx_repair_lineage_idempotency_claim_actor: {
      unique: false,
      columns: ['actor_user_id'],
    },
  },
  [MUTEXES]: {
    PRIMARY: { unique: true, columns: ['work_order_id'] },
    idx_repair_lineage_mutex_created_by: { unique: false, columns: ['created_by_user_id'] },
  },
  [BINDINGS]: {
    PRIMARY: { unique: true, columns: ['work_order_id'] },
    uq_repair_lineage_work_order_root: {
      unique: true,
      columns: ['work_order_id', 'economic_root_id'],
    },
    uq_repair_lineage_predecessor: {
      unique: true,
      columns: ['predecessor_work_order_id'],
    },
    idx_repair_lineage_predecessor_root: {
      unique: false,
      columns: ['predecessor_work_order_id', 'economic_root_id'],
    },
    uq_repair_lineage_binding_accepted_semantics: {
      unique: true,
      columns: [
        'accepted_decision_id',
        'accepted_phase',
        'work_order_id',
        'economic_root_id',
        'relation_type',
        'predecessor_key',
      ],
    },
    idx_repair_lineage_root_origin_pair: {
      unique: false,
      columns: ['root_origin_work_order_id', 'economic_root_id'],
    },
    idx_repair_lineage_binding_root: { unique: false, columns: ['economic_root_id'] },
  },
};

const foreignKeys: Readonly<Record<string, Readonly<Record<string, ForeignKeySpec>>>> = {
  [ROOTS]: {
    fk_bc_economic_root_origin_work_order: {
      columns: ['origin_work_order_id'],
      table: 'repair_work_order_profiles',
      referencedColumns: ['work_order_id'],
      updateRule: 'RESTRICT',
      deleteRule: 'RESTRICT',
    },
    fk_bc_economic_root_vehicle: {
      columns: ['vehicle_id'],
      table: 'repair_vehicle_profiles',
      referencedColumns: ['id'],
      updateRule: 'RESTRICT',
      deleteRule: 'RESTRICT',
    },
    fk_bc_economic_root_created_by: {
      columns: ['created_by_user_id'],
      table: 'users',
      referencedColumns: ['id'],
      updateRule: 'RESTRICT',
      deleteRule: 'RESTRICT',
    },
  },
  [DECISIONS]: {
    fk_repair_lineage_approval_proposal_semantics: {
      columns: [
        'proposal_decision_id',
        'proposal_phase_key',
        'target_work_order_id',
        'relation_type',
        'predecessor_key',
        'authorized_company_ref',
        'authorized_business_sector_ref',
        'authorized_store_ref',
        'authorized_customer_ref',
        'expected_predecessor_version_key',
        'expected_target_version',
      ],
      table: DECISIONS,
      referencedColumns: [
        'id',
        'phase',
        'target_work_order_id',
        'relation_type',
        'predecessor_key',
        'authorized_company_ref',
        'authorized_business_sector_ref',
        'authorized_store_ref',
        'authorized_customer_ref',
        'expected_predecessor_version_key',
        'expected_target_version',
      ],
      updateRule: 'RESTRICT',
      deleteRule: 'RESTRICT',
    },
    fk_repair_lineage_predecessor_work_order: {
      columns: ['predecessor_work_order_id'],
      table: 'repair_work_order_profiles',
      referencedColumns: ['work_order_id'],
      updateRule: 'RESTRICT',
      deleteRule: 'RESTRICT',
    },
    fk_repair_lineage_target_work_order: {
      columns: ['target_work_order_id'],
      table: 'repair_work_order_profiles',
      referencedColumns: ['work_order_id'],
      updateRule: 'RESTRICT',
      deleteRule: 'RESTRICT',
    },
    fk_repair_lineage_decision_root: {
      columns: ['economic_root_id'],
      table: ROOTS,
      referencedColumns: ['economic_root_id'],
      updateRule: 'RESTRICT',
      deleteRule: 'RESTRICT',
    },
    fk_repair_lineage_decision_actor: {
      columns: ['actor_user_id'],
      table: 'users',
      referencedColumns: ['id'],
      updateRule: 'RESTRICT',
      deleteRule: 'RESTRICT',
    },
  },
  [CLAIMS]: {
    fk_repair_lineage_idempotency_claim_actor: {
      columns: ['actor_user_id'],
      table: 'users',
      referencedColumns: ['id'],
      updateRule: 'RESTRICT',
      deleteRule: 'RESTRICT',
    },
  },
  [MUTEXES]: {
    fk_repair_lineage_mutex_work_order: {
      columns: ['work_order_id'],
      table: 'repair_work_order_profiles',
      referencedColumns: ['work_order_id'],
      updateRule: 'RESTRICT',
      deleteRule: 'RESTRICT',
    },
    fk_repair_lineage_mutex_created_by: {
      columns: ['created_by_user_id'],
      table: 'users',
      referencedColumns: ['id'],
      updateRule: 'RESTRICT',
      deleteRule: 'RESTRICT',
    },
  },
  [BINDINGS]: {
    fk_repair_lineage_binding_work_order: {
      columns: ['work_order_id'],
      table: 'repair_work_order_profiles',
      referencedColumns: ['work_order_id'],
      updateRule: 'RESTRICT',
      deleteRule: 'RESTRICT',
    },
    fk_repair_lineage_binding_root_origin: {
      columns: ['root_origin_work_order_id', 'economic_root_id'],
      table: ROOTS,
      referencedColumns: ['origin_work_order_id', 'economic_root_id'],
      updateRule: 'RESTRICT',
      deleteRule: 'RESTRICT',
    },
    fk_repair_lineage_binding_predecessor_same_root: {
      columns: ['predecessor_work_order_id', 'economic_root_id'],
      table: BINDINGS,
      referencedColumns: ['work_order_id', 'economic_root_id'],
      updateRule: 'RESTRICT',
      deleteRule: 'RESTRICT',
    },
    fk_repair_lineage_binding_accepted_semantics: {
      columns: [
        'accepted_decision_id',
        'accepted_phase',
        'work_order_id',
        'economic_root_id',
        'relation_type',
        'predecessor_key',
      ],
      table: DECISIONS,
      referencedColumns: [
        'id',
        'phase',
        'target_work_order_id',
        'economic_root_id',
        'relation_type',
        'predecessor_key',
      ],
      updateRule: 'RESTRICT',
      deleteRule: 'RESTRICT',
    },
  },
};

const checkClauses: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  [ROOTS]: {
    chk_bc_economic_root_id:
      "regexp_like(`economic_root_id`,'^[0-9a-f]{64}$','c')",
    chk_bc_economic_root_domain: "`business_domain` = 'repair'",
  },
  [DECISIONS]: {
    chk_repair_lineage_decision_ref:
      "regexp_like(`decision_ref`,'^[0-9a-f]{64}$','c')",
    chk_repair_lineage_decision_hashes:
      "regexp_like(`evidence_hash`,'^[0-9a-f]{64}$','c') AND regexp_like(`request_fingerprint`,'^[0-9a-f]{64}$','c')",
    chk_repair_lineage_evidence_ref:
      "regexp_like(`evidence_ref`,'^evidence:[0-9a-f]{64}$','c')",
    chk_repair_lineage_idempotency_key:
      "regexp_like(`idempotency_key`,'^lineage-idempotency:[0-9a-f]{64}$','c')",
    chk_repair_lineage_phase:
      "`phase` IN ('proposal','approval') AND `proposal_phase_key` = 'proposal' AND ((`phase` = 'proposal' AND `proposal_decision_id` IS NULL AND `economic_root_id` IS NULL) OR (`phase` = 'approval' AND `proposal_decision_id` IS NOT NULL AND `economic_root_id` IS NOT NULL))",
    chk_repair_lineage_relation:
      "`relation_type` IN ('origin','cancel_recreate') AND ((`relation_type` = 'origin' AND `predecessor_work_order_id` IS NULL AND `expected_predecessor_version` IS NULL) OR (`relation_type` = 'cancel_recreate' AND `predecessor_work_order_id` IS NOT NULL AND `expected_predecessor_version` > 0 AND `predecessor_work_order_id` <> `target_work_order_id`))",
    chk_repair_lineage_reason:
      "(`phase` = 'proposal' AND ((`relation_type` = 'origin' AND `reason_code` = 'initial_registration') OR (`relation_type` = 'cancel_recreate' AND `reason_code` = 'cancelled_recreated_same_economic_fact'))) OR (`phase` = 'approval' AND `reason_code` = 'lineage_verified')",
    chk_repair_lineage_versions:
      '`expected_target_version` > 0 AND `version` = 1',
  },
  [CLAIMS]: {
    chk_repair_lineage_claim_shape:
      "regexp_like(`idempotency_key`,'^lineage-idempotency:[0-9a-f]{64}$','c') AND `phase` IN ('proposal','approval') AND regexp_like(`request_fingerprint`,'^[0-9a-f]{64}$','c')",
  },
  [BINDINGS]: {
    chk_repair_lineage_binding_root:
      "regexp_like(`economic_root_id`,'^[0-9a-f]{64}$','c')",
    chk_repair_lineage_binding_role:
      "`accepted_phase` = 'approval' AND ((`lineage_role` = 'origin' AND `relation_type` = 'origin' AND `predecessor_work_order_id` IS NULL AND `root_origin_work_order_id` = `work_order_id`) OR (`lineage_role` = 'recreated' AND `relation_type` = 'cancel_recreate' AND `predecessor_work_order_id` IS NOT NULL AND `predecessor_work_order_id` <> `work_order_id` AND `root_origin_work_order_id` <> `work_order_id`))",
  },
};

export class AddRepairEconomicLineage00671792000000000 implements MigrationInterface {
  name = 'AddRepairEconomicLineage00671792000000000';

  public static normalizeInformationSchemaCheckClauseForTest(clause: unknown): string {
    return normalizeRepairEconomicLineage0067InformationSchemaCheckClause(clause);
  }

  public static checkCompatibilityProblemForTest(
    table: string,
    constraintName: string,
    expectedClause: string,
    row?: CheckClauseMetadataRow0067,
  ): string | null {
    return repairEconomicLineage0067CheckCompatibilityProblem(
      table,
      constraintName,
      expectedClause,
      row,
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Full compatibility preflight occurs before this invocation's first DDL.
    await this.assertPrerequisites(queryRunner);
    await this.assertPlannedConstraintOwnership(queryRunner);
    const tableStates = await Promise.all(([
      [ROOTS, ROOT_COLUMNS],
      [DECISIONS, DECISION_COLUMNS],
      [CLAIMS, CLAIM_COLUMNS],
      [MUTEXES, MUTEX_COLUMNS],
      [BINDINGS, BINDING_COLUMNS],
    ] as const).map(async ([table, specs]) => ({
      table,
      specs,
      exists: await this.tableExists(queryRunner, table),
    })));
    for (const { table, specs, exists } of tableStates) {
      if (exists) {
        await this.assertTableSchema(queryRunner, table, specs);
      }
    }
    const contributionComplete = await this.assertContributionPartialState(queryRunner);
    const fullyComplete = tableStates.every((state) => state.exists) && contributionComplete;
    if (fullyComplete) {
      await this.assertComplete(queryRunner);
      return;
    }
    await this.assertPartialRecoveryEmpty(queryRunner, tableStates);

    if (!tableStates.find((state) => state.table === ROOTS)?.exists) {
      await this.createRoots(queryRunner);
    }
    if (!tableStates.find((state) => state.table === DECISIONS)?.exists) {
      await this.createDecisions(queryRunner);
    }
    if (!tableStates.find((state) => state.table === CLAIMS)?.exists) {
      await this.createClaims(queryRunner);
    }
    if (!tableStates.find((state) => state.table === MUTEXES)?.exists) {
      await this.createMutexes(queryRunner);
    }
    if (!tableStates.find((state) => state.table === BINDINGS)?.exists) {
      await this.createBindings(queryRunner);
    }
    await this.recoverContributionRootColumn(queryRunner);

    await this.assertComplete(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Destructive rollback is allowed only when every 0067 structure is empty;
    // this check finishes before the first DROP/ALTER DDL.
    for (const [table, specs] of [
      [ROOTS, ROOT_COLUMNS],
      [DECISIONS, DECISION_COLUMNS],
      [CLAIMS, CLAIM_COLUMNS],
      [MUTEXES, MUTEX_COLUMNS],
      [BINDINGS, BINDING_COLUMNS],
    ] as const) {
      if (await this.tableExists(queryRunner, table)) {
        await this.assertTableSchema(queryRunner, table, specs);
        const rows = await queryRunner.query(`SELECT COUNT(*) AS row_count FROM \`${table}\``);
        if (Number(rows[0]?.row_count ?? 0) !== 0) {
          throw new Error(`repair_economic_lineage_0067_down_non_empty:${table}`);
        }
      }
    }
    await this.assertContributionPartialState(queryRunner);
    if (await this.columnExists(queryRunner, CONTRIBUTIONS, ROOT_COLUMN)) {
      const rows = await queryRunner.query(
        `SELECT COUNT(*) AS row_count FROM \`${CONTRIBUTIONS}\` WHERE \`${ROOT_COLUMN}\` IS NOT NULL`,
      );
      if (Number(rows[0]?.row_count ?? 0) !== 0) {
        throw new Error('repair_economic_lineage_0067_down_non_empty:business_contributions');
      }
    }

    if (await this.foreignKeyExists(queryRunner, CONTRIBUTIONS, 'fk_business_contribution_economic_root')) {
      await queryRunner.query(
        `ALTER TABLE \`${CONTRIBUTIONS}\` DROP FOREIGN KEY fk_business_contribution_economic_root`,
      );
    }
    if (await this.checkExists(queryRunner, CONTRIBUTIONS, 'chk_business_contribution_economic_root')) {
      await queryRunner.query(
        `ALTER TABLE \`${CONTRIBUTIONS}\` DROP CHECK chk_business_contribution_economic_root`,
      );
    }
    if (await this.indexExists(queryRunner, CONTRIBUTIONS, 'uq_business_contribution_economic_root')) {
      await queryRunner.query(
        `ALTER TABLE \`${CONTRIBUTIONS}\` DROP INDEX uq_business_contribution_economic_root`,
      );
    }
    if (await this.columnExists(queryRunner, CONTRIBUTIONS, ROOT_COLUMN)) {
      await queryRunner.query(
        `ALTER TABLE \`${CONTRIBUTIONS}\` DROP COLUMN \`${ROOT_COLUMN}\``,
      );
    }
    for (const table of [BINDINGS, MUTEXES, CLAIMS, DECISIONS, ROOTS]) {
      if (await this.tableExists(queryRunner, table)) {
        await queryRunner.query(`DROP TABLE \`${table}\``);
      }
    }
  }

  private async createRoots(queryRunner: QueryRunner) {
    await queryRunner.query(`
      CREATE TABLE \`${ROOTS}\` (
        economic_root_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        business_domain VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'repair',
        origin_work_order_id INT NOT NULL,
        company_ref VARCHAR(100) NOT NULL,
        business_sector_ref VARCHAR(100) NOT NULL,
        store_ref VARCHAR(100) NOT NULL,
        customer_ref VARCHAR(100) NOT NULL,
        vehicle_id INT NOT NULL,
        created_by_user_id INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (economic_root_id),
        UNIQUE KEY uq_bc_economic_root_origin_work_order (origin_work_order_id),
        UNIQUE KEY uq_bc_economic_root_origin_pair (origin_work_order_id, economic_root_id),
        KEY idx_bc_economic_root_scope (company_ref, business_sector_ref, store_ref, customer_ref),
        KEY idx_bc_economic_root_vehicle (vehicle_id),
        KEY idx_bc_economic_root_created_by (created_by_user_id),
        CONSTRAINT chk_bc_economic_root_id
          CHECK (REGEXP_LIKE(economic_root_id, '^[0-9a-f]{64}$', 'c')),
        CONSTRAINT chk_bc_economic_root_domain CHECK (business_domain = 'repair'),
        CONSTRAINT fk_bc_economic_root_origin_work_order
          FOREIGN KEY (origin_work_order_id) REFERENCES repair_work_order_profiles(work_order_id)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT fk_bc_economic_root_vehicle
          FOREIGN KEY (vehicle_id) REFERENCES repair_vehicle_profiles(id)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT fk_bc_economic_root_created_by
          FOREIGN KEY (created_by_user_id) REFERENCES users(id)
          ON UPDATE RESTRICT ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  private async createDecisions(queryRunner: QueryRunner) {
    await queryRunner.query(`
      CREATE TABLE \`${DECISIONS}\` (
        id BIGINT NOT NULL AUTO_INCREMENT,
        decision_ref CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        phase VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        proposal_decision_id BIGINT NULL,
        proposal_phase_key VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin
          NOT NULL DEFAULT 'proposal',
        relation_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        predecessor_work_order_id INT NULL,
        predecessor_key INT GENERATED ALWAYS AS (COALESCE(predecessor_work_order_id, 0)) STORED,
        target_work_order_id INT NOT NULL,
        authorized_company_ref VARCHAR(100) NOT NULL,
        authorized_business_sector_ref VARCHAR(100) NOT NULL,
        authorized_store_ref VARCHAR(100) NOT NULL,
        authorized_customer_ref VARCHAR(100) NOT NULL,
        reason_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        evidence_ref VARCHAR(73) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        evidence_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        idempotency_key CHAR(84) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        request_fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        expected_predecessor_version INT NULL,
        expected_predecessor_version_key INT
          GENERATED ALWAYS AS (COALESCE(expected_predecessor_version, 0)) STORED,
        expected_target_version INT NOT NULL,
        economic_root_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
        actor_user_id INT NOT NULL,
        version INT NOT NULL DEFAULT 1,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_repair_lineage_decision_ref (decision_ref),
        UNIQUE KEY uq_repair_lineage_decision_idempotency (idempotency_key),
        UNIQUE KEY uq_repair_lineage_proposal_resolution (proposal_decision_id),
        UNIQUE KEY uq_repair_lineage_proposal_semantics
          (id, phase, target_work_order_id, relation_type, predecessor_key,
           authorized_company_ref, authorized_business_sector_ref,
           authorized_store_ref, authorized_customer_ref,
           expected_predecessor_version_key, expected_target_version),
        KEY idx_repair_lineage_approval_proposal_semantics
          (proposal_decision_id, proposal_phase_key,
           target_work_order_id, relation_type, predecessor_key,
           authorized_company_ref, authorized_business_sector_ref,
           authorized_store_ref, authorized_customer_ref,
           expected_predecessor_version_key, expected_target_version),
        UNIQUE KEY uq_repair_lineage_accepted_semantics
          (id, phase, target_work_order_id, economic_root_id, relation_type, predecessor_key),
        KEY idx_repair_lineage_decision_target (target_work_order_id),
        KEY idx_repair_lineage_decision_predecessor (predecessor_work_order_id),
        KEY idx_repair_lineage_decision_root (economic_root_id),
        KEY idx_repair_lineage_decision_actor (actor_user_id),
        CONSTRAINT chk_repair_lineage_decision_ref
          CHECK (REGEXP_LIKE(decision_ref, '^[0-9a-f]{64}$', 'c')),
        CONSTRAINT chk_repair_lineage_decision_hashes
          CHECK (REGEXP_LIKE(evidence_hash, '^[0-9a-f]{64}$', 'c')
            AND REGEXP_LIKE(request_fingerprint, '^[0-9a-f]{64}$', 'c')),
        CONSTRAINT chk_repair_lineage_evidence_ref
          CHECK (REGEXP_LIKE(evidence_ref, '^evidence:[0-9a-f]{64}$', 'c')),
        CONSTRAINT chk_repair_lineage_idempotency_key
          CHECK (REGEXP_LIKE(idempotency_key, '^lineage-idempotency:[0-9a-f]{64}$', 'c')),
        CONSTRAINT chk_repair_lineage_phase CHECK (
          phase IN ('proposal','approval') AND proposal_phase_key = 'proposal'
          AND ((phase = 'proposal' AND proposal_decision_id IS NULL AND economic_root_id IS NULL)
            OR (phase = 'approval' AND proposal_decision_id IS NOT NULL AND economic_root_id IS NOT NULL))
        ),
        CONSTRAINT chk_repair_lineage_relation CHECK (
          relation_type IN ('origin','cancel_recreate')
          AND ((relation_type = 'origin' AND predecessor_work_order_id IS NULL AND expected_predecessor_version IS NULL)
            OR (relation_type = 'cancel_recreate' AND predecessor_work_order_id IS NOT NULL
              AND expected_predecessor_version > 0 AND predecessor_work_order_id <> target_work_order_id))
        ),
        CONSTRAINT chk_repair_lineage_reason CHECK (
          (phase = 'proposal' AND ((relation_type = 'origin' AND reason_code = 'initial_registration')
            OR (relation_type = 'cancel_recreate' AND reason_code = 'cancelled_recreated_same_economic_fact')))
          OR (phase = 'approval' AND reason_code = 'lineage_verified')
        ),
        CONSTRAINT chk_repair_lineage_versions CHECK (expected_target_version > 0 AND version = 1),
        CONSTRAINT fk_repair_lineage_approval_proposal_semantics
          FOREIGN KEY (proposal_decision_id, proposal_phase_key,
            target_work_order_id, relation_type, predecessor_key,
            authorized_company_ref, authorized_business_sector_ref,
            authorized_store_ref, authorized_customer_ref,
            expected_predecessor_version_key, expected_target_version)
          REFERENCES \`${DECISIONS}\`(id, phase,
            target_work_order_id, relation_type, predecessor_key,
            authorized_company_ref, authorized_business_sector_ref,
            authorized_store_ref, authorized_customer_ref,
            expected_predecessor_version_key, expected_target_version)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT fk_repair_lineage_predecessor_work_order
          FOREIGN KEY (predecessor_work_order_id) REFERENCES repair_work_order_profiles(work_order_id)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT fk_repair_lineage_target_work_order
          FOREIGN KEY (target_work_order_id) REFERENCES repair_work_order_profiles(work_order_id)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT fk_repair_lineage_decision_root
          FOREIGN KEY (economic_root_id) REFERENCES \`${ROOTS}\`(economic_root_id)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT fk_repair_lineage_decision_actor
          FOREIGN KEY (actor_user_id) REFERENCES users(id)
          ON UPDATE RESTRICT ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  private async createClaims(queryRunner: QueryRunner) {
    await queryRunner.query(`
      CREATE TABLE \`${CLAIMS}\` (
        id BIGINT NOT NULL AUTO_INCREMENT,
        idempotency_key CHAR(84) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        phase VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        request_fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        actor_user_id INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_repair_lineage_idempotency_claim_key (idempotency_key),
        KEY idx_repair_lineage_idempotency_claim_actor (actor_user_id),
        CONSTRAINT chk_repair_lineage_claim_shape CHECK (
          REGEXP_LIKE(idempotency_key, '^lineage-idempotency:[0-9a-f]{64}$', 'c')
          AND phase IN ('proposal','approval')
          AND REGEXP_LIKE(request_fingerprint, '^[0-9a-f]{64}$', 'c')
        ),
        CONSTRAINT fk_repair_lineage_idempotency_claim_actor
          FOREIGN KEY (actor_user_id) REFERENCES users(id)
          ON UPDATE RESTRICT ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  private async createMutexes(queryRunner: QueryRunner) {
    await queryRunner.query(`
      CREATE TABLE \`${MUTEXES}\` (
        work_order_id INT NOT NULL,
        created_by_user_id INT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (work_order_id),
        KEY idx_repair_lineage_mutex_created_by (created_by_user_id),
        CONSTRAINT fk_repair_lineage_mutex_work_order
          FOREIGN KEY (work_order_id) REFERENCES repair_work_order_profiles(work_order_id)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT fk_repair_lineage_mutex_created_by
          FOREIGN KEY (created_by_user_id) REFERENCES users(id)
          ON UPDATE RESTRICT ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  private async createBindings(queryRunner: QueryRunner) {
    await queryRunner.query(`
      CREATE TABLE \`${BINDINGS}\` (
        work_order_id INT NOT NULL,
        economic_root_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        root_origin_work_order_id INT NOT NULL,
        lineage_role VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        accepted_phase VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'approval',
        relation_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        predecessor_work_order_id INT NULL,
        predecessor_key INT GENERATED ALWAYS AS (COALESCE(predecessor_work_order_id, 0)) STORED,
        accepted_decision_id BIGINT NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (work_order_id),
        UNIQUE KEY uq_repair_lineage_work_order_root (work_order_id, economic_root_id),
        UNIQUE KEY uq_repair_lineage_predecessor (predecessor_work_order_id),
        UNIQUE KEY uq_repair_lineage_binding_accepted_semantics
          (accepted_decision_id, accepted_phase, work_order_id, economic_root_id,
           relation_type, predecessor_key),
        KEY idx_repair_lineage_binding_root (economic_root_id),
        KEY idx_repair_lineage_root_origin_pair (root_origin_work_order_id, economic_root_id),
        KEY idx_repair_lineage_predecessor_root (predecessor_work_order_id, economic_root_id),
        CONSTRAINT chk_repair_lineage_binding_root
          CHECK (REGEXP_LIKE(economic_root_id, '^[0-9a-f]{64}$', 'c')),
        CONSTRAINT chk_repair_lineage_binding_role CHECK (
          accepted_phase = 'approval'
          AND ((lineage_role = 'origin' AND relation_type = 'origin'
              AND predecessor_work_order_id IS NULL AND root_origin_work_order_id = work_order_id)
            OR (lineage_role = 'recreated' AND relation_type = 'cancel_recreate'
              AND predecessor_work_order_id IS NOT NULL
              AND predecessor_work_order_id <> work_order_id
              AND root_origin_work_order_id <> work_order_id))
        ),
        CONSTRAINT fk_repair_lineage_binding_work_order
          FOREIGN KEY (work_order_id) REFERENCES repair_work_order_profiles(work_order_id)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT fk_repair_lineage_binding_root_origin
          FOREIGN KEY (root_origin_work_order_id, economic_root_id)
          REFERENCES \`${ROOTS}\`(origin_work_order_id, economic_root_id)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT fk_repair_lineage_binding_predecessor_same_root
          FOREIGN KEY (predecessor_work_order_id, economic_root_id)
          REFERENCES \`${BINDINGS}\`(work_order_id, economic_root_id)
          ON UPDATE RESTRICT ON DELETE RESTRICT,
        CONSTRAINT fk_repair_lineage_binding_accepted_semantics
          FOREIGN KEY (accepted_decision_id, accepted_phase, work_order_id,
            economic_root_id, relation_type, predecessor_key)
          REFERENCES \`${DECISIONS}\`(id, phase, target_work_order_id,
            economic_root_id, relation_type, predecessor_key)
          ON UPDATE RESTRICT ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  private async recoverContributionRootColumn(queryRunner: QueryRunner) {
    if (!(await this.columnExists(queryRunner, CONTRIBUTIONS, ROOT_COLUMN))) {
      await queryRunner.query(
        `ALTER TABLE \`${CONTRIBUTIONS}\`
          ADD COLUMN \`${ROOT_COLUMN}\` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER economic_fact_key`,
      );
    }
    if (!(await this.indexExists(queryRunner, CONTRIBUTIONS, 'uq_business_contribution_economic_root'))) {
      await queryRunner.query(
        `ALTER TABLE \`${CONTRIBUTIONS}\`
          ADD UNIQUE KEY uq_business_contribution_economic_root (\`${ROOT_COLUMN}\`)`,
      );
    }
    if (!(await this.checkExists(queryRunner, CONTRIBUTIONS, 'chk_business_contribution_economic_root'))) {
      await queryRunner.query(
        `ALTER TABLE \`${CONTRIBUTIONS}\`
          ADD CONSTRAINT chk_business_contribution_economic_root
          CHECK (\`${ROOT_COLUMN}\` IS NULL OR
            (REGEXP_LIKE(\`${ROOT_COLUMN}\`, '^[0-9a-f]{64}$', 'c')
              AND reversal_of_contribution_id IS NULL))`,
      );
    }
    if (!(await this.foreignKeyExists(queryRunner, CONTRIBUTIONS, 'fk_business_contribution_economic_root'))) {
      await queryRunner.query(
        `ALTER TABLE \`${CONTRIBUTIONS}\`
          ADD CONSTRAINT fk_business_contribution_economic_root
          FOREIGN KEY (\`${ROOT_COLUMN}\`) REFERENCES \`${ROOTS}\`(economic_root_id)
          ON UPDATE RESTRICT ON DELETE RESTRICT`,
      );
    }
  }

  private async assertPrerequisites(queryRunner: QueryRunner) {
    for (const table of [
      CONTRIBUTIONS,
      'repair_work_order_profiles',
      'repair_vehicle_profiles',
      'users',
    ]) {
      if (!(await this.tableExists(queryRunner, table))) {
        throw new Error(`repair_economic_lineage_0067_prerequisite_missing:${table}`);
      }
    }
    await this.assertReferencedUnique(queryRunner, 'repair_work_order_profiles', ['work_order_id']);
    await this.assertReferencedUnique(queryRunner, 'repair_vehicle_profiles', ['id']);
    await this.assertReferencedUnique(queryRunner, 'users', ['id']);
    for (const columnName of ['economic_fact_key', 'reversal_of_contribution_id']) {
      if (!(await this.columnExists(queryRunner, CONTRIBUTIONS, columnName))) {
        throw new Error(
          `repair_economic_lineage_0067_prerequisite_missing:${CONTRIBUTIONS}.${columnName}`,
        );
      }
    }
  }

  private async assertPlannedConstraintOwnership(queryRunner: QueryRunner) {
    const planned = [
      ...Object.entries(foreignKeys).flatMap(([table, specs]) =>
        Object.keys(specs).map((name) => ({ table, name, type: 'FOREIGN KEY' })),
      ),
      ...Object.entries(checkClauses).flatMap(([table, specs]) =>
        Object.keys(specs).map((name) => ({ table, name, type: 'CHECK' })),
      ),
      {
        table: CONTRIBUTIONS,
        name: 'fk_business_contribution_economic_root',
        type: 'FOREIGN KEY',
      },
      {
        table: CONTRIBUTIONS,
        name: 'chk_business_contribution_economic_root',
        type: 'CHECK',
      },
    ] as const;
    const uniqueNames = new Set(planned.map((item) => item.name));
    if (uniqueNames.size !== planned.length) {
      throw new Error('repair_economic_lineage_0067_constraint_plan_duplicate');
    }
    for (const item of planned) {
      const rows = await queryRunner.query(
        `SELECT table_name AS table_name, constraint_type AS constraint_type
           FROM information_schema.table_constraints
          WHERE constraint_schema = DATABASE() AND constraint_name = ?`,
        [item.name],
      );
      if (
        rows.length > 1 ||
        (rows.length === 1 &&
          (String(rows[0].table_name) !== item.table ||
            String(rows[0].constraint_type).toUpperCase() !== item.type))
      ) {
        throw new Error(
          `repair_economic_lineage_0067_constraint_owner_conflict:${item.name}`,
        );
      }
    }
  }

  private async assertComplete(queryRunner: QueryRunner) {
    await this.assertTableSchema(queryRunner, ROOTS, ROOT_COLUMNS);
    await this.assertTableSchema(queryRunner, DECISIONS, DECISION_COLUMNS);
    await this.assertTableSchema(queryRunner, CLAIMS, CLAIM_COLUMNS);
    await this.assertTableSchema(queryRunner, MUTEXES, MUTEX_COLUMNS);
    await this.assertTableSchema(queryRunner, BINDINGS, BINDING_COLUMNS);
    await this.assertContributionPartialState(queryRunner, true);
  }

  private async assertPartialRecoveryEmpty(
    queryRunner: QueryRunner,
    tableStates: readonly Readonly<{ table: string; exists: boolean }>[],
  ) {
    for (const { table, exists } of tableStates) {
      if (!exists) continue;
      const rows = await queryRunner.query(`SELECT COUNT(*) AS row_count FROM \`${table}\``);
      if (Number(rows[0]?.row_count ?? 0) !== 0) {
        throw new Error(`repair_economic_lineage_0067_partial_non_empty:${table}`);
      }
    }
    if (await this.columnExists(queryRunner, CONTRIBUTIONS, ROOT_COLUMN)) {
      const rows = await queryRunner.query(
        `SELECT COUNT(*) AS row_count FROM \`${CONTRIBUTIONS}\`
          WHERE \`${ROOT_COLUMN}\` IS NOT NULL`,
      );
      if (Number(rows[0]?.row_count ?? 0) !== 0) {
        throw new Error(
          'repair_economic_lineage_0067_partial_non_empty:business_contributions',
        );
      }
    }
  }

  private async assertTableSchema(
    queryRunner: QueryRunner,
    table: string,
    expectedColumns: readonly ColumnSpec[],
  ) {
    const tables = await queryRunner.query(
      `SELECT engine AS engine, table_collation AS table_collation
         FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = ?`,
      [table],
    );
    if (
      tables.length !== 1 ||
      String(tables[0].engine).toUpperCase() !== 'INNODB' ||
      String(tables[0].table_collation) !== 'utf8mb4_unicode_ci'
    ) {
      throw new Error(`repair_economic_lineage_0067_schema_incompatible:${table}:engine`);
    }
    const columns = await queryRunner.query(
      `SELECT column_name AS column_name, column_type AS column_type,
              is_nullable AS is_nullable, column_default AS column_default,
              extra AS extra, generation_expression AS generation_expression,
              character_set_name AS character_set_name, collation_name AS collation_name
         FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ?
        ORDER BY ordinal_position`,
      [table],
    );
    const actual = columns.map((row: Record<string, unknown>) => ({
      name: String(row.column_name),
      type: String(row.column_type).toLowerCase(),
      nullable: String(row.is_nullable),
      defaultValue: row.column_default == null
        ? null
        : String(row.column_default).trim().toLowerCase(),
      extra: String(row.extra ?? '').trim().toLowerCase().replace(/\s+/g, ' '),
      generationExpression: String(row.generation_expression ?? '')
        .replace(/`/g, '')
        .replace(/\s+/g, '')
        .replace(/^\((.*)\)$/u, '$1')
        .toLowerCase(),
      charset: row.character_set_name == null ? null : String(row.character_set_name),
      collation: row.collation_name == null ? null : String(row.collation_name),
    }));
    if (actual.length !== expectedColumns.length) {
      throw new Error(`repair_economic_lineage_0067_schema_incompatible:${table}:columns:count`);
    }
    for (let index = 0; index < expectedColumns.length; index += 1) {
      const expected = expectedColumns[index];
      const observed = actual[index];
      for (const field of COLUMN_SPEC_FIELDS) {
        if (observed[field] !== expected[field]) {
          throw new Error(
            `repair_economic_lineage_0067_schema_incompatible:${table}:columns:${expected.name}:${field}`,
          );
        }
      }
    }
    await this.assertIndexes(queryRunner, table, indexes[table]);
    await this.assertForeignKeys(queryRunner, table, foreignKeys[table]);
    await this.assertChecks(queryRunner, table, checkClauses[table] ?? {});
  }

  private async assertContributionPartialState(
    queryRunner: QueryRunner,
    requireComplete = false,
  ): Promise<boolean> {
    const column = await this.columnExists(queryRunner, CONTRIBUTIONS, ROOT_COLUMN);
    const index = await this.indexExists(
      queryRunner,
      CONTRIBUTIONS,
      'uq_business_contribution_economic_root',
    );
    const check = await this.checkExists(
      queryRunner,
      CONTRIBUTIONS,
      'chk_business_contribution_economic_root',
    );
    const foreignKey = await this.foreignKeyExists(
      queryRunner,
      CONTRIBUTIONS,
      'fk_business_contribution_economic_root',
    );
    if (!column && (index || check || foreignKey)) {
      throw new Error('repair_economic_lineage_0067_schema_incompatible:contribution_orphan');
    }
    if (column) {
      const rows = await queryRunner.query(
        `SELECT column_type AS column_type, is_nullable AS is_nullable,
                column_default AS column_default, extra AS extra,
                generation_expression AS generation_expression,
                character_set_name AS character_set_name, collation_name AS collation_name
           FROM information_schema.columns
          WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
        [CONTRIBUTIONS, ROOT_COLUMN],
      );
      if (
        rows.length !== 1 ||
        String(rows[0].column_type).toLowerCase() !== 'char(64)' ||
        String(rows[0].is_nullable) !== 'YES' ||
        rows[0].column_default != null ||
        String(rows[0].extra ?? '') !== '' ||
        String(rows[0].generation_expression ?? '') !== '' ||
        String(rows[0].character_set_name) !== 'ascii' ||
        String(rows[0].collation_name) !== 'ascii_bin'
      ) {
        throw new Error('repair_economic_lineage_0067_schema_incompatible:contribution_column');
      }
      if (index) {
        await this.assertIndexes(queryRunner, CONTRIBUTIONS, {
          uq_business_contribution_economic_root: {
            unique: true,
            columns: [ROOT_COLUMN],
          },
        }, false);
      }
      if (foreignKey) {
        await this.assertForeignKeys(queryRunner, CONTRIBUTIONS, {
          fk_business_contribution_economic_root: {
            columns: [ROOT_COLUMN],
            table: ROOTS,
            referencedColumns: ['economic_root_id'],
            updateRule: 'RESTRICT',
            deleteRule: 'RESTRICT',
          },
        }, false);
      }
      if (check) {
        await this.assertChecks(queryRunner, CONTRIBUTIONS, {
          chk_business_contribution_economic_root:
            "`canonical_economic_fact_root_id` IS NULL OR (regexp_like(`canonical_economic_fact_root_id`,'^[0-9a-f]{64}$','c') AND `reversal_of_contribution_id` IS NULL)",
        }, false);
      }

      // Dirty-data preflight is intentionally complete before any recovery DDL.
      // A partially-created column must never let malformed or guessed lineage
      // become legitimized by subsequently adding constraints.
      const populated = await queryRunner.query(
        `SELECT COUNT(*) AS row_count FROM \`${CONTRIBUTIONS}\`
          WHERE \`${ROOT_COLUMN}\` IS NOT NULL`,
      );
      const populatedCount = Number(populated[0]?.row_count ?? 0);
      const malformed = await queryRunner.query(
        `SELECT COUNT(*) AS row_count FROM \`${CONTRIBUTIONS}\`
          WHERE \`${ROOT_COLUMN}\` IS NOT NULL
            AND NOT REGEXP_LIKE(\`${ROOT_COLUMN}\`, '^[0-9a-f]{64}$', 'c')`,
      );
      if (Number(malformed[0]?.row_count ?? 0) !== 0) {
        throw new Error('repair_economic_lineage_0067_dirty:contribution_root_format');
      }
      const duplicates = await queryRunner.query(
        `SELECT COUNT(*) AS row_count FROM (
           SELECT \`${ROOT_COLUMN}\` FROM \`${CONTRIBUTIONS}\`
            WHERE \`${ROOT_COLUMN}\` IS NOT NULL
            GROUP BY \`${ROOT_COLUMN}\` HAVING COUNT(*) > 1
         ) duplicate_roots`,
      );
      if (Number(duplicates[0]?.row_count ?? 0) !== 0) {
        throw new Error('repair_economic_lineage_0067_dirty:contribution_root_duplicate');
      }
      const reversals = await queryRunner.query(
        `SELECT COUNT(*) AS row_count FROM \`${CONTRIBUTIONS}\`
          WHERE \`${ROOT_COLUMN}\` IS NOT NULL
            AND reversal_of_contribution_id IS NOT NULL`,
      );
      if (Number(reversals[0]?.row_count ?? 0) !== 0) {
        throw new Error('repair_economic_lineage_0067_dirty:contribution_reversal_root');
      }
      if (populatedCount !== 0) {
        if (!(await this.tableExists(queryRunner, ROOTS))) {
          throw new Error('repair_economic_lineage_0067_dirty:contribution_root_orphan');
        }
        const orphans = await queryRunner.query(
          `SELECT COUNT(*) AS row_count FROM \`${CONTRIBUTIONS}\` c
             LEFT JOIN \`${ROOTS}\` r
               ON r.economic_root_id = c.\`${ROOT_COLUMN}\`
            WHERE c.\`${ROOT_COLUMN}\` IS NOT NULL
              AND r.economic_root_id IS NULL`,
        );
        if (Number(orphans[0]?.row_count ?? 0) !== 0) {
          throw new Error('repair_economic_lineage_0067_dirty:contribution_root_orphan');
        }
        if (!(index && check && foreignKey)) {
          throw new Error(
            'repair_economic_lineage_0067_dirty:contribution_nonnull_incomplete_constraints',
          );
        }
      }
    }
    if (requireComplete && !(column && index && check && foreignKey)) {
      throw new Error('repair_economic_lineage_0067_schema_incomplete:business_contributions');
    }
    return column && index && check && foreignKey;
  }

  private async assertIndexes(
    queryRunner: QueryRunner,
    table: string,
    expected: Readonly<Record<string, IndexSpec>>,
    exact = true,
  ) {
    const rows = await queryRunner.query(
      `SELECT index_name AS index_name, non_unique AS non_unique,
              seq_in_index AS seq_in_index, column_name AS column_name
         FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = ?
        ORDER BY index_name, seq_in_index`,
      [table],
    );
    const actual = new Map<string, { unique: boolean; columns: string[] }>();
    for (const row of rows) {
      const name = String(row.index_name);
      const current = actual.get(name) ?? { unique: Number(row.non_unique) === 0, columns: [] };
      current.columns.push(String(row.column_name));
      actual.set(name, current);
    }
    if (exact && actual.size !== Object.keys(expected).length) {
      throw new Error(`repair_economic_lineage_0067_schema_incompatible:${table}:indexes`);
    }
    for (const [name, spec] of Object.entries(expected)) {
      const item = actual.get(name);
      if (!item || item.unique !== spec.unique || JSON.stringify(item.columns) !== JSON.stringify(spec.columns)) {
        throw new Error(`repair_economic_lineage_0067_schema_incompatible:${table}:index:${name}`);
      }
    }
  }

  private async assertForeignKeys(
    queryRunner: QueryRunner,
    table: string,
    expected: Readonly<Record<string, ForeignKeySpec>>,
    exact = true,
  ) {
    const rows = await queryRunner.query(
      `SELECT kcu.constraint_name AS constraint_name,
              kcu.column_name AS column_name,
              kcu.referenced_table_name AS referenced_table_name,
              kcu.referenced_column_name AS referenced_column_name,
              rc.update_rule AS update_rule, rc.delete_rule AS delete_rule,
              kcu.ordinal_position AS ordinal_position
         FROM information_schema.key_column_usage kcu
         JOIN information_schema.referential_constraints rc
           ON rc.constraint_schema = kcu.constraint_schema
          AND rc.constraint_name = kcu.constraint_name
        WHERE kcu.table_schema = DATABASE() AND kcu.table_name = ?
          AND kcu.referenced_table_name IS NOT NULL
        ORDER BY kcu.constraint_name, kcu.ordinal_position`,
      [table],
    );
    const actual = new Map<string, ForeignKeySpec>();
    for (const row of rows) {
      const name = String(row.constraint_name);
      const current = actual.get(name) ?? {
        columns: [],
        table: String(row.referenced_table_name),
        referencedColumns: [],
        updateRule: String(row.update_rule),
        deleteRule: String(row.delete_rule),
      };
      (current.columns as string[]).push(String(row.column_name));
      (current.referencedColumns as string[]).push(String(row.referenced_column_name));
      actual.set(name, current);
    }
    if (exact && actual.size !== Object.keys(expected).length) {
      throw new Error(`repair_economic_lineage_0067_schema_incompatible:${table}:foreign_keys`);
    }
    for (const [name, spec] of Object.entries(expected)) {
      if (JSON.stringify(actual.get(name)) !== JSON.stringify(spec)) {
        throw new Error(`repair_economic_lineage_0067_schema_incompatible:${table}:foreign_key:${name}`);
      }
    }
  }

  private async assertChecks(
    queryRunner: QueryRunner,
    table: string,
    expected: Readonly<Record<string, string>>,
    exact = true,
  ) {
    const rows = await queryRunner.query(
      `SELECT tc.constraint_name AS constraint_name,
              cc.check_clause AS check_clause, tc.enforced AS enforced
         FROM information_schema.table_constraints tc
         JOIN information_schema.check_constraints cc
           ON cc.constraint_schema = tc.constraint_schema
          AND cc.constraint_name = tc.constraint_name
        WHERE tc.table_schema = DATABASE() AND tc.table_name = ?
          AND tc.constraint_type = 'CHECK'
        ORDER BY tc.constraint_name`,
      [table],
    );
    const actual = new Map<string, CheckClauseMetadataRow0067>(
      rows.map((row: Record<string, unknown>) => [
        String(row.constraint_name),
        {
          checkClause: row.check_clause,
          enforced: row.enforced,
        },
      ] as [string, CheckClauseMetadataRow0067]),
    );
    for (const [name, clause] of Object.entries(expected)) {
      const problem = repairEconomicLineage0067CheckCompatibilityProblem(
        table,
        name,
        clause,
        actual.get(name),
      );
      if (problem) throw new Error(problem);
    }
    if (exact && actual.size !== Object.keys(expected).length) {
      throw new Error(`repair_economic_lineage_0067_schema_incompatible:${table}:checks`);
    }
  }

  private async assertReferencedUnique(
    queryRunner: QueryRunner,
    table: string,
    columns: readonly string[],
  ) {
    const rows = await queryRunner.query(
      `SELECT index_name AS index_name, seq_in_index AS seq_in_index,
              column_name AS column_name
         FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = ? AND non_unique = 0
        ORDER BY index_name, seq_in_index`,
      [table],
    );
    const grouped = new Map<string, string[]>();
    for (const row of rows) {
      const name = String(row.index_name);
      const list = grouped.get(name) ?? [];
      list.push(String(row.column_name));
      grouped.set(name, list);
    }
    if (![...grouped.values()].some((value) => JSON.stringify(value) === JSON.stringify(columns))) {
      throw new Error(`repair_economic_lineage_0067_prerequisite_not_unique:${table}`);
    }
  }

  private async tableExists(queryRunner: QueryRunner, table: string): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS row_count FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = ?`,
      [table],
    );
    return Number(rows[0]?.row_count ?? 0) === 1;
  }

  private async columnExists(queryRunner: QueryRunner, table: string, column: string) {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS row_count FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
      [table, column],
    );
    return Number(rows[0]?.row_count ?? 0) === 1;
  }

  private async indexExists(queryRunner: QueryRunner, table: string, index: string) {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS row_count FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
      [table, index],
    );
    return Number(rows[0]?.row_count ?? 0) > 0;
  }

  private async foreignKeyExists(queryRunner: QueryRunner, table: string, name: string) {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS row_count FROM information_schema.table_constraints
        WHERE table_schema = DATABASE() AND table_name = ?
          AND constraint_name = ? AND constraint_type = 'FOREIGN KEY'`,
      [table, name],
    );
    return Number(rows[0]?.row_count ?? 0) === 1;
  }

  private async checkExists(queryRunner: QueryRunner, table: string, name: string) {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS row_count FROM information_schema.table_constraints
        WHERE table_schema = DATABASE() AND table_name = ?
          AND constraint_name = ? AND constraint_type = 'CHECK'`,
      [table, name],
    );
    return Number(rows[0]?.row_count ?? 0) === 1;
  }
}
