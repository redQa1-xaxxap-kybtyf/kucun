/**
 * 运输查询定时任务调度器
 * 自动查询需要更新运输信息的工厂发货订单
 * SOLID-S: 单一职责 - 只负责定时任务的调度和订单筛选
 * KISS: 简洁的调度逻辑，清晰的筛选条件
 */

import { Queue } from 'bullmq';

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

import { defaultQueueConfig } from '../config';
import { ShippingQueryQueue } from '../shipping-query-queue';

/**
 * 调度器配置
 */
interface SchedulerConfig {
  /** 定时任务执行间隔（小时） */
  intervalHours: number;
  /** 两次查询之间的最小间隔（小时） */
  minQueryIntervalHours: number;
  /** 是否启用自动查询 */
  enabled: boolean;
}

/**
 * 默认调度器配置
 */
const DEFAULT_CONFIG: SchedulerConfig = {
  intervalHours: 6, // 每6小时执行一次
  minQueryIntervalHours: 2, // 两次查询至少间隔2小时
  enabled: true,
};

/**
 * 运输查询调度器
 * 使用单例模式确保全局只有一个调度器实例
 */
class ShippingQueryScheduler {
  private static instance: ShippingQueryScheduler | null = null;
  private queue: Queue | null = null;
  private config: SchedulerConfig;
  private isRunning = false;

  private constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 获取调度器实例
   */
  static getInstance(
    config?: Partial<SchedulerConfig>
  ): ShippingQueryScheduler {
    if (!ShippingQueryScheduler.instance) {
      ShippingQueryScheduler.instance = new ShippingQueryScheduler(config);
    }
    return ShippingQueryScheduler.instance;
  }

  /**
   * 启动定时任务调度器
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('运输查询调度器已禁用', { config: this.config });
      return;
    }

    if (this.isRunning) {
      logger.warn('运输查询调度器已在运行中');
      return;
    }

    try {
      // 创建调度器队列
      this.queue = new Queue('shipping-query-scheduler', defaultQueueConfig);

      // 添加重复任务
      await this.queue.add(
        'schedule-shipping-queries',
        {},
        {
          repeat: {
            // 每 N 小时执行一次
            pattern: `0 */${this.config.intervalHours} * * *`,
          },
          // 使用固定的 jobId 确保只有一个调度任务
          jobId: 'shipping-query-scheduler',
          // 如果任务已存在则移除旧任务
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      this.isRunning = true;

      logger.info('运输查询调度器已启动', {
        intervalHours: this.config.intervalHours,
        minQueryIntervalHours: this.config.minQueryIntervalHours,
      });

      // 立即执行一次（可选）
      await this.scheduleAutoQuery();
    } catch (error) {
      logger.error('启动运输查询调度器失败', { error });
      throw error;
    }
  }

  /**
   * 停止定时任务调度器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('运输查询调度器未在运行');
      return;
    }

    try {
      if (this.queue) {
        // 移除所有重复任务
        await this.queue.removeRepeatable('schedule-shipping-queries', {
          pattern: `0 */${this.config.intervalHours} * * *`,
        });

        // 关闭队列
        await this.queue.close();
        this.queue = null;
      }

      this.isRunning = false;
      logger.info('运输查询调度器已停止');
    } catch (error) {
      logger.error('停止运输查询调度器失败', { error });
      throw error;
    }
  }

  /**
   * 获取调度器状态
   */
  getStatus(): {
    isRunning: boolean;
    config: SchedulerConfig;
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
    };
  }

  /**
   * 执行自动查询调度
   * 查询所有需要更新运输信息的订单并添加到队列
   */
  async scheduleAutoQuery(): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info('开始执行运输查询调度');

      // 计算最小查询间隔时间点
      const minQueryTime = new Date(
        Date.now() - this.config.minQueryIntervalHours * 60 * 60 * 1000
      );

      // 查询需要自动查询的订单
      // 条件：
      // 1. 状态为 'shipped'（已发货）
      // 2. 未到达（arrivalDate 为空）
      // 3. 有船公司信息或柜号
      // 4. 距离上次查询超过最小间隔时间（或从未查询过）
      const orders = await prisma.factoryShipmentOrder.findMany({
        where: {
          status: 'shipped',
          arrivalDate: null,
          AND: [
            {
              OR: [
                { shippingCompany: { not: null } },
                { containerNumber: { not: null } },
              ],
            },
            {
              OR: [
                { lastShippingQueryAt: null },
                { lastShippingQueryAt: { lt: minQueryTime } },
              ],
            },
          ],
        },
        select: {
          id: true,
          orderNumber: true,
          shippingCompany: true,
          containerNumber: true,
          lastShippingQueryAt: true,
        },
        // 限制每次处理的订单数量，避免一次性添加过多任务
        take: 100,
      });

      logger.info(`找到 ${orders.length} 个需要查询的订单`);

      // 为每个订单添加查询任务
      let successCount = 0;
      let failCount = 0;

      for (const order of orders) {
        try {
          // 使用订单ID作为 jobId 实现任务去重
          // 如果该订单已有待处理的任务，则不会重复添加
          await ShippingQueryQueue.addShippingQueryJob(
            {
              factoryShipmentOrderId: order.id,
              shippingCompany: order.shippingCompany || '',
              containerNumber: order.containerNumber || undefined,
            },
            {
              // 使用订单ID作为 jobId 确保同一订单不会重复添加任务
              jobId: `shipping-query-${order.id}`,
              // 优先级：越久未查询的订单优先级越高
              priority: order.lastShippingQueryAt
                ? Math.floor(
                    (Date.now() - order.lastShippingQueryAt.getTime()) /
                      1000 /
                      60 /
                      60
                  )
                : 999,
            }
          );

          successCount++;

          logger.debug('已添加运输查询任务', {
            orderId: order.id,
            orderNumber: order.orderNumber,
            shippingCompany: order.shippingCompany,
            containerNumber: order.containerNumber,
          });
        } catch (error) {
          failCount++;
          logger.error('添加运输查询任务失败', {
            orderId: order.id,
            orderNumber: order.orderNumber,
            error,
          });
        }
      }

      const duration = Date.now() - startTime;

      logger.info('运输查询调度完成', {
        totalOrders: orders.length,
        successCount,
        failCount,
        durationMs: duration,
      });
    } catch (error) {
      logger.error('执行运输查询调度失败', { error });
      throw error;
    }
  }

  /**
   * 手动触发一次调度（用于测试或手动执行）
   */
  async triggerManual(): Promise<void> {
    logger.info('手动触发运输查询调度');
    await this.scheduleAutoQuery();
  }
}

/**
 * 导出调度器实例获取方法
 */
export function getShippingQueryScheduler(
  config?: Partial<SchedulerConfig>
): ShippingQueryScheduler {
  return ShippingQueryScheduler.getInstance(config);
}

/**
 * 导出调度器配置类型
 */
export type { SchedulerConfig };
