import fs from 'fs';
import path from 'path';

import { Prisma, PrismaClient } from '@prisma/client';

type SchemaIndexStats = {
  schemaPath: string;
  modelCount: number;
  modelLevelIndexes: number;
  modelLevelUniques: number;
  modelLevelFulltext: number;
  fieldLevelIndex: number;
  fieldLevelUnique: number;
};

type IndexCountRow = {
  TABLE_NAME: string;
  indexCount: bigint;
  uniqueIndexCount: bigint;
};

type DigestTotalsRow = {
  totalCount: bigint | null;
  noIndexCount: bigint | null;
  noGoodIndexCount: bigint | null;
};

type DigestRow = {
  DIGEST_TEXT: string | null;
  COUNT_STAR: bigint;
  SUM_NO_INDEX_USED: bigint;
  SUM_NO_GOOD_INDEX_USED: bigint;
  SUM_ROWS_EXAMINED: bigint;
  SUM_TIMER_WAIT: bigint;
};

function getArgValue(name: string): string | null {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }

  const value = args[index + 1];
  return value || null;
}

function hasArg(name: string): boolean {
  return process.argv.slice(2).includes(name);
}

function stripCommentOnlyLines(text: string): string {
  const lines = text.split(/\r?\n/);
  return lines.filter(line => !line.trimStart().startsWith('//')).join('\n');
}

function countRegex(text: string, re: RegExp): number {
  return Array.from(text.matchAll(re)).length;
}

function parseSchemaIndexStats(schemaPath: string): SchemaIndexStats {
  const schemaText = fs.readFileSync(schemaPath, 'utf8');
  const cleanText = stripCommentOnlyLines(schemaText);

  const modelCount = countRegex(cleanText, /^\s*model\s+\w+\s*{/gm);
  const modelLevelIndexes = countRegex(cleanText, /@@index\b/g);
  const modelLevelUniques = countRegex(cleanText, /@@unique\b/g);
  const modelLevelFulltext = countRegex(cleanText, /@@fulltext\b/g);
  const fieldLevelIndex = countRegex(cleanText, /(?<!@)@index\b/g);
  const fieldLevelUnique = countRegex(cleanText, /(?<!@)@unique\b/g);

  return {
    schemaPath,
    modelCount,
    modelLevelIndexes,
    modelLevelUniques,
    modelLevelFulltext,
    fieldLevelIndex,
    fieldLevelUnique,
  };
}

function toBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0n;
    return BigInt(trimmed);
  }
  if (value instanceof Prisma.Decimal) {
    const str = value.toString().trim();
    if (!str) return 0n;
    return BigInt(str);
  }
  return 0n;
}

function formatPercent(numerator: bigint, denominator: bigint): string {
  if (denominator === 0n) return '0%';
  const pct = Number((numerator * 10000n) / denominator) / 100;
  return `${pct}%`;
}

function formatMsFromPicoSeconds(pico: bigint): string {
  // performance_schema TIMER_WAIT is in picoseconds (1e-12s).
  // ms = ps / 1e9
  const ms = Number(pico / 1000000n) / 1000;
  return `${ms.toFixed(2)}ms`;
}

function printTable(
  rows: Array<Record<string, unknown>>,
  keys: string[]
): void {
  if (rows.length === 0) {
    return;
  }

  const normalized = rows.map(row =>
    keys.map(key => {
      const value = row[key];
      if (typeof value === 'bigint') return value.toString();
      if (value === null || value === undefined) return '';
      return String(value);
    })
  );

  const widths = keys.map((key, i) =>
    Math.max(key.length, ...normalized.map(cols => cols[i]?.length ?? 0))
  );

  const header = keys
    .map((key, i) => key.padEnd(widths[i]))
    .join('  ')
    .trimEnd();
  // eslint-disable-next-line no-console
  console.log(header);

  const separator = keys
    .map((_, i) => '-'.repeat(widths[i]))
    .join('  ')
    .trimEnd();
  // eslint-disable-next-line no-console
  console.log(separator);

  for (const cols of normalized) {
    const line = cols
      .map((col, i) => (col || '').padEnd(widths[i]))
      .join('  ')
      .trimEnd();
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

async function main(): Promise<void> {
  const top = Math.max(1, parseInt(getArgValue('--top') || '20', 10) || 20);
  const schemaPath = path.resolve(
    process.cwd(),
    getArgValue('--schema') || path.join('prisma', 'schema.prisma')
  );

  // eslint-disable-next-line no-console
  console.log(`[index-usage] generatedAt=${new Date().toISOString()}`);

  if (!fs.existsSync(schemaPath)) {
    // eslint-disable-next-line no-console
    console.error(`[index-usage] schema file not found: ${schemaPath}`);
    process.exitCode = 1;
    return;
  }

  const schemaStats = parseSchemaIndexStats(schemaPath);
  // eslint-disable-next-line no-console
  console.log('\n[schema] prisma index declarations');
  printTable(
    [
      {
        schemaPath: path.relative(process.cwd(), schemaStats.schemaPath),
        modelCount: schemaStats.modelCount,
        '@@index': schemaStats.modelLevelIndexes,
        '@@unique': schemaStats.modelLevelUniques,
        '@@fulltext': schemaStats.modelLevelFulltext,
        '@index': schemaStats.fieldLevelIndex,
        '@unique': schemaStats.fieldLevelUnique,
      },
    ],
    [
      'schemaPath',
      'modelCount',
      '@@index',
      '@@unique',
      '@@fulltext',
      '@index',
      '@unique',
    ]
  );

  if (!process.env.DATABASE_URL) {
    // eslint-disable-next-line no-console
    console.log(
      '\n[db] DATABASE_URL missing. Run with env, e.g.:\n' +
        '  dotenv -e .env -- tsx scripts/report-index-usage.ts\n' +
        '  dotenv -e .env.production -- tsx scripts/report-index-usage.ts'
    );
    return;
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
    log: [],
  });

  try {
    const dbRow = await prisma.$queryRawUnsafe<Array<{ db: string | null }>>(
      'SELECT DATABASE() AS db'
    );
    const dbName = dbRow[0]?.db || '(unknown)';
    // eslint-disable-next-line no-console
    console.log(`\n[db] schema=${dbName}`);

    const indexCounts = await prisma.$queryRawUnsafe<IndexCountRow[]>(
      `
      SELECT
        TABLE_NAME,
        COUNT(DISTINCT INDEX_NAME) AS indexCount,
        COUNT(DISTINCT CASE WHEN NON_UNIQUE = 0 THEN INDEX_NAME END) AS uniqueIndexCount
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
      GROUP BY TABLE_NAME
      ORDER BY indexCount DESC, TABLE_NAME ASC
      `
    );

    // eslint-disable-next-line no-console
    console.log('\n[db] top tables by index count');
    printTable(
      indexCounts.slice(0, top) as unknown as Array<Record<string, unknown>>,
      ['TABLE_NAME', 'indexCount', 'uniqueIndexCount']
    );

    const perfSchemaExists = await prisma.$queryRawUnsafe<
      Array<{ ok: number }>
    >(
      "SELECT 1 AS ok FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='performance_schema' LIMIT 1"
    );

    if (perfSchemaExists.length === 0) {
      // eslint-disable-next-line no-console
      console.log(
        '\n[performance_schema] not available. Index hit-rate requires MySQL performance_schema.'
      );
      return;
    }

    // Ensure digest summary table is accessible
    try {
      await prisma.$queryRawUnsafe(
        'SELECT 1 FROM performance_schema.events_statements_summary_by_digest LIMIT 1'
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log(
        '\n[performance_schema] digest summary table not accessible. ' +
          'Check MySQL configuration: performance_schema=ON and statement instruments enabled.'
      );
      if (hasArg('--debug')) {
        // eslint-disable-next-line no-console
        console.error(error);
      }
      return;
    }

    // eslint-disable-next-line no-console
    console.log('\n[performance_schema] index usage (digest summary)');

    const totals = await prisma.$queryRawUnsafe<DigestTotalsRow[]>(
      `
      SELECT
        SUM(COUNT_STAR) AS totalCount,
        SUM(SUM_NO_INDEX_USED) AS noIndexCount,
        SUM(SUM_NO_GOOD_INDEX_USED) AS noGoodIndexCount
      FROM performance_schema.events_statements_summary_by_digest
      WHERE SCHEMA_NAME = DATABASE()
        AND DIGEST_TEXT REGEXP '^(SELECT|UPDATE|DELETE)'
        AND DIGEST_TEXT NOT LIKE 'SELECT @@%'
      `
    );

    const totalCount = toBigInt(totals[0]?.totalCount ?? 0);
    const noIndexCount = toBigInt(totals[0]?.noIndexCount ?? 0);
    const noGoodIndexCount = toBigInt(totals[0]?.noGoodIndexCount ?? 0);

    printTable(
      [
        {
          totalCount: totalCount.toString(),
          noIndexCount: noIndexCount.toString(),
          noIndexRate: formatPercent(noIndexCount, totalCount),
          noGoodIndexCount: noGoodIndexCount.toString(),
          noGoodIndexRate: formatPercent(noGoodIndexCount, totalCount),
        },
      ],
      [
        'totalCount',
        'noIndexCount',
        'noIndexRate',
        'noGoodIndexCount',
        'noGoodIndexRate',
      ]
    );

    const topNoIndex = await prisma.$queryRawUnsafe<DigestRow[]>(
      `
      SELECT
        DIGEST_TEXT,
        COUNT_STAR,
        SUM_NO_INDEX_USED,
        SUM_NO_GOOD_INDEX_USED,
        SUM_ROWS_EXAMINED,
        SUM_TIMER_WAIT
      FROM performance_schema.events_statements_summary_by_digest
      WHERE SCHEMA_NAME = DATABASE()
        AND DIGEST_TEXT REGEXP '^(SELECT|UPDATE|DELETE)'
        AND DIGEST_TEXT NOT LIKE 'SELECT @@%'
        AND (SUM_NO_INDEX_USED > 0 OR SUM_NO_GOOD_INDEX_USED > 0)
      ORDER BY SUM_NO_INDEX_USED DESC, SUM_NO_GOOD_INDEX_USED DESC, SUM_TIMER_WAIT DESC
      LIMIT ${top}
      `
    );

    if (topNoIndex.length === 0) {
      // eslint-disable-next-line no-console
      console.log(
        '\n[performance_schema] no statements flagged as NO_INDEX_USED / NO_GOOD_INDEX_USED.'
      );
    } else {
      // eslint-disable-next-line no-console
      console.log(`\n[performance_schema] top ${top} digests by no-index-used`);
      printTable(
        topNoIndex.map(row => ({
          COUNT_STAR: row.COUNT_STAR,
          SUM_NO_INDEX_USED: row.SUM_NO_INDEX_USED,
          SUM_NO_GOOD_INDEX_USED: row.SUM_NO_GOOD_INDEX_USED,
          SUM_ROWS_EXAMINED: row.SUM_ROWS_EXAMINED,
          totalTime: formatMsFromPicoSeconds(toBigInt(row.SUM_TIMER_WAIT)),
          DIGEST_TEXT: row.DIGEST_TEXT,
        })) as unknown as Array<Record<string, unknown>>,
        [
          'COUNT_STAR',
          'SUM_NO_INDEX_USED',
          'SUM_NO_GOOD_INDEX_USED',
          'SUM_ROWS_EXAMINED',
          'totalTime',
          'DIGEST_TEXT',
        ]
      );
    }

    const topByTime = await prisma.$queryRawUnsafe<DigestRow[]>(
      `
      SELECT
        DIGEST_TEXT,
        COUNT_STAR,
        SUM_NO_INDEX_USED,
        SUM_NO_GOOD_INDEX_USED,
        SUM_ROWS_EXAMINED,
        SUM_TIMER_WAIT
      FROM performance_schema.events_statements_summary_by_digest
      WHERE SCHEMA_NAME = DATABASE()
        AND DIGEST_TEXT REGEXP '^(SELECT|UPDATE|DELETE)'
        AND DIGEST_TEXT NOT LIKE 'SELECT @@%'
      ORDER BY SUM_TIMER_WAIT DESC
      LIMIT ${top}
      `
    );

    // eslint-disable-next-line no-console
    console.log(`\n[performance_schema] top ${top} digests by total time`);
    printTable(
      topByTime.map(row => {
        const count = toBigInt(row.COUNT_STAR);
        const totalPico = toBigInt(row.SUM_TIMER_WAIT);
        const avgPico = count > 0n ? totalPico / count : 0n;
        return {
          COUNT_STAR: row.COUNT_STAR,
          SUM_ROWS_EXAMINED: row.SUM_ROWS_EXAMINED,
          avgTime: formatMsFromPicoSeconds(avgPico),
          totalTime: formatMsFromPicoSeconds(totalPico),
          SUM_NO_INDEX_USED: row.SUM_NO_INDEX_USED,
          SUM_NO_GOOD_INDEX_USED: row.SUM_NO_GOOD_INDEX_USED,
          DIGEST_TEXT: row.DIGEST_TEXT,
        };
      }) as unknown as Array<Record<string, unknown>>,
      [
        'COUNT_STAR',
        'SUM_ROWS_EXAMINED',
        'avgTime',
        'totalTime',
        'SUM_NO_INDEX_USED',
        'SUM_NO_GOOD_INDEX_USED',
        'DIGEST_TEXT',
      ]
    );

    const topByRowsExamined = await prisma.$queryRawUnsafe<DigestRow[]>(
      `
      SELECT
        DIGEST_TEXT,
        COUNT_STAR,
        SUM_NO_INDEX_USED,
        SUM_NO_GOOD_INDEX_USED,
        SUM_ROWS_EXAMINED,
        SUM_TIMER_WAIT
      FROM performance_schema.events_statements_summary_by_digest
      WHERE SCHEMA_NAME = DATABASE()
        AND DIGEST_TEXT REGEXP '^(SELECT|UPDATE|DELETE)'
        AND DIGEST_TEXT NOT LIKE 'SELECT @@%'
      ORDER BY SUM_ROWS_EXAMINED DESC, SUM_TIMER_WAIT DESC
      LIMIT ${top}
      `
    );

    // eslint-disable-next-line no-console
    console.log(`\n[performance_schema] top ${top} digests by rows examined`);
    printTable(
      topByRowsExamined.map(row => ({
        COUNT_STAR: row.COUNT_STAR,
        SUM_ROWS_EXAMINED: row.SUM_ROWS_EXAMINED,
        totalTime: formatMsFromPicoSeconds(toBigInt(row.SUM_TIMER_WAIT)),
        SUM_NO_INDEX_USED: row.SUM_NO_INDEX_USED,
        SUM_NO_GOOD_INDEX_USED: row.SUM_NO_GOOD_INDEX_USED,
        DIGEST_TEXT: row.DIGEST_TEXT,
      })) as unknown as Array<Record<string, unknown>>,
      [
        'COUNT_STAR',
        'SUM_ROWS_EXAMINED',
        'totalTime',
        'SUM_NO_INDEX_USED',
        'SUM_NO_GOOD_INDEX_USED',
        'DIGEST_TEXT',
      ]
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch(error => {
  // eslint-disable-next-line no-console
  console.error('[index-usage] failed:', error);
  process.exitCode = 1;
});
