/**
 * Prisma Mock 配置
 * 用于单元测试和集成测试
 */

// 创建 mock 对象
export const prismaMock = {
  // 厂家发货订单
  factoryShipmentOrder: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
  },

  // 销售订单
  salesOrder: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
  },

  // 销售订单明细
  salesOrderItem: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
  },

  // 费用
  expense: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
  },

  // 退款记录
  refundRecord: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
  },

  // 费用记录
  expenseRecord: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
    count: jest.fn(),
  },

  // 入库记录
  inboundRecord: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
  },

  // 出库记录
  outboundRecord: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
  },

  // Prisma 事务和连接方法
  $transaction: jest.fn((callback: unknown) => {
    if (typeof callback === 'function') {
      return callback(prismaMock);
    }
    return Promise.resolve(callback);
  }),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $executeRaw: jest.fn(),
  $queryRaw: jest.fn(),
};

// 导出类型
export type PrismaMock = typeof prismaMock;
