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

    const orders = await prisma.salesOrder.findMany({
      where: whereClause,
      include: {
        customer: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
      },
    });

    const totalOrders = orders.length;
    const totalAmount = orders.reduce(
      (sum, order) => sum + order.totalAmount,
      0
    );
    const totalProfit = orders.reduce(
      (sum, order) => sum + (order.profitAmount || 0),
      0
    );
    const averageOrderValue = totalOrders > 0 ? totalAmount / totalOrders : 0;
    const profitMargin =
      totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0;

    // 按状态统计订单
    const ordersByStatus: Record<string, number> = {};
    orders.forEach(order => {
      ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
    });

    // 统计客户排名
    const customerStats = new Map<
      string,
      { name: string; count: number; amount: number }
    >();
    orders.forEach(order => {
      const existing = customerStats.get(order.customerId) || {
        name: order.customer.name,
        count: 0,
        amount: 0,
      };
      existing.count += 1;
      existing.amount += order.totalAmount;
      customerStats.set(order.customerId, existing);
    });

    const topCustomers = Array.from(customerStats.entries())
      .map(([id, stats]) => ({
        customerId: id,
        customerName: stats.name,
        orderCount: stats.count,
        totalAmount: stats.amount,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);

    // 统计产品排名
    const productStats = new Map<
      string,
      { name: string; quantity: number; revenue: number }
    >();
    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.product) {
          const existing = productStats.get(item.product.id) || {
            name: item.product.name,
            quantity: 0,
            revenue: 0,
          };
          existing.quantity += item.quantity;
          existing.revenue += item.subtotal;
          productStats.set(item.product.id, existing);
        }
      });
    });

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
    // 获取当前库存
    const inventory = await prisma.inventory.findMany({
      include: {
        product: { select: { id: true, name: true } },
      },
    });

    const totalProducts = inventory.length;
    const totalValue = inventory.reduce(
      (sum, item) => sum + item.quantity * (item.unitCost || 0),
      0
    );

    // 获取安全库存配置
    const safetyStocks = await prisma.inventorySafetyStock.findMany();
    const safetyStockMap = new Map(
      safetyStocks.map(s => [`${s.productId}-${s.variantId || ''}`, s])
    );

    // 识别低库存商品
    const lowStockItems = inventory
      .filter(item => {
        const key = `${item.productId}-${item.variantId || ''}`;
        const safetyStock = safetyStockMap.get(key);
        return safetyStock && item.quantity <= safetyStock.safetyStock;
      })
      .map(item => {
        const key = `${item.productId}-${item.variantId || ''}`;
        const safetyStock = safetyStockMap.get(key)!;
        return {
          productId: item.productId,
          productName: item.product.name,
          currentStock: item.quantity,
          safetyStock: safetyStock.safetyStock,
          stockValue: item.quantity * (item.unitCost || 0),
        };
      });

    // 计算库存周转率（简化版本）
    const inventoryTurnover = inventory.map(item => ({
      productId: item.productId,
      productName: item.product.name,
      turnoverRate: 0, // 需要历史数据计算
      daysInStock: 0, // 需要历史数据计算
    }));

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

    const orders = await prisma.salesOrder.findMany({
      where: whereClause,
      include: {
        customer: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
        feeItems: true,
      },
    });

    const totalRevenue = orders.reduce(
      (sum, order) => sum + order.totalAmount,
      0
    );
    const totalCost = orders.reduce(
      (sum, order) => sum + (order.costAmount || 0),
      0
    );
    const totalExpenses = orders.reduce(
      (sum, order) => sum + (order.expenseAmount || 0),
      0
    );
    const grossProfit = totalRevenue - totalCost;
    const netProfit = grossProfit - totalExpenses;
    const grossMargin =
      totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // 按产品统计利润
    const productProfitMap = new Map<
      string,
      { name: string; revenue: number; cost: number; profit: number }
    >();
    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.product) {
          const existing = productProfitMap.get(item.product.id) || {
            name: item.product.name,
            revenue: 0,
            cost: 0,
            profit: 0,
          };
          existing.revenue += item.subtotal;
          existing.cost += (item.unitCost || 0) * item.quantity;
          existing.profit = existing.revenue - existing.cost;
          productProfitMap.set(item.product.id, existing);
        }
      });
    });

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

    // 按客户统计利润
    const customerProfitMap = new Map<
      string,
      { name: string; revenue: number; profit: number }
    >();
    orders.forEach(order => {
      const existing = customerProfitMap.get(order.customerId) || {
        name: order.customer.name,
        revenue: 0,
        profit: 0,
      };
      existing.revenue += order.totalAmount;
      existing.profit += order.profitAmount || 0;
      customerProfitMap.set(order.customerId, existing);
    });

    const profitByCustomer = Array.from(customerProfitMap.entries()).map(
      ([id, stats]) => ({
        customerId: id,
        customerName: stats.name,
        revenue: stats.revenue,
        profit: stats.profit,
        margin: stats.revenue > 0 ? (stats.profit / stats.revenue) * 100 : 0,
      })
    );

    // 费用分类统计
    const expenseBreakdown: Record<string, number> = {};
    orders.forEach(order => {
      order.feeItems.forEach(fee => {
        expenseBreakdown[fee.feeType] =
          (expenseBreakdown[fee.feeType] || 0) + fee.feeAmount;
      });
    });

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

    const orders = await prisma.salesOrder.findMany({
      where: whereClause,
      include: {
        feeItems: true,
      },
    });

    const approvals = await prisma.expenseApproval.findMany({
      where: {
        salesOrder: whereClause,
      },
      include: {
        salesOrder: { select: { orderNumber: true } },
        expenseType: { select: { typeName: true, category: true } },
        approver: { select: { name: true } },
      },
    });

    const totalExpenses = orders.reduce(
      (sum, order) =>
        sum + order.feeItems.reduce((feeSum, fee) => feeSum + fee.feeAmount, 0),
      0
    );

    const expensesByType: Record<string, number> = {};
    const expensesByCategory: Record<string, number> = {};

    orders.forEach(order => {
      order.feeItems.forEach(fee => {
        expensesByType[fee.feeType] =
          (expensesByType[fee.feeType] || 0) + fee.feeAmount;
      });
    });

    approvals.forEach(approval => {
      if (approval.expenseType) {
        const category = approval.expenseType.category;
        const amount = approval.approvedAmount || approval.requestedAmount;
        expensesByCategory[category] =
          (expensesByCategory[category] || 0) + amount;
      }
    });

    const pendingApprovals = approvals.filter(
      a => a.approvalStatus === 'PENDING'
    ).length;
    const approvedExpenses = approvals.filter(
      a => a.approvalStatus === 'APPROVED'
    ).length;
    const rejectedExpenses = approvals.filter(
      a => a.approvalStatus === 'REJECTED'
    ).length;

    const expenseDetails = approvals.map(approval => ({
      orderId: approval.salesOrderId,
      orderNumber: approval.salesOrder.orderNumber,
      expenseType: approval.expenseType?.typeName || '未知',
      amount: approval.approvedAmount || approval.requestedAmount,
      status: approval.approvalStatus,
      approvedBy: approval.approver?.name,
      approvedAt: approval.approvedAt ?? undefined,
    }));

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
    const ordersWithInconsistentAmounts = await prisma.salesOrder.findMany({
      where: {
        OR: [
          { totalAmount: { lt: 0 } },
          { itemsAmount: { lt: 0 } },
          { additionalFees: { lt: 0 } },
        ],
      },
    });

    if (ordersWithInconsistentAmounts.length > 0) {
      errors.push(
        `发现 ${ordersWithInconsistentAmounts.length} 个订单金额异常`
      );
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
    const ordersWithProfitIssues = await prisma.salesOrder.findMany({
      where: {
        profitAmount: { not: null },
        OR: [{ costAmount: null }, { expenseAmount: null }],
      },
    });

    if (ordersWithProfitIssues.length > 0) {
      warnings.push(
        `发现 ${ordersWithProfitIssues.length} 个订单利润计算可能不完整`
      );
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
