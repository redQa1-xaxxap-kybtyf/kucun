/**
 * 销售订单API处理器
 * 将超长API函数拆分为职责单一的小函数
 */

import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma, withTransaction } from '@/lib/db';
import type {
  SalesOrderCreateFormData,
  SalesOrderItemFormData,
  SalesOrderQueryFormData,
} from '@/lib/validations/sales-order';

/**
 * 验证用户权限
 */
export async function validateUserSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: '未授权访问', status: 401 };
  }
  return { user: session.user };
}

/**
 * 构建销售订单查询条件
 */
export function buildSalesOrderQuery(params: SalesOrderQueryFormData) {
  const where: Record<string, unknown> = {};

  if (params.search) {
    where.OR = [
      { orderNumber: { contains: params.search } },
      { customer: { name: { contains: params.search } } },
      { remarks: { contains: params.search } },
    ];
  }

  if (params.status) {
    where.status = params.status;
  }

  if (params.customerId) {
    where.customerId = params.customerId;
  }

  if (params.dateFrom || params.dateTo) {
    where.createdAt = {};
    if (params.dateFrom) {
      where.createdAt.gte = new Date(params.dateFrom);
    }
    if (params.dateTo) {
      where.createdAt.lte = new Date(params.dateTo);
    }
  }

  return where;
}

/**
 * 构建销售订单排序条件
 */
export function buildSalesOrderOrderBy(params: SalesOrderQueryFormData) {
  return {
    [params.sortBy]: params.sortOrder,
  };
}

/**
 * 获取销售订单列表
 */
export async function getSalesOrdersList(params: SalesOrderQueryFormData) {
  const where = buildSalesOrderQuery(params);
  const orderBy = buildSalesOrderOrderBy(params);

  const [salesOrders, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      orderBy,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        userId: true,
        status: true,
        orderType: true,
        supplierId: true,
        costAmount: true,
        profitAmount: true,
        totalAmount: true,
        remarks: true,
        createdAt: true,
        updatedAt: true,
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    }),
    prisma.salesOrder.count({ where }),
  ]);

  return {
    salesOrders,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
  };
}

/**
 * 获取单个销售订单详情
 */
export async function getSalesOrderById(id: string) {
  return await prisma.salesOrder.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      customerId: true,
      userId: true,
      status: true,
      orderType: true,
      supplierId: true,
      costAmount: true,
      profitAmount: true,
      totalAmount: true,
      remarks: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
        },
      },
      supplier: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
      items: {
        select: {
          id: true,
          productId: true,
          colorCode: true,
          productionDate: true,
          quantity: true,
          unitPrice: true,
          subtotal: true,
          unitCost: true,
          costSubtotal: true,
          profitAmount: true,
          isManualProduct: true,
          manualProductName: true,
          manualSpecification: true,
          manualWeight: true,
          manualUnit: true,
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              specification: true,
              unit: true,
              weight: true,
              piecesPerUnit: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });
}

/**
 * 生成订单号
 */
export function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const timestamp = now.getTime().toString().slice(-6);

  return `SO${year}${month}${day}${timestamp}`;
}

/**
 * 计算订单明细小计
 */
export function calculateItemSubtotal(
  quantity: number,
  unitPrice: number
): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

/**
 * 计算订单总金额
 */
export function calculateOrderTotal(items: { subtotal?: number }[]): number {
  return (
    Math.round(
      items.reduce((total, item) => total + (item.subtotal || 0), 0) * 100
    ) / 100
  );
}

/**
 * 计算调货销售的成本和毛利
 */
export function calculateTransferCosts(
  items: { unitCost?: number; quantity?: number; subtotal: number }[]
) {
  let totalCost = 0;
  let totalProfit = 0;

  items.forEach(item => {
    if (item.unitCost && item.quantity) {
      const costSubtotal =
        Math.round(item.unitCost * item.quantity * 100) / 100;
      const profitAmount =
        Math.round((item.subtotal - costSubtotal) * 100) / 100;

      item.costSubtotal = costSubtotal;
      item.profitAmount = profitAmount;

      totalCost += costSubtotal;
      totalProfit += profitAmount;
    }
  });

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
  };
}

/**
 * 处理订单明细数据
 */
export function processOrderItems(
  items: SalesOrderItemFormData[],
  orderType: string
) {
  const processedItems = items.map(item => {
    const subtotal = calculateItemSubtotal(item.quantity, item.unitPrice);

    const processedItem = {
      ...item,
      subtotal,
    };

    // 调货销售需要计算成本和毛利
    if (orderType === 'TRANSFER' && item.unitCost) {
      const costSubtotal =
        Math.round(item.unitCost * item.quantity * 100) / 100;
      const profitAmount = Math.round((subtotal - costSubtotal) * 100) / 100;

      processedItem.costSubtotal = costSubtotal;
      processedItem.profitAmount = profitAmount;
    }

    return processedItem;
  });

  return processedItems;
}

/**
 * 创建销售订单
 */
export async function createSalesOrder(
  data: SalesOrderCreateFormData,
  userId: string
) {
  return await withTransaction(async tx => {
    // 生成订单号
    const orderNumber = data.orderNumber || generateOrderNumber();

    // 处理订单明细
    const processedItems = processOrderItems(data.items, data.orderType);
    const totalAmount = calculateOrderTotal(processedItems);

    // 计算调货销售的成本和毛利
    let costAmount = data.costAmount;
    let profitAmount = 0;

    if (data.orderType === 'TRANSFER') {
      const costs = calculateTransferCosts(processedItems);
      costAmount = costs.totalCost;
      profitAmount = costs.totalProfit;
    }

    // 创建销售订单
    const salesOrder = await tx.salesOrder.create({
      data: {
        orderNumber,
        customerId: data.customerId,
        userId,
        status: data.status || 'draft',
        orderType: data.orderType || 'NORMAL',
        supplierId: data.supplierId || null,
        costAmount,
        profitAmount,
        totalAmount,
        remarks: data.remarks || null,
        items: {
          create: processedItems.map(item => ({
            productId: item.productId || null,
            colorCode: item.colorCode || null,
            productionDate: item.productionDate || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
            unitCost: item.unitCost || null,
            costSubtotal: item.costSubtotal || null,
            profitAmount: item.profitAmount || null,
            isManualProduct: item.isManualProduct || false,
            manualProductName: item.manualProductName || null,
            manualSpecification: item.manualSpecification || null,
            manualWeight: item.manualWeight || null,
            manualUnit: item.manualUnit || null,
          })),
        },
      },
      include: {
        customer: true,
        user: true,
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return salesOrder;
  });
}
