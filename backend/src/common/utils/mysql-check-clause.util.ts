/**
 * Quote-aware, fail-closed normalization for MySQL CHECK clause text.
 *
 * MySQL stores CHECK clauses in `information_schema.CHECK_CONSTRAINTS` with
 * backtick-quoted identifiers and preserves the original DDL case, while our
 * expected clauses are written lower-case and unquoted. The two only need to
 * become comparable without ever mutating string literal content or collapsing
 * two semantically distinct clauses into one:
 *
 *   - single-quoted string literals are copied byte-for-byte (case, backticks,
 *     inner whitespace and introducer-like text are preserved);
 *   - double-quoted tokens are copied byte-for-byte too: under an unknown
 *     sql_mode `"A"` may be a literal or an identifier, so its content never
 *     participates in case folding, whitespace collapsing, parentheses
 *     scanning or operator detection;
 *   - a backtick-quoted identifier is unquoted and lower-cased only when it is
 *     closed, contains no escaped backtick, matches the conservative
 *     bare-identifier grammar `[A-Za-z_][A-Za-z0-9_$]*` and its lower-cased
 *     name belongs to the auditable 0065 CHECK identifier allowlist; any other
 *     name (reserved words such as `true`/`false`/`null`/`unknown`/`current_
 *     date`, context tokens, operators, spaces, escaped backticks or
 *     non-identifier content) is preserved verbatim as an opaque `\`...\`` token;
 *   - bare identifiers / keywords are lower-cased;
 *   - whitespace outside quoted regions is collapsed to single spaces;
 *   - the only charset introducer that is dropped is a standalone ASCII
 *     `_utf8mb4` immediately followed by an ASCII-only single-quoted literal.
 *     This is the sole introducer MySQL 8.0 auto-emits for the utf8mb4 CHECK
 *     literals this migration compares; because the literal is ASCII-only,
 *     removing the introducer is provably semantics-preserving under any
 *     ASCII-compatible connection charset. `_utf8`, `_latin1` and `_binary`
 *     are never stripped, so `_binary'x'` can never equal `'x'`.
 *
 * Anything the lexer cannot confidently classify (an unterminated single,
 * double or backtick quote, or a backslash escape inside a quoted token whose
 * meaning depends on the SQL mode) is fail-closed: the whole clause is returned
 * verbatim instead of normalized, so an ambiguous clause cannot collapse into
 * an unsafe equality such as `code='A'` === `code='a'`, `code='a  b'` ===
 * `code='a b'`, `code="A"` === `code="a"`, `\`content_version > 0\`` ===
 * `content_version > 0`, or `_binary'...'` === `'...'`.
 */

const ASCII_BARE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_$]*$/;
const ASCII_IDENTIFIER_CHARACTER = /[A-Za-z0-9_$]/;
const ASCII_UTF8MB4_INTRODUCER = '_utf8mb4';
const MYSQL_INFORMATION_SCHEMA_ESCAPED_LITERAL_PREFIX = "_utf8mb4\\'";

/**
 * Auditable pure allowlist predicate for backtick-quoted identifiers that the
 * normalizer may unquote and lower-case. It is mechanically extracted from the 0065 CHECK
 * constraints' expected column names across finance_collection_confirmation_
 * authorities, bank_account_registry, bank_account_registry_review_authority
 * and wechat_settlement_batch, so the 0065 comparison can fold MySQL's
 * backticked DDL columns onto our lower-case expected clauses without ever
 * folding reserved words or arbitrary context tokens (e.g. `true`, `false`,
 * `null`, `unknown`, `current_date`), which keep their full backtick token.
 */
function isMysql0065CheckIdentifier(value: string): boolean {
  switch (value) {
    case 'authority_hash':
      return true;
    case 'bank_account_registry_id':
      return true;
    case 'bank_account_registry_snapshot_hash':
      return true;
    case 'bank_match_suggested_at':
      return true;
    case 'bank_match_suggestion_bank_sms_transaction_id':
      return true;
    case 'bank_match_suggestion_registry_id':
      return true;
    case 'bank_match_suggestion_registry_updated_at':
      return true;
    case 'bank_match_suggestion_snapshot_hash':
      return true;
    case 'bank_match_suggestion_version':
      return true;
    case 'bank_snapshot_hash':
      return true;
    case 'canonical_snapshot_hash':
      return true;
    case 'content_snapshot_hash':
      return true;
    case 'content_version':
      return true;
    case 'currency':
      return true;
    case 'fee_cents':
      return true;
    case 'formal_review_authority_hash':
      return true;
    case 'formal_review_authority_id':
      return true;
    case 'gross_cents':
      return true;
    case 'link_snapshot_hash':
      return true;
    case 'match_status':
      return true;
    case 'net_cents':
      return true;
    case 'profile_scope_snapshot_hash':
      return true;
    case 'reason_code':
      return true;
    case 'source_mode':
      return true;
    case 'source_version':
      return true;
    case 'work_order_snapshot_hash':
      return true;
    default:
      return false;
  }
}

/**
 * Exact 0065 ASCII literal values that MySQL 8.0.46 may serialize in
 * information_schema.CHECK_CONSTRAINTS with a backslash before each outer
 * apostrophe. This is deliberately a pure switch rather than a mutable Set or
 * a pattern: a seventh value requires an explicit reviewed source change.
 */
function isMysql0065EscapedMetadataLiteral(value: string): boolean {
  switch (value) {
    case 'bank_transfer_one_to_one_v1':
      return true;
    case 'cny':
      return true;
    case 'confirmed':
      return true;
    case 'repair_bank_collection_confirmed':
      return true;
    case 'suggested':
      return true;
    case 'v1':
      return true;
    default:
      return false;
  }
}

interface ScannedRegion {
  text: string;
  end: number;
  opaque: boolean;
}

export function normalizeMysqlCheckClause(clause: unknown): string {
  const raw = String(clause ?? '');
  const lexed = normalizeOutsideStringLiterals(raw);
  if (lexed.opaque) {
    // Fail closed: preserve the ambiguous clause verbatim so it can never be
    // mistaken for (or collapse onto) a confidently normalized clause.
    return raw;
  }
  let normalized = lexed.text;
  normalized = stripRedundantAtomicGroupingParentheses(normalized);
  while (hasSingleBalancedOuterPair(normalized)) {
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized;
}

/**
 * Normalizes only actual CHECK_CLAUSE metadata read from
 * information_schema.CHECK_CONSTRAINTS. MySQL 8.0.46 has been observed to
 * serialize the 0065 ASCII literals as `_utf8mb4\\'<value>\\'`. Decode that
 * exact metadata wrapper before applying the ordinary CHECK normalizer.
 *
 * This does not relax normalizeMysqlCheckClause or readStringLiteral. Any
 * unknown value, malformed wrapper, illegal adjacency, quoted occurrence or
 * other backslash makes the entire metadata clause opaque and returns it
 * verbatim.
 */
export function normalizeMysqlInformationSchemaCheckClause(clause: unknown): string {
  const raw = String(clause ?? '');
  const decoded = decodeMysqlInformationSchemaEscapedLiterals(raw);
  if (decoded.opaque) return raw;
  return normalizeMysqlCheckClause(decoded.text);
}

function decodeMysqlInformationSchemaEscapedLiterals(
  raw: string,
): { text: string; opaque: boolean } {
  let output = '';
  let index = 0;
  while (index < raw.length) {
    const char = raw[index];

    if (char === "'") {
      const literal = readStringLiteral(raw, index);
      if (literal.opaque) return { text: raw, opaque: true };
      output += raw.slice(index, literal.end);
      index = literal.end;
      continue;
    }

    if (char === '"') {
      const token = readDoubleQuotedOpaque(raw, index);
      if (token.opaque) return { text: raw, opaque: true };
      output += raw.slice(index, token.end);
      index = token.end;
      continue;
    }

    if (char === '`') {
      const identifier = readBacktickIdentifier(raw, index);
      const originalToken = raw.slice(index, identifier.end);
      if (identifier.opaque || originalToken.includes('\\')) {
        return { text: raw, opaque: true };
      }
      output += originalToken;
      index = identifier.end;
      continue;
    }

    if (
      char === '_' &&
      raw.startsWith(MYSQL_INFORMATION_SCHEMA_ESCAPED_LITERAL_PREFIX, index)
    ) {
      const literal = readMysql0065EscapedMetadataLiteral(raw, index);
      if (literal.opaque) return { text: raw, opaque: true };
      output += literal.text;
      index = literal.end;
      continue;
    }

    if (char === '\\') return { text: raw, opaque: true };
    output += char;
    index += 1;
  }
  return { text: output, opaque: false };
}

function readMysql0065EscapedMetadataLiteral(
  raw: string,
  start: number,
): ScannedRegion {
  if (!isMysqlMetadataLiteralLeftBoundary(raw, start)) {
    return { text: raw.slice(start), end: raw.length, opaque: true };
  }
  const valueStart = start + MYSQL_INFORMATION_SCHEMA_ESCAPED_LITERAL_PREFIX.length;
  const closingBackslash = raw.indexOf('\\', valueStart);
  if (closingBackslash < 0 || raw[closingBackslash + 1] !== "'") {
    return { text: raw.slice(start), end: raw.length, opaque: true };
  }
  const value = raw.slice(valueStart, closingBackslash);
  const end = closingBackslash + 2;
  if (
    !isMysql0065EscapedMetadataLiteral(value) ||
    !isMysqlMetadataLiteralRightBoundary(raw, end)
  ) {
    return { text: raw.slice(start), end: raw.length, opaque: true };
  }
  return { text: `'${value}'`, end, opaque: false };
}

function isMysqlMetadataLiteralLeftBoundary(raw: string, index: number): boolean {
  if (index === 0) return true;
  const before = raw[index - 1];
  return isAsciiSqlMetadataWhitespace(before) || before === '(' || before === ',' || before === '=';
}

function isMysqlMetadataLiteralRightBoundary(raw: string, index: number): boolean {
  if (index === raw.length) return true;
  const after = raw[index];
  return isAsciiSqlMetadataWhitespace(after) || after === ')' || after === ',';
}

function isAsciiSqlMetadataWhitespace(value: string): boolean {
  return value === ' ' || value === '\t' || value === '\r' || value === '\n' || value === '\f';
}

/**
 * Single-pass quote-aware lexer. Single-quoted literals, double-quoted opaque
 * tokens and backtick identifiers are consumed by dedicated scanners; every
 * other character is lower-cased and whitespace runs are collapsed to one
 * space. This is the only place where case folding, backtick removal and the
 * narrow `_utf8mb4` introducer removal happen.
 */
function normalizeOutsideStringLiterals(raw: string): { text: string; opaque: boolean } {
  let output = '';
  let pendingSpace = false;
  let index = 0;
  const flushSpace = () => {
    if (pendingSpace) {
      output += ' ';
      pendingSpace = false;
    }
  };

  while (index < raw.length) {
    const char = raw[index];

    if (char === "'") {
      flushSpace();
      const literal = readStringLiteral(raw, index);
      if (literal.opaque) return { text: raw, opaque: true };
      output += literal.text;
      index = literal.end;
      continue;
    }

    if (char === '"') {
      flushSpace();
      const token = readDoubleQuotedOpaque(raw, index);
      if (token.opaque) return { text: raw, opaque: true };
      output += token.text;
      index = token.end;
      continue;
    }

    if (char === '`') {
      flushSpace();
      const identifier = readBacktickIdentifier(raw, index);
      if (identifier.opaque) return { text: raw, opaque: true };
      output += identifier.text;
      index = identifier.end;
      continue;
    }

    if (char === '_') {
      const introducerLength = asciiUtf8mb4IntroducerLength(raw, index);
      if (introducerLength > 0) {
        // Drop only the narrow ASCII `_utf8mb4` introducer. The immediately
        // following ASCII literal is emitted verbatim on the next iteration.
        index += introducerLength;
        continue;
      }
      // Not the narrow introducer: fall through and emit '_' as a normal
      // identifier character below.
    }

    if (/\s/.test(char)) {
      if (output.length > 0) pendingSpace = true;
      index += 1;
      while (index < raw.length && /\s/.test(raw[index])) index += 1;
      continue;
    }

    flushSpace();
    output += char.toLowerCase();
    index += 1;
  }

  return { text: output, opaque: false };
}

/**
 * Returns the length of the standalone `_utf8mb4` introducer starting at
 * `index`, or 0 when the sequence must not be stripped. The introducer is
 * recognized case-insensitively, is immediately followed by a single-quoted
 * ASCII-only literal, and its front boundary is only the clause start or an
 * explicit safe ASCII SQL delimiter/whitespace. Any non-ASCII character (for
 * example ©, é, or a CJK identifier) and any ASCII identifier character block
 * the strip, so `foo_utf8mb4'x'` and `é_utf8mb4'x'` stay untouched.
 */
function asciiUtf8mb4IntroducerLength(raw: string, index: number): number {
  if (raw.slice(index, index + ASCII_UTF8MB4_INTRODUCER.length).toLowerCase() !== ASCII_UTF8MB4_INTRODUCER) {
    return 0;
  }
  const afterIntroducer = index + ASCII_UTF8MB4_INTRODUCER.length;
  if (raw[afterIntroducer] !== "'") return 0;
  if (index > 0) {
    const beforeCode = raw.charCodeAt(index - 1);
    if (beforeCode > 0x7f) return 0;
    if (ASCII_IDENTIFIER_CHARACTER.test(raw[index - 1])) return 0;
  }
  const literal = readStringLiteral(raw, afterIntroducer);
  if (literal.opaque || !isAsciiOnly(literal.text)) return 0;
  return ASCII_UTF8MB4_INTRODUCER.length;
}

function isAsciiOnly(value: string): boolean {
  return /^[\x00-\x7f]*$/.test(value);
}

/**
 * Scans a single-quoted string literal starting at the opening quote at
 * `start`. The literal content is preserved verbatim, including `''`
 * (doubled-quote) escapes. An unterminated literal or a backslash escape
 * (whose meaning depends on the SQL mode) is reported as `opaque` so the whole
 * clause fails closed rather than being normalized.
 */
function readStringLiteral(raw: string, start: number): ScannedRegion {
  let text = "'";
  let index = start + 1;
  while (index < raw.length) {
    const char = raw[index];
    if (char === "'") {
      if (raw[index + 1] === "'") {
        text += "''";
        index += 2;
        continue;
      }
      text += "'";
      return { text, end: index + 1, opaque: false };
    }
    if (char === '\\') {
      // Backslash escapes are SQL-mode dependent: fail closed on the clause.
      return { text: raw.slice(start), end: raw.length, opaque: true };
    }
    text += char;
    index += 1;
  }
  return { text, end: index, opaque: true };
}

/**
 * Scans a double-quoted token starting at the opening quote at `start`. Under
 * an unknown sql_mode `"..."` may be a literal or an identifier, so the whole
 * token (including the quotes) is preserved byte-for-byte and its content is
 * excluded from case folding, whitespace collapsing and structural scanning.
 * An unterminated token or a backslash escape fails closed.
 */
function readDoubleQuotedOpaque(raw: string, start: number): ScannedRegion {
  let index = start + 1;
  while (index < raw.length) {
    const char = raw[index];
    if (char === '"') {
      if (raw[index + 1] === '"') {
        index += 2;
        continue;
      }
      return { text: raw.slice(start, index + 1), end: index + 1, opaque: false };
    }
    if (char === '\\') {
      return { text: raw.slice(start), end: raw.length, opaque: true };
    }
    index += 1;
  }
  return { text: raw.slice(start), end: raw.length, opaque: true };
}

/**
 * Scans a backtick-quoted identifier starting at the opening backtick at
 * `start`. The content is unquoted and lower-cased only when the token is
 * closed, has no escaped backtick, matches the conservative bare-identifier
 * grammar and its lower-cased name is in the auditable 0065 CHECK identifier
 * allowlist; otherwise the whole `\`...\`` token is preserved verbatim (opaque).
 * An unterminated backtick fails closed for the whole clause.
 */
function readBacktickIdentifier(raw: string, start: number): ScannedRegion {
  let content = '';
  let index = start + 1;
  let hasEscapedBacktick = false;
  let closed = false;
  while (index < raw.length) {
    const char = raw[index];
    if (char === '`') {
      if (raw[index + 1] === '`') {
        hasEscapedBacktick = true;
        content += '`';
        index += 2;
        continue;
      }
      closed = true;
      index += 1;
      break;
    }
    content += char;
    index += 1;
  }
  if (!closed) {
    return { text: raw.slice(start), end: raw.length, opaque: true };
  }
  const folded = content.toLowerCase();
  if (
    !hasEscapedBacktick &&
    ASCII_BARE_IDENTIFIER.test(content) &&
    isMysql0065CheckIdentifier(folded)
  ) {
    return { text: folded, end: index, opaque: false };
  }
  return { text: raw.slice(start, index), end: index, opaque: false };
}

function stripRedundantAtomicGroupingParentheses(value: string): string {
  let current = value;
  for (;;) {
    const removable = findFirstRemovableAtomicPair(current);
    if (!removable) return current;
    current = `${current.slice(0, removable.start)}${current
      .slice(removable.start + 1, removable.end)
      .trim()}${current.slice(removable.end + 1)}`;
  }
}

function findFirstRemovableAtomicPair(
  value: string,
): { start: number; end: number } | null {
  const stack: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "'" || char === '"' || char === '`') {
      index = skipQuotedRegion(value, index) - 1;
      continue;
    }
    if (char === '(') {
      stack.push(index);
      continue;
    }
    if (char !== ')') continue;
    const start = stack.pop();
    if (start === undefined) return null;
    if (isFunctionOrListParenthesis(value, start)) continue;
    const content = value.slice(start + 1, index);
    if (
      isBooleanOperandContext(value, start, index) &&
      !containsTopLevelBooleanOperator(content) &&
      containsTopLevelPredicateOperator(content)
    ) {
      return { start, end: index };
    }
  }
  return null;
}

function isBooleanOperandContext(value: string, start: number, end: number): boolean {
  const before = value.slice(0, start).trimEnd();
  const after = value.slice(end + 1).trimStart();
  const beforeIsBooleanBoundary =
    before.length === 0 ||
    before.endsWith('(') ||
    ['and', 'or', 'xor'].some((operator) => endsWithWord(before, operator));
  const afterIsBooleanBoundary =
    after.length === 0 ||
    after.startsWith(')') ||
    ['and', 'or', 'xor'].some((operator) => isWordAt(after, 0, operator));
  return beforeIsBooleanBoundary && afterIsBooleanBoundary;
}

function endsWithWord(value: string, word: string): boolean {
  const start = value.length - word.length;
  return start >= 0 && isWordAt(value, start, word);
}

function isFunctionOrListParenthesis(value: string, start: number): boolean {
  const immediatePrevious = value[start - 1] ?? '';
  if (/[a-z0-9_]/i.test(immediatePrevious)) return true;

  let wordEnd = start - 1;
  while (wordEnd >= 0 && /\s/.test(value[wordEnd])) wordEnd -= 1;
  if (wordEnd < 0 || !/[a-z0-9_]/i.test(value[wordEnd])) return false;
  let wordStart = wordEnd;
  while (wordStart > 0 && /[a-z0-9_]/i.test(value[wordStart - 1])) wordStart -= 1;
  const previousWord = value.slice(wordStart, wordEnd + 1);
  return !['and', 'or', 'xor', 'not', 'is'].includes(previousWord);
}

function containsTopLevelBooleanOperator(value: string): boolean {
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "'" || char === '"' || char === '`') {
      index = skipQuotedRegion(value, index) - 1;
      continue;
    }
    if (char === '(') {
      depth += 1;
      continue;
    }
    if (char === ')') {
      depth -= 1;
      continue;
    }
    if (depth !== 0) continue;
    if (
      (char === '|' && value[index + 1] === '|') ||
      (char === '&' && value[index + 1] === '&')
    ) {
      return true;
    }
    if (
      isWordAt(value, index, 'and') ||
      isWordAt(value, index, 'or') ||
      isWordAt(value, index, 'xor')
    ) {
      return true;
    }
  }
  return false;
}

function containsTopLevelPredicateOperator(value: string): boolean {
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "'" || char === '"' || char === '`') {
      index = skipQuotedRegion(value, index) - 1;
      continue;
    }
    if (char === '(') {
      depth += 1;
      continue;
    }
    if (char === ')') {
      depth -= 1;
      continue;
    }
    if (depth !== 0) continue;
    if (char === '=' || char === '<' || char === '>') return true;
    for (const operator of ['is', 'in', 'like', 'between', 'regexp']) {
      if (isWordAt(value, index, operator)) return true;
    }
  }
  return false;
}

/**
 * Advances past the quoted/opaque region starting at `value[index]` for a
 * single quote, double quote or backtick. A doubled quote character (e.g. `''`,
 * `""`, ` `` `) and, for single/double quotes, a backslash-escaped quote are
 * treated as escapes. Returns the index just past the closing delimiter, or
 * `value.length` when the region is unterminated.
 */
function skipQuotedRegion(value: string, index: number): number {
  const quote = value[index];
  if (quote !== "'" && quote !== '"' && quote !== '`') return index;
  let i = index + 1;
  while (i < value.length) {
    const char = value[i];
    if (char === quote) {
      if (value[i + 1] === quote) {
        i += 2;
        continue;
      }
      return i + 1;
    }
    if (char === '\\' && (quote === "'" || quote === '"') && value[i + 1] === quote) {
      i += 2;
      continue;
    }
    i += 1;
  }
  return value.length;
}

function isWordAt(value: string, index: number, word: string): boolean {
  if (value.slice(index, index + word.length) !== word) return false;
  const before = index > 0 ? value[index - 1] : '';
  const after = value[index + word.length] ?? '';
  return !/[a-z0-9_]/i.test(before) && !/[a-z0-9_]/i.test(after);
}

function hasSingleBalancedOuterPair(value: string): boolean {
  if (!value.startsWith('(') || !value.endsWith(')')) return false;
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "'" || char === '"' || char === '`') {
      index = skipQuotedRegion(value, index) - 1;
      continue;
    }
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (depth === 0 && index < value.length - 1) return false;
    if (depth < 0) return false;
  }
  return depth === 0;
}
