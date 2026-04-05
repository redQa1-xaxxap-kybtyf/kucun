import { prisma } from '@/lib/db';
import { SALES_ORDER_PENDING_FILTER_STATUSES } from '@/lib/types/sales-order';

export interface DashboardTodoItem {
  id: string;
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  type: 'sales_order' | 'inventory_alert' | 'customer_follow_up';
  createdAt: Date | string;
  dueDate?: Date;
  url?: string;
  relatedId?: string;
  status?: string;
  assignedTo?: string;
}

const PRIORITY_ORDER = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
} as const;

export async function listDashboardTodoItems(
  userId: string,
  limit = 10
): Promise<DashboardTodoItem[]> {
  const todos: DashboardTodoItem[] = [];

  const [pendingSalesOrders, lowStockItems, confirmedSalesOrders] =
    await Promise.all([
      prisma.salesOrder.findMany({
        where: {
          status: {
            in: [...SALES_ORDER_PENDING_FILTER_STATUSES],
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
          createdAt: 'desc',
        },
        take: 5,
      }),
      prisma.inventory.findMany({
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
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: {
          quantity: 'asc',
        },
        take: 5,
      }),
      prisma.salesOrder.findMany({
        where: {
          status: 'confirmed',
          createdAt: {
            lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
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
      }),
    ]);

  pendingSalesOrders.forEach(order => {
    const isDraft = order.status === 'draft';
    todos.push({
      id: `sales-${order.id}`,
      type: 'sales_order',
      title: isDraft
        ? `确认销售订单 ${order.orderNumber}`
        : `安排订单发货 ${order.orderNumber}`,
      description: `客户：${order.customer.name}，${isDraft ? '当前为草稿待确认' : '当前已确认待发货'}，金额：￥${order.totalAmount?.toFixed(2) || '0.00'}`,
      priority: 'high',
      relatedId: order.id,
      status: 'pending',
      createdAt: order.createdAt,
      assignedTo: userId,
      url: `/sales-orders/${order.id}`,
    });
  });

  lowStockItems.forEach(item => {
    const priority =
      item.quantity === 0 ? 'urgent' : item.quantity <= 5 ? 'high' : 'medium';

    todos.push({
      id: `inventory-${item.id}`,
      type: 'inventory_alert',
      title: `${item.product.name} 库存不足`,
      description: `产品编码：${item.product.code}，当前库存：${item.quantity}`,
      priority,
      relatedId: item.productId,
      status: 'pending',
      createdAt: item.updatedAt,
      assignedTo: userId,
      url: '/inventory',
    });
  });

  confirmedSalesOrders.forEach(order => {
    const daysPastDue = Math.floor(
      (Date.now() - order.createdAt.getTime()) / (24 * 60 * 60 * 1000)
    );

    todos.push({
      id: `follow-up-${order.id}`,
      type: 'customer_follow_up',
      title: `跟进订单进度 ${order.orderNumber}`,
      description: `客户：${order.customer.name}，已确认 ${daysPastDue} 天，金额：￥${order.totalAmount?.toFixed(2) || '0.00'}`,
      priority: daysPastDue > 14 ? 'urgent' : 'high',
      relatedId: order.id,
      status: 'pending',
      createdAt: order.createdAt,
      assignedTo: userId,
      url: `/sales-orders/${order.id}`,
    });
  });

  todos.sort((left, right) => {
    const priorityDiff =
      PRIORITY_ORDER[right.priority] - PRIORITY_ORDER[left.priority];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return (
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  });

  return todos.slice(0, limit);
}
