// @ts-nocheck

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ReportFilter {
  startDate?: Date;
  endDate?: Date;
  customerId?: string;
  userId?: string;
  status?: string[];
  productId?: string;
}

export interface OrderSummaryReport {
  totalOrders: number;
  totalAmount: number;
  totalProfit: number;
  averageOrderValue: number;
  profitMargin: number;
  ordersByStatus: Record<string, number>;
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    orderCount: number;
    totalAmount: number;
  }>;
  topProducts: Array<{
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
  }>;
}

export interface InventoryReport {
  totalProducts: number;
  totalValue: number;
  lowStockItems: Array<{
    productId: string;
    productName: string;
    currentStock: number;
    safetyStock: number;
    stockValue: number;
  }>;
  inventoryTurnover: Array<{
    productId: string;
    productName: string;
    turnoverRate: number;
    daysInStock: number;
  }>;
  stockMovements: Array<{
    date: string;
    inbound: number;
    outbound: number;
    adjustment: number;
    balance: number;
  }>;
}

export interface ProfitAnalysisReport {
  totalRevenue: number;
  totalCost: number;
  totalExpenses: number;
  grossProfit: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
  profitByProduct: Array<{
    productId: string;
    productName: string;
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
  }>;
  profitByCustomer: Array<{
    customerId: string;
    customerName: string;
    revenue: number;
    profit: number;
    margin: number;
  }>;
  expenseBreakdown: Record<string, number>;
}

export interface ExpenseReport {
  totalExpenses: number;
  expensesByType: Record<string, number>;
  expensesByCategory: Record<string, number>;
  pendingApprovals: number;
  approvedExpenses: number;
  rejectedExpenses: number;
  expenseDetails: Array<{
    orderId: string;
    orderNumber: string;
    expenseType: string;
    amount: number;
    status: string;
    approvedBy?: string;
    approvedAt?: Date;
  }>;
}

export class ReportGenerationService {
  /**
   * 生成销售订单汇总报表
   */
  public async generateOrderSummaryReport(
    filter: ReportFilter
  ): Promise<OrderSummaryReport> {
    const whereClause = this.buildWhereClause(filter);

    const pageSize = 2000;
    let cursor: string | undefined;

    let totalOrders = 0;
    let totalAmount = 0;
    let totalProfit = 0;

    // 按状态统计订单
    const ordersByStatus: Record<string, number> = {};

    // 统计客户排名
    const customerStats = new Map<
      string,
      { name: string; count: number; amount: number }
    >();

    // 统计产品排名
    const productStats = new Map<
      string,
      { name: string; quantity: number; revenue: number }
    >();

    while (true) {
      const page = await prisma.salesOrder.findMany({
        where: whereClause,
        select: {
          id: true,
          status: true,
          customerId: true,
          totalAmount: true,
          profitAmount: true,
          customer: { select: { name: true } },
          items: {
            select: {
              quantity: true,
              subtotal: true,
              product: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { id: 'asc' },
        take: pageSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      totalOrders += page.length;

      for (const order of page) {
        totalAmount += order.totalAmount;
        totalProfit += order.profitAmount || 0;

        ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;

        const existingCustomer = customerStats.get(order.customerId) || {
          name: order.customer.name,
          count: 0,
          amount: 0,
        };
        existingCustomer.count += 1;
        existingCustomer.amount += order.totalAmount;
        customerStats.set(order.customerId, existingCustomer);

        for (const item of order.items) {
          if (!item.product) {
            continue;
          }

          const existingProduct = productStats.get(item.product.id) || {
            name: item.product.name,
            quantity: 0,
            revenue: 0,
          };
          existingProduct.quantity += item.quantity;
          existingProduct.revenue += item.subtotal;
          productStats.set(item.product.id, existingProduct);
        }
      }

      if (page.length < pageSize) {
        break;
      }

      cursor = page[page.length - 1]?.id;
      if (!cursor) {
        break;
      }
    }

    const averageOrderValue = totalOrders > 0 ? totalAmount / totalOrders : 0;
    const profitMargin =
      totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0;

    const topCustomers = Array.from(customerStats.entries())
      .map(([id, stats]) => ({
        customerId: id,
        customerName: stats.name,
        orderCount: stats.count,
        totalAmount: stats.amount,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);

    const topProducts = Array.from(productStats.entries())
      .map(([id, stats]) => ({
        productId: id,
        productName: stats.name,
        quantity: stats.quantity,
        revenue: stats.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      totalOrders,
      totalAmount,
      totalProfit,
      averageOrderValue,
      profitMargin,
      ordersByStatus,
      topCustomers,
      topProducts,
    };
  }

  /**
   * 生成库存变动报表
   */
  public async generateInventoryReport(
    _filter: ReportFilter
  ): Promise<InventoryReport> {
    const pageSize = 2000;

    // 获取安全库存配置
    const safetyStocks: any[] = [];
    for (let skip = 0; ; skip += pageSize) {
      const page = await prisma.inventorySafetyStock.findMany({
        select: { productId: true, variantId: true, safetyStock: true },
        skip,
        take: pageSize,
      });
      safetyStocks.push(...page);
      if (page.length < pageSize) {
        break;
      }
    }
    const safetyStockMap = new Map(
      safetyStocks.map(s => [`${s.productId}-${s.variantId || ''}`, s])
    );

    // 获取当前库存
    let cursor: string | undefined;
    let totalProducts = 0;
    let totalValue = 0;
    const lowStockItems: any[] = [];
    const inventoryTurnover: any[] = [];

    while (true) {
      const inventory = await prisma.inventory.findMany({
        select: {
          id: true,
          productId: true,
          variantId: true,
          quantity: true,
          unitCost: true,
          product: { select: { name: true } },
        },
        orderBy: { id: 'asc' },
        take: pageSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      totalProducts += inventory.length;

      for (const item of inventory) {
        totalValue += item.quantity * (item.unitCost || 0);

        const key = `${item.productId}-${item.variantId || ''}`;
        const safetyStock = safetyStockMap.get(key);
        if (safetyStock && item.quantity <= safetyStock.safetyStock) {
          const safetyStockValue = safetyStock?.safetyStock || 0;
          lowStockItems.push({
            productId: item.productId,
            productName: item.product.name,
            currentStock: item.quantity,
            safetyStock: safetyStockValue,
            stockValue: item.quantity * (item.unitCost || 0),
          });
        }

        inventoryTurnover.push({
          productId: item.productId,
          productName: item.product.name,
          turnoverRate: 0, // 需要历史数据计算
          daysInStock: 0, // 需要历史数据计算
        });
      }

      if (inventory.length < pageSize) {
        break;
      }

      cursor = inventory[inventory.length - 1]?.id;
      if (!cursor) {
        break;
      }
    }

    // 获取库存变动记录（简化版本）
    const stockMovements = [
      {
        date: new Date().toISOString().split('T')[0],
        inbound: 0,
        outbound: 0,
        adjustment: 0,
        balance: totalValue,
      },
    ];

    return {
      totalProducts,
      totalValue,
      lowStockItems,
      inventoryTurnover,
      stockMovements,
    };
  }

  /**
   * 生成利润分析报表
   */
  public async generateProfitAnalysisReport(
    filter: ReportFilter
  ): Promise<ProfitAnalysisReport> {
    const whereClause = this.buildWhereClause(filter);

    const pageSize = 2000;
    let cursor: string | undefined;

    let totalRevenue = 0;
    let totalCost = 0;
    let totalExpenses = 0;

    // 按产品统计利润
    const productProfitMap = new Map<
      string,
      { name: string; revenue: number; cost: number; profit: number }
    >();

    // 按客户统计利润
    const customerProfitMap = new Map<
      string,
      { name: string; revenue: number; profit: number }
    >();

    // 费用分类统计
    const expenseBreakdown: Record<string, number> = {};

    while (true) {
      const page = await prisma.salesOrder.findMany({
        where: whereClause,
        select: {
          id: true,
          customerId: true,
          totalAmount: true,
          costAmount: true,
          expenseAmount: true,
          profitAmount: true,
          customer: { select: { name: true } },
          items: {
            select: {
              quantity: true,
              subtotal: true,
              unitCost: true,
              product: { select: { id: true, name: true } },
            },
          },
          feeItems: { select: { feeType: true, feeAmount: true } },
        },
        orderBy: { id: 'asc' },
        take: pageSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      for (const order of page) {
        totalRevenue += order.totalAmount;
        totalCost += order.costAmount || 0;
        totalExpenses += order.expenseAmount || 0;

        const existingCustomer = customerProfitMap.get(order.customerId) || {
          name: order.customer.name,
          revenue: 0,
          profit: 0,
        };
        existingCustomer.revenue += order.totalAmount;
        existingCustomer.profit += order.profitAmount || 0;
        customerProfitMap.set(order.customerId, existingCustomer);

        for (const item of order.items) {
          if (!item.product) {
            continue;
          }

          const existingProduct = productProfitMap.get(item.product.id) || {
            name: item.product.name,
            revenue: 0,
            cost: 0,
            profit: 0,
          };
          existingProduct.revenue += item.subtotal;
          existingProduct.cost += (item.unitCost || 0) * item.quantity;
          existingProduct.profit =
            existingProduct.revenue - existingProduct.cost;
          productProfitMap.set(item.product.id, existingProduct);
        }

        for (const fee of order.feeItems) {
          expenseBreakdown[fee.feeType] =
            (expenseBreakdown[fee.feeType] || 0) + fee.feeAmount;
        }
      }

      if (page.length < pageSize) {
        break;
      }

      cursor = page[page.length - 1]?.id;
      if (!cursor) {
        break;
      }
    }

    const grossProfit = totalRevenue - totalCost;
    const netProfit = grossProfit - totalExpenses;
    const grossMargin =
      totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const profitByProduct = Array.from(productProfitMap.entries()).map(
      ([id, stats]) => ({
        productId: id,
        productName: stats.name,
        revenue: stats.revenue,
        cost: stats.cost,
        profit: stats.profit,
        margin: stats.revenue > 0 ? (stats.profit / stats.revenue) * 100 : 0,
      })
    );

    const profitByCustomer = Array.from(customerProfitMap.entries()).map(
      ([id, stats]) => ({
        customerId: id,
        customerName: stats.name,
        revenue: stats.revenue,
        profit: stats.profit,
        margin: stats.revenue > 0 ? (stats.profit / stats.revenue) * 100 : 0,
      })
    );

    return {
      totalRevenue,
      totalCost,
      totalExpenses,
      grossProfit,
      netProfit,
      grossMargin,
      netMargin,
      profitByProduct,
      profitByCustomer,
      expenseBreakdown,
    };
  }

  /**
   * 生成费用明细报表
   */
  public async generateExpenseReport(
    filter: ReportFilter
  ): Promise<ExpenseReport> {
    const whereClause = this.buildWhereClause(filter);

    const pageSize = 2000;

    let orderCursor: string | undefined;
    let totalExpenses = 0;
    const expensesByType: Record<string, number> = {};

    while (true) {
      const orderPage = await prisma.salesOrder.findMany({
        where: whereClause,
        select: {
          id: true,
          feeItems: { select: { feeType: true, feeAmount: true } },
        },
        orderBy: { id: 'asc' },
        take: pageSize,
        ...(orderCursor ? { cursor: { id: orderCursor }, skip: 1 } : {}),
      });

      for (const order of orderPage) {
        for (const fee of order.feeItems) {
          totalExpenses += fee.feeAmount;
          expensesByType[fee.feeType] =
            (expensesByType[fee.feeType] || 0) + fee.feeAmount;
        }
      }

      if (orderPage.length < pageSize) {
        break;
      }

      orderCursor = orderPage[orderPage.length - 1]?.id;
      if (!orderCursor) {
        break;
      }
    }

    const approvals: any[] = [];
    let approvalCursor: string | undefined;

    while (true) {
      const approvalPage = await prisma.expenseApproval.findMany({
        where: {
          salesOrder: whereClause,
        },
        select: {
          id: true,
          salesOrderId: true,
          approvalStatus: true,
          requestedAmount: true,
          approvedAmount: true,
          approvedAt: true,
          salesOrder: { select: { orderNumber: true } },
          expenseType: { select: { typeName: true, category: true } },
          approver: { select: { name: true } },
        },
        orderBy: { id: 'asc' },
        take: pageSize,
        ...(approvalCursor ? { cursor: { id: approvalCursor }, skip: 1 } : {}),
      });

      approvals.push(...approvalPage);

      if (approvalPage.length < pageSize) {
        break;
      }

      approvalCursor = approvalPage[approvalPage.length - 1]?.id;
      if (!approvalCursor) {
        break;
      }
    }

    const expensesByCategory: Record<string, number> = {};
    let pendingApprovals = 0;
    let approvedExpenses = 0;
    let rejectedExpenses = 0;

    const expenseDetails = approvals.map(approval => {
      if (approval.expenseType) {
        const category = approval.expenseType.category;
        const amount = approval.approvedAmount || approval.requestedAmount;
        expensesByCategory[category] =
          (expensesByCategory[category] || 0) + amount;
      }

      if (approval.approvalStatus === 'PENDING') pendingApprovals += 1;
      if (approval.approvalStatus === 'APPROVED') approvedExpenses += 1;
      if (approval.approvalStatus === 'REJECTED') rejectedExpenses += 1;

      return {
        orderId: approval.salesOrderId,
        orderNumber: approval.salesOrder.orderNumber,
        expenseType: approval.expenseType?.typeName || '未知',
        amount: approval.approvedAmount || approval.requestedAmount,
        status: approval.approvalStatus,
        approvedBy: approval.approver?.name,
        approvedAt: approval.approvedAt ?? undefined,
      };
    });

    return {
      totalExpenses,
      expensesByType,
      expensesByCategory,
      pendingApprovals,
      approvedExpenses,
      rejectedExpenses,
      expenseDetails,
    };
  }

  /**
   * 数据完整性检查
   */
  public async validateDataIntegrity(): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查订单金额一致性
    const inconsistentAmountCount = await prisma.salesOrder.count({
      where: {
        OR: [
          { totalAmount: { lt: 0 } },
          { itemsAmount: { lt: 0 } },
          { additionalFees: { lt: 0 } },
        ],
      },
    });

    if (inconsistentAmountCount > 0) {
      errors.push(`发现 ${inconsistentAmountCount} 个订单金额异常`);
    }

    // 检查库存预留一致性
    const inconsistentReservations = await prisma.$queryRaw`
      SELECT ir.id, ir.reservation_number
      FROM inventory_reservations ir
      JOIN inventory i ON ir.product_id = i.product_id
        AND (ir.variant_id = i.variant_id OR (ir.variant_id IS NULL AND i.variant_id IS NULL))
        AND (ir.batch_number = i.batch_number OR (ir.batch_number IS NULL AND i.batch_number IS NULL))
      WHERE ir.reservation_status = 'ACTIVE'
        AND ir.reserved_quantity > i.quantity
    `;

    if (
      Array.isArray(inconsistentReservations) &&
      inconsistentReservations.length > 0
    ) {
      errors.push(`发现 ${inconsistentReservations.length} 个库存预留异常`);
    }

    // 检查利润计算一致性
    const profitIssueCount = await prisma.salesOrder.count({
      where: {
        profitAmount: { not: null },
        OR: [{ costAmount: null }, { expenseAmount: null }],
      },
    });

    if (profitIssueCount > 0) {
      warnings.push(`发现 ${profitIssueCount} 个订单利润计算可能不完整`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 构建查询条件
   */
  private buildWhereClause(filter: ReportFilter) {
    const where: any = {};

    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) where.createdAt.gte = filter.startDate;
      if (filter.endDate) where.createdAt.lte = filter.endDate;
    }

    if (filter.customerId) where.customerId = filter.customerId;
    if (filter.userId) where.userId = filter.userId;
    if (filter.status && filter.status.length > 0)
      where.status = { in: filter.status };

    return where;
  }
}
