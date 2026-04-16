/**
 * 入库后处理 Worker
 * 消费队列中的任务,执行批次规格更新、产品同步、缓存失效等操作
 */

import { type Job, Worker } from 'bullmq';

import { upsertBatchSpecification } from '@/lib/api/batch-specification-handlers';
import { defaultWorkerConfig, QUEUE_NAMES } from '@/lib/queue/config';
import type { InboundPostProcessingJobData } from '@/lib/queue/inbound-queue';

/**
 * 处理入库后处理任务
 */
async function processInboundPostProcessing(
  job: Job<InboundPostProcessingJobData>
): Promise<void> {
  const { productId, batchNumber, piecesPerUnit, weight, variantId } = job.data;

  // eslint-disable-next-line no-console
  console.log(
    `Processing inbound post-processing job ${job.id} for product ${productId}`
  );

  // 步骤1: 批次规格更新 (如果提供了规格参数)
  if (
    batchNumber &&
    typeof piecesPerUnit === 'number' &&
    Number.isInteger(piecesPerUnit) &&
    piecesPerUnit > 0
  ) {
    try {
      await upsertBatchSpecification({
        productId,
        variantId,
        batchNumber,
        piecesPerUnit,
        weight: weight || undefined,
      });

      await job.updateProgress(33);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Batch specification update failed:', error);
      // 不抛出错误,允许继续执行后续步骤
    }
  }

  // 步骤2: 缓存失效
  try {
    const [{ invalidateInventoryCache }, { revalidateProducts }] =
      await Promise.all([
        import('@/lib/cache/inventory-cache'),
        import('@/lib/cache'),
      ]);

    await Promise.all([
      invalidateInventoryCache(productId),
      revalidateProducts(productId),
    ]);

    await job.updateProgress(100);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Cache invalidation failed:', error);
  }

  // eslint-disable-next-line no-console
  console.log(`Completed inbound post-processing job ${job.id}`);
}

/**
 * 创建入库后处理 Worker
 * 注意: Worker 应该在单独的进程中运行,不要在 API 路由中直接创建
 */
export function createInboundWorker(): Worker<InboundPostProcessingJobData> {
  const worker = new Worker<InboundPostProcessingJobData>(
    QUEUE_NAMES.INBOUND_POST_PROCESSING,
    processInboundPostProcessing,
    {
      ...defaultWorkerConfig,
      concurrency: 5, // 入库后处理并发度设置为 5
    }
  );

  // 监听 Worker 事件
  worker.on('completed', (job: Job) => {
    // eslint-disable-next-line no-console
    console.log(`Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job: Job | undefined, error: Error) => {
    // eslint-disable-next-line no-console
    console.error(`Job ${job?.id} failed:`, error);
  });

  worker.on('error', (error: Error) => {
    // eslint-disable-next-line no-console
    console.error('Worker error:', error);
  });

  return worker;
}

/**
 * 启动 Worker (用于单独的 Worker 进程)
 */
export function startInboundWorker(): void {
  const worker = createInboundWorker();

  // eslint-disable-next-line no-console
  console.log('Inbound post-processing worker started');

  // 优雅关闭
  process.on('SIGTERM', async () => {
    // eslint-disable-next-line no-console
    console.log('SIGTERM received, closing worker...');
    await worker.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    // eslint-disable-next-line no-console
    console.log('SIGINT received, closing worker...');
    await worker.close();
    process.exit(0);
  });
}
