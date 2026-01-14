// 工作台统计数据 API
import type { NextRequest } from 'next/server';

import { errorResponse, successResponse, withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function handleGetStats(_request: NextRequest, userRole: string) {
  if (!['admin', 'sales'].includes(userRole)) {
    return errorResponse('权限不足', 403);
  }

  const now = new Date();

  // 今日开始时间
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 本月开始时间
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // 并行查询统计数据
  const [
    todayOrdersData,
    pendingShipmentCount,
    pendingPaymentCount,
    monthOrdersData,
    monthActiveCustomers,
  ] = await Promise.all([
    // 今日订单统计
    prisma.salesOrder.aggregate({
      where: {
        createdAt: { gte: todayStart },
        status: { not: 'cancelled' },
      },
      _count: true,
      _sum: { totalAmount: true },
    }),

    // 待发货订单数
    prisma.salesOrder.count({
      where: {
        status: 'confirmed',
      },
    }),

    // 待收款订单数（已发货但未完成）
    prisma.salesOrder.count({
      where: {
        status: 'shipped',
      },
    }),

    // 本月订单统计
    prisma.salesOrder.aggregate({
      where: {
        createdAt: { gte: monthStart },
        status: { not: 'cancelled' },
      },
      _count: true,
      _sum: { totalAmount: true },
    }),

    // 本月活跃客户数
    prisma.salesOrder.groupBy({
      by: ['customerId'],
      where: {
        createdAt: { gte: monthStart },
        status: { not: 'cancelled' },
      },
    }),
  ]);

  return successResponse({
    todayAmount: Number(todayOrdersData._sum.totalAmount ?? 0),
    todayOrders: todayOrdersData._count || 0,
    pendingShipment: pendingShipmentCount,
    pendingPayment: pendingPaymentCount,
    monthAmount: Number(monthOrdersData._sum.totalAmount ?? 0),
    monthOrders: monthOrdersData._count || 0,
    monthCustomers: monthActiveCustomers.length,
  });
}

export const GET = withAuth(async (request: NextRequest, { user }) => handleGetStats(request, user.role));
