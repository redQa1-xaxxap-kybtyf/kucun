/**
 * POST /api/shipping/query/trigger - 手动触发单个订单的运输查询
 * SOLID-S: 单一职责 - 只负责触发单个订单查询
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
} from '@/lib/queue/shipping-query-queue';

/**
 * 请求体验证 Schema
 */
const triggerQuerySchema = z.object({
  orderId: z.string().min(1, '订单编号不能为空').uuid('订单编号格式不正确'),
  orderType: z
    .enum([
      SHIPPING_QUERY_TARGETS.FACTORY_SHIPMENT,
      SHIPPING_QUERY_TARGETS.PURCHASE_ORDER,
    ] as const)
    .default(SHIPPING_QUERY_TARGETS.FACTORY_SHIPMENT),
  force: z.boolean().optional().default(false),
});

/**
 * POST /api/shipping/query/trigger
 * 手动触发单个厂家发货订单的运输查询
 */
export const POST = withErrorHandling(
  withAuth(async (request: NextRequest, { user }) => {
    try {
      // 解析和验证请求体
      const body: unknown = await request.json();
      const validatedData = triggerQuerySchema.parse(body);
      const { orderId, orderType, force } = validatedData;

      logger.info('shipping-query-trigger', `用户 ${user.id} 触发运输查询`, {
        orderId,
        orderType,
        force,
      });

      const order =
        orderType === SHIPPING_QUERY_TARGETS.FACTORY_SHIPMENT
          ? await prisma.factoryShipmentOrder.findUnique({
              where: { id: orderId },
              select: {
                id: true,
                orderNumber: true,
                containerNumber: true,
                shippingCompany: true,
                status: true,
                lastShippingQueryAt: true,
                shippingQueryStatus: true,
              },
            })
          : await prisma.purchaseOrder.findUnique({
              where: { id: orderId },
              select: {
                id: true,
                orderNumber: true,
                containerNumber: true,
                shippingCompany: true,
                status: true,
                lastShippingQueryAt: true,
                shippingQueryStatus: true,
              },
            });

      // 验证订单是否存在
      if (!order) {
        return errorResponse('订单不存在', 404);
      }

      // 验证订单是否有运输信息
      if (!order.containerNumber && !order.shippingCompany) {
        return errorResponse('订单缺少运输信息（柜号或船公司），无法查询', 400);
      }

      // 检查最小查询间隔（除非强制查询）
      if (!force && order.lastShippingQueryAt) {
        const minIntervalHours = env.SHIPPING_QUERY_MIN_INTERVAL_HOURS;
        const minIntervalMs = minIntervalHours * 60 * 60 * 1000;
        const timeSinceLastQuery =
          Date.now() - order.lastShippingQueryAt.getTime();

        if (timeSinceLastQuery < minIntervalMs) {
          const remainingMinutes = Math.ceil(
            (minIntervalMs - timeSinceLastQuery) / 60000
          );
          return errorResponse(
            `距离上次查询时间不足 ${minIntervalHours} 小时，请等待 ${remainingMinutes} 分钟后再试。如需立即查询，请使用强制查询选项。`,
            429
          );
        }
      }

      // 添加查询任务到队列
      const job = await addShippingQueryJob(
        {
          targetType: orderType,
          orderId: order.id,
          shippingCompany: order.shippingCompany || '',
          containerNumber: order.containerNumber || undefined,
        },
        {
          jobId: `manual-${orderType}-${order.id}-${Date.now()}`, // 使用唯一 jobId 避免重复
          priority: 1, // 手动触发的任务优先级更高
        }
      );

      logger.info('shipping-query-trigger', `成功添加查询任务 ${job.id}`, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        jobId: job.id,
      });

      // 返回任务信息
      return successResponse({
        jobId: job.id,
        orderId: order.id,
        orderType,
        orderNumber: order.orderNumber,
        status: 'queued' as const,
        message: '查询任务已添加到队列',
      });
    } catch (error) {
      // Zod 验证错误
      if (error instanceof z.ZodError) {
        return errorResponse(
          `请求提交内容有误： ${error.issues.map((e: ZodIssue) => e.message).join(', ')}`,
          400
        );
      }

      logger.error('shipping-query-trigger', '触发运输查询失败', error, {
        userId: user.id,
      });

      return errorResponse('触发查询失败，请稍后重试', 500);
    }
  })
);
