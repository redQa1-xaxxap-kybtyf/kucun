/**
 * 入库后处理队列
 * 处理批次规格更新、产品同步、缓存失效等非核心操作
 */

import { Queue } from 'bullmq';

import { defaultQueueConfig, QUEUE_NAMES } from './config';

/**
 * 入库后处理任务数据类型
 */
export interface InboundPostProcessingJobData {
  recordId: string;
  productId: string;
  batchNumber?: string;
  piecesPerUnit?: number;
  weight?: number;
  variantId?: string;
}

/**
 * 入库后处理队列实例
 * 单例模式,避免重复创建
 */
class InboundPostProcessingQueue {
  private static instance: Queue<InboundPostProcessingJobData> | null = null;

  /**
   * 获取队列实例
   */
  static getInstance(): Queue<InboundPostProcessingJobData> {
    if (!InboundPostProcessingQueue.instance) {
      InboundPostProcessingQueue.instance =
        new Queue<InboundPostProcessingJobData>(
          QUEUE_NAMES.INBOUND_POST_PROCESSING,
          defaultQueueConfig
        );

      // 监听队列事件 (用于监控和调试)
      InboundPostProcessingQueue.instance.on('error', (error: Error) => {
        // eslint-disable-next-line no-console
        console.error('Inbound queue error:', error);
      });

      InboundPostProcessingQueue.instance.on('waiting', job => {
        // eslint-disable-next-line no-console
        console.log(`Job ${job.id} is waiting`);
      });
    }

    return InboundPostProcessingQueue.instance;
  }

  /**
   * 添加入库后处理任务
   */
  static async addPostProcessingJob(
    data: InboundPostProcessingJobData,
    options?: {
      priority?: number;
      delay?: number;
    }
  ) {
    const queue = InboundPostProcessingQueue.getInstance();

    return await queue.add('post-process', data, {
      priority: options?.priority || 0,
      delay: options?.delay || 0,
    });
  }

  /**
   * 获取队列统计信息
   */
  static async getQueueStats() {
    const queue = InboundPostProcessingQueue.getInstance();

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
   * 清空队列 (仅用于测试)
   */
  static async obliterate() {
    const queue = InboundPostProcessingQueue.getInstance();
    await queue.obliterate({ force: true });
  }
}

export const inboundQueue = InboundPostProcessingQueue.getInstance();
export const addInboundPostProcessingJob =
  InboundPostProcessingQueue.addPostProcessingJob;
export const getInboundQueueStats = InboundPostProcessingQueue.getQueueStats;
