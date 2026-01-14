// 工作台待处理订单 API
import type { NextRequest } from 'next/server';

import { errorResponse, successResponse, withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function handleGetPendingOrders(request: NextRequest, userRole: string) {
  if (!['admin', 'sales'].includes(userRole)) {
    return errorResponse('权限不足', 403);
  }

  // 查询待处理订单（待发货 + 待收款）
  const orders = await prisma.salesOrder.findMany({
    where: {
      status: {
        in: ['confirmed', 'shipped'],
      },
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [
      { status: 'asc' }, // confirmed 在前
      { createdAt: 'desc' },
    ],
    take: 10,
  });

  return successResponse({
    orders: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customer: order.customer,
      totalAmount: Number(order.totalAmount ?? 0),
      status: order.status,
      createdAt: order.createdAt,
    })),
  });
}

export const GET = withAuth(async (request: NextRequest, { user }) => handleGetPendingOrders(request, user.role));
