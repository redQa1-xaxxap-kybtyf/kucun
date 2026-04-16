jest.mock('@/lib/db', () => ({
  prisma: {},
}));

jest.mock('@/lib/env', () => ({
  env: {
    EXPENSE_TO_PAYABLE_ENABLED: false,
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/services/expense-payable-integration', () => ({
  createOrMergePayableFromExpense: jest.fn(),
}));

jest.mock('@/lib/services/system-mode-service', () => ({
  getSystemMode: jest.fn(),
}));

import {
  getExpenseStatistics,
  voidExpenseRecord,
} from '@/lib/services/expense-service';

type MockedPrisma = {
  expenseRecord: {
    findUnique: jest.Mock;
    aggregate: jest.Mock;
    groupBy: jest.Mock;
    findMany: jest.Mock;
  };
  purchaseOrder: {
    findUnique: jest.Mock;
  };
  $transaction: jest.Mock;
};

function createExpenseRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'expense-1',
    expenseNumber: 'EXP-20260416-001',
    expenseType: 'other',
    expenseName: '测试费用',
    expenseAmount: 120,
    expenseDate: new Date('2026-04-16T00:00:00.000Z'),
    relatedType: null,
    relatedId: null,
    relatedNumber: null,
    remarks: null,
    attachments: null,
    status: 'approved',
    userId: 'user-1',
    createdAt: new Date('2026-04-16T00:00:00.000Z'),
    updatedAt: new Date('2026-04-16T00:00:00.000Z'),
    approvedById: 'approver-1',
    approvedAt: new Date('2026-04-16T00:00:00.000Z'),
    cancelReason: null,
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
    user: {
      id: 'user-1',
      name: '测试用户',
      email: 'user@example.com',
    },
    approvedBy: {
      id: 'approver-1',
      name: '审核人',
      email: 'approver@example.com',
    },
    paymentStatus: 'unpaid',
    payableId: null,
    supplierId: null,
    ...overrides,
  };
}

describe('expense-service 边界回归', () => {
  const { prisma } = jest.requireMock('@/lib/db') as { prisma: MockedPrisma };
  const { getSystemMode } = jest.requireMock(
    '@/lib/services/system-mode-service'
  ) as { getSystemMode: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    Object.assign(prisma, {
      expenseRecord: {
        findUnique: jest.fn(),
        aggregate: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
      },
      purchaseOrder: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    });

    getSystemMode.mockResolvedValue('production');
  });

  test('voidExpenseRecord：费用已有付款状态时，应直接阻止作废且不进入事务', async () => {
    prisma.expenseRecord.findUnique.mockResolvedValue({
      id: 'expense-locked',
      status: 'approved',
      voidedAt: null,
      paymentStatus: 'partial',
    });

    await expect(
      voidExpenseRecord('expense-locked', 'user-1', '重复登记')
    ).rejects.toMatchObject({
      message: '这笔费用已经有关联付款，请先处理付款记录后再作废费用',
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('voidExpenseRecord：挂到已有有效付款的应付单时，应阻止作废', async () => {
    prisma.expenseRecord.findUnique.mockResolvedValue({
      id: 'expense-payable-1',
      status: 'approved',
      voidedAt: null,
      paymentStatus: 'unpaid',
    });

    const tx = {
      expenseRecord: {
        findUnique: jest.fn(async () =>
          createExpenseRecord({
            id: 'expense-payable-1',
            payableId: 'payable-1',
          })
        ),
        update: jest.fn(),
      },
      payableRecord: {
        findUnique: jest.fn(async () => ({
          id: 'payable-1',
          payableNumber: 'YFD-001',
          payableAmount: 120,
          paidAmount: 0,
          remainingAmount: 120,
          status: 'pending',
          voidedAt: null,
          paymentOutRecords: [
            {
              id: 'payment-out-1',
              status: 'confirmed',
              voidedAt: null,
            },
          ],
          expenseRecords: [{ id: 'expense-payable-1', status: 'approved', voidedAt: null }],
        })),
        update: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(async callback => callback(tx));

    await expect(
      voidExpenseRecord('expense-payable-1', 'user-1', '重复登记')
    ).rejects.toMatchObject({
      message: '这笔费用已挂到有付款记录的应付款，请先作废对应付款后再作废费用',
    });

    expect(tx.payableRecord.update).not.toHaveBeenCalled();
    expect(tx.expenseRecord.update).not.toHaveBeenCalled();
  });

  test('voidExpenseRecord：同一应付单还有其他有效费用时，应只回退金额并解绑当前费用', async () => {
    prisma.expenseRecord.findUnique.mockResolvedValue({
      id: 'expense-split-1',
      status: 'approved',
      voidedAt: null,
      paymentStatus: 'unpaid',
    });

    const tx = {
      expenseRecord: {
        findUnique: jest.fn(async () =>
          createExpenseRecord({
            id: 'expense-split-1',
            expenseAmount: 120,
            payableId: 'payable-2',
          })
        ),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
          createExpenseRecord({
            id: 'expense-split-1',
            status: data.status,
            cancelReason: data.cancelReason,
            voidedAt: data.voidedAt,
            voidedBy: data.voidedBy,
            voidReason: data.voidReason,
            paymentStatus: data.paymentStatus,
            payableId: data.payableId,
          })
        ),
      },
      payableRecord: {
        findUnique: jest.fn(async () => ({
          id: 'payable-2',
          payableNumber: 'YFD-002',
          payableAmount: 300,
          paidAmount: 0,
          remainingAmount: 300,
          status: 'pending',
          voidedAt: null,
          paymentOutRecords: [],
          expenseRecords: [
            { id: 'expense-split-1', status: 'approved', voidedAt: null },
            { id: 'expense-split-2', status: 'approved', voidedAt: null },
          ],
        })),
        update: jest.fn(async () => ({})),
      },
    };

    prisma.$transaction.mockImplementation(async callback => callback(tx));

    const result = await voidExpenseRecord(
      'expense-split-1',
      'user-1',
      '重复登记'
    );

    expect(tx.payableRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'payable-2' },
        data: expect.objectContaining({
          payableAmount: 180,
          remainingAmount: 180,
          status: 'pending',
          voidedAt: null,
          voidedBy: null,
          voidReason: null,
        }),
      })
    );

    expect(tx.expenseRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'expense-split-1' },
        data: expect.objectContaining({
          status: 'cancelled',
          cancelReason: '重复登记',
          voidReason: '重复登记',
          paymentStatus: 'unpaid',
          payableId: null,
        }),
      })
    );

    expect(result.status).toBe('cancelled');
    expect(result.payableId).toBeUndefined();
    expect(result.cancelReason).toBe('重复登记');
  });

  test('getExpenseStatistics：正式环境应强制只统计 approved 且 voidedAt=null 的费用', async () => {
    prisma.expenseRecord.aggregate.mockResolvedValue({
      _sum: { expenseAmount: 300 },
      _count: { id: 2 },
      _avg: { expenseAmount: 150 },
    });
    prisma.expenseRecord.groupBy.mockResolvedValue([
      {
        expenseType: 'shipping',
        _sum: { expenseAmount: 300 },
        _count: { id: 2 },
      },
    ]);

    const result = await getExpenseStatistics({
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      groupBy: 'type',
      relatedType: 'purchase_order',
    });

    const aggregateWhere =
      prisma.expenseRecord.aggregate.mock.calls[0][0].where;

    expect(aggregateWhere.status).toBe('approved');
    expect(aggregateWhere.voidedAt).toBeNull();
    expect(aggregateWhere.dataTag).toBe('prod');
    expect(aggregateWhere.relatedType).toBe('purchase_order');
    expect(aggregateWhere.expenseDate.gte).toBeInstanceOf(Date);
    expect(aggregateWhere.expenseDate.lte).toBeInstanceOf(Date);
    expect(aggregateWhere.expenseDate.gte.getFullYear()).toBe(2026);
    expect(aggregateWhere.expenseDate.gte.getMonth()).toBe(3);
    expect(aggregateWhere.expenseDate.gte.getDate()).toBe(1);
    expect(aggregateWhere.expenseDate.gte.getHours()).toBe(0);
    expect(aggregateWhere.expenseDate.lte.getHours()).toBe(23);
    expect(aggregateWhere.expenseDate.lte.getMinutes()).toBe(59);
    expect(aggregateWhere.expenseDate.lte.getSeconds()).toBe(59);
    expect(aggregateWhere.expenseDate.lte.getMilliseconds()).toBe(999);

    expect(prisma.expenseRecord.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'approved',
          voidedAt: null,
          dataTag: 'prod',
          relatedType: 'purchase_order',
        }),
      })
    );

    expect(result.totalAmount).toBe(300);
    expect(result.totalCount).toBe(2);
    expect(result.averageAmount).toBe(150);
    expect(result.byType).toEqual([
      expect.objectContaining({
        expenseType: 'shipping',
        totalAmount: 300,
        count: 2,
        percentage: 100,
      }),
    ]);
  });
});
