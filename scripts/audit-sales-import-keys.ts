/**
 * Audit sales import key integrity for historical data.
 *
 * Goals:
 * - find orders that still rely on legacy remarks tokens instead of `importKey`
 * - find malformed legacy import remarks
 * - find mismatches between `importKey` and legacy remarks tokens
 *
 * Usage:
 *   npm run audit:sales-import-keys
 *   npm run audit:sales-import-keys -- --take 500
 *   npm run audit:sales-import-keys -- --out test-results/sales-import-key-audit --fail
 */

import fs from 'fs';
import path from 'path';

import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: '.env', quiet: true });

const prisma = new PrismaClient();

type OutputFormat = 'both' | 'json' | 'csv';

type Options = {
  outPrefix: string;
  format: OutputFormat;
  batchSize: number;
  take?: number;
  failOnIssues: boolean;
};

type IssueCode =
  | 'IMPORT_KEY_BLANK'
  | 'IMPORT_KEY_HAS_SURROUNDING_SPACES'
  | 'LEGACY_IMPORT_TOKEN_MALFORMED'
  | 'LEGACY_TOKEN_WITHOUT_IMPORT_KEY'
  | 'IMPORT_KEY_LEGACY_TOKEN_MISMATCH'
  | 'LEGACY_TOKEN_DUPLICATE';

type AuditIssue = {
  code: IssueCode;
  message: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  createdAt: string;
  importKey?: string;
  legacyImportKey?: string;
  remarks?: string | null;
  duplicateCount?: number;
};

type AuditRow = {
  id: string;
  orderNumber: string;
  importKey: string | null;
  remarks: string | null;
  createdAt: Date;
  customer: {
    name: string;
  };
};

type AuditSummary = {
  scanned: number;
  clean: number;
  issueCount: number;
  issueCounts: Record<IssueCode, number>;
  rowsWithLegacyTokenOnly: number;
  rowsWithMalformedLegacyToken: number;
  rowsWithMismatch: number;
  duplicateLegacyTokenGroups: number;
};

function parseArgs(argv: string[]): Options {
  const args = [...argv];

  const getFlag = (name: string): string | undefined => {
    const index = args.findIndex(arg => arg === name);
    if (index < 0) {
      return undefined;
    }
    return args[index + 1];
  };

  const hasFlag = (name: string): boolean => args.includes(name);

  const format = (getFlag('--format') as OutputFormat | undefined) ?? 'both';
  const batchSizeRaw = Number(getFlag('--batch') ?? 200);
  const takeRaw = getFlag('--take');
  const take = takeRaw ? Number(takeRaw) : undefined;
  const failOnIssues = hasFlag('--fail');
  const outPrefixRaw = getFlag('--out');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return {
    outPrefix:
      outPrefixRaw ||
      path.join('test-results', `sales-import-key-audit-${timestamp}`),
    format,
    batchSize:
      Number.isFinite(batchSizeRaw) && batchSizeRaw > 0 ? batchSizeRaw : 200,
    take:
      take !== undefined && Number.isFinite(take) && take > 0
        ? take
        : undefined,
    failOnIssues,
  };
}

function ensureDirForFile(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const raw = String(value);
  if (raw.includes('"') || raw.includes(',') || raw.includes('\n')) {
    return `"${raw.replace(/\"/g, '""')}"`;
  }

  return raw;
}

function extractLegacyImportKey(remarks: string | null | undefined) {
  if (!remarks) {
    return undefined;
  }

  const match = remarks.match(/【销售导入:([^】]+)】/);
  return match?.[1]?.trim() || undefined;
}

function hasLegacyImportMarker(remarks: string | null | undefined) {
  return remarks?.includes('【销售导入:') ?? false;
}

function normalizeImportKey(importKey: string | null | undefined) {
  if (importKey === null || importKey === undefined) {
    return undefined;
  }

  const trimmed = importKey.trim();
  return trimmed || '';
}

function buildIssue(
  row: AuditRow,
  code: IssueCode,
  message: string,
  options: {
    importKey?: string;
    legacyImportKey?: string;
    duplicateCount?: number;
  } = {}
): AuditIssue {
  return {
    code,
    message,
    orderId: row.id,
    orderNumber: row.orderNumber,
    customerName: row.customer.name,
    createdAt: row.createdAt.toISOString(),
    remarks: row.remarks,
    ...(options.importKey ? { importKey: options.importKey } : {}),
    ...(options.legacyImportKey
      ? { legacyImportKey: options.legacyImportKey }
      : {}),
    ...(options.duplicateCount
      ? { duplicateCount: options.duplicateCount }
      : {}),
  };
}

async function fetchImportRelatedOrders(options: Options): Promise<AuditRow[]> {
  const rows: AuditRow[] = [];
  let cursorId: string | undefined;

  while (true) {
    const remainingTake =
      options.take !== undefined ? Math.max(0, options.take - rows.length) : 0;
    const pageTake =
      options.take !== undefined
        ? Math.min(options.batchSize, remainingTake)
        : options.batchSize;

    if (options.take !== undefined && pageTake <= 0) {
      break;
    }

    const page = await prisma.salesOrder.findMany({
      where: {
        OR: [
          { importKey: { not: null } },
          { remarks: { contains: '【销售导入:' } },
        ],
      },
      orderBy: { id: 'asc' },
      take: pageTake,
      ...(cursorId
        ? {
            cursor: { id: cursorId },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        orderNumber: true,
        importKey: true,
        remarks: true,
        createdAt: true,
        customer: {
          select: {
            name: true,
          },
        },
      },
    });

    if (page.length === 0) {
      break;
    }

    rows.push(...page);
    cursorId = page[page.length - 1].id;

    if (page.length < pageTake) {
      break;
    }
  }

  return rows;
}

function auditRows(rows: AuditRow[]) {
  const issues: AuditIssue[] = [];
  const legacyTokenToRows = new Map<string, AuditRow[]>();

  for (const row of rows) {
    const normalizedImportKey = normalizeImportKey(row.importKey);
    const legacyImportKey = extractLegacyImportKey(row.remarks);
    const hasLegacyMarker = hasLegacyImportMarker(row.remarks);

    if (row.importKey !== null && row.importKey.trim().length === 0) {
      issues.push(
        buildIssue(
          row,
          'IMPORT_KEY_BLANK',
          'importKey is present in the database but blank after trimming.'
        )
      );
    } else if (
      row.importKey !== null &&
      normalizedImportKey &&
      normalizedImportKey !== row.importKey
    ) {
      issues.push(
        buildIssue(
          row,
          'IMPORT_KEY_HAS_SURROUNDING_SPACES',
          'importKey contains surrounding whitespace and should be normalized.',
          {
            importKey: row.importKey,
          }
        )
      );
    }

    if (hasLegacyMarker && !legacyImportKey) {
      issues.push(
        buildIssue(
          row,
          'LEGACY_IMPORT_TOKEN_MALFORMED',
          'remarks contain a legacy sales import marker, but the token cannot be parsed.'
        )
      );
    }

    if (legacyImportKey) {
      const bucket = legacyTokenToRows.get(legacyImportKey) ?? [];
      bucket.push(row);
      legacyTokenToRows.set(legacyImportKey, bucket);
    }

    if (legacyImportKey && !normalizedImportKey) {
      issues.push(
        buildIssue(
          row,
          'LEGACY_TOKEN_WITHOUT_IMPORT_KEY',
          'legacy sales import token exists in remarks, but importKey is missing.',
          {
            legacyImportKey,
          }
        )
      );
    }

    if (
      legacyImportKey &&
      normalizedImportKey &&
      legacyImportKey !== normalizedImportKey
    ) {
      issues.push(
        buildIssue(
          row,
          'IMPORT_KEY_LEGACY_TOKEN_MISMATCH',
          'importKey does not match the legacy sales import token stored in remarks.',
          {
            importKey: normalizedImportKey,
            legacyImportKey,
          }
        )
      );
    }
  }

  for (const [legacyImportKey, duplicateRows] of legacyTokenToRows.entries()) {
    if (duplicateRows.length <= 1) {
      continue;
    }

    for (const row of duplicateRows) {
      issues.push(
        buildIssue(
          row,
          'LEGACY_TOKEN_DUPLICATE',
          'multiple sales orders share the same legacy sales import token.',
          {
            legacyImportKey,
            duplicateCount: duplicateRows.length,
          }
        )
      );
    }
  }

  const issueCounts = {
    IMPORT_KEY_BLANK: 0,
    IMPORT_KEY_HAS_SURROUNDING_SPACES: 0,
    LEGACY_IMPORT_TOKEN_MALFORMED: 0,
    LEGACY_TOKEN_WITHOUT_IMPORT_KEY: 0,
    IMPORT_KEY_LEGACY_TOKEN_MISMATCH: 0,
    LEGACY_TOKEN_DUPLICATE: 0,
  } satisfies Record<IssueCode, number>;

  const ordersWithIssue = new Set<string>();
  for (const issue of issues) {
    issueCounts[issue.code] += 1;
    ordersWithIssue.add(issue.orderId);
  }

  const duplicateLegacyTokenGroups = Array.from(
    legacyTokenToRows.values()
  ).filter(group => group.length > 1).length;

  const summary: AuditSummary = {
    scanned: rows.length,
    clean: rows.length - ordersWithIssue.size,
    issueCount: issues.length,
    issueCounts,
    rowsWithLegacyTokenOnly: issueCounts.LEGACY_TOKEN_WITHOUT_IMPORT_KEY,
    rowsWithMalformedLegacyToken: issueCounts.LEGACY_IMPORT_TOKEN_MALFORMED,
    rowsWithMismatch: issueCounts.IMPORT_KEY_LEGACY_TOKEN_MISMATCH,
    duplicateLegacyTokenGroups,
  };

  return { issues, summary };
}

function writeJson(
  outPrefix: string,
  summary: AuditSummary,
  issues: AuditIssue[]
) {
  const outputPath = `${outPrefix}.json`;
  ensureDirForFile(outputPath);
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        summary,
        issues,
      },
      null,
      2
    ),
    'utf8'
  );
  return outputPath;
}

function writeCsv(outPrefix: string, issues: AuditIssue[]) {
  const outputPath = `${outPrefix}.csv`;
  ensureDirForFile(outputPath);

  const headers = [
    'code',
    'message',
    'orderId',
    'orderNumber',
    'customerName',
    'createdAt',
    'importKey',
    'legacyImportKey',
    'duplicateCount',
    'remarks',
  ];

  const lines = [
    headers.join(','),
    ...issues.map(issue =>
      headers
        .map(header => toCsvValue(issue[header as keyof AuditIssue] ?? ''))
        .join(',')
    ),
  ];

  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
  return outputPath;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log('sales import key audit start', {
    batchSize: options.batchSize,
    take: options.take ?? null,
    format: options.format,
    outPrefix: options.outPrefix,
    failOnIssues: options.failOnIssues,
  });

  const rows = await fetchImportRelatedOrders(options);
  const { issues, summary } = auditRows(rows);

  console.log('sales import key audit summary', summary);

  if (issues.length > 0) {
    console.log(
      'sales import key audit sample issues',
      issues.slice(0, 10).map(issue => ({
        code: issue.code,
        orderNumber: issue.orderNumber,
        importKey: issue.importKey ?? null,
        legacyImportKey: issue.legacyImportKey ?? null,
        duplicateCount: issue.duplicateCount ?? null,
      }))
    );
  }

  const outputPaths: string[] = [];
  if (options.format === 'both' || options.format === 'json') {
    outputPaths.push(writeJson(options.outPrefix, summary, issues));
  }
  if (options.format === 'both' || options.format === 'csv') {
    outputPaths.push(writeCsv(options.outPrefix, issues));
  }

  if (outputPaths.length > 0) {
    console.log('sales import key audit outputs', outputPaths);
  }

  await prisma.$disconnect();

  if (options.failOnIssues && issues.length > 0) {
    process.exit(1);
  }
}

main().catch(async error => {
  console.error('sales import key audit failed:', error);
  try {
    await prisma.$disconnect();
  } catch {
    // ignore disconnect failures
  }
  process.exit(1);
});
