import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// 获取待办事项数据
export async function GET(_request: NextRequest) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const todos: Array<{
      id: string;
      title: string;
      description: string;
      priority: 'urgent' | 'high' | 'medium' | 'low';
      type: string;
      createdAt: Date | string;
      dueDate?: Date;
      url?: string;
      relatedId?: string;
      status?: string;
      assignedTo?: string;
    }> = [];

    // 1. 待确认的销售订单
    const pendingSalesOrders = await prisma.salesOrder.findMany({
      where: {
        status: 'draft',
      },
      include: {
        customer: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    pendingSalesOrders.forEach(order => {
      todos.push({
        id: `sales-${order.id}`,
        type: 'sales_order' as const,
        title: `确认销售订单 ${order.orderNumber}`,
        description: `客户：${order.customer.name}，金额：¥${order.totalAmount?.toFixed(2) || '0.00'}`,
        priority: 'high' as const,
        dueDate: undefined,
        relatedId: order.id,
        status: 'pending' as const,
        createdAt: order.createdAt.toISOString(),
        assignedTo: session.user.id,
      });
    });

    // 2. 库存不足预警
    const lowStockItems = await prisma.inventory.findMany({
      where: {
        quantity: {
          lte: 10,
        },
        product: {
          status: 'active',
        },
      },
      include: {
        product: {
          select: {
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        quantity: 'asc',
      },
      take: 5,
    });

    lowStockItems.forEach(item => {
      const priority =
        item.quantity === 0 ? 'urgent' : item.quantity <= 5 ? 'high' : 'medium';

      todos.push({
        id: `inventory-${item.id}`,
        type: 'inventory_alert' as const,
        title: `${item.product.name} 库存不足`,
        description: `产品编码：${item.product.code}，当前库存：${item.quantity}`,
        priority: priority as 'low' | 'medium' | 'high' | 'urgent',
        dueDate: undefined,
        relatedId: item.productId,
        status: 'pending' as const,
        createdAt: item.updatedAt.toISOString(),
        assignedTo: session.user.id,
      });
    });

    // 3. 需要跟进的已确认订单（简化处理，不依赖paymentStatus字段）
    const confirmedSalesOrders = await prisma.salesOrder.findMany({
      where: {
        status: 'confirmed',
        createdAt: {
          lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7天前
        },
      },
      include: {
        customer: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 3,
    });

    confirmedSalesOrders.forEach(order => {
      const daysPastDue = Math.floor(
        (Date.now() - order.createdAt.getTime()) / (24 * 60 * 60 * 1000)
      );

      todos.push({
        id: `follow-up-${order.id}`,
        type: 'customer_follow_up' as const,
        title: `跟进订单进度 ${order.orderNumber}`,
        description: `客户：${order.customer.name}，已确认 ${daysPastDue} 天，金额：¥${order.totalAmount?.toFixed(2) || '0.00'}`,
        priority: daysPastDue > 14 ? 'urgent' : ('high' as const),
        dueDate: undefined,
        relatedId: order.id,
        status: 'pending' as const,
        createdAt: order.createdAt.toISOString(),
        assignedTo: session.user.id,
      });
    });

    // 按优先级和创建时间排序
    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
    todos.sort((a, b) => {
      const priorityDiff =
        priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({
      success: true,
      data: todos.slice(0, 10), // 限制返回数量
    });
  } catch (error) {
    console.error('获取待办事项失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取待办事项失败',
      },
      { status: 500 }
    );
  }
}
