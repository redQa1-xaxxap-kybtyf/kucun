/**
 * 运输查询调度器启动脚本
 * 独立进程运行，负责定时触发运输查询任务
 * SOLID-S: 单一职责 - 只负责调度器的启动、停止和健康检查
 */

// 在导入其他模块之前加载环境变量
import 'dotenv/config';

import { shippingQuerySchedulerConfig } from '@/lib/env';
import { logger } from '@/lib/logger';

import { getOperationsMaintenanceScheduler } from './operations-maintenance-scheduler';
import { createShippingQueryWorker } from '../workers/shipping-query-worker';

import { getShippingQueryScheduler } from './shipping-query-scheduler';

/**
 * 调度器实例
 */
let scheduler: ReturnType<typeof getShippingQueryScheduler> | null = null;
let maintenanceScheduler:
  | ReturnType<typeof getOperationsMaintenanceScheduler>
  | null = null;

/**
 * Worker 实例
 */
let worker: Awaited<ReturnType<typeof createShippingQueryWorker>> | null = null;

/**
 * 是否正在关闭
 */
let isShuttingDown = false;

/**
 * 启动调度器和 Worker
 */
async function start(): Promise<void> {
  try {
    logger.info('shipping-scheduler', '正在启动运输查询调度器...', undefined, {
      config: shippingQuerySchedulerConfig,
    });

    // 创建并启动 Worker
    worker = await createShippingQueryWorker();
    logger.info('shipping-scheduler', '运输查询 Worker 已启动');

    // 创建并启动调度器
    scheduler = getShippingQueryScheduler(shippingQuerySchedulerConfig);
    await scheduler.start();

    logger.info('shipping-scheduler', '运输查询调度器启动成功', undefined, {
      status: scheduler.getStatus(),
    });

    maintenanceScheduler = getOperationsMaintenanceScheduler();
    await maintenanceScheduler.start();

    logger.info('shipping-scheduler', '运维维护调度器启动成功', undefined, {
      maintenanceStatus: maintenanceScheduler.getStatus(),
    });

    // 设置健康检查
    setupHealthCheck();
  } catch (error) {
    logger.error('shipping-scheduler', '启动运输查询调度器失败', error);
    process.exit(1);
  }
}

/**
 * 停止调度器和 Worker
 */
async function stop(): Promise<void> {
  if (isShuttingDown) {
    logger.warn('shipping-scheduler', '调度器正在关闭中，请勿重复操作');
    return;
  }

  isShuttingDown = true;

  try {
    logger.info('shipping-scheduler', '正在停止运输查询调度器...');

    // 停止调度器
    if (scheduler) {
      await scheduler.stop();
      scheduler = null;
      logger.info('shipping-scheduler', '调度器已停止');
    }

    if (maintenanceScheduler) {
      await maintenanceScheduler.stop();
      maintenanceScheduler = null;
      logger.info('shipping-scheduler', '运维维护调度器已停止');
    }

    // 停止 Worker
    if (worker) {
      await worker.close();
      worker = null;
      logger.info('shipping-scheduler', 'Worker 已停止');
    }

    logger.info('shipping-scheduler', '运输查询调度器已完全停止');
    process.exit(0);
  } catch (error) {
    logger.error('shipping-scheduler', '停止运输查询调度器失败', error);
    process.exit(1);
  }
}

/**
 * 设置健康检查
 * 每分钟检查一次调度器和 Worker 状态
 */
function setupHealthCheck(): void {
  setInterval(() => {
    try {
      if (!scheduler || !worker || !maintenanceScheduler) {
        logger.error(
          'shipping-scheduler',
          '健康检查失败：调度器或 Worker 未运行'
        );
        return;
      }

      const status = scheduler.getStatus();
      const maintenanceStatus = maintenanceScheduler.getStatus();

      logger.debug('shipping-scheduler', '健康检查通过', undefined, {
        schedulerRunning: status.isRunning,
        maintenanceSchedulerRunning: maintenanceStatus.isRunning,
        workerRunning: worker !== null,
      });
    } catch (error) {
      logger.error('shipping-scheduler', '健康检查异常', error);
    }
  }, 60 * 1000); // 每分钟检查一次
}

/**
 * 处理未捕获的异常
 */
function setupErrorHandlers(): void {
  // 处理未捕获的 Promise 拒绝
  process.on('unhandledRejection', (reason, promise) => {
    logger.error(
      'shipping-scheduler',
      '未捕获的 Promise 拒绝',
      reason as Error,
      undefined,
      {
        promise,
      }
    );
  });

  // 处理未捕获的异常
  process.on('uncaughtException', error => {
    logger.error('shipping-scheduler', '未捕获的异常', error);
    // 异常后优雅关闭
    stop();
  });

  // 处理 SIGTERM 信号（Docker/Kubernetes 停止容器）
  process.on('SIGTERM', () => {
    logger.info('shipping-scheduler', '收到 SIGTERM 信号，开始优雅关闭...');
    stop();
  });

  // 处理 SIGINT 信号（Ctrl+C）
  process.on('SIGINT', () => {
    logger.info('shipping-scheduler', '收到 SIGINT 信号，开始优雅关闭...');
    stop();
  });
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  logger.info('shipping-scheduler', '运输查询调度器进程启动', undefined, {
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
  });

  // 设置错误处理器
  setupErrorHandlers();

  // 启动调度器
  await start();

  // 保持进程运行
  logger.info('shipping-scheduler', '调度器进程正在运行，按 Ctrl+C 停止');
}

// 执行主函数
main().catch(error => {
  logger.error('shipping-scheduler', '调度器进程启动失败', error);
  process.exit(1);
});
