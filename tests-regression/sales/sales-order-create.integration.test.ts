import { createSalesOrder } from '@/lib/api/handlers/sales-orders/create';

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/env', () => {
  const actual = jest.requireActual('@/lib/env');
  return {
    ...actual,
    env: {
      ...(actual as any).env,
      EXPENSE_AUTO_CREATE: false,
    },
  };
});

jest.mock('@/lib/db/transaction-options', () => ({
  getLongTransactionOptions: jest.fn(() => ({})),
}));

jest.mock('@/lib/cache/invalidation-strategy', () => ({
  executeInvalidation: jest.fn().mockResolvedValue(undefined),
  ORDER_STATUS_CHANGE_INVALIDATION: { key: 'ORDER_STATUS_CHANGE_INVALIDATION' },
}));

jest.mock('@/lib/services/partner-ledger-service', () => ({
  recordPartnerTransaction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/services/simple-order-number-generator', () => ({
  generateSalesOrderNumber: jest.fn(),
}));

jest.mock('@/lib/utils/payment-number-generator', () => ({
  generatePaymentNumber: jest.fn().mockResolvedValue('PAY-0001'),
}));

jest.mock('@/lib/services/expense-service', () => ({
  ensureCompanyExpenses: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/api/handlers/sales-orders/price-history', () => ({
  recordCustomerPriceHistory: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/api/handlers/sales-orders/payable', () => ({
  maybeCreatePayable: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/api/handlers/sales-orders/purchase-order', () => ({
  createPurchaseOrderForTransfer: jest.fn(),
}));

jest.mock('@/lib/api/handlers/sales-orders/prepayment', () => ({
  applyPrepaymentToOrder: jest.fn().mockResolvedValue({ totalApplied: 0 }),
}));

jest.mock('@/lib/api/handlers/sales-orders/validation', () => ({
  ensureCustomerExists: jest.fn().mockResolvedValue(undefined),
  ensureSupplierExists: jest.fn().mockResolvedValue(undefined),
  ensureProductsExist: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/db', () => ({
  prisma: {
    $transaction: jest.fn(),
    product: {
      findMany: jest.fn(),
    },
  },
}));

const { prisma } = jest.requireMock('@/lib/db') as {
  prisma: {
    $transaction: jest.Mock;
    product: { findMany: jest.Mock };
  };
};

function createRetryableTransactionConflictError() {
  return {
    code: 'P2034',
    message:
      'Transaction failed due to a write conflict or a deadlock. Please retry your transaction',
  };
}

function createSalesOrderTx(params: {
  userId: string;
  customerId: string;
  productId: string;
  variantId: string;
  inventories: Array<{
    id: string;
    productId: string;
    variantId: string | null;
    batchNumber: string | null;
    quantity: number;
    reservedQuantity: number;
    updatedAt: Date;
  }>;
  inventoryUpdateCount?: number;
  orderId?: string;
}) {
  const orderId = params.orderId ?? 'order-1';

  const tx = {
    inventory: {
      findMany: jest.fn(async () => params.inventories),
      updateMany: jest.fn(async () => ({
        count:
          typeof params.inventoryUpdateCount === 'number'
            ? params.inventoryUpdateCount
            : 1,
      })),
    },
    productVariant: {
      findFirst: jest.fn(async () => ({ id: params.variantId })),
    },
    salesOrderItem: {
      update: jest.fn(async (args: any) => ({
        id: args.where.id,
        ...args.data,
      })),
    },
    paymentRecord: {
      create: jest.fn(async (args: any) => ({ id: 'pay-1', ...args.data })),
    },
    salesOrder: {
      create: jest.fn(async (args: any) => {
        const createdAt = new Date('2026-01-01T00:00:00.000Z');
        const updatedAt = new Date('2026-01-01T00:00:00.000Z');

        const itemsCreate = (args.data?.items?.create ?? []) as any[];
        const items = itemsCreate.map((item, index) => ({
          ...item,
          id: `item-${index + 1}`,
          salesOrderId: orderId,
        }));

        const feeItemsCreate = (args.data?.feeItems?.create ?? []) as any[];
        const feeItems = feeItemsCreate.map((fee, index) => ({
          id: `fee-${index + 1}`,
          ...fee,
        }));

        return {
          id: orderId,
          orderNumber: args.data.orderNumber,
          customerId: args.data.customerId,
          userId: args.data.userId,
          supplierId: args.data.supplierId ?? null,
          status: args.data.status,
          orderType: args.data.orderType,
          transferMode: args.data.transferMode,
          itemsAmount: args.data.itemsAmount,
          additionalFees: args.data.additionalFees,
          expenseAmount: args.data.expenseAmount,
          roundingAdjustment: args.data.roundingAdjustment,
          costAmount: args.data.costAmount,
          profitAmount: args.data.profitAmount,
          totalAmount: args.data.totalAmount,
          paidAmount: 0,
          remarks: args.data.remarks ?? null,
          shippedAt: null,
          createdAt,
          updatedAt,
          customer: {
            id: args.data.customerId,
            name: 'Customer A',
            address: 'addr',
            phone: '13000000000',
          },
          user: {
            id: args.data.userId,
            name: 'User A',
          },
          items,
          feeItems,
          _count: { items: items.length },
        };
      }),
    },
  };

  return tx;
}

describe('sales-order create integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('confirmed 普通销售开单：应预留库存、回填明细批次/变体，并创建应收记录', async () => {
    const userId = '33333333-3333-4333-8333-333333333333';
    const customerId = '22222222-2222-4222-8222-222222222222';
    const productId = '11111111-1111-4111-8111-111111111111';
    const variantId = '44444444-4444-4444-8444-444444444444';

    const tx = createSalesOrderTx({
      userId,
      customerId,
      productId,
      variantId,
      inventories: [
        {
          id: 'inv-1',
          productId,
          variantId,
          batchNumber: 'B1',
          quantity: 100,
          reservedQuantity: 0,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    const { generateSalesOrderNumber } = jest.requireMock(
      '@/lib/services/simple-order-number-generator'
    ) as {
      generateSalesOrderNumber: jest.Mock;
    };
    generateSalesOrderNumber.mockResolvedValue('SO-0001');

    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
    prisma.product.findMany.mockResolvedValue([
      {
        id: productId,
        name: 'P1',
        code: 'P1',
        unit: '片',
        specification: 'spec',
        piecesPerUnit: 1,
        weight: null,
      },
    ]);

    const result = await createSalesOrder(
      {
        customerId,
        status: 'confirmed',
        orderType: 'NORMAL',
        items: [
          {
            productId,
            colorCode: 'C01',
            quantity: 10,
            unitPrice: 5,
            subtotal: 50,
          },
        ],
        usePrepayment: false,
      },
      userId
    );

    expect(result.orderNumber).toBe('SO-0001');
    expect(result.status).toBe('confirmed');
    expect(result.totalAmount).toBe(50);
    expect(result.items).toHaveLength(1);
    expect(result.items?.[0]?.variantId).toBe(variantId);
    expect(result.items?.[0]?.batchNumber).toBe('B1');
    expect(result.items?.[0]?.product?.id).toBe(productId);

    expect(tx.inventory.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.salesOrderItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { variantId, batchNumber: 'B1' },
    });

    expect(tx.paymentRecord.create).toHaveBeenCalledTimes(1);
    expect(
      (tx.paymentRecord.create as jest.Mock).mock.calls[0]?.[0]?.data
    ).toMatchObject({
      paymentNumber: 'PAY-0001',
      salesOrderId: 'order-1',
      customerId,
      userId,
      paymentType: 'order_payment',
      paymentAmount: 50,
      roundingAmount: 0,
      status: 'pending',
    });

    const { recordPartnerTransaction } = jest.requireMock(
      '@/lib/services/partner-ledger-service'
    ) as {
      recordPartnerTransaction: jest.Mock;
    };

    expect(recordPartnerTransaction).toHaveBeenCalledTimes(1);
    expect(recordPartnerTransaction.mock.calls[0]?.[0]).toMatchObject({
      partnerId: customerId,
      partnerRole: 'customer',
      transactionType: 'sale',
      amount: 50,
      referenceId: 'order-1',
      referenceNumber: 'SO-0001',
    });
  });

  it('confirmed 普通销售开单：库存不足时应失败且不创建应收', async () => {
    const userId = '33333333-3333-4333-8333-333333333333';
    const customerId = '22222222-2222-4222-8222-222222222222';
    const productId = '11111111-1111-4111-8111-111111111111';
    const variantId = '44444444-4444-4444-8444-444444444444';

    const tx = createSalesOrderTx({
      userId,
      customerId,
      productId,
      variantId,
      inventories: [
        {
          id: 'inv-1',
          productId,
          variantId,
          batchNumber: 'B1',
          quantity: 5,
          reservedQuantity: 0,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    const { generateSalesOrderNumber } = jest.requireMock(
      '@/lib/services/simple-order-number-generator'
    ) as {
      generateSalesOrderNumber: jest.Mock;
    };
    generateSalesOrderNumber.mockResolvedValue('SO-0002');

    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    await expect(
      createSalesOrder(
        {
          customerId,
          status: 'confirmed',
          orderType: 'NORMAL',
          items: [
            {
              productId,
              colorCode: 'C01',
              quantity: 10,
              unitPrice: 5,
              subtotal: 50,
            },
          ],
          usePrepayment: false,
        },
        userId
      )
    ).rejects.toThrow('可用库存不足');

    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
    expect(tx.paymentRecord.create).not.toHaveBeenCalled();

    const { recordPartnerTransaction } = jest.requireMock(
      '@/lib/services/partner-ledger-service'
    ) as {
      recordPartnerTransaction: jest.Mock;
    };
    expect(recordPartnerTransaction).not.toHaveBeenCalled();
  });

  it('confirmed 普通销售开单：多批次但未指定批次号时应失败且不创建应收', async () => {
    const userId = '33333333-3333-4333-8333-333333333333';
    const customerId = '22222222-2222-4222-8222-222222222222';
    const productId = '11111111-1111-4111-8111-111111111111';
    const variantId = '44444444-4444-4444-8444-444444444444';

    const tx = createSalesOrderTx({
      userId,
      customerId,
      productId,
      variantId,
      inventories: [
        {
          id: 'inv-1',
          productId,
          variantId,
          batchNumber: 'B1',
          quantity: 100,
          reservedQuantity: 0,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'inv-2',
          productId,
          variantId,
          batchNumber: 'B2',
          quantity: 100,
          reservedQuantity: 0,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    const { generateSalesOrderNumber } = jest.requireMock(
      '@/lib/services/simple-order-number-generator'
    ) as {
      generateSalesOrderNumber: jest.Mock;
    };
    generateSalesOrderNumber.mockResolvedValue('SO-0003');

    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    await expect(
      createSalesOrder(
        {
          customerId,
          status: 'confirmed',
          orderType: 'NORMAL',
          items: [
            {
              productId,
              colorCode: 'C01',
              quantity: 10,
              unitPrice: 5,
              subtotal: 50,
            },
          ],
          usePrepayment: false,
        },
        userId
      )
    ).rejects.toThrow('多个库存批次');

    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
    expect(tx.paymentRecord.create).not.toHaveBeenCalled();
  });

  it('confirmed 普通销售开单：并发冲突导致预留失败应提示重试且不创建应收', async () => {
    const userId = '33333333-3333-4333-8333-333333333333';
    const customerId = '22222222-2222-4222-8222-222222222222';
    const productId = '11111111-1111-4111-8111-111111111111';
    const variantId = '44444444-4444-4444-8444-444444444444';

    const tx = createSalesOrderTx({
      userId,
      customerId,
      productId,
      variantId,
      inventories: [
        {
          id: 'inv-1',
          productId,
          variantId,
          batchNumber: 'B1',
          quantity: 100,
          reservedQuantity: 0,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      inventoryUpdateCount: 0,
    });

    const { generateSalesOrderNumber } = jest.requireMock(
      '@/lib/services/simple-order-number-generator'
    ) as {
      generateSalesOrderNumber: jest.Mock;
    };
    generateSalesOrderNumber.mockResolvedValue('SO-0004');

    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    await expect(
      createSalesOrder(
        {
          customerId,
          status: 'confirmed',
          orderType: 'NORMAL',
          items: [
            {
              productId,
              colorCode: 'C01',
              quantity: 10,
              unitPrice: 5,
              subtotal: 50,
            },
          ],
          usePrepayment: false,
        },
        userId
      )
    ).rejects.toThrow('库存预留失败');

    expect(tx.paymentRecord.create).not.toHaveBeenCalled();
  });

  it('创建销售订单遇到瞬时事务写冲突时应自动重试并成功', async () => {
    const userId = '33333333-3333-4333-8333-333333333333';
    const customerId = '22222222-2222-4222-8222-222222222222';
    const productId = '11111111-1111-4111-8111-111111111111';
    const variantId = '44444444-4444-4444-8444-444444444444';

    const tx = createSalesOrderTx({
      userId,
      customerId,
      productId,
      variantId,
      inventories: [
        {
          id: 'inv-1',
          productId,
          variantId,
          batchNumber: 'B1',
          quantity: 100,
          reservedQuantity: 0,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    const { generateSalesOrderNumber } = jest.requireMock(
      '@/lib/services/simple-order-number-generator'
    ) as {
      generateSalesOrderNumber: jest.Mock;
    };
    generateSalesOrderNumber.mockResolvedValue('SO-0004A');

    prisma.$transaction
      .mockRejectedValueOnce(createRetryableTransactionConflictError())
      .mockImplementationOnce(async (fn: any) => fn(tx));
    prisma.product.findMany.mockResolvedValue([
      {
        id: productId,
        name: 'P1',
        code: 'P1',
        unit: '片',
        specification: 'spec',
        piecesPerUnit: 1,
        weight: null,
      },
    ]);

    const result = await createSalesOrder(
      {
        customerId,
        status: 'confirmed',
        orderType: 'NORMAL',
        items: [
          {
            productId,
            colorCode: 'C01',
            quantity: 10,
            unitPrice: 5,
            subtotal: 50,
          },
        ],
        usePrepayment: false,
      },
      userId
    );

    expect(result.orderNumber).toBe('SO-0004A');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(tx.inventory.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.paymentRecord.create).toHaveBeenCalledTimes(1);
  });

  it('draft 普通销售开单：不应预留库存，也不应创建应收', async () => {
    const userId = '33333333-3333-4333-8333-333333333333';
    const customerId = '22222222-2222-4222-8222-222222222222';
    const productId = '11111111-1111-4111-8111-111111111111';
    const variantId = '44444444-4444-4444-8444-444444444444';

    const tx = createSalesOrderTx({
      userId,
      customerId,
      productId,
      variantId,
      inventories: [
        {
          id: 'inv-1',
          productId,
          variantId,
          batchNumber: 'B1',
          quantity: 100,
          reservedQuantity: 0,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    const { generateSalesOrderNumber } = jest.requireMock(
      '@/lib/services/simple-order-number-generator'
    ) as {
      generateSalesOrderNumber: jest.Mock;
    };
    generateSalesOrderNumber.mockResolvedValue('SO-0005');

    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
    prisma.product.findMany.mockResolvedValue([]);

    const result = await createSalesOrder(
      {
        customerId,
        status: 'draft',
        orderType: 'NORMAL',
        items: [],
        usePrepayment: false,
      },
      userId
    );

    expect(result.status).toBe('draft');
    expect(result.totalAmount).toBe(0);
    expect(result.items).toHaveLength(0);
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
    expect(tx.paymentRecord.create).not.toHaveBeenCalled();
  });

  it('confirmed 普通销售开单：显式传入 variantId+batchNumber 时不应再回填更新', async () => {
    const userId = '33333333-3333-4333-8333-333333333333';
    const customerId = '22222222-2222-4222-8222-222222222222';
    const productId = '11111111-1111-4111-8111-111111111111';
    const variantId = '44444444-4444-4444-8444-444444444444';

    const tx = createSalesOrderTx({
      userId,
      customerId,
      productId,
      variantId,
      inventories: [
        {
          id: 'inv-1',
          productId,
          variantId,
          batchNumber: 'B1',
          quantity: 100,
          reservedQuantity: 0,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    const { generateSalesOrderNumber } = jest.requireMock(
      '@/lib/services/simple-order-number-generator'
    ) as {
      generateSalesOrderNumber: jest.Mock;
    };
    generateSalesOrderNumber.mockResolvedValue('SO-0006');

    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
    prisma.product.findMany.mockResolvedValue([
      {
        id: productId,
        name: 'P1',
        code: 'P1',
        unit: '片',
        specification: 'spec',
        piecesPerUnit: 1,
        weight: null,
      },
    ]);

    const result = await createSalesOrder(
      {
        customerId,
        status: 'confirmed',
        orderType: 'NORMAL',
        items: [
          {
            productId,
            variantId,
            batchNumber: 'B1',
            quantity: 10,
            unitPrice: 5,
            subtotal: 50,
          },
        ],
        usePrepayment: false,
      },
      userId
    );

    expect(result.items?.[0]?.variantId).toBe(variantId);
    expect(result.items?.[0]?.batchNumber).toBe('B1');

    expect(tx.inventory.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.productVariant.findFirst).not.toHaveBeenCalled();
    expect(tx.salesOrderItem.update).not.toHaveBeenCalled();
  });

  it('confirmed 普通销售开单：指定批次号但不存在时应失败', async () => {
    const userId = '33333333-3333-4333-8333-333333333333';
    const customerId = '22222222-2222-4222-8222-222222222222';
    const productId = '11111111-1111-4111-8111-111111111111';
    const variantId = '44444444-4444-4444-8444-444444444444';

    const tx = createSalesOrderTx({
      userId,
      customerId,
      productId,
      variantId,
      inventories: [
        {
          id: 'inv-1',
          productId,
          variantId,
          batchNumber: 'B1',
          quantity: 100,
          reservedQuantity: 0,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'inv-2',
          productId,
          variantId,
          batchNumber: 'B2',
          quantity: 100,
          reservedQuantity: 0,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    const { generateSalesOrderNumber } = jest.requireMock(
      '@/lib/services/simple-order-number-generator'
    ) as {
      generateSalesOrderNumber: jest.Mock;
    };
    generateSalesOrderNumber.mockResolvedValue('SO-0007');

    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    await expect(
      createSalesOrder(
        {
          customerId,
          status: 'confirmed',
          orderType: 'NORMAL',
          items: [
            {
              productId,
              variantId,
              batchNumber: 'B3',
              quantity: 10,
              unitPrice: 5,
              subtotal: 50,
            },
          ],
          usePrepayment: false,
        },
        userId
      )
    ).rejects.toThrow('库存记录不存在 (批次: B3)');

    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
    expect(tx.paymentRecord.create).not.toHaveBeenCalled();
  });

  it('confirmed 普通销售开单：全部为手动产品时不预留库存但仍生成应收', async () => {
    const userId = '33333333-3333-4333-8333-333333333333';
    const customerId = '22222222-2222-4222-8222-222222222222';
    const productId = '11111111-1111-4111-8111-111111111111';
    const variantId = '44444444-4444-4444-8444-444444444444';

    const tx = createSalesOrderTx({
      userId,
      customerId,
      productId,
      variantId,
      inventories: [],
    });

    const { generateSalesOrderNumber } = jest.requireMock(
      '@/lib/services/simple-order-number-generator'
    ) as {
      generateSalesOrderNumber: jest.Mock;
    };
    generateSalesOrderNumber.mockResolvedValue('SO-0008');

    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
    prisma.product.findMany.mockResolvedValue([]);

    const result = await createSalesOrder(
      {
        customerId,
        status: 'confirmed',
        orderType: 'NORMAL',
        items: [
          {
            isManualProduct: true,
            manualProductName: '临时产品',
            manualSpecification: 'spec',
            manualUnit: '片',
            quantity: 10,
            unitPrice: 5,
            subtotal: 50,
          },
        ],
        usePrepayment: false,
      },
      userId
    );

    expect(result.items?.[0]?.isManualProduct).toBe(true);
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
    expect(tx.salesOrderItem.update).not.toHaveBeenCalled();
    expect(tx.paymentRecord.create).toHaveBeenCalledTimes(1);
  });

  it('confirmed 调货直发开单：应创建调货采购单且不预留本地库存', async () => {
    const userId = '33333333-3333-4333-8333-333333333333';
    const customerId = '22222222-2222-4222-8222-222222222222';
    const supplierId = '55555555-5555-4555-8555-555555555555';
    const productId = '11111111-1111-4111-8111-111111111111';
    const variantId = '44444444-4444-4444-8444-444444444444';

    const tx = createSalesOrderTx({
      userId,
      customerId,
      productId,
      variantId,
      inventories: [
        {
          id: 'inv-1',
          productId,
          variantId,
          batchNumber: 'B1',
          quantity: 100,
          reservedQuantity: 0,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    const { generateSalesOrderNumber } = jest.requireMock(
      '@/lib/services/simple-order-number-generator'
    ) as {
      generateSalesOrderNumber: jest.Mock;
    };
    generateSalesOrderNumber.mockResolvedValue('SO-0009');

    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
    prisma.product.findMany.mockResolvedValue([
      {
        id: productId,
        name: 'P1',
        code: 'P1',
        unit: '片',
        specification: 'spec',
        piecesPerUnit: 1,
        weight: null,
      },
    ]);

    const { createPurchaseOrderForTransfer } = jest.requireMock(
      '@/lib/api/handlers/sales-orders/purchase-order'
    ) as {
      createPurchaseOrderForTransfer: jest.Mock;
    };
    createPurchaseOrderForTransfer.mockResolvedValue(undefined);

    const result = await createSalesOrder(
      {
        customerId,
        supplierId,
        status: 'confirmed',
        orderType: 'TRANSFER',
        transferMode: 'SUPPLIER_ONLY',
        items: [
          {
            productId,
            quantity: 10,
            unitPrice: 5,
            subtotal: 50,
            unitCost: 2,
          },
        ],
        usePrepayment: false,
      },
      userId
    );

    expect(result.orderType).toBe('TRANSFER');
    expect(result.transferMode).toBe('SUPPLIER_ONLY');

    expect(createPurchaseOrderForTransfer).toHaveBeenCalledTimes(1);
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
    expect(tx.paymentRecord.create).toHaveBeenCalledTimes(1);
  });

  it('confirmed 调货混合开单：仅预留本地数量（localQuantity）', async () => {
    const userId = '33333333-3333-4333-8333-333333333333';
    const customerId = '22222222-2222-4222-8222-222222222222';
    const supplierId = '55555555-5555-4555-8555-555555555555';
    const productId = '11111111-1111-4111-8111-111111111111';
    const variantId = '44444444-4444-4444-8444-444444444444';

    const tx = createSalesOrderTx({
      userId,
      customerId,
      productId,
      variantId,
      inventories: [
        {
          id: 'inv-1',
          productId,
          variantId,
          batchNumber: 'B1',
          quantity: 100,
          reservedQuantity: 0,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    const { generateSalesOrderNumber } = jest.requireMock(
      '@/lib/services/simple-order-number-generator'
    ) as {
      generateSalesOrderNumber: jest.Mock;
    };
    generateSalesOrderNumber.mockResolvedValue('SO-0010');

    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
    prisma.product.findMany.mockResolvedValue([
      {
        id: productId,
        name: 'P1',
        code: 'P1',
        unit: '片',
        specification: 'spec',
        piecesPerUnit: 1,
        weight: null,
      },
    ]);

    const result = await createSalesOrder(
      {
        customerId,
        supplierId,
        status: 'confirmed',
        orderType: 'TRANSFER',
        transferMode: 'MIXED',
        items: [
          {
            productId,
            colorCode: 'C01',
            quantity: 10,
            localQuantity: 3,
            transferQuantity: 7,
            unitPrice: 5,
            subtotal: 50,
            unitCost: 2,
            batchNumber: 'B1',
          },
          {
            productId,
            colorCode: 'C01',
            quantity: 5,
            localQuantity: 0,
            transferQuantity: 5,
            unitPrice: 5,
            subtotal: 25,
            unitCost: 2,
            batchNumber: 'B2',
          },
        ],
        usePrepayment: false,
      },
      userId
    );

    expect(result.orderType).toBe('TRANSFER');
    expect(result.transferMode).toBe('MIXED');

    expect(tx.inventory.updateMany).toHaveBeenCalledTimes(1);
    const updateArgs = (tx.inventory.updateMany as jest.Mock).mock
      .calls[0]?.[0];
    expect(updateArgs?.data?.reservedQuantity?.increment).toBe(3);
  });
});
