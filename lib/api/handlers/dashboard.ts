import { prisma } from '@/lib/db';
import type { DashboardData, TimeRange } from '@/lib/types/dashboard';

/**
 * 获取仪表盘数据
 */
export async function getDashboardData(
  timeRange: TimeRange = '7d'
): Promise<DashboardData> {
  const now = new Date();
  const startDate = getStartDate(now, timeRange);

  // 并行获取所有数据
  const [
    totalProducts,
    totalCustomers,
    totalOrders,
    totalRevenue,
    lowStockCount,
    monthlyOrders,
    recentOrders,
  ] = await Promise.all([
    // 产品总数
    prisma.product.count({
      where: { status: 'active' },
    }),

    // 客户总数
    prisma.customer.count(),

    // 订单总数（指定时间范围）
    prisma.salesOrder.count({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
    }),

    // 总收入（指定时间范围）
    prisma.salesOrder.aggregate({
      where: {
        createdAt: {
          gte: startDate,
        },
        status: {
          in: ['confirmed', 'shipped', 'delivered'],
        },
      },
      _sum: {
        totalAmount: true,
      },
    }),

    // 低库存产品数量
    prisma.product.count({
      where: {
        status: 'active',
        inventory: {
          some: {
            quantity: {
              lte: 10, // 使用默认的低库存阈值
            },
          },
        },
      },
    }),

    // 本月订单数
    prisma.salesOrder.count({
      where: {
        createdAt: {
          gte: new Date(now.getFullYear(), now.getMonth(), 1),
        },
      },
    }),

    // 最近订单
    prisma.salesOrder.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        customer: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  return {
    overview: {
      inventory: {
        totalProducts,
        lowStockCount,
      },
      sales: {
        totalOrders,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        monthlyOrders,
      },
      customers: {
        totalCustomers,
      },
    },
    recentOrders: recentOrders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customer?.name || '未知客户',
      totalAmount: order.totalAmount,
      status: order.status,
      createdAt: order.createdAt,
    })),
    alerts: [], // 暂时为空，后续可以添加库存警告等
    quickActions: [
      {
        id: 'create-order',
        title: '创建订单',
        description: '快速创建新的销售订单',
        icon: 'plus',
        href: '/sales-orders/create',
      },
      {
        id: 'add-product',
        title: '添加产品',
        description: '向库存中添加新产品',
        icon: 'package',
        href: '/products/create',
      },
      {
        id: 'inventory-check',
        title: '库存盘点',
        description: '进行库存盘点和调整',
        icon: 'clipboard',
        href: '/inventory',
      },
    ],
  };
}

/**
 * 根据时间范围获取开始日期
 */
function getStartDate(now: Date, timeRange: TimeRange): Date {
  switch (timeRange) {
    case '1d':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
}

/**
 * 获取业务概览数据
 */
export async function getBusinessOverview(timeRange: TimeRange = '7d') {
  return getDashboardData(timeRange);
}

/**
 * 获取库存警告
 */
export async function getInventoryAlerts() {
  const lowStockProducts = await prisma.product.findMany({
    where: {
      status: 'active',
      inventory: {
        some: {
          quantity: {
            lte: 10,
          },
        },
      },
    },
    include: {
      inventory: {
        select: {
          quantity: true,
        },
      },
    },
    take: 10,
  });

  return lowStockProducts.map(product => ({
    id: product.id,
    productName: product.name,
    currentStock: product.inventory.reduce((sum, inv) => sum + inv.quantity, 0),
    minStock: 10,
    severity: 'warning' as const,
  }));
}

/**
 * 获取待办事项
 */
export async function getTodoItems() {
  const pendingOrders = await prisma.salesOrder.count({
    where: {
      status: 'pending',
    },
  });

  const lowStockCount = await prisma.product.count({
    where: {
      status: 'active',
      inventory: {
        some: {
          quantity: {
            lte: 10,
          },
        },
      },
    },
  });

  return [
    {
      id: 'pending-orders',
      title: '待处理订单',
      count: pendingOrders,
      priority: 'high' as const,
      href: '/sales-orders?status=pending',
    },
    {
      id: 'low-stock',
      title: '低库存商品',
      count: lowStockCount,
      priority: 'medium' as const,
      href: '/products?lowStock=true',
    },
  ];
}

/**
 * 获取销售趋势数据
 */
export async function getSalesTrend(timeRange: TimeRange = '7d') {
  // 简化实现，返回模拟数据
  return [];
}

/**
 * 获取库存趋势数据
 */
export async function getInventoryTrend(timeRange: TimeRange = '7d') {
  // 简化实现，返回模拟数据
  return [];
}

/**
 * 获取产品排名
 */
export async function getProductRanking(timeRange: TimeRange = '7d') {
  // 简化实现，返回模拟数据
  return [];
}

/**
 * 获取客户排名
 */
export async function getCustomerRanking(timeRange: TimeRange = '7d') {
  // 简化实现，返回模拟数据
  return [];
}

/**
 * 获取快捷操作
 */
export async function getQuickActions() {
  return [
    {
      id: 'create-order',
      title: '创建订单',
      description: '快速创建新的销售订单',
      icon: 'plus',
      href: '/sales-orders/create',
    },
    {
      id: 'add-product',
      title: '添加产品',
      description: '向库存中添加新产品',
      icon: 'package',
      href: '/products/create',
    },
    {
      id: 'inventory-check',
      title: '库存盘点',
      description: '进行库存盘点和调整',
      icon: 'clipboard',
      href: '/inventory',
    },
  ];
}
