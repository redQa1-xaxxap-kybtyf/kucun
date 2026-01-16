/**
 * Data Management 最小回归测试（不依赖真实数据库）
 *
 * 覆盖：
 * 1) preview 输出结构与 totals 计算
 * 2) trial reset 可跑通并完成
 * 3) production cleanup_test 冲销幂等（不重复写 reversal）
 * 4) execute API 无权限返回 403
 */

import type { NextRequest } from 'next/server';

jest.mock('@/lib/cache', () => ({
  revalidateFinance: jest.fn().mockResolvedValue(undefined),
  revalidateReturnOrders: jest.fn().mockResolvedValue(undefined),
  revalidateSalesOrders: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/cache/finance-cache', () => ({
  clearAllFinanceCache: jest.fn().mockResolvedValue(undefined),
  invalidateReportCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/cache/inventory-cache', () => ({
  clearAllInventoryCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/cache/product-cache', () => ({
  clearAllProductCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/services/system-mode-service', () => ({
  getSystemMode: jest.fn(),
}));

jest.mock('@/lib/services/system-write-lock', () => ({
  setSystemWriteLock: jest.fn().mockResolvedValue(undefined),
  clearSystemWriteLock: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/services/partner-ledger-service', () => ({
  recordPartnerTransaction: jest.fn(),
}));

jest.mock('@/lib/services/finance-statistics', () => ({
  getFinanceOverview: jest.fn().mockResolvedValue({
    totalReceivable: 0,
    totalRefundable: 0,
    monthlyReceived: 0,
    receivableCount: 0,
    refundCount: 0,
    summary: {
      totalOrders: 0,
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0,
      paymentRate: 0,
    },
  }),
}));

jest.mock('@/lib/services/profit-loss-service', () => ({
  getProfitLossAnalysis: jest.fn().mockResolvedValue({
    revenue: { totalRevenue: 0 },
    costs: { totalCost: 0 },
    expenses: { totalExpenses: 0 },
    profit: { netProfit: 0 },
  }),
}));

jest.mock('@/lib/services/monthly-report-service', () => ({
  getMonthlyReport: jest.fn().mockResolvedValue({
    revenue: { salesRevenue: 0 },
    costs: { totalCost: 0 },
    expenses: { totalExpenses: 0 },
    profit: { netProfit: 0 },
  }),
}));

jest.mock('@/lib/services/annual-report-service', () => ({
  getAnnualReport: jest.fn().mockResolvedValue({
    summary: {
      totalRevenue: 0,
      totalCost: 0,
      totalExpenses: 0,
      totalProfit: 0,
    },
  }),
}));

jest.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: jest.fn().mockResolvedValue([{ count: BigInt(0) }]),
    dataManagementTask: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    systemLog: {
      create: jest.fn(),
    },
    prepaymentUsage: {
      aggregate: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    shippingQuery: {
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    returnOrderItem: { count: jest.fn(), deleteMany: jest.fn() },
    factoryShipmentOrderFeeItem: { count: jest.fn(), deleteMany: jest.fn() },
    factoryShipmentOrderItem: { count: jest.fn(), deleteMany: jest.fn() },
    purchaseOrderItem: { count: jest.fn(), deleteMany: jest.fn() },
    salesOrderFeeItem: { count: jest.fn(), deleteMany: jest.fn() },
    salesOrderItem: { count: jest.fn(), deleteMany: jest.fn() },
    inventoryCostQueue: { count: jest.fn(), deleteMany: jest.fn() },
    inventoryCountItem: { count: jest.fn(), deleteMany: jest.fn() },
    inventoryCount: { count: jest.fn(), deleteMany: jest.fn() },
    outboundRecord: { count: jest.fn(), deleteMany: jest.fn() },
    inboundRecord: { count: jest.fn(), deleteMany: jest.fn() },
    inventoryAdjustment: { count: jest.fn(), deleteMany: jest.fn() },
    inventoryOperation: { count: jest.fn(), deleteMany: jest.fn() },
    inventory: { count: jest.fn(), deleteMany: jest.fn() },
    fifoConsumptionLedger: { count: jest.fn(), deleteMany: jest.fn() },
    batchSpecification: { count: jest.fn(), deleteMany: jest.fn() },
    temporaryProduct: { count: jest.fn(), deleteMany: jest.fn() },
    product: { count: jest.fn(), deleteMany: jest.fn() },
    category: { count: jest.fn(), deleteMany: jest.fn() },
    salesOrder: {
      aggregate: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    returnOrder: {
      aggregate: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    paymentRecord: {
      aggregate: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    refundRecord: {
      aggregate: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    purchaseOrder: {
      aggregate: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    factoryShipmentOrder: {
      aggregate: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    payableRecord: {
      aggregate: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    paymentOutRecord: {
      aggregate: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    expenseRecord: {
      aggregate: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    statementTransaction: {
      count: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    accountStatement: {
      count: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// next/server minimal mock (for execute route permission test)
jest.mock('next/server', () => {
  class MockNextRequest {
    readonly url: string;
    readonly method: string;
    readonly headers: Headers;
    readonly nextUrl: URL;
    private readonly body: unknown;

    constructor(
      url: string,
      init?: { method?: string; headers?: HeadersInit; body?: string }
    ) {
      this.url = url;
      this.method = init?.method ?? 'GET';
      this.headers = new Headers(init?.headers);
      this.nextUrl = new URL(url);
      this.body = init?.body ? JSON.parse(init.body) : undefined;
    }

    async json() {
      return this.body;
    }
  }

  class MockNextResponse {
    constructor(public readonly data: unknown, public readonly status: number) {}
    async json() {
      return this.data;
    }
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: {
      json(data: unknown, init?: { status?: number }) {
        return new MockNextResponse(data, init?.status ?? 200);
      },
    },
  };
});

jest.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => undefined,
  }),
}));

const { prisma } = jest.requireMock('@/lib/db') as {
  prisma: Record<string, any>;
};

const { getSystemMode } = jest.requireMock('@/lib/services/system-mode-service') as {
  getSystemMode: jest.Mock;
};

const { recordPartnerTransaction } = jest.requireMock(
  '@/lib/services/partner-ledger-service'
) as {
  recordPartnerTransaction: jest.Mock;
};

const { NextRequest: MockNextRequest } = jest.requireMock('next/server') as {
  NextRequest: new (
    url: string,
    init?: { method?: string; headers?: HeadersInit; body?: string }
  ) => NextRequest;
};

function setDefaultPrismaMocks() {
  for (const value of Object.values(prisma)) {
    if (!value || typeof value !== 'object') continue;
    if (typeof value.count === 'function') value.count.mockResolvedValue(0);
    if (typeof value.findMany === 'function') value.findMany.mockResolvedValue([]);
    if (typeof value.deleteMany === 'function')
      value.deleteMany.mockResolvedValue({ count: 0 });
    if (typeof value.updateMany === 'function')
      value.updateMany.mockResolvedValue({ count: 0 });
    if (typeof value.update === 'function') value.update.mockResolvedValue({});
    if (typeof value.aggregate === 'function')
      value.aggregate.mockResolvedValue({ _count: { id: 0 }, _sum: {} });
  }

  prisma.dataManagementTask.updateMany.mockResolvedValue({ count: 1 });
  prisma.dataManagementTask.update.mockResolvedValue({});
  prisma.dataManagementTask.findUnique.mockResolvedValue({
    id: 'task-001',
    action: 'reset_trial',
    status: 'queued',
    requestedBy: 'user-001',
    stage: 'S0',
    preview: null,
    result: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('data-management regression', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setDefaultPrismaMocks();
  });

  test('previewDataManagement(cleanup_test) 输出 items 与 totals', async () => {
    getSystemMode.mockResolvedValue('production');

    prisma.salesOrder.aggregate.mockResolvedValue({
      _count: { id: 2 },
      _sum: { totalAmount: 200 },
    });
    prisma.prepaymentUsage.aggregate.mockResolvedValue({
      _count: { id: 1 },
      _sum: { appliedAmount: 10 },
    });
    prisma.shippingQuery.count.mockResolvedValue(3);

    const { previewDataManagement } = await import(
      '@/lib/services/data-management/data-management-service'
    );
    const preview = await previewDataManagement('cleanup_test');

    expect(preview.action).toBe('cleanup_test');
    expect(preview.systemMode).toBe('production');
    expect(preview.items.some((i: any) => i.id === 'prepayment_usages')).toBe(true);
    expect(preview.items.some((i: any) => i.id === 'shipping_queries')).toBe(true);
    expect(preview.totals.count).toBeGreaterThan(0);
  });

  test('runDataManagementTask(reset_trial) 可跑通并完成', async () => {
    getSystemMode.mockResolvedValue('trial');

    const { runDataManagementTask } = await import(
      '@/lib/services/data-management/data-management-service'
    );

    await runDataManagementTask('task-001');

    expect(prisma.salesOrder.deleteMany).toHaveBeenCalled();
    expect(prisma.product.deleteMany).toHaveBeenCalled();
    expect(prisma.statementTransaction.deleteMany).toHaveBeenCalled();
    expect(
      prisma.dataManagementTask.update.mock.calls.some(
        (call: any[]) => call?.[0]?.data?.status === 'completed'
      )
    ).toBe(true);
  });

  test('runDataManagementTask(cleanup_test) 冲销幂等：已有 reversal 不重复写入', async () => {
    getSystemMode.mockResolvedValue('production');

    prisma.dataManagementTask.findUnique.mockResolvedValue({
      id: 'task-002',
      action: 'cleanup_test',
      status: 'queued',
      requestedBy: 'user-001',
      stage: 'S0',
      preview: null,
      result: null,
      errorMessage: null,
      startedAt: null,
      finishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 仅存在一条 test refund 相关流水
    prisma.refundRecord.findMany.mockResolvedValue([{ id: 'rf-001' }]);
    prisma.salesOrder.findMany.mockResolvedValue([]);
    prisma.returnOrder.findMany.mockResolvedValue([]);
    prisma.paymentRecord.findMany.mockResolvedValue([]);
    prisma.payableRecord.findMany.mockResolvedValue([]);
    prisma.paymentOutRecord.findMany.mockResolvedValue([]);

    let hasRefundReversal = true;

    prisma.statementTransaction.findMany.mockImplementation(async (args: any) => {
      const where = args?.where ?? {};
      const type = where?.transactionType;

      // 1) computeReversalMissingCountForReferenceIds: baseType/refund
      if (typeof type === 'string' && type === 'refund') {
        return [{ referenceId: 'rf-001' }];
      }
      // 2) computeReversalMissingCountForReferenceIds: reversalType/refund_reversal
      if (typeof type === 'string' && type === 'refund_reversal') {
        return hasRefundReversal ? [{ referenceId: 'rf-001' }] : [];
      }
      // 3) stage S3: 拉取需要冲销的 base 流水
      if (type?.in?.includes?.('refund')) {
        return [
          {
            id: 'st-001',
            transactionType: 'refund',
            referenceId: 'rf-001',
            referenceNumber: 'RF001',
            amount: 10,
            statement: {
              entityId: 'customer-001',
              entityName: '测试客户',
              partnerRole: 'customer',
              entityType: 'customer',
            },
          },
        ];
      }
      // 4) filterRowsMissingReversal: 查询是否已有 reversal
      if (type?.in?.includes?.('refund_reversal')) {
        return hasRefundReversal ? [{ referenceId: 'rf-001', transactionType: 'refund_reversal' }] : [];
      }

      return [];
    });

    recordPartnerTransaction.mockImplementation(() => {
      hasRefundReversal = true;
    });

    const { runDataManagementTask } = await import(
      '@/lib/services/data-management/data-management-service'
    );

    await runDataManagementTask('task-002');

    expect(recordPartnerTransaction).toHaveBeenCalledTimes(0);
  });

  test('POST /api/data-management/execute 无权限返回 403', async () => {
    const { POST } = await import('@/app/api/data-management/execute/route');

    const request = new MockNextRequest(
      'http://localhost/api/data-management/execute',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'u-001',
          'x-user-username': 'sales-user',
          'x-user-role': 'sales',
        },
        body: JSON.stringify({ action: 'cleanup_test', confirmText: '清理' }),
      }
    );

    const response = await POST(request as any);
    expect((response as any).status).toBe(403);
  });
});
