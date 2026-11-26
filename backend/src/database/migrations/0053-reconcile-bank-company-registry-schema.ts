import { MigrationInterface, QueryRunner } from 'typeorm';

const companyRegistryTable = 'company_registry';
const bankAccountRegistryTable = 'bank_account_registry';

type RegistryTable = typeof companyRegistryTable | typeof bankAccountRegistryTable;

type ColumnContract = {
  name: string;
  ddl: string;
  generated?: {
    requiredFragments: string[];
    dataType: 'varchar';
    maxLength: number;
    nullable: boolean;
    characterSet: 'utf8mb4';
  };
};

type IndexContract = {
  name: string;
  unique: boolean;
  columns: string[];
  ddl: string;
};

type IndexSignature = {
  unique: boolean;
  columns: string[];
  subParts: Array<number | null>;
  indexTypes: string[];
  visibility: boolean[];
};

type GeneratedColumnDefinition = {
  extra: string;
  expression: string;
  dataType: string;
  maxLength: number | null;
  nullable: boolean;
  characterSet: string | null;
  collation: string | null;
  tableCollation: string | null;
};

const allowedTables = new Set<RegistryTable>([
  companyRegistryTable,
  bankAccountRegistryTable,
]);

const companyGeneratedExpression =
  "case when (`status` = _utf8mb4'active') then `company_name` else NULL end";

const bankGeneratedExpression =
  "case when (`status` = _utf8mb4'active') then concat(`company_id`,_utf8mb4'|',`bank_name`,_utf8mb4'|',`sms_sender`,_utf8mb4'|',`account_tail`) else NULL end";

const legacyBankGeneratedExpression =
  "case when (`status` = _utf8mb4'active') then concat(`company_id`,_utf8mb4'|',`bank_name`,_utf8mb4'|',`account_tail`) else NULL end";

export class ReconcileBankCompanyRegistrySchema00531783740000000
  implements MigrationInterface
{
  name = 'ReconcileBankCompanyRegistrySchema00531783740000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await ensureCompanyRegistrySchema(queryRunner);
    await ensureBankAccountRegistrySchema(queryRunner);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-destructive by design: these registry objects may predate this
    // compatibility bridge on the HQ server, so rollback must not remove them.
  }
}

async function ensureCompanyRegistrySchema(queryRunner: QueryRunner): Promise<void> {
  if (!(await hasTable(queryRunner, companyRegistryTable))) {
    await queryRunner.query(createCompanyRegistryTableSql);
  }

  await ensureColumns(queryRunner, companyRegistryTable, companyRegistryColumns);
  await verifyGeneratedColumn(queryRunner, companyRegistryTable, 'active_company_name_scope');
  await ensureIndex(queryRunner, companyRegistryTable, companyReviewStatusIndex);
  await ensureIndex(queryRunner, companyRegistryTable, companyActiveNameIndex);
}

async function ensureBankAccountRegistrySchema(queryRunner: QueryRunner): Promise<void> {
  if (!(await hasTable(queryRunner, bankAccountRegistryTable))) {
    await queryRunner.query(createBankAccountRegistryTableSql);
  }

  await ensureColumns(queryRunner, bankAccountRegistryTable, bankAccountRegistryColumns);
  await assertNoDuplicateActiveBankRegistryScope(queryRunner);
  await reconcileBankActiveRegistryScope(queryRunner);
  await ensureIndex(queryRunner, bankAccountRegistryTable, bankRegistryMatchIndex);
  await ensureIndex(queryRunner, bankAccountRegistryTable, bankRegistryReviewStatusIndex);
  await ensureIndex(queryRunner, bankAccountRegistryTable, bankRegistryActiveScopeIndex);
}

async function reconcileBankActiveRegistryScope(queryRunner: QueryRunner): Promise<void> {
  const columnName = 'active_registry_scope';
  const definition = await getGeneratedColumnDefinition(
    queryRunner,
    bankAccountRegistryTable,
    columnName,
  );
  if (!definition) {
    throw new Error(
      `generated column missing after schema reconciliation: ${bankAccountRegistryTable}.${columnName}`,
    );
  }

  const expected = getColumnContract(bankAccountRegistryTable, columnName).generated;
  if (!expected) {
    throw new Error(`generated column contract missing: ${bankAccountRegistryTable}.${columnName}`);
  }
  assertGeneratedColumnPhysicalContract(
    bankAccountRegistryTable,
    columnName,
    definition,
    expected,
  );

  const canonicalExpression = canonicalizeGeneratedExpression(definition.expression);
  if (canonicalExpression === canonicalizeGeneratedExpression(bankGeneratedExpression)) {
    return;
  }

  const isRecognizedLegacyScope =
    canonicalExpression === canonicalizeGeneratedExpression(legacyBankGeneratedExpression);
  if (!isRecognizedLegacyScope) {
    throw new Error(
      `generated column expression mismatch: ${bankAccountRegistryTable}.${columnName}`,
    );
  }

  const existingIndex = await getIndexSignature(
    queryRunner,
    bankAccountRegistryTable,
    bankRegistryActiveScopeIndex.name,
  );
  if (existingIndex) {
    assertIndexSignature(bankAccountRegistryTable, bankRegistryActiveScopeIndex, existingIndex);
  }

  const contract = getColumnContract(bankAccountRegistryTable, columnName);
  const addMissingIndexClause = existingIndex
    ? ''
    : ', ADD UNIQUE INDEX `uniq_bank_account_registry_active_scope` (`active_registry_scope`)';
  await queryRunner.query(
    `ALTER TABLE \`${bankAccountRegistryTable}\` MODIFY COLUMN ${contract.ddl}${addMissingIndexClause}`,
  );
  await verifyGeneratedColumn(queryRunner, bankAccountRegistryTable, columnName);
  const reconciledDefinition = await getGeneratedColumnDefinition(
    queryRunner,
    bankAccountRegistryTable,
    columnName,
  );
  if (
    !reconciledDefinition ||
    canonicalizeGeneratedExpression(reconciledDefinition.expression) !==
      canonicalizeGeneratedExpression(bankGeneratedExpression)
  ) {
    throw new Error(
      `generated column expression mismatch after reconciliation: ${bankAccountRegistryTable}.${columnName}`,
    );
  }
}

async function assertNoDuplicateActiveBankRegistryScope(
  queryRunner: QueryRunner,
): Promise<void> {
  const rows = await queryRunner.query(
    `SELECT COUNT(*) AS count
       FROM (
         SELECT ${bankGeneratedExpression} AS candidateScope
           FROM \`${bankAccountRegistryTable}\`
          WHERE \`status\` = 'active'
          GROUP BY candidateScope
         HAVING COUNT(*) > 1
       ) AS duplicate_active_registry_scope`,
  );
  if (Number(rows[0]?.count ?? 0) > 0) {
    throw new Error('duplicate active bank account registry scope exists');
  }
}

async function ensureColumns(
  queryRunner: QueryRunner,
  tableName: RegistryTable,
  columns: ColumnContract[],
): Promise<void> {
  assertAllowedTable(tableName);
  for (const column of columns) {
    assertAllowedColumn(tableName, column.name);
    if (!(await hasColumn(queryRunner, tableName, column.name))) {
      await queryRunner.query(`ALTER TABLE \`${tableName}\` ADD COLUMN ${column.ddl}`);
    }
  }
}

async function ensureIndex(
  queryRunner: QueryRunner,
  tableName: RegistryTable,
  expected: IndexContract,
): Promise<void> {
  assertAllowedTable(tableName);
  assertAllowedIndex(tableName, expected.name);
  const signature = await getIndexSignature(queryRunner, tableName, expected.name);
  if (!signature) {
    await queryRunner.query(expected.ddl);
    return;
  }

  assertIndexSignature(tableName, expected, signature);
}

async function hasTable(queryRunner: QueryRunner, tableName: RegistryTable): Promise<boolean> {
  assertAllowedTable(tableName);
  const rows = await queryRunner.query(
    `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?`,
    [tableName],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function hasColumn(
  queryRunner: QueryRunner,
  tableName: RegistryTable,
  columnName: string,
): Promise<boolean> {
  assertAllowedTable(tableName);
  assertAllowedColumn(tableName, columnName);
  const rows = await queryRunner.query(
    `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?`,
    [tableName, columnName],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function getIndexSignature(
  queryRunner: QueryRunner,
  tableName: RegistryTable,
  indexName: string,
): Promise<IndexSignature | null> {
  assertAllowedTable(tableName);
  assertAllowedIndex(tableName, indexName);
  const rows = (await queryRunner.query(
    `SELECT NON_UNIQUE AS nonUnique,
            COLUMN_NAME AS columnName,
            SEQ_IN_INDEX AS seqInIndex,
            SUB_PART AS subPart,
            INDEX_TYPE AS indexType,
            IS_VISIBLE AS isVisible
       FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
      ORDER BY SEQ_IN_INDEX`,
    [tableName, indexName],
  )) as Array<{
    nonUnique: number | string;
    columnName: string;
    subPart: number | string | null;
    indexType: string;
    isVisible: string;
  }>;

  if (rows.length === 0) {
    return null;
  }

  return {
    unique: rows.every((row) => Number(row.nonUnique) === 0),
    columns: rows.map((row) => String(row.columnName)),
    subParts: rows.map((row) => (row.subPart === null ? null : Number(row.subPart))),
    indexTypes: rows.map((row) => String(row.indexType).toUpperCase()),
    visibility: rows.map((row) => String(row.isVisible).toUpperCase() === 'YES'),
  };
}

async function getGeneratedColumnDefinition(
  queryRunner: QueryRunner,
  tableName: RegistryTable,
  columnName: string,
): Promise<GeneratedColumnDefinition | null> {
  assertAllowedTable(tableName);
  assertAllowedColumn(tableName, columnName);
  const rows = await queryRunner.query(
    `SELECT columns_table.EXTRA AS extra,
            columns_table.GENERATION_EXPRESSION AS expression,
            columns_table.DATA_TYPE AS dataType,
            columns_table.CHARACTER_MAXIMUM_LENGTH AS maxLength,
            columns_table.IS_NULLABLE AS isNullable,
            columns_table.CHARACTER_SET_NAME AS characterSet,
            columns_table.COLLATION_NAME AS collation,
            tables_table.TABLE_COLLATION AS tableCollation
       FROM INFORMATION_SCHEMA.COLUMNS AS columns_table
       INNER JOIN INFORMATION_SCHEMA.TABLES AS tables_table
         ON tables_table.TABLE_SCHEMA = columns_table.TABLE_SCHEMA
        AND tables_table.TABLE_NAME = columns_table.TABLE_NAME
      WHERE columns_table.TABLE_SCHEMA = DATABASE()
        AND columns_table.TABLE_NAME = ?
        AND columns_table.COLUMN_NAME = ?`,
    [tableName, columnName],
  );

  if (rows.length === 0) {
    return null;
  }

  return {
    extra: String(rows[0].extra ?? ''),
    expression: String(rows[0].expression ?? ''),
    dataType: String(rows[0].dataType ?? '').toLowerCase(),
    maxLength: rows[0].maxLength === null ? null : Number(rows[0].maxLength),
    nullable: String(rows[0].isNullable ?? '').toUpperCase() === 'YES',
    characterSet: rows[0].characterSet ? String(rows[0].characterSet).toLowerCase() : null,
    collation: rows[0].collation ? String(rows[0].collation).toLowerCase() : null,
    tableCollation: rows[0].tableCollation
      ? String(rows[0].tableCollation).toLowerCase()
      : null,
  };
}

async function verifyGeneratedColumn(
  queryRunner: QueryRunner,
  tableName: RegistryTable,
  columnName: string,
): Promise<void> {
  const definition = await getGeneratedColumnDefinition(queryRunner, tableName, columnName);
  if (!definition) {
    throw new Error(`generated column missing after schema reconciliation: ${tableName}.${columnName}`);
  }

  const expected = getColumnContract(tableName, columnName).generated;
  if (!expected) {
    return;
  }
  assertGeneratedColumnPhysicalContract(tableName, columnName, definition, expected);

  const normalizedExpression = normalizeGeneratedExpression(definition.expression);
  if (!hasGeneratedFragmentsInOrder(normalizedExpression, expected.requiredFragments)) {
    throw new Error(`generated column expression mismatch: ${tableName}.${columnName}`);
  }
}

function assertGeneratedColumnPhysicalContract(
  tableName: RegistryTable,
  columnName: string,
  definition: GeneratedColumnDefinition,
  expected: NonNullable<ColumnContract['generated']>,
): void {
  const isStoredGenerated = definition.extra.toUpperCase().includes('STORED GENERATED');
  const hasExpectedType = definition.dataType === expected.dataType;
  const hasExpectedLength = definition.maxLength === expected.maxLength;
  const hasExpectedNullability = definition.nullable === expected.nullable;
  const hasExpectedCharacterSet = definition.characterSet === expected.characterSet;
  const hasExpectedCollation =
    definition.collation !== null &&
    definition.tableCollation !== null &&
    definition.collation === definition.tableCollation &&
    definition.collation.startsWith(`${expected.characterSet}_`);

  if (
    !isStoredGenerated ||
    !hasExpectedType ||
    !hasExpectedLength ||
    !hasExpectedNullability ||
    !hasExpectedCharacterSet ||
    !hasExpectedCollation
  ) {
    throw new Error(`generated column physical contract mismatch: ${tableName}.${columnName}`);
  }
}

function hasGeneratedFragmentsInOrder(expression: string, fragments: string[]): boolean {
  let nextOffset = 0;
  for (const fragment of fragments) {
    const fragmentOffset = expression.indexOf(fragment, nextOffset);
    if (fragmentOffset < 0) {
      return false;
    }
    nextOffset = fragmentOffset + fragment.length;
  }
  return true;
}

function assertIndexSignature(
  tableName: RegistryTable,
  expected: IndexContract,
  actual: IndexSignature,
): void {
  const sameUniqueness = actual.unique === expected.unique;
  const sameColumns =
    actual.columns.length === expected.columns.length &&
    actual.columns.every((columnName, index) => columnName === expected.columns[index]);
  const hasNoPrefixParts = actual.subParts.every((subPart) => subPart === null);
  const usesBtree = actual.indexTypes.every((indexType) => indexType === 'BTREE');
  const isVisible = actual.visibility.every(Boolean);

  if (!sameUniqueness || !sameColumns || !hasNoPrefixParts || !usesBtree || !isVisible) {
    throw new Error(`existing index signature mismatch: ${tableName}.${expected.name}`);
  }
}

function getColumnContract(tableName: RegistryTable, columnName: string): ColumnContract {
  assertAllowedTable(tableName);
  assertAllowedColumn(tableName, columnName);
  const columns =
    tableName === companyRegistryTable ? companyRegistryColumns : bankAccountRegistryColumns;
  const contract = columns.find((column) => column.name === columnName);
  if (!contract) {
    throw new Error(`unsupported column contract: ${tableName}.${columnName}`);
  }
  return contract;
}

function assertAllowedTable(tableName: string): asserts tableName is RegistryTable {
  if (!allowedTables.has(tableName as RegistryTable)) {
    throw new Error(`unsupported registry table: ${tableName}`);
  }
}

function assertAllowedColumn(tableName: RegistryTable, columnName: string): void {
  const allowedColumns = new Set(
    (tableName === companyRegistryTable ? companyRegistryColumns : bankAccountRegistryColumns).map(
      (column) => column.name,
    ),
  );
  if (!allowedColumns.has(columnName)) {
    throw new Error(`unsupported registry column: ${tableName}.${columnName}`);
  }
}

function assertAllowedIndex(tableName: RegistryTable, indexName: string): void {
  const allowedIndexes = new Set(
    (tableName === companyRegistryTable ? companyRegistryIndexes : bankAccountRegistryIndexes).map(
      (index) => index.name,
    ),
  );
  if (!allowedIndexes.has(indexName)) {
    throw new Error(`unsupported registry index: ${tableName}.${indexName}`);
  }
}

function normalizeGeneratedExpression(expression: string): string {
  return expression
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

function canonicalizeGeneratedExpression(expression: string): string {
  return normalizeGeneratedExpression(expression)
    .replace(/_utf8mb4/g, '')
    .replace(/\\'/g, "'")
    .replace(/[()\s]/g, '');
}

const idColumn = '`id` int NOT NULL AUTO_INCREMENT PRIMARY KEY';
const createdAtColumn = '`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP';
const updatedAtColumn =
  '`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP';

const companyRegistryColumns: ColumnContract[] = [
  { name: 'id', ddl: idColumn },
  { name: 'company_name', ddl: '`company_name` varchar(200) NOT NULL' },
  { name: 'company_short_name', ddl: '`company_short_name` varchar(100) NULL' },
  {
    name: 'company_type',
    ddl: "`company_type` enum('operating_company','internal_company') NOT NULL DEFAULT 'operating_company'",
  },
  { name: 'status', ddl: "`status` enum('active','inactive') NOT NULL DEFAULT 'active'" },
  { name: 'evidence_source', ddl: '`evidence_source` varchar(100) NULL' },
  { name: 'evidence_ref', ddl: '`evidence_ref` varchar(200) NULL' },
  { name: 'created_by', ddl: '`created_by` varchar(100) NULL' },
  { name: 'reviewed_by', ddl: '`reviewed_by` varchar(100) NULL' },
  {
    name: 'review_status',
    ddl: "`review_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending'",
  },
  { name: 'review_remark', ddl: '`review_remark` varchar(500) NULL' },
  {
    name: 'active_company_name_scope',
    ddl: `\`active_company_name_scope\` varchar(200) GENERATED ALWAYS AS (${companyGeneratedExpression}) STORED`,
    generated: {
      requiredFragments: ['case when', 'status', 'active', 'company_name', 'else null'],
      dataType: 'varchar',
      maxLength: 200,
      nullable: true,
      characterSet: 'utf8mb4',
    },
  },
  { name: 'created_at', ddl: createdAtColumn },
  { name: 'updated_at', ddl: updatedAtColumn },
];

const bankAccountRegistryColumns: ColumnContract[] = [
  { name: 'id', ddl: idColumn },
  { name: 'company_id', ddl: '`company_id` int NOT NULL' },
  { name: 'bank_name', ddl: '`bank_name` varchar(100) NOT NULL' },
  { name: 'sms_sender', ddl: '`sms_sender` varchar(100) NOT NULL' },
  { name: 'account_tail', ddl: '`account_tail` varchar(8) NOT NULL' },
  { name: 'account_alias', ddl: '`account_alias` varchar(100) NOT NULL' },
  { name: 'account_holder', ddl: '`account_holder` varchar(100) NULL' },
  { name: 'virtual_ledger_id', ddl: '`virtual_ledger_id` int NULL' },
  { name: 'device_id', ddl: '`device_id` varchar(100) NULL' },
  { name: 'sim_slot', ddl: '`sim_slot` int NULL' },
  { name: 'status', ddl: "`status` enum('active','inactive') NOT NULL DEFAULT 'active'" },
  { name: 'account_use', ddl: '`account_use` varchar(80) NULL' },
  { name: 'evidence_source', ddl: '`evidence_source` varchar(200) NULL' },
  { name: 'evidence_ref', ddl: '`evidence_ref` varchar(200) NULL' },
  { name: 'created_by', ddl: '`created_by` int NULL' },
  { name: 'reviewed_by', ddl: '`reviewed_by` int NULL' },
  {
    name: 'review_status',
    ddl: "`review_status` enum('pending_review','reviewed','rejected') NOT NULL DEFAULT 'pending_review'",
  },
  { name: 'review_remark', ddl: '`review_remark` varchar(500) NULL' },
  {
    name: 'active_registry_scope',
    ddl: `\`active_registry_scope\` varchar(255) GENERATED ALWAYS AS (${bankGeneratedExpression}) STORED`,
    generated: {
      requiredFragments: [
        'case when',
        'status',
        'active',
        'concat',
        'company_id',
        'bank_name',
        'sms_sender',
        'account_tail',
        'else null',
      ],
      dataType: 'varchar',
      maxLength: 255,
      nullable: true,
      characterSet: 'utf8mb4',
    },
  },
  { name: 'created_at', ddl: createdAtColumn },
  { name: 'updated_at', ddl: updatedAtColumn },
];

const companyReviewStatusIndex: IndexContract = {
  name: 'idx_company_registry_review_status',
  unique: false,
  columns: ['review_status', 'status'],
  ddl: 'CREATE INDEX `idx_company_registry_review_status` ON `company_registry` (`review_status`, `status`)',
};

const companyActiveNameIndex: IndexContract = {
  name: 'uniq_company_registry_active_company_name',
  unique: true,
  columns: ['active_company_name_scope'],
  ddl: 'CREATE UNIQUE INDEX `uniq_company_registry_active_company_name` ON `company_registry` (`active_company_name_scope`)',
};

const bankRegistryMatchIndex: IndexContract = {
  name: 'idx_bank_account_registry_match',
  unique: false,
  columns: ['bank_name', 'sms_sender', 'account_tail', 'status'],
  ddl: 'CREATE INDEX `idx_bank_account_registry_match` ON `bank_account_registry` (`bank_name`, `sms_sender`, `account_tail`, `status`)',
};

const bankRegistryReviewStatusIndex: IndexContract = {
  name: 'idx_bank_account_registry_review_status',
  unique: false,
  columns: ['review_status', 'status'],
  ddl: 'CREATE INDEX `idx_bank_account_registry_review_status` ON `bank_account_registry` (`review_status`, `status`)',
};

const bankRegistryActiveScopeIndex: IndexContract = {
  name: 'uniq_bank_account_registry_active_scope',
  unique: true,
  columns: ['active_registry_scope'],
  ddl: 'CREATE UNIQUE INDEX `uniq_bank_account_registry_active_scope` ON `bank_account_registry` (`active_registry_scope`)',
};

const companyRegistryIndexes = [companyReviewStatusIndex, companyActiveNameIndex];
const bankAccountRegistryIndexes = [
  bankRegistryMatchIndex,
  bankRegistryReviewStatusIndex,
  bankRegistryActiveScopeIndex,
];

const createCompanyRegistryTableSql = `
CREATE TABLE \`company_registry\` (
  ${companyRegistryColumns.map((column) => column.ddl).join(',\n  ')}
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const createBankAccountRegistryTableSql = `
CREATE TABLE \`bank_account_registry\` (
  ${bankAccountRegistryColumns.map((column) => column.ddl).join(',\n  ')}
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;
