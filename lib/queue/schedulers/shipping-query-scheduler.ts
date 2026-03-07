/**
 * 运输查询定时任务调度器
 * 自动查询需要更新运输信息的工厂发货订单
 * SOLID-S: 单一职责 - 只负责定时任务的调度和订单筛选
 * KISS: 简洁的调度逻辑，清晰的筛选条件
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

import {
  addShippingQueryJob,
  SHIPPING_QUERY_TARGETS,
  type ShippingQueryTargetType,
} from '../shipping-query-queue';

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
  private intervalTimer: NodeJS.Timeout | null = null;
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
      logger.info('shipping-scheduler', '运输查询调度器已禁用', undefined, {
        config: this.config,
      });
      return;
    }

    if (this.isRunning) {
      logger.warn('shipping-scheduler', '运输查询调度器已在运行中');
      return;
    }

    try {
      // 立即执行一次
      await this.scheduleAutoQuery();

      // 启动进程内周期调度（确保真实周期执行）
      const intervalMs = this.config.intervalHours * 60 * 60 * 1000;
      this.intervalTimer = setInterval(() => {
        this.scheduleAutoQuery().catch(error => {
          logger.error('shipping-scheduler', '周期调度执行失败', error);
        });
      }, intervalMs);

      const timerWithUnref = this.intervalTimer as NodeJS.Timeout & {
        unref?: () => void;
      };
      if (typeof timerWithUnref.unref === 'function') {
        timerWithUnref.unref();
      }

      this.isRunning = true;

      logger.info('shipping-scheduler', '运输查询调度器已启动', undefined, {
        intervalHours: this.config.intervalHours,
        minQueryIntervalHours: this.config.minQueryIntervalHours,
      });
    } catch (error) {
      if (this.intervalTimer) {
        clearInterval(this.intervalTimer);
        this.intervalTimer = null;
      }
      logger.error(
        'shipping-scheduler',
        '启动运输查询调度器失败',
        error,
        undefined,
        { error }
      );
      throw error;
    }
  }

  /**
   * 停止定时任务调度器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('shipping-scheduler', '运输查询调度器未在运行');
      return;
    }

    try {
      if (this.intervalTimer) {
        clearInterval(this.intervalTimer);
        this.intervalTimer = null;
      }

      this.isRunning = false;
      logger.info('shipping-scheduler', '运输查询调度器已停止');
    } catch (error) {
      logger.error('shipping-scheduler', '停止运输查询调度器失败', error);
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
      logger.info('shipping-scheduler', '开始执行运输查询调度');

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
      const factoryOrders = await prisma.factoryShipmentOrder.findMany({
        where: {
          status: 'shipped',
          arrivalDate: null,
          AND: [
            {
              OR: [
                { shippingCompany: { not: '' } },
                { containerNumber: { not: '' } },
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

      const purchaseOrders = await prisma.purchaseOrder.findMany({
        where: {
          status: { in: ['shipped', 'in_transit'] },
          arrivalDate: null,
          AND: [
            {
              OR: [
                { shippingCompany: { not: '' } },
                { containerNumber: { not: '' } },
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
        take: 100,
      });

      const totalCandidates = factoryOrders.length + purchaseOrders.length;

      logger.info('shipping-scheduler', '找到需要查询的订单', undefined, {
        factoryShipments: factoryOrders.length,
        purchaseOrders: purchaseOrders.length,
        total: totalCandidates,
      });

      // 为每个订单添加查询任务
      let successCount = 0;
      let failCount = 0;

      const enqueueOrder = async (
        order: (typeof factoryOrders)[number] | (typeof purchaseOrders)[number],
        targetType: ShippingQueryTargetType
      ) => {
        try {
          // 使用订单ID作为 jobId 实现任务去重
          // 如果该订单已有待处理的任务，则不会重复添加
          await addShippingQueryJob(
            {
              targetType,
              orderId: order.id,
              shippingCompany: order.shippingCompany || '',
              containerNumber: order.containerNumber || undefined,
            },
            {
              // 使用订单ID作为 jobId 确保同一订单不会重复添加任务
              jobId: `shipping-query-${targetType}-${order.id}`,
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

          logger.debug('shipping-scheduler', '已添加运输查询任务', undefined, {
            orderId: order.id,
            orderNumber: order.orderNumber,
            shippingCompany: order.shippingCompany,
            containerNumber: order.containerNumber,
            targetType,
          });
        } catch (error) {
          failCount++;
          logger.error(
            'shipping-scheduler',
            '添加运输查询任务失败',
            error,
            undefined,
            {
              orderId: order.id,
              orderNumber: order.orderNumber,
              targetType,
            }
          );
        }
      };

      for (const order of factoryOrders) {
        await enqueueOrder(order, SHIPPING_QUERY_TARGETS.FACTORY_SHIPMENT);
      }

      for (const order of purchaseOrders) {
        await enqueueOrder(order, SHIPPING_QUERY_TARGETS.PURCHASE_ORDER);
      }

      const duration = Date.now() - startTime;

      logger.info('shipping-scheduler', '运输查询调度完成', undefined, {
        totalOrders: totalCandidates,
        successCount,
        failCount,
        durationMs: duration,
      });
    } catch (error) {
      logger.error('shipping-scheduler', '执行运输查询调度失败', error);
      throw error;
    }
  }

  /**
   * 手动触发一次调度（用于测试或手动执行）
   */
  async triggerManual(): Promise<void> {
    logger.info('shipping-scheduler', '手动触发运输查询调度');
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
