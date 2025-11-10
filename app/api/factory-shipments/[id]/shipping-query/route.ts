import { type NextRequest } from 'next/server';

import { withErrorHandling } from '@/lib/api/middleware';
import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import {
  addShippingQueryJob,
  SHIPPING_QUERY_TARGETS,
} from '@/lib/queue/shipping-query-queue';

const MANUAL_QUERY_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6小时

export const POST = withErrorHandling(
  withAuth(async (_request: NextRequest, { params }) => {
    if (!params) {
      return errorResponse('缺少请求参数', 400);
    }
    const { id } = await params;

    const order = await prisma.factoryShipmentOrder.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        shippingCompany: true,
        containerNumber: true,
        estimatedArrival: true,
        lastShippingQueryAt: true,
      },
    });

    if (!order) {
      return errorResponse('订单不存在或无权限访问', 404);
    }

    if (order.status !== 'shipped') {
      return errorResponse('只有已发货的订单才能手动查询', 400);
    }

    if (order.estimatedArrival) {
      return errorResponse('该订单已有预计到达时间，无需重复查询', 400);
    }

    if (!order.shippingCompany?.trim()) {
      return errorResponse('请先填写船运公司信息再查询', 400);
    }

    const now = Date.now();
    const lastQueryAt = order.lastShippingQueryAt
      ? new Date(order.lastShippingQueryAt).getTime()
      : null;

    if (lastQueryAt && now - lastQueryAt < MANUAL_QUERY_COOLDOWN_MS) {
      const remainingMs = MANUAL_QUERY_COOLDOWN_MS - (now - lastQueryAt);
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      return errorResponse(
        `距离上次查询不足6小时，请 ${remainingMinutes} 分钟后再试`,
        429
      );
    }

    await addShippingQueryJob(
      {
        targetType: SHIPPING_QUERY_TARGETS.FACTORY_SHIPMENT,
        orderId: order.id,
        shippingCompany: order.shippingCompany,
        containerNumber: order.containerNumber || undefined,
      },
      {
        jobId: `manual-shipping-query-${order.id}-${Date.now()}`,
      }
    );

    await prisma.factoryShipmentOrder.update({
      where: { id: order.id },
      data: {
        shippingQueryStatus: 'manual_pending',
        shippingQueryError: null,
        lastShippingQueryAt: new Date(),
      },
    });

    const nextAvailableAt = new Date(now + MANUAL_QUERY_COOLDOWN_MS);

    return successResponse(
      {
        orderId: order.id,
        nextAvailableAt: nextAvailableAt.toISOString(),
      },
      200,
      '已提交运输查询，预计几分钟内完成，请稍后刷新'
    );
  })
);
