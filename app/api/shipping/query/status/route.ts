/**
 * GET /api/shipping/query/status - 获取查询任务的执行状态
 * SOLID-S: 单一职责 - 只负责查询任务状态
 * DRY: 复用现有的队列基础设施
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
import { logger } from '@/lib/logger';
import { shippingQueryQueue } from '@/lib/queue/shipping-query-queue';

/**
 * 查询参数验证 Schema
 */
const statusQuerySchema = z
  .object({
    jobId: z.string().optional(),
    orderId: z.string().uuid('订单 ID 格式无效').optional(),
  })
  .refine(data => data.jobId || data.orderId, {
    message: '必须提供 jobId 或 orderId 参数',
  });

type StatusQueryInput = z.infer<typeof statusQuerySchema>;

/**
 * GET /api/shipping/query/status
 * 获取查询任务的执行状态
 */
export const GET = withErrorHandling(
  // eslint-disable-next-line max-lines-per-function
  withAuth(async (request: NextRequest, { user }) => {
    try {
      // 解析查询参数
      const { searchParams } = new URL(request.url);
      const queryParams: StatusQueryInput = {
        jobId: searchParams.get('jobId') || undefined,
        orderId: searchParams.get('orderId') || undefined,
      };

      // 验证查询参数
      const validatedParams = statusQuerySchema.parse(queryParams);
      const { jobId, orderId } = validatedParams;

      logger.info('shipping-query-status', `用户 ${user.id} 查询任务状态`, {
        jobId,
        orderId,
      });

      // 如果提供了 jobId，直接查询任务状态
      if (jobId) {
        const job = await shippingQueryQueue.getJob(jobId);

        if (!job) {
          return errorResponse('任务不存在或已过期', 404);
        }

        const state = await job.getState();
        const progress = job.progress;

        // 获取任务关联的订单信息
        const order = await prisma.factoryShipmentOrder.findUnique({
          where: { id: job.data.factoryShipmentOrderId },
          select: {
            id: true,
            orderNumber: true,
            containerNumber: true,
            shippingCompany: true,
            lastShippingQueryAt: true,
            shippingQueryStatus: true,
            shippingQueryError: true,
          },
        });

        // 构建响应数据
        const responseData: Record<string, unknown> = {
          jobId: job.id,
          orderId: job.data.factoryShipmentOrderId,
          orderNumber: order?.orderNumber || '未知',
          status: state,
          progress: typeof progress === 'number' ? progress : undefined,
          createdAt: new Date(job.timestamp).toISOString(),
          processedAt: job.processedOn
            ? new Date(job.processedOn).toISOString()
            : undefined,
          finishedAt: job.finishedOn
            ? new Date(job.finishedOn).toISOString()
            : undefined,
        };

        // 如果任务已完成，添加查询结果
        if (state === 'completed' && order) {
          // 查询最近的查询记录
          const latestQuery = await prisma.shippingQuery.findFirst({
            where: {
              factoryShipmentOrderId: order.id,
            },
            orderBy: {
              queriedAt: 'desc',
            },
            select: {
              status: true,
              destination: true,
              estimatedArrival: true,
              lastUpdateTime: true,
              queryStatus: true,
            },
          });

          if (latestQuery && latestQuery.queryStatus === 'success') {
            responseData.result = {
              status: latestQuery.status || '',
              destination: latestQuery.destination || '',
              estimatedArrival: latestQuery.estimatedArrival
                ? latestQuery.estimatedArrival.toISOString()
                : null,
              lastUpdateTime: latestQuery.lastUpdateTime
                ? latestQuery.lastUpdateTime.toISOString()
                : null,
            };
          }
        }

        // 如果任务失败，添加错误信息
        if (state === 'failed') {
          responseData.error =
            job.failedReason || order?.shippingQueryError || '查询失败';
        }

        return successResponse(responseData);
      }

      // 如果提供了 orderId，查找该订单最近的查询任务
      if (orderId) {
        // 查询订单信息
        const order = await prisma.factoryShipmentOrder.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            orderNumber: true,
            containerNumber: true,
            shippingCompany: true,
            lastShippingQueryAt: true,
            shippingQueryStatus: true,
            shippingQueryError: true,
          },
        });

        if (!order) {
          return errorResponse('订单不存在', 404);
        }

        // 尝试查找最近的任务（通过 jobId 模式匹配）
        // 注意：BullMQ 不支持按数据字段查询，所以我们需要遍历最近的任务
        const jobs = await shippingQueryQueue.getJobs([
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
        ]);

        // 查找匹配该订单的最近任务
        const matchingJob = jobs.find(
          job => job.data.factoryShipmentOrderId === orderId
        );

        if (matchingJob) {
          const state = await matchingJob.getState();
          const progress = matchingJob.progress;

          const responseData: Record<string, unknown> = {
            jobId: matchingJob.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            status: state,
            progress: typeof progress === 'number' ? progress : undefined,
            createdAt: new Date(matchingJob.timestamp).toISOString(),
            processedAt: matchingJob.processedOn
              ? new Date(matchingJob.processedOn).toISOString()
              : undefined,
            finishedAt: matchingJob.finishedOn
              ? new Date(matchingJob.finishedOn).toISOString()
              : undefined,
          };

          // 如果任务已完成，添加查询结果
          if (state === 'completed') {
            const latestQuery = await prisma.shippingQuery.findFirst({
              where: {
                factoryShipmentOrderId: order.id,
              },
              orderBy: {
                queriedAt: 'desc',
              },
              select: {
                status: true,
                destination: true,
                estimatedArrival: true,
                lastUpdateTime: true,
                queryStatus: true,
              },
            });

            if (latestQuery && latestQuery.queryStatus === 'success') {
              responseData.result = {
                status: latestQuery.status || '',
                destination: latestQuery.destination || '',
                estimatedArrival: latestQuery.estimatedArrival
                  ? latestQuery.estimatedArrival.toISOString()
                  : null,
                lastUpdateTime: latestQuery.lastUpdateTime
                  ? latestQuery.lastUpdateTime.toISOString()
                  : null,
              };
            }
          }

          // 如果任务失败，添加错误信息
          if (state === 'failed') {
            responseData.error =
              matchingJob.failedReason ||
              order.shippingQueryError ||
              '查询失败';
          }

          return successResponse(responseData);
        }

        // 如果没有找到队列中的任务，返回订单的最后查询状态
        return successResponse({
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: order.shippingQueryStatus || 'unknown',
          lastQueryAt: order.lastShippingQueryAt
            ? order.lastShippingQueryAt.toISOString()
            : null,
          error: order.shippingQueryError || undefined,
          message: '未找到进行中的查询任务，返回最后查询状态',
        });
      }

      // 理论上不会到达这里，因为 Zod 验证会确保至少有一个参数
      return errorResponse('必须提供 jobId 或 orderId 参数', 400);
    } catch (error) {
      // Zod 验证错误
      if (error instanceof z.ZodError) {
        return errorResponse(
          `请求参数验证失败: ${error.issues.map((e: ZodIssue) => e.message).join(', ')}`,
          400
        );
      }

      logger.error('shipping-query-status', '查询任务状态失败', error, {
        userId: user.id,
      });

      return errorResponse('查询状态失败，请稍后重试', 500);
    }
  })
);
