/**
 * POST /api/shipping/query/batch - 批量触发多个订单的运输查询
 * SOLID-S: 单一职责 - 只负责批量触发查询
 * DRY: 复用现有的队列和 Worker 基础设施
 */

import type { NextRequest } from 'next/server';
import { z, type ZodIssue } from 'zod';

import { withErrorHandling } from '@/lib/api/middleware';
import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import {
  addShippingQueryJob,
  SHIPPING_QUERY_TARGETS,
  type ShippingQueryTargetType,
} from '@/lib/queue/shipping-query-queue';

/**
 * 请求体验证 Schema
 */
const orderTypeEnum = z.enum([
  SHIPPING_QUERY_TARGETS.FACTORY_SHIPMENT,
  SHIPPING_QUERY_TARGETS.PURCHASE_ORDER,
] as const);

const batchQuerySchema = z.object({
  orderIds: z
    .array(z.string().uuid('订单 ID 格式无效'))
    .min(1, '至少需要提供一个订单 ID')
    .max(50, '最多支持 50 个订单批量查询'),
  orderType: orderTypeEnum.default(SHIPPING_QUERY_TARGETS.FACTORY_SHIPMENT),
  force: z.boolean().optional().default(false),
});

/**
 * 批量查询结果项
 */
interface BatchQueryResultItem {
  orderId: string;
  orderNumber: string;
  jobId?: string;
  status: 'queued' | 'skipped' | 'failed';
  reason?: string;
}

/**
 * 处理单个订单的查询任务
 * SOLID-S: 单一职责 - 只负责处理单个订单
 */
async function processOrderQuery(
  orderId: string,
  orderMap: Map<
    string,
    {
      id: string;
      orderNumber: string;
      containerNumber: string | null;
      shippingCompany: string | null;
      lastShippingQueryAt: Date | null;
    }
  >,
  orderType: ShippingQueryTargetType,
  force: boolean,
  minIntervalMs: number,
  minIntervalHours: number,
  now: number
): Promise<BatchQueryResultItem> {
  const order = orderMap.get(orderId);

  // 订单不存在
  if (!order) {
    return {
      orderId,
      orderNumber: '未知',
      status: 'failed',
      reason: '订单不存在',
    };
  }

  // 订单缺少运输信息
  if (!order.containerNumber && !order.shippingCompany) {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: 'skipped',
      reason: '缺少运输信息（柜号或船公司）',
    };
  }

  // 检查最小查询间隔（除非强制查询）
  if (!force && order.lastShippingQueryAt) {
    const timeSinceLastQuery = now - order.lastShippingQueryAt.getTime();

    if (timeSinceLastQuery < minIntervalMs) {
      const remainingMinutes = Math.ceil(
        (minIntervalMs - timeSinceLastQuery) / 60000
      );
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: 'skipped',
        reason: `距离上次查询不足 ${minIntervalHours} 小时（还需等待 ${remainingMinutes} 分钟）`,
      };
    }
  }

  // 添加查询任务到队列
  try {
    const job = await addShippingQueryJob(
      {
        targetType: orderType,
        orderId: order.id,
        shippingCompany: order.shippingCompany || '',
        containerNumber: order.containerNumber || undefined,
      },
      {
        jobId: `batch-${orderType}-${order.id}-${Date.now()}`,
        priority: 2,
      }
    );

    logger.info('shipping-query-batch', `成功添加查询任务 ${job.id}`, {
      orderId: order.id,
      orderNumber: order.orderNumber,
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      jobId: job.id,
      status: 'queued',
    };
  } catch (error) {
    logger.error(
      'shipping-query-batch',
      `添加查询任务失败: ${order.orderNumber}`,
      error
    );

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: 'failed',
      reason: error instanceof Error ? error.message : '添加任务到队列失败',
    };
  }
}

/**
 * POST /api/shipping/query/batch
 * 批量触发多个厂家发货订单的运输查询
 */
export const POST = withErrorHandling(
  withAuth(async (request: NextRequest, { user }) => {
    try {
      // 解析和验证请求体
      const rawBody = (await request.json()) as Record<string, unknown>;
      const normalizedPayload = {
        orderIds:
          (rawBody.orderIds as string[] | undefined) ??
          (rawBody.factoryShipmentOrderIds as string[] | undefined),
        orderType: rawBody.orderType,
        force: rawBody.force,
      };
      const validatedData = batchQuerySchema.parse(normalizedPayload);
      const { orderIds, orderType, force } = validatedData;

      logger.info('shipping-query-batch', `用户 ${user.id} 触发批量运输查询`, {
        orderCount: orderIds.length,
        force,
        orderType,
      });

      // 批量查询订单信息
      const orders =
        orderType === SHIPPING_QUERY_TARGETS.FACTORY_SHIPMENT
          ? await prisma.factoryShipmentOrder.findMany({
              where: {
                id: { in: orderIds },
              },
              select: {
                id: true,
                orderNumber: true,
                containerNumber: true,
                shippingCompany: true,
                status: true,
                lastShippingQueryAt: true,
                shippingQueryStatus: true,
              },
              take: orderIds.length,
            })
          : await prisma.purchaseOrder.findMany({
              where: {
                id: { in: orderIds },
              },
              select: {
                id: true,
                orderNumber: true,
                containerNumber: true,
                shippingCompany: true,
                status: true,
                lastShippingQueryAt: true,
                shippingQueryStatus: true,
              },
              take: orderIds.length,
            });

      // 创建订单 ID 到订单的映射
      const orderMap = new Map(orders.map(order => [order.id, order]));

      // 计算最小查询间隔
      const minIntervalHours = env.SHIPPING_QUERY_MIN_INTERVAL_HOURS;
      const minIntervalMs = minIntervalHours * 60 * 60 * 1000;
      const now = Date.now();

      // 处理每个订单
      const results: BatchQueryResultItem[] = [];
      for (const orderId of orderIds) {
        const result = await processOrderQuery(
          orderId,
          orderMap,
          orderType,
          force,
          minIntervalMs,
          minIntervalHours,
          now
        );
        results.push(result);
      }

      // 统计结果
      const queuedCount = results.filter(r => r.status === 'queued').length;
      const skippedCount = results.filter(r => r.status === 'skipped').length;
      const failedCount = results.filter(r => r.status === 'failed').length;

      logger.info('shipping-query-batch', `批量查询任务处理完成`, {
        total: orderIds.length,
        queued: queuedCount,
        skipped: skippedCount,
        failed: failedCount,
      });

      // 返回批量处理结果
      return successResponse({
        total: orderIds.length,
        queued: queuedCount,
        skipped: skippedCount,
        failed: failedCount,
        jobs: results,
      });
    } catch (error) {
      // Zod 验证错误
      if (error instanceof z.ZodError) {
        return errorResponse(
          `请求参数验证失败: ${error.issues.map((e: ZodIssue) => e.message).join(', ')}`,
          400
        );
      }

      logger.error('shipping-query-batch', '批量触发运输查询失败', error, {
        userId: user.id,
      });

      return errorResponse('批量查询失败，请稍后重试', 500);
    }
  })
);
