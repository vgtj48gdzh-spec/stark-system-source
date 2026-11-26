import { BadRequestException, Injectable } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { SyncInputFormat } from '../../../shared/enums/sync-input-format.enum';

@Injectable()
export class OfflineImportAdapter {
  async loadRecords(
    inputFormat: SyncInputFormat,
    inputPath: string,
    sourceTable: string,
    delimiter = ',',
  ) {
    const resolvedPath = resolve(inputPath);
    const fileContent = this.stripBom(await readFile(resolvedPath, 'utf8'));

    if (inputFormat === SyncInputFormat.JSON) {
      return this.parseJson(fileContent);
    }

    if (inputFormat === SyncInputFormat.CSV) {
      return this.parseCsv(fileContent, delimiter);
    }

    if (inputFormat === SyncInputFormat.SQL) {
      return this.parseSqlDump(fileContent, sourceTable);
    }

    throw new BadRequestException(`暂不支持导入格式：${inputFormat}`);
  }

  private parseJson(content: string) {
    const parsed = JSON.parse(content) as unknown;

    if (Array.isArray(parsed)) {
      return parsed as Record<string, unknown>[];
    }

    if (parsed && typeof parsed === 'object') {
      const objectValue = parsed as Record<string, unknown>;

      if (Array.isArray(objectValue.rows)) {
        return objectValue.rows as Record<string, unknown>[];
      }

      if (Array.isArray(objectValue.data)) {
        return objectValue.data as Record<string, unknown>[];
      }

      return [objectValue];
    }

    throw new BadRequestException('JSON 导入内容格式无效');
  }

  private parseCsv(content: string, delimiter: string) {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      return [];
    }

    const headers = this.parseDelimitedLine(lines[0], delimiter);
    return lines.slice(1).map((line) => {
      const values = this.parseDelimitedLine(line, delimiter);
      return headers.reduce<Record<string, unknown>>((acc, header, index) => {
        acc[header] = values[index] ?? null;
        return acc;
      }, {});
    });
  }

  private parseSqlDump(content: string, sourceTable: string) {
    const rows: Record<string, unknown>[] = [];
    const targetTables = new Set([sourceTable, `\`${sourceTable}\``]);
    const statementRegex =
      /INSERT\s+INTO\s+(`?[A-Za-z0-9_]+`?)\s*\(([\s\S]*?)\)\s*VALUES\s*([\s\S]*?);/gi;

    let match: RegExpExecArray | null;

    while ((match = statementRegex.exec(content)) !== null) {
      const tableToken = match[1];
      if (!targetTables.has(tableToken)) {
        continue;
      }

      const columns = this.extractColumns(match[2]);
      const valueGroups = this.extractValueGroups(match[3]);

      for (const valueGroup of valueGroups) {
        const values = this.parseSqlValueRow(valueGroup);
        const row = columns.reduce<Record<string, unknown>>((acc, column, index) => {
          acc[column] = values[index] ?? null;
          return acc;
        }, {});
        rows.push(row);
      }
    }

    return rows;
  }

  private extractColumns(columnSegment: string) {
    return columnSegment
      .split(',')
      .map((column) => column.trim().replace(/^`|`$/g, ''))
      .filter(Boolean);
  }

  private extractValueGroups(valueSegment: string) {
    const groups: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let previous = '';

    for (const char of valueSegment) {
      current += char;

      if (char === "'" && previous !== '\\') {
        inString = !inString;
      }

      if (!inString && char === '(') {
        depth += 1;
      }

      if (!inString && char === ')') {
        depth -= 1;
      }

      if (!inString && depth === 0 && char === ')') {
        groups.push(current.trim().replace(/,$/, ''));
        current = '';
      }

      previous = char;
    }

    return groups.filter(Boolean);
  }

  private parseSqlValueRow(valueGroup: string) {
    const inner = valueGroup.trim().replace(/^\(/, '').replace(/\)$/, '');
    const tokens: string[] = [];
    let current = '';
    let inString = false;
    let previous = '';

    for (const char of inner) {
      if (char === "'" && previous !== '\\') {
        inString = !inString;
      }

      if (!inString && char === ',') {
        tokens.push(current.trim());
        current = '';
      } else {
        current += char;
      }

      previous = char;
    }

    if (current.length > 0) {
      tokens.push(current.trim());
    }

    return tokens.map((token) => this.normalizeSqlToken(token));
  }

  private normalizeSqlToken(token: string) {
    if (/^null$/i.test(token)) {
      return null;
    }

    if (/^true$/i.test(token)) {
      return true;
    }

    if (/^false$/i.test(token)) {
      return false;
    }

    if (/^-?\d+(\.\d+)?$/.test(token)) {
      return Number(token);
    }

    if (token.startsWith("'") && token.endsWith("'")) {
      return token
        .slice(1, -1)
        .replace(/\\'/g, "'")
        .replace(/''/g, "'")
        .replace(/\\\\/g, '\\');
    }

    return token;
  }

  private parseDelimitedLine(line: string, delimiter: string) {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const nextChar = line[index + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (!inQuotes && char === delimiter) {
        values.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    values.push(current);
    return values.map((value) => value.trim());
  }

  private stripBom(content: string) {
    return content.replace(/^\uFEFF/, '');
  }
}
