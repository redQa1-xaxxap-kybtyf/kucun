/**
 * 盈亏报表服务 - 单元测试
 * 
 * 测试目标：
 * 1. 期初入库不影响当期损益
 * 2. 销售期初库存的成本计算正确
 * 3. 本期采购仅影响库存维度，不直接计入当期损益成本
 * 4. 混合场景（期初入库 + 本期采购）下，利润按权责发生制计算
 */

import { getProfitLossAnalysis } from '@/lib/services/profit-loss-service';

// Mock Prisma Client
jest.mock('@/lib/db', () => ({
  prisma: {
    salesOrder: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    inboundRecord: {
      aggregate: jest.fn(),
    },
    outboundRecord: {
      aggregate: jest.fn(),
    },
    expenseRecord: {
      groupBy: jest.fn(),
    },
    refundRecord: {
      aggregate: jest.fn(),
    },
    factoryShipmentOrder: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

const { prisma } = jest.requireMock('@/lib/db') as {
  prisma: {
    salesOrder: { aggregate: jest.Mock; findMany: jest.Mock };
    inboundRecord: { aggregate: jest.Mock };
    outboundRecord: { aggregate: jest.Mock };
    expenseRecord: { groupBy: jest.Mock };
    refundRecord: { aggregate: jest.Mock };
    factoryShipmentOrder: { aggregate: jest.Mock; findMany: jest.Mock };
  };
};

describe('profit-loss-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // 默认返回空数据
    prisma.salesOrder.aggregate.mockResolvedValue({
      _sum: { totalAmount: 0, itemsAmount: 0, costAmount: 0 },
      _count: { id: 0 },
    });
    prisma.salesOrder.findMany.mockResolvedValue([]);
    
    prisma.inboundRecord.aggregate.mockResolvedValue({
      _sum: { totalCost: 0 },
    });
    
    prisma.outboundRecord.aggregate.mockResolvedValue({
      _sum: { totalCost: 0 },
    });
    
    prisma.expenseRecord.groupBy.mockResolvedValue([]);
    
    prisma.refundRecord.aggregate.mockResolvedValue({
      _sum: { processedAmount: 0 },
    });
    
    prisma.factoryShipmentOrder.aggregate.mockResolvedValue({
      _sum: { receivableAmount: 0 },
      _count: { id: 0 },
    });
    prisma.factoryShipmentOrder.findMany.mockResolvedValue([]);
  });

  describe('期初入库处理', () => {
    it('应该排除期初入库成本', async () => {
      // Arrange: 准备测试数据
      // 模拟期初入库 2,575 元
      prisma.inboundRecord.aggregate.mockImplementation((args: any) => {
        // 检查是否排除了 opening_balance
        if (args.where?.reason?.not === 'opening_balance') {
          // 正确排除期初入库，返回 0
          return Promise.resolve({ _sum: { totalCost: 0 } });
        }
        // 如果没有排除，返回期初入库成本（这是错误的情况）
        return Promise.resolve({ _sum: { totalCost: 2575 } });
      });

      // Act: 调用服务函数
      const result = await getProfitLossAnalysis(
        '2025-01-01',
        '2025-01-31',
        'day',
        false
      );

      // Assert: 验证结果
      expect(result.costs.totalCost).toBe(0); // 成本应该为 0
      expect(result.sample.sampleRevenue).toBe(0);
      expect(result.profit.netProfit).toBe(0); // 净利润应该为 0（没有收入和费用）
      
      // 验证 inboundRecord.aggregate 被调用时排除了 opening_balance
      expect(prisma.inboundRecord.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reason: { not: 'opening_balance' },
          }),
        })
      );
    });

    it('应该正确计算销售期初库存的成本', async () => {
      // Arrange: 准备测试数据
      // 1. 期初入库 2,575 元（应该被排除）
      prisma.inboundRecord.aggregate.mockImplementation((args: any) => {
        if (args.where?.reason?.not === 'opening_balance') {
          return Promise.resolve({ _sum: { totalCost: 0 } });
        }
        return Promise.resolve({ _sum: { totalCost: 2575 } });
      });

      // 2. 销售订单：收入 3,000 元，成本 2,575 元（来自期初库存）
      prisma.salesOrder.aggregate.mockResolvedValue({
        _sum: {
          totalAmount: 3000,
          itemsAmount: 3000,
          costAmount: 2575, // 销售成本通过 salesOrder.costAmount 计入
        },
        _count: { id: 1 },
      });
      prisma.salesOrder.findMany.mockImplementation((args?: { cursor?: { id: string } }) => {
        if (args?.cursor?.id) {
          return Promise.resolve([]);
        }

        return Promise.resolve([
          {
            id: 'sample-order-1',
            customerId: 'customer-1',
            totalAmount: 80,
            costAmount: 45,
            customer: { name: '样品客户A' },
            items: [{ quantity: 8 }],
          },
        ]);
      });

      // Act: 调用服务函数
      const result = await getProfitLossAnalysis(
        '2025-01-01',
        '2025-01-31',
        'day',
        false
      );

      // Assert: 验证结果
      expect(result.revenue.totalRevenue).toBe(3000); // 收入 3,000 元
      expect(result.sample.sampleRevenue).toBe(80);
      expect(result.sample.sampleQuantity).toBe(8);
      expect(result.costs.salesCost).toBe(2575); // 销售成本 2,575 元
      expect(result.costs.totalCost).toBe(2575); // 总成本 2,575 元
      expect(result.profit.grossProfit).toBe(425); // 毛利润 = 3000 - 2575 = 425
      expect(result.profit.netProfit).toBe(425); // 净利润 = 425（没有费用）
    });
  });

  describe('本期采购处理', () => {
    it('本期采购应体现在库存成本变化维度，但不会重复计入当期成本', async () => {
      // Arrange: 准备测试数据
      // 1. 本期采购入库 1,000 元（reason = 'purchase'）
      prisma.inboundRecord.aggregate.mockImplementation((args: any) => {
        if (args.where?.reason?.not === 'opening_balance') {
          // 排除期初入库后，只有本期采购
          return Promise.resolve({ _sum: { totalCost: 1000 } });
        }
        return Promise.resolve({ _sum: { totalCost: 1000 } });
      });

      // 2. 没有出库
      prisma.outboundRecord.aggregate.mockResolvedValue({
        _sum: { totalCost: 0 },
      });

      // 3. 销售订单：收入 1,500 元，成本 1,000 元
      prisma.salesOrder.aggregate.mockResolvedValue({
        _sum: {
          totalAmount: 1500,
          itemsAmount: 1500,
          costAmount: 1000,
        },
        _count: { id: 1 },
      });

      // Act: 调用服务函数
      const result = await getProfitLossAnalysis(
        '2025-01-01',
        '2025-01-31',
        'day',
        false
      );

      // Assert: 验证结果
      expect(result.revenue.totalRevenue).toBe(1500); // 收入 1,500 元
      expect(result.costs.salesCost).toBe(1000); // 销售成本 1,000 元
      expect(result.costs.inventoryCost).toBe(1000); // 库存成本变化 = 1000 - 0 = 1000（仅作资产变动展示）
      expect(result.costs.totalCost).toBe(1000); // 总成本 = 当期 COGS = 1000
      expect(result.profit.grossProfit).toBe(500); // 毛利润 = 1500 - 1000 = 500
    });

    it('本期采购 + 出库时，利润仍应按销售成本（COGS）计算', async () => {
      // Arrange: 准备测试数据
      // 1. 本期采购入库 1,000 元
      prisma.inboundRecord.aggregate.mockImplementation((args: any) => {
        if (args.where?.reason?.not === 'opening_balance') {
          return Promise.resolve({ _sum: { totalCost: 1000 } });
        }
        return Promise.resolve({ _sum: { totalCost: 1000 } });
      });

      // 2. 本期出库 500 元
      prisma.outboundRecord.aggregate.mockResolvedValue({
        _sum: { totalCost: 500 },
      });

      // 3. 销售订单：收入 1,500 元，成本 1,000 元
      prisma.salesOrder.aggregate.mockResolvedValue({
        _sum: {
          totalAmount: 1500,
          itemsAmount: 1500,
          costAmount: 1000,
        },
        _count: { id: 1 },
      });

      // Act: 调用服务函数
      const result = await getProfitLossAnalysis(
        '2025-01-01',
        '2025-01-31',
        'day',
        false
      );

      // Assert: 验证结果
      expect(result.costs.inventoryCost).toBe(500); // 库存成本变化 = 1000 - 500 = 500
      expect(result.costs.totalCost).toBe(1000); // 总成本仍等于 COGS = 1000
      expect(result.profit.grossProfit).toBe(500); // 毛利润 = 1500 - 1000 = 500
    });
  });

  describe('混合场景', () => {
    it('期初入库 + 本期采购时，应按权责发生制计算利润', async () => {
      // Arrange: 准备测试数据
      // 1. 期初入库 2,575 元 + 本期采购 1,000 元
      prisma.inboundRecord.aggregate.mockImplementation((args: any) => {
        if (args.where?.reason?.not === 'opening_balance') {
          // 排除期初入库后，只有本期采购 1,000 元
          return Promise.resolve({ _sum: { totalCost: 1000 } });
        }
        // 如果没有排除，返回总计 3,575 元（错误情况）
        return Promise.resolve({ _sum: { totalCost: 3575 } });
      });

      // 2. 本期出库 500 元
      prisma.outboundRecord.aggregate.mockResolvedValue({
        _sum: { totalCost: 500 },
      });

      // 3. 销售订单：
      //    - 销售期初库存商品：收入 3,000 元，成本 2,575 元
      //    - 销售本期采购商品：收入 1,500 元，成本 1,000 元
      prisma.salesOrder.aggregate.mockResolvedValue({
        _sum: {
          totalAmount: 4500, // 3000 + 1500
          itemsAmount: 4500,
          costAmount: 3575, // 2575 + 1000
        },
        _count: { id: 2 },
      });

      // Act: 调用服务函数
      const result = await getProfitLossAnalysis(
        '2025-01-01',
        '2025-01-31',
        'day',
        false
      );

      // Assert: 验证结果
      expect(result.revenue.totalRevenue).toBe(4500); // 收入 4,500 元
      expect(result.costs.salesCost).toBe(3575); // 销售成本 3,575 元
      expect(result.costs.inventoryCost).toBe(500); // 库存成本变化 = 1000 - 500 = 500
      expect(result.costs.totalCost).toBe(3575); // 总成本 = 当期销售成本 = 3575
      expect(result.profit.grossProfit).toBe(925); // 毛利润 = 4500 - 3575 = 925
      expect(result.profit.netProfit).toBe(925); // 净利润 = 925（没有费用）
      
      // 验证期初入库被正确排除
      expect(prisma.inboundRecord.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reason: { not: 'opening_balance' },
          }),
        })
      );
    });
  });
});
