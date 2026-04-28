import { logExtendedConfig } from '@/lib/env';
import { logger } from '@/lib/logger';
import {
  createDatabaseBackup,
  isDatabaseBackupDue,
} from '@/lib/services/database-backup-service';
import { runAutomatedLogMaintenance } from '@/lib/services/system-log-maintenance-service';

interface MaintenanceSchedulerConfig {
  enabled: boolean;
  intervalHours: number;
  logRetentionDays: number;
  backupEnabled: boolean;
  backupIntervalHours: number;
  backupRetentionDays: number;
  backupDir: string;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const DEFAULT_CONFIG: MaintenanceSchedulerConfig = {
  enabled: process.env.MAINTENANCE_AUTO_ENABLED !== 'false',
  intervalHours: parsePositiveInteger(
    process.env.MAINTENANCE_INTERVAL_HOURS,
    24
  ),
  logRetentionDays: Math.max(logExtendedConfig.retentionDays, 1),
  backupEnabled: process.env.AUTO_DB_BACKUP_ENABLED !== 'false',
  backupIntervalHours: parsePositiveInteger(
    process.env.DB_BACKUP_INTERVAL_HOURS,
    24
  ),
  backupRetentionDays: parsePositiveInteger(
    process.env.DB_BACKUP_RETENTION_DAYS,
    30
  ),
  backupDir: process.env.DB_BACKUP_DIR?.trim() || 'backups',
};

class OperationsMaintenanceScheduler {
  private static instance: OperationsMaintenanceScheduler | null = null;
  private intervalTimer: NodeJS.Timeout | null = null;
  private config: MaintenanceSchedulerConfig;
  private isRunning = false;

  private constructor(config: Partial<MaintenanceSchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(
    config?: Partial<MaintenanceSchedulerConfig>
  ): OperationsMaintenanceScheduler {
    if (!OperationsMaintenanceScheduler.instance) {
      OperationsMaintenanceScheduler.instance =
        new OperationsMaintenanceScheduler(config);
    }

    return OperationsMaintenanceScheduler.instance;
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('maintenance', '运维维护调度器已禁用', {
        config: JSON.stringify(this.config),
      });
      return;
    }

    if (this.isRunning) {
      logger.warn('maintenance', '运维维护调度器已在运行中');
      return;
    }

    try {
      await this.runMaintenanceCycle();

      const intervalMs = this.config.intervalHours * 60 * 60 * 1000;
      this.intervalTimer = setInterval(() => {
        this.runMaintenanceCycle().catch(error => {
          logger.error('maintenance', '运维维护周期任务执行失败', error);
        });
      }, intervalMs);

      const timerWithUnref = this.intervalTimer as NodeJS.Timeout & {
        unref?: () => void;
      };
      if (typeof timerWithUnref.unref === 'function') {
        timerWithUnref.unref();
      }

      this.isRunning = true;

      logger.info('maintenance', '运维维护调度器已启动', {
        config: JSON.stringify(this.config),
      });
    } catch (error) {
      if (this.intervalTimer) {
        clearInterval(this.intervalTimer);
        this.intervalTimer = null;
      }

      logger.error('maintenance', '运维维护调度器启动失败', error, {
        config: JSON.stringify(this.config),
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('maintenance', '运维维护调度器未在运行');
      return;
    }

    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }

    this.isRunning = false;
    logger.info('maintenance', '运维维护调度器已停止');
  }

  getStatus(): {
    isRunning: boolean;
    config: MaintenanceSchedulerConfig;
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
    };
  }

  async runMaintenanceCycle(): Promise<void> {
    const cycleStartedAt = Date.now();

    logger.info('maintenance', '开始执行运维维护周期任务', {
      logRetentionDays: this.config.logRetentionDays,
      backupEnabled: this.config.backupEnabled,
    });

    const logMaintenanceResult = await runAutomatedLogMaintenance(
      this.config.logRetentionDays
    );

    let backupSummary: Record<string, unknown> = {
      backupEnabled: this.config.backupEnabled,
      executed: false,
    };

    if (this.config.backupEnabled) {
      try {
        const dueState = await isDatabaseBackupDue({
          backupDir: this.config.backupDir,
          intervalHours: this.config.backupIntervalHours,
        });

        if (dueState.due) {
          const backupResult = await createDatabaseBackup({
            backupDir: this.config.backupDir,
            retentionDays: this.config.backupRetentionDays,
          });

          backupSummary = {
            backupEnabled: true,
            executed: true,
            backupPath: backupResult.backupPath,
            backupSizeBytes: backupResult.backupSizeBytes,
            deletedExpiredBackups: backupResult.deletedExpiredBackups,
          };
        } else {
          backupSummary = {
            backupEnabled: true,
            executed: false,
            lastBackupAt: dueState.lastBackupAt?.toISOString() ?? null,
            backupDir: dueState.backupDir,
            database: dueState.database,
          };
        }
      } catch (error) {
        logger.error('maintenance', '自动数据库备份执行失败', error, {
          backupDir: this.config.backupDir,
        });

        backupSummary = {
          backupEnabled: true,
          executed: false,
          backupError: error instanceof Error ? error.message : String(error),
        };
      }
    }

    logger.info('maintenance', '运维维护周期任务完成', {
      durationMs: Date.now() - cycleStartedAt,
      ...logMaintenanceResult,
      ...backupSummary,
    });
  }
}

export function getOperationsMaintenanceScheduler(
  config?: Partial<MaintenanceSchedulerConfig>
): OperationsMaintenanceScheduler {
  return OperationsMaintenanceScheduler.getInstance(config);
}

export type { MaintenanceSchedulerConfig };
