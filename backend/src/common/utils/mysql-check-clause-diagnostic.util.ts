import {
  normalizeMysqlCheckClause,
  normalizeMysqlInformationSchemaCheckClause,
} from './mysql-check-clause.util';

export const CHECK_CLAUSE_DIAGNOSTIC_LIMIT = 2048;

export function authorityCheckCompatibilityProblem(
  constraintName: string,
  expectedClause: string,
  row?: Record<string, unknown>,
): string | null {
  if (!row) {
    return `finance_collection_confirmation_0065_incompatible:check_missing:${constraintName}`;
  }
  const enforced = String(row.enforced ?? '');
  if (enforced.toUpperCase() !== 'YES') {
    return `finance_collection_confirmation_0065_incompatible:check_not_enforced:${constraintName}:${JSON.stringify({ enforced })}`;
  }
  const rawClause = String(row.checkClause ?? '');
  const actualCanonical = normalizeMysqlInformationSchemaCheckClause(rawClause);
  const expectedCanonical = normalizeMysqlCheckClause(expectedClause);
  if (actualCanonical === expectedCanonical) {
    return null;
  }

  // CHECK text is fixed schema metadata, never business-row data. Keep the
  // diagnostic bounded and JSON-escaped so disposable MySQL CI can prove the
  // exact server form without weakening compatibility checks.
  const diagnostic = {
    constraintName,
    enforced,
    rawClause: rawClause.slice(0, CHECK_CLAUSE_DIAGNOSTIC_LIMIT),
    rawClauseTruncated: rawClause.length > CHECK_CLAUSE_DIAGNOSTIC_LIMIT,
    actualCanonical: actualCanonical.slice(0, CHECK_CLAUSE_DIAGNOSTIC_LIMIT),
    actualCanonicalTruncated:
      actualCanonical.length > CHECK_CLAUSE_DIAGNOSTIC_LIMIT,
    expectedCanonical: expectedCanonical.slice(0, CHECK_CLAUSE_DIAGNOSTIC_LIMIT),
    expectedCanonicalTruncated:
      expectedCanonical.length > CHECK_CLAUSE_DIAGNOSTIC_LIMIT,
  };
  return `finance_collection_confirmation_0065_incompatible:check_clause_mismatch:${constraintName}:${JSON.stringify(diagnostic)}`;
}
