import { prisma } from '@/lib/db';
import { inventoryConfig } from '@/lib/env';
import { logger } from '@/lib/logger';
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
    _recentOrders,
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
    prisma.inventory
      .findMany({
        where: {
          quantity: {
            lte: 10,
          },
        },
        select: {
          productId: true,
        },
        distinct: ['productId'],
      })
      .then(items => items.length),

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
        totalStock: 0,
        lowStockCount,
        outOfStockCount: 0,
        inventoryValue: 0,
        turnoverRate: 0,
        stockHealth: 0,
        productGrowth: 0,
      },
      sales: {
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        monthlyRevenue: 0,
        totalOrders,
        monthlyOrders,
        averageOrderValue: 0,
        revenueGrowth: 0,
        ordersGrowth: 0,
      },
      customers: {
        totalCustomers,
        activeCustomers: 0,
        newCustomers: 0,
        customerGrowth: 0,
      },
      returns: {
        totalReturns: 0,
        monthlyReturns: 0,
        returnRate: 0,
        returnValue: 0,
        pendingReturns: 0,
      },
    },
    // recentOrders: recentOrders.map(order => ({
    //   id: order.id,
    //   orderNumber: order.orderNumber,
    //   customerName: order.customer?.name || '未知客户',
    //   totalAmount: order.totalAmount,
    //   status: order.status,
    //   createdAt: order.createdAt,
    // })),
    alerts: [], // 暂时为空，后续可以添加库存警告等
    todos: [], // 待办事项
    salesTrend: {
      daily: [],
      weekly: [],
      monthly: [],
      yearly: [],
    },
    inventoryTrend: {
      stockLevels: [],
      stockMovements: [],
      categoryDistribution: [],
    },
    productRanking: [], // 产品排名
    customerRanking: [], // 客户排名
    config: {
      refreshInterval: 30000,
      showAlerts: true,
      showTodos: true,
      showCharts: true,
      showQuickActions: true,
      layout: 'grid' as const,
      theme: 'light' as const,
    },
    lastUpdated: new Date().toISOString(),
    // recentActivities: [], // 最近活动
    // notifications: [], // 通知
    quickActions: [
      {
        id: 'create-order',
        title: '创建订单',
        description: '快速创建新的销售订单',
        icon: 'plus',
        href: '/sales-orders/create',
        color: 'blue',
      },
      {
        id: 'add-product',
        title: '添加产品',
        description: '向库存中添加新产品',
        icon: 'package',
        href: '/products/create',
        color: 'green',
      },
      {
        id: 'inventory-check',
        title: '库存盘点',
        description: '进行库存盘点和调整',
        icon: 'clipboard',
        href: '/inventory',
        color: 'orange',
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
  // 获取低库存记录
  const lowStockInventories = await prisma.inventory.findMany({
    where: {
      quantity: {
        lte: inventoryConfig.lowStockThreshold,
      },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
    take: 10,
  });

  // 按产品聚合库存
  const productStockMap = new Map<string, { name: string; quantity: number }>();

  for (const inv of lowStockInventories) {
    if (inv.product.status !== 'active') continue;

    const existing = productStockMap.get(inv.product.id);
    if (existing) {
      existing.quantity += inv.quantity;
    } else {
      productStockMap.set(inv.product.id, {
        name: inv.product.name,
        quantity: inv.quantity,
      });
    }
  }

  return Array.from(productStockMap.entries()).map(([id, data]) => ({
    id,
    productName: data.name,
    currentStock: data.quantity,
    minStock: inventoryConfig.lowStockThreshold,
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

  // 获取低库存产品数量（去重）
  const lowStockInventories = await prisma.inventory.findMany({
    where: {
      quantity: {
        lte: 10,
      },
    },
    select: {
      productId: true,
    },
    distinct: ['productId'],
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
      title: '低库存产品',
      count: lowStockInventories.length,
      priority: 'medium' as const,
      href: '/products?lowStock=true',
    },
  ];
}

/**
 * 获取销售趋势数据
 */
export async function getSalesTrend(_timeRange: TimeRange = '7d') {
  // 简化实现，返回模拟数据
  return [];
}

/**
 * 获取库存趋势数据
 */
export async function getInventoryTrend(_timeRange: TimeRange = '7d') {
  // 简化实现，返回模拟数据
  return [];
}

/**
 * 获取产品排名
 */
export async function getProductRanking(
  timeRange: TimeRange = '7d',
  limit = 10
) {
  const now = new Date();
  const startDate = getStartDate(now, timeRange);

  try {
    // 并行获取仓库发货和厂家发货的产品销售数据
    const [warehouseSales, factorySales] = await Promise.all([
      // 仓库发货产品销售统计
      prisma.$queryRaw<
        Array<{
          productId: string;
          productName: string;
          productCode: string;
          totalQuantity: number;
          totalAmount: number;
          orderCount: number;
        }>
      >`
        SELECT 
          p.id as productId,
          p.name as productName,
          p.product_code as productCode,
          SUM(soi.quantity) as totalQuantity,
          SUM(soi.subtotal) as totalAmount,
          COUNT(DISTINCT so.id) as orderCount
        FROM sales_order_items soi
        INNER JOIN sales_orders so ON soi.sales_order_id = so.id
        INNER JOIN products p ON soi.product_id = p.id
        WHERE so.created_at >= ${startDate}
          AND so.status IN ('confirmed', 'shipped', 'delivered')
          AND soi.product_id IS NOT NULL
        GROUP BY p.id, p.name, p.product_code
        ORDER BY totalAmount DESC
        LIMIT ${limit}
      `,

      // 厂家发货产品销售统计
      prisma.$queryRaw<
        Array<{
          productId: string;
          productName: string;
          productCode: string;
          totalQuantity: number;
          totalAmount: number;
          orderCount: number;
        }>
      >`
        SELECT 
          p.id as productId,
          p.name as productName,
          p.product_code as productCode,
          SUM(fsoi.quantity) as totalQuantity,
          SUM(fsoi.total_price) as totalAmount,
          COUNT(DISTINCT fso.id) as orderCount
        FROM factory_shipment_order_items fsoi
        INNER JOIN factory_shipment_orders fso ON fsoi.factory_shipment_order_id = fso.id
        INNER JOIN products p ON fsoi.product_id = p.id
        WHERE fso.created_at >= ${startDate}
          AND fso.status IN ('confirmed', 'shipped', 'delivered', 'completed')
          AND fsoi.product_id IS NOT NULL
        GROUP BY p.id, p.name, p.product_code
        ORDER BY totalAmount DESC
        LIMIT ${limit}
      `,
    ]);

    return {
      warehouse: warehouseSales.map((item, index) => ({
        rank: index + 1,
        productId: item.productId,
        productName: item.productName,
        productCode: item.productCode,
        totalQuantity: Number(item.totalQuantity),
        totalAmount: Number(item.totalAmount),
        orderCount: Number(item.orderCount),
        source: 'warehouse' as const,
      })),
      factory: factorySales.map((item, index) => ({
        rank: index + 1,
        productId: item.productId,
        productName: item.productName,
        productCode: item.productCode,
        totalQuantity: Number(item.totalQuantity),
        totalAmount: Number(item.totalAmount),
        orderCount: Number(item.orderCount),
        source: 'factory' as const,
      })),
    };
  } catch (error) {
    // 避免仪表盘因为 SQL/数据问题直接 500，记录日志并返回空排名
    logger.error('dashboard', '获取产品销售排名失败，已返回空结果', error, {
      timeRange,
      limit,
    });

    return {
      warehouse: [],
      factory: [],
    };
  }
}

/**
 * 获取客户排名
 */
export async function getCustomerRanking(_timeRange: TimeRange = '7d') {
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
