import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { logExtendedConfig } from '@/lib/env';
import { logger } from '@/lib/logger';
import { cleanupOldLoginAttempts } from '@/lib/utils/login-security';

const VALID_SYSTEM_LOG_TYPES = new Set([
  'user_action',
  'business_operation',
  'system_event',
  'error',
  'security',
  'export',
]);

const PRESERVED_SYSTEM_LOG_TYPES = [
  'business_operation',
  'security',
  'export',
] as const;

const PRESERVED_SYSTEM_LOG_ACTIONS = [
  'cleanup_logs',
  'clear_audit_logs_blocked',
  'maintenance_cleanup_logs',
  'maintenance_database_backup',
  'maintenance_cycle',
] as const;

const PRESERVED_SYSTEM_LOG_ACTION_PREFIXES = ['export_'] as const;

function normalizeCriticalTypes(): string[] {
  return logExtendedConfig.criticalTypes
    .map(type => type.trim())
    .filter(type => type.length > 0 && VALID_SYSTEM_LOG_TYPES.has(type));
}

function buildPreservedTypeList(): string[] {
  return Array.from(
    new Set([...PRESERVED_SYSTEM_LOG_TYPES, ...normalizeCriticalTypes()])
  );
}

function buildPreservedActionList(): string[] {
  return Array.from(
    new Set([
      ...PRESERVED_SYSTEM_LOG_ACTIONS,
      ...logExtendedConfig.criticalActions
        .map(action => action.trim())
        .filter(Boolean),
    ])
  );
}

export function buildSystemLogCleanupWhere(params: {
  cutoffDate: Date;
  types?: string[] | null;
}): Prisma.SystemLogWhereInput {
  const requestedTypes =
    params.types?.map(type => type.trim()).filter(Boolean) ?? [];
  const preservedTypes = buildPreservedTypeList();
  const preservedActions = buildPreservedActionList();

  const where: Prisma.SystemLogWhereInput = {
    createdAt: { lt: params.cutoffDate },
    NOT: [
      { type: { in: preservedTypes } },
      { action: { in: preservedActions } },
      ...PRESERVED_SYSTEM_LOG_ACTION_PREFIXES.map(prefix => ({
        action: { startsWith: prefix },
      })),
    ],
  };

  if (requestedTypes.length > 0) {
    where.type = { in: requestedTypes };
  }

  return where;
}

export async function cleanupExpiredSystemLogs(params?: {
  retentionDays?: number;
  cutoffDate?: Date;
  types?: string[] | null;
}): Promise<number> {
  const cutoffDate = params?.cutoffDate
    ? new Date(params.cutoffDate)
    : (() => {
        const retentionDays = Math.max(params?.retentionDays ?? 0, 1);
        const calculatedCutoffDate = new Date();
        calculatedCutoffDate.setDate(
          calculatedCutoffDate.getDate() - retentionDays
        );
        return calculatedCutoffDate;
      })();

  const retentionDays =
    params?.retentionDays ??
    Math.max(
      Math.ceil((Date.now() - cutoffDate.getTime()) / (24 * 60 * 60 * 1000)),
      1
    );

  const result = await prisma.systemLog.deleteMany({
    where: buildSystemLogCleanupWhere({
      cutoffDate,
      types: params?.types,
    }),
  });

  logger.info('maintenance', '系统日志自动清理完成', {
    deletedCount: result.count,
    retentionDays,
    cutoffDate: cutoffDate.toISOString(),
  });

  return result.count;
}

export async function cleanupExpiredLoginLogs(
  retentionDays = logExtendedConfig.retentionDays
): Promise<number> {
  const normalizedRetentionDays = Math.max(retentionDays, 1);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - normalizedRetentionDays);

  const result = await prisma.loginLog.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  logger.info('maintenance', '登录日志自动清理完成', {
    deletedCount: result.count,
    retentionDays: normalizedRetentionDays,
    cutoffDate: cutoffDate.toISOString(),
  });

  return result.count;
}

export async function runAutomatedLogMaintenance(
  retentionDays = logExtendedConfig.retentionDays
): Promise<{
  deletedSystemLogs: number;
  deletedLoginLogs: number;
  deletedLoginAttempts: number;
}> {
  const [deletedSystemLogs, deletedLoginLogs] = await Promise.all([
    cleanupExpiredSystemLogs({ retentionDays }),
    cleanupExpiredLoginLogs(retentionDays),
  ]);
  const deletedLoginAttempts = await cleanupOldLoginAttempts();

  logger.info('maintenance', '日志维护任务完成', {
    retentionDays,
    deletedSystemLogs,
    deletedLoginLogs,
    deletedLoginAttempts,
  });

  return {
    deletedSystemLogs,
    deletedLoginLogs,
    deletedLoginAttempts,
  };
}
