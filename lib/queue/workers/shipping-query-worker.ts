/**
 * 运输查询 Worker
 * 消费队列中的任务，执行运输信息自动查询
 * SOLID-S: 单一职责 - 只负责处理运输查询任务
 */

import { type Job, Worker } from 'bullmq';

import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { defaultWorkerConfig, QUEUE_NAMES } from '@/lib/queue/config';
import {
  SHIPPING_QUERY_TARGETS,
  type ShippingQueryJobData,
} from '@/lib/queue/shipping-query-queue';
import { PuppeteerService } from '@/lib/services/puppeteer-service';
import type { ExtractSelectors } from '@/lib/types/shipping';
import { safeJSONParse } from '@/lib/utils/safe-json';
import {
  normalizeSelector,
  normalizeShippingExtractSelectors,
} from '@/lib/utils/selector-normalizer';

const SITE_COOLDOWN_MS = env.SHIPPING_QUERY_SITE_COOLDOWN_MS;
const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * 处理运输查询任务
 * SOLID-S: 单一职责 - 只负责查询逻辑
 *
 * 流程：
 * 1. 从数据库获取所有活跃的运输站点
 * 2. 使用 Round-robin 算法轮询每个站点
 * 3. 找到结果后立即停止轮询
 * 4. 更新工厂发货订单和创建查询记录
 *
 * @param job BullMQ 任务实例
 */
async function processShippingQueryJob(
  job: Job<ShippingQueryJobData>
): Promise<void> {
  const { targetType, orderId, shippingCompany, containerNumber } = job.data;
  const isFactoryShipment =
    targetType === SHIPPING_QUERY_TARGETS.FACTORY_SHIPMENT;

  logger.info('shipping-query-worker', `开始处理运输查询任务 ${job.id}`, {
    targetType,
    orderId,
    shippingCompany,
    containerNumber,
  });

  try {
    // 步骤1: 获取所有活跃的运输站点
    const activeSites: Array<{
      id: string;
      name: string;
      url: string;
      extractSelectors: string | null;
      searchInputSelector: string | null;
      searchButtonSelector: string | null;
      resultContainerSelector: string | null;
    }> = [];
    const pageSize = 2000;
    let cursor: string | undefined;

    while (true) {
      const page = await prisma.shippingSite.findMany({
        where: {
          status: 'active',
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], // Round-robin
        select: {
          id: true,
          name: true,
          url: true,
          extractSelectors: true,
          searchInputSelector: true,
          searchButtonSelector: true,
          resultContainerSelector: true,
        },
        take: pageSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      activeSites.push(...page);
      if (page.length < pageSize) {
        break;
      }

      cursor = page[page.length - 1]?.id;
      if (!cursor) {
        break;
      }
    }

    if (activeSites.length === 0) {
      const errorMessage = '没有可用的运输查询站点';
      logger.error('shipping-query-worker', errorMessage);

      // 更新订单状态为失败
      if (isFactoryShipment) {
        await prisma.factoryShipmentOrder.update({
          where: { id: orderId },
          data: {
            lastShippingQueryAt: new Date(),
            shippingQueryStatus: 'failed',
            shippingQueryError: errorMessage,
          },
        });
      } else {
        await prisma.purchaseOrder.update({
          where: { id: orderId },
          data: {
            lastShippingQueryAt: new Date(),
            shippingQueryStatus: 'failed',
            shippingQueryError: errorMessage,
          },
        });
      }

      throw new Error(errorMessage);
    }

    logger.info(
      'shipping-query-worker',
      `找到 ${activeSites.length} 个活跃站点`
    );

    // 步骤2: Round-robin 站点轮询
    let querySuccess = false;
    let lastError: string | null = null;

    // 优先使用船公司名称作为查询关键词，柜号仅在缺失时作为备选
    const keywordSource = shippingCompany
      ? 'shippingCompany'
      : 'containerNumber';
    const keyword = (shippingCompany || containerNumber || '').toUpperCase();

    if (!keyword) {
      throw new Error('缺少查询关键词：必须提供船公司名称或柜号');
    }

    logger.info('shipping-query-worker', '使用查询关键词', {
      orderId,
      targetType,
      keywordSource,
      keyword,
    });

    for (const [index, site] of activeSites.entries()) {
      try {
        logger.info('shipping-query-worker', `尝试站点: ${site.name}`, {
          siteId: site.id,
          url: site.url,
        });

        // 解析提取选择器配置，兼容新旧格式
        const parsedSelectors = safeJSONParse<Partial<ExtractSelectors>>(
          site.extractSelectors ?? '{}',
          {},
          {
            logError: true,
            context: 'shipping-query-worker:extract-selectors',
            includeRawJSON: false,
          }
        );
        const canonicalSelectors =
          normalizeShippingExtractSelectors(parsedSelectors);
        const extractSelectors: ExtractSelectors = {
          status: canonicalSelectors.status ?? '',
          destination: canonicalSelectors.destination ?? '',
          estimatedArrival: canonicalSelectors.estimatedArrival ?? '',
          updateTime: canonicalSelectors.updateTime ?? '',
        };

        // 调用 PuppeteerService 查询运输信息
        const result = await PuppeteerService.queryShipping(
          site.id,
          site.url,
          keyword,
          {
            searchInput: normalizeSelector(site.searchInputSelector),
            searchButton: normalizeSelector(site.searchButtonSelector),
            resultContainer: normalizeSelector(site.resultContainerSelector),
          },
          extractSelectors
        );

        // 检查是否查询成功（至少有一个字段有值）
        if (result.status || result.destination) {
          querySuccess = true;

          logger.info('shipping-query-worker', `✅ 查询成功: ${site.name}`, {
            siteId: site.id,
            status: result.status,
            destination: result.destination,
            targetType,
            orderId,
          });

          const successPayload = {
            lastShippingQueryAt: new Date(),
            shippingQueryStatus: 'success',
            shippingQueryError: null,
            ...(result.estimatedArrival && {
              estimatedArrival: new Date(result.estimatedArrival),
            }),
          };

          if (isFactoryShipment) {
            await prisma.factoryShipmentOrder.update({
              where: { id: orderId },
              data: {
                ...successPayload,
                preferredSiteId: site.id,
              },
            });
          } else {
            await prisma.purchaseOrder.update({
              where: { id: orderId },
              data: successPayload,
            });
          }

          // 步骤4: 创建查询记录（采购订单沿用相同表，后续重构为通用记录）
          await prisma.shippingQuery.create({
            data: {
              siteId: site.id,
              trackingNumber: keyword,
              inputKeyword: keyword,
              status: result.status || null,
              destination: result.destination || null,
              estimatedArrival: result.estimatedArrival
                ? new Date(result.estimatedArrival)
                : null,
              lastUpdateTime: result.lastUpdateTime
                ? new Date(result.lastUpdateTime)
                : null,
              queryStatus: 'success',
              errorMessage: null,
              factoryShipmentOrderId: orderId,
            },
          });

          logger.info('shipping-query-worker', `✅ 任务完成: ${job.id}`, {
            orderId,
            targetType,
            siteId: site.id,
          });

          // 找到结果，立即停止轮询
          break;
        } else {
          logger.warn(
            'shipping-query-worker',
            `站点 ${site.name} 未返回有效结果`,
            { siteId: site.id }
          );
          lastError = `站点 ${site.name} 未返回有效结果`;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        lastError = `站点 ${site.name} 查询失败: ${errorMessage}`;

        logger.error(
          'shipping-query-worker',
          `站点 ${site.name} 查询失败`,
          error
        );

        // 继续尝试下一个站点
        continue;
      }

      const isLastSite = index === activeSites.length - 1;
      if (!querySuccess && !isLastSite && SITE_COOLDOWN_MS > 0) {
        logger.debug(
          'shipping-query-worker',
          `等待 ${SITE_COOLDOWN_MS}ms 后继续尝试下一站点`
        );
        await sleep(SITE_COOLDOWN_MS);
      }
    }

    // 步骤5: 如果所有站点都失败，更新订单状态
    if (!querySuccess) {
      const errorMessage = lastError || '所有站点查询均失败';

      logger.error('shipping-query-worker', errorMessage);

      const failurePayload = {
        lastShippingQueryAt: new Date(),
        shippingQueryStatus: 'failed',
        shippingQueryError: errorMessage,
      };

      if (isFactoryShipment) {
        await prisma.factoryShipmentOrder.update({
          where: { id: orderId },
          data: failurePayload,
        });
      } else {
        await prisma.purchaseOrder.update({
          where: { id: orderId },
          data: failurePayload,
        });
      }

      throw new Error(errorMessage);
    }

    // 更新任务进度
    await job.updateProgress(100);
  } catch (error) {
    logger.error('shipping-query-worker', `任务 ${job.id} 处理失败`, error);

    // 重新抛出错误，让 BullMQ 处理重试
    throw error;
  }
}

/**
 * 创建运输查询 Worker
 * SOLID-S: 单一职责 - 只负责 Worker 实例创建和事件监听
 *
 * 注意: Worker 应该在单独的进程中运行，不要在 API 路由中直接创建
 */
export function createShippingQueryWorker(): Worker<ShippingQueryJobData> {
  const worker = new Worker<ShippingQueryJobData>(
    QUEUE_NAMES.SHIPPING_QUERY,
    processShippingQueryJob,
    {
      ...defaultWorkerConfig,
      concurrency: 3, // 运输查询并发度设置为 3（避免过度并发导致被封禁）
    }
  );

  // 监听 Worker 事件
  worker.on('completed', (job: Job) => {
    logger.info('shipping-query-worker', `任务 ${job.id} 完成`);
  });

  worker.on('failed', (job: Job | undefined, error: Error) => {
    logger.error('shipping-query-worker', `任务 ${job?.id} 失败`, error);
  });

  worker.on('error', (error: Error) => {
    logger.error('shipping-query-worker', 'Worker 错误', error);
  });

  return worker;
}

/**
 * 启动 Worker（用于单独的 Worker 进程）
 */
export function startShippingQueryWorker(): void {
  const worker = createShippingQueryWorker();

  logger.info('shipping-query-worker', '运输查询 Worker 已启动');

  // 优雅关闭
  process.on('SIGTERM', async () => {
    logger.info('shipping-query-worker', '收到 SIGTERM 信号，关闭 Worker...');
    await worker.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('shipping-query-worker', '收到 SIGINT 信号，关闭 Worker...');
    await worker.close();
    process.exit(0);
  });
}
