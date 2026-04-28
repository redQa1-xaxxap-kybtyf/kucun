#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';

import dotenv from 'dotenv';

function loadEnvironmentFiles(): string[] {
  const candidates = [
    process.env.DOTENV_CONFIG_PATH,
    process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local',
    '.env.production',
    '.env.local',
    '.env',
  ].filter((value): value is string => Boolean(value && value.trim()));

  const loadedFiles: string[] = [];

  for (const candidate of Array.from(new Set(candidates))) {
    const resolvedPath = path.isAbsolute(candidate)
      ? candidate
      : path.join(process.cwd(), candidate);

    if (!fs.existsSync(resolvedPath)) {
      continue;
    }

    const result = dotenv.config({
      path: resolvedPath,
      override: false,
      quiet: true,
    });

    if (!result.error) {
      loadedFiles.push(candidate);
    }
  }

  return loadedFiles;
}

function hasFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

function formatDate(date: Date | null): string {
  return date ? date.toISOString() : 'none';
}

async function main(): Promise<void> {
  const loadedEnvironmentFiles = loadEnvironmentFiles();
  const forceBackup = hasFlag('--force-backup');
  const skipBackup = hasFlag('--skip-backup');

  const [
    { logExtendedConfig },
    { runAutomatedLogMaintenance },
    { createDatabaseBackup, isDatabaseBackupDue },
  ] = await Promise.all([
    import('@/lib/env'),
    import('@/lib/services/system-log-maintenance-service'),
    import('@/lib/services/database-backup-service'),
  ]);

  const startedAt = Date.now();
  const retentionDays = Math.max(logExtendedConfig.retentionDays, 1);

  console.log('[maintenance] starting operations maintenance');
  if (loadedEnvironmentFiles.length > 0) {
    console.log(
      `[maintenance] loaded env files: ${loadedEnvironmentFiles.join(', ')}`
    );
  }

  console.log(
    `[maintenance] log retention days: ${retentionDays}, force backup: ${forceBackup}, skip backup: ${skipBackup}`
  );

  const logResult = await runAutomatedLogMaintenance(retentionDays);

  let backupSummary =
    '[maintenance] database backup skipped because AUTO_DB_BACKUP_ENABLED=false';

  if (skipBackup) {
    backupSummary = '[maintenance] database backup skipped by --skip-backup';
  } else if (forceBackup || process.env.AUTO_DB_BACKUP_ENABLED !== 'false') {
    const dueState = forceBackup
      ? {
          due: true,
          lastBackupAt: null,
          database: 'manual',
          backupDir: process.env.DB_BACKUP_DIR || 'backups',
        }
      : await isDatabaseBackupDue();

    if (forceBackup || dueState.due) {
      const backupResult = await createDatabaseBackup();
      backupSummary =
        `[maintenance] database backup created: ${backupResult.backupPath}` +
        ` (${backupResult.backupSizeBytes} bytes, cleaned ${backupResult.deletedExpiredBackups} expired backups)`;
    } else {
      backupSummary =
        `[maintenance] database backup not due, last backup at ${formatDate(dueState.lastBackupAt)}` +
        `, backup dir: ${dueState.backupDir}, database: ${dueState.database}`;
    }
  }

  console.log('[maintenance] completed successfully');
  console.log(
    `[maintenance] log cleanup result: systemLogs=${logResult.deletedSystemLogs}, loginLogs=${logResult.deletedLoginLogs}, loginAttempts=${logResult.deletedLoginAttempts}`
  );
  console.log(backupSummary);
  console.log(`[maintenance] total duration: ${Date.now() - startedAt}ms`);
}

main().catch(error => {
  console.error('[maintenance] failed to run operations maintenance');
  console.error(error);
  process.exit(1);
});
