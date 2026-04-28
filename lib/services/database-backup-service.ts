import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';

import { logger } from '@/lib/logger';

interface ParsedDatabaseUrl {
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
}

interface DatabaseBackupOptions {
  backupDir?: string;
  retentionDays?: number;
  databaseUrl?: string;
}

interface DatabaseBackupDueOptions {
  backupDir?: string;
  intervalHours?: number;
  databaseUrl?: string;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDatabaseUrl(databaseUrl: string): ParsedDatabaseUrl {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL 未配置，无法执行数据库备份');
  }

  const parsed = new URL(databaseUrl);
  if (parsed.protocol !== 'mysql:') {
    throw new Error(`当前仅支持 MySQL 备份，收到协议：${parsed.protocol}`);
  }

  const database = parsed.pathname.replace(/^\//, '').trim();
  if (!database) {
    throw new Error('DATABASE_URL 缺少数据库名称，无法执行数据库备份');
  }

  return {
    host: parsed.hostname,
    port: parsed.port || '3306',
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
  };
}

function resolveBackupDirectory(backupDir?: string): string {
  const configuredDir = backupDir?.trim() || process.env.DB_BACKUP_DIR || 'backups';
  return path.isAbsolute(configuredDir)
    ? configuredDir
    : path.join(process.cwd(), configuredDir);
}

function formatTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

async function listDatabaseBackupFiles(
  backupDir: string,
  database: string
): Promise<Array<{ name: string; fullPath: string; mtimeMs: number }>> {
  try {
    const entries = await fs.readdir(backupDir, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter(entry => entry.isFile())
        .filter(entry => entry.name.startsWith(`${database}_`))
        .filter(entry => entry.name.endsWith('.sql.gz'))
        .map(async entry => {
          const fullPath = path.join(backupDir, entry.name);
          const stats = await fs.stat(fullPath);
          return {
            name: entry.name,
            fullPath,
            mtimeMs: stats.mtimeMs,
          };
        })
    );

    return files.sort((left, right) => right.mtimeMs - left.mtimeMs);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return [];
    }

    throw error;
  }
}

async function cleanupOldDatabaseBackups(params: {
  backupDir: string;
  database: string;
  retentionDays: number;
}): Promise<number> {
  const files = await listDatabaseBackupFiles(params.backupDir, params.database);
  const cutoffTime =
    Date.now() - Math.max(params.retentionDays, 1) * 24 * 60 * 60 * 1000;
  const expiredFiles = files.filter(file => file.mtimeMs < cutoffTime);

  await Promise.all(expiredFiles.map(file => fs.unlink(file.fullPath)));

  return expiredFiles.length;
}

export async function isDatabaseBackupDue(
  options?: DatabaseBackupDueOptions
): Promise<{
  due: boolean;
  lastBackupAt: Date | null;
  database: string;
  backupDir: string;
}> {
  const parsedDatabase = parseDatabaseUrl(
    options?.databaseUrl ?? process.env.DATABASE_URL ?? ''
  );
  const backupDir = resolveBackupDirectory(options?.backupDir);
  const files = await listDatabaseBackupFiles(backupDir, parsedDatabase.database);
  const latestFile = files[0];
  const lastBackupAt = latestFile ? new Date(latestFile.mtimeMs) : null;
  const intervalHours = parsePositiveInteger(
    String(options?.intervalHours ?? process.env.DB_BACKUP_INTERVAL_HOURS ?? ''),
    24
  );

  if (!lastBackupAt) {
    return {
      due: true,
      lastBackupAt: null,
      database: parsedDatabase.database,
      backupDir,
    };
  }

  return {
    due: Date.now() - lastBackupAt.getTime() >= intervalHours * 60 * 60 * 1000,
    lastBackupAt,
    database: parsedDatabase.database,
    backupDir,
  };
}

export async function createDatabaseBackup(
  options?: DatabaseBackupOptions
): Promise<{
  backupPath: string;
  backupSizeBytes: number;
  deletedExpiredBackups: number;
}> {
  const databaseUrl = options?.databaseUrl ?? process.env.DATABASE_URL ?? '';
  const parsedDatabase = parseDatabaseUrl(databaseUrl);
  const backupDir = resolveBackupDirectory(options?.backupDir);
  const retentionDays = parsePositiveInteger(
    String(options?.retentionDays ?? process.env.DB_BACKUP_RETENTION_DAYS ?? ''),
    30
  );

  await fs.mkdir(backupDir, { recursive: true });

  const backupFilename = `${parsedDatabase.database}_${formatTimestamp(new Date())}.sql.gz`;
  const backupPath = path.join(backupDir, backupFilename);
  const output = createWriteStream(backupPath);
  const gzip = createGzip();

  let stderr = '';
  const mysqldumpArgs = [
    '-h',
    parsedDatabase.host,
    '-P',
    parsedDatabase.port,
    '-u',
    parsedDatabase.username,
    '--single-transaction',
    '--routines',
    '--triggers',
    '--events',
    parsedDatabase.database,
  ];

  const child = spawn('mysqldump', mysqldumpArgs, {
    env: {
      ...process.env,
      MYSQL_PWD: parsedDatabase.password,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stderr.on('data', chunk => {
    stderr += chunk.toString();
  });

  try {
    await Promise.all([
      pipeline(child.stdout, gzip, output),
      new Promise<void>((resolve, reject) => {
        child.on('error', reject);
        child.on('close', code => {
          if (code === 0) {
            resolve();
            return;
          }

          reject(
            new Error(
              stderr.trim() || `mysqldump 退出异常，退出码：${code ?? -1}`
            )
          );
        });
      }),
    ]);

    const stats = await fs.stat(backupPath);
    const deletedExpiredBackups = await cleanupOldDatabaseBackups({
      backupDir,
      database: parsedDatabase.database,
      retentionDays,
    });

    logger.info('maintenance', '数据库自动备份完成', {
      database: parsedDatabase.database,
      backupPath,
      backupSizeBytes: stats.size,
      deletedExpiredBackups,
      retentionDays,
    });

    return {
      backupPath,
      backupSizeBytes: stats.size,
      deletedExpiredBackups,
    };
  } catch (error) {
    await fs.unlink(backupPath).catch(() => undefined);
    logger.error('maintenance', '数据库自动备份失败', error, {
      database: parsedDatabase.database,
      backupDir,
      retentionDays,
    });
    throw error;
  }
}
