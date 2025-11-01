/**
 * 运输查询队列
 * 处理工厂发货订单的运输信息自动查询任务
 * SOLID-S: 单一职责 - 只负责运输查询任务的队列管理
 */

import { Queue } from 'bullmq';

import { defaultQueueConfig, QUEUE_NAMES } from './config';

/**
 * 运输查询任务数据类型
 */
export interface ShippingQueryJobData {
  /** 工厂发货订单ID */
  factoryShipmentOrderId: string;
  /** 船公司名称 */
  shippingCompany: string;
  /** 柜号（可选） */
  containerNumber?: string;
}

/**
 * 运输查询队列实例
 * 单例模式，避免重复创建
 * SOLID-S: 单一职责 - 只负责队列实例管理和任务添加
 */
class ShippingQueryQueue {
  private static instance: Queue<ShippingQueryJobData> | null = null;

  /**
   * 获取队列实例
   * 使用单例模式确保全局只有一个队列实例
   */
  static getInstance(): Queue<ShippingQueryJobData> {
    if (!ShippingQueryQueue.instance) {
      ShippingQueryQueue.instance = new Queue<ShippingQueryJobData>(
        QUEUE_NAMES.SHIPPING_QUERY,
        defaultQueueConfig
      );

      // 监听队列事件（用于监控和调试）
      ShippingQueryQueue.instance.on('error', (error: Error) => {
        // eslint-disable-next-line no-console
        console.error('Shipping query queue error:', error);
      });

      ShippingQueryQueue.instance.on('waiting', job => {
        // eslint-disable-next-line no-console
        console.log(`Shipping query job ${job.id} is waiting`);
      });
    }

    return ShippingQueryQueue.instance;
  }

  /**
   * 添加运输查询任务
   * SOLID-S: 单一职责 - 只负责添加任务到队列
   *
   * @param data 任务数据
   * @param options 任务选项
   * @returns 任务实例
   *
   * 配置说明：
   * - attempts: 3 - 失败后重试3次
   * - backoff: exponential - 使用指数退避策略（1秒、2秒、4秒）
   * - priority: 0 - 默认优先级
   * - delay: 0 - 立即执行
   */
  static async addShippingQueryJob(
    data: ShippingQueryJobData,
    options?: {
      priority?: number;
      delay?: number;
    }
  ) {
    const queue = ShippingQueryQueue.getInstance();

    return await queue.add('shipping-query', data, {
      priority: options?.priority || 0,
      delay: options?.delay || 0,
      attempts: 3, // 重试3次
      backoff: {
        type: 'exponential',
        delay: 1000, // 初始延迟 1 秒
      },
    });
  }

  /**
   * 获取队列统计信息
   * 用于监控队列状态
   */
  static async getQueueStats() {
    const queue = ShippingQueryQueue.getInstance();

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }

  /**
   * 清空队列（仅用于测试）
   */
  static async obliterate() {
    const queue = ShippingQueryQueue.getInstance();
    await queue.obliterate({ force: true });
  }
}

// 导出队列实例和方法
export const shippingQueryQueue = ShippingQueryQueue.getInstance();
export const addShippingQueryJob = ShippingQueryQueue.addShippingQueryJob;
export const getShippingQueryQueueStats = ShippingQueryQueue.getQueueStats;
