import { FACTORY_SHIPMENT_ITEM_OWNERSHIP } from '@/lib/types/factory-shipment';

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/cache', () => ({
  invalidateInventoryCache: jest.fn(async () => undefined),
  revalidateProducts: jest.fn(async () => undefined),
}));

jest.mock('@/lib/api/minimal-inbound-transaction', () => ({
  executeMinimalInboundTransaction: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  prisma: {},
}));

const { auth } = jest.requireMock('@/lib/auth') as {
  auth: jest.Mock;
};

const { prisma } = jest.requireMock('@/lib/db') as {
  prisma: Record<string, any>;
};

const { executeMinimalInboundTransaction } = jest.requireMock(
  '@/lib/api/minimal-inbound-transaction'
) as {
  executeMinimalInboundTransaction: jest.Mock;
};

const { invalidateInventoryCache, revalidateProducts } = jest.requireMock(
  '@/lib/cache'
) as {
  invalidateInventoryCache: jest.Mock;
  revalidateProducts: jest.Mock;
};

type ShipmentItem = {
  id: string;
  ownership: 'customer' | 'self';
  selfInboundStatus: 'pending' | 'received';
  inboundReceivedAt: Date | null;
  productId: string | null;
  supplierId: string | null;
  productCode: string;
  quantity: number;
  unit: string | null;
  piecesPerUnit: number | null;
  unitCost: number | null;
  batchNumber: string | null;
  isManualProduct: boolean;
  temporaryProductId: string | null;
  displayName: string;
  totalPrice: number;
  product?: {
    code: string;
    unit: string | null;
    piecesPerUnit: number | null;
  } | null;
};

type ShipmentOrder = {
  id: string;
  orderNumber: string;
  customer: { id: string; name: string; phone: string; address: string } | null;
  user: { id: string; name: string; email: string } | null;
  items: ShipmentItem[];
};

function clone<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (Array.isArray(value)) return value.map(item => clone(item)) as T;

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = clone(item);
  }
  return out as T;
}

function createStore(seed?: Partial<ShipmentOrder>) {
  const order: ShipmentOrder = {
    id: 'fs-1',
    orderNumber: 'FS-001',
    customer: {
      id: 'customer-1',
      name: '客户A',
      phone: '13800000000',
      address: '广州',
    },
    user: {
      id: 'user-1',
      name: '测试员',
      email: 'tester@example.com',
    },
    items: [
      {
        id: 'item-self-1',
        ownership: FACTORY_SHIPMENT_ITEM_OWNERSHIP.SELF,
        selfInboundStatus: 'pending',
        inboundReceivedAt: null,
        productId: 'product-1',
        supplierId: 'supplier-1',
        productCode: 'SELF-A',
        quantity: 5,
        unit: 'piece',
        piecesPerUnit: 12,
        unitCost: 96,
        batchNumber: 'B001',
        isManualProduct: false,
        temporaryProductId: null,
        displayName: '自用货A',
        totalPrice: 480,
        product: {
          code: 'SELF-A',
          unit: 'piece',
          piecesPerUnit: 12,
        },
      },
      {
        id: 'item-customer-1',
        ownership: FACTORY_SHIPMENT_ITEM_OWNERSHIP.CUSTOMER,
        selfInboundStatus: 'pending',
        inboundReceivedAt: null,
        productId: 'product-2',
        supplierId: 'supplier-1',
        productCode: 'CUSTOMER-B',
        quantity: 20,
        unit: 'sheet',
        piecesPerUnit: null,
        unitCost: 12,
        batchNumber: 'B002',
        isManualProduct: false,
        temporaryProductId: null,
        displayName: '客户货B',
        totalPrice: 240,
        product: {
          code: 'CUSTOMER-B',
          unit: 'sheet',
          piecesPerUnit: null,
        },
      },
    ],
    ...seed,
  };

  return { order };
}

function setupPrisma(store: ReturnType<typeof createStore>) {
  const tx = {
    factoryShipmentOrder: {
      findUnique: jest.fn(async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (id !== store.order.id) {
          return null;
        }

        const itemIds = args?.select?.items?.where?.id?.in as
          | string[]
          | undefined;
        const items = Array.isArray(itemIds)
          ? store.order.items.filter(item => itemIds.includes(item.id))
          : store.order.items;

        return clone({
          id: store.order.id,
          orderNumber: store.order.orderNumber,
          items,
        });
      }),
    },
    factoryShipmentOrderItem: {
      updateMany: jest.fn(async (args: any) => {
        const itemId = args?.where?.id as string | undefined;
        const item = store.order.items.find(entry => entry.id === itemId);

        if (
          !item ||
          args?.where?.factoryShipmentOrderId !== store.order.id ||
          item.ownership !== args?.where?.ownership ||
          item.selfInboundStatus === 'received'
        ) {
          return { count: 0 };
        }

        item.selfInboundStatus = 'received';
        item.inboundReceivedAt = new Date();
        return { count: 1 };
      }),
    },
  };

  const memPrisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    factoryShipmentOrder: {
      findUnique: jest.fn(async (args: any) => {
        const id = args?.where?.id as string | undefined;
        if (id !== store.order.id) {
          return null;
        }

        return clone(store.order);
      }),
    },
  };

  for (const key of Object.keys(prisma)) {
    delete prisma[key];
  }
  Object.assign(prisma, memPrisma);

  return { tx };
}

describe('厂家直发自用补货入库：完整链路回归', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue({
      user: { id: 'user-1' },
    });
    executeMinimalInboundTransaction.mockImplementation(async (input: any) => ({
      id: `inbound-${input.productId}`,
      productId: input.productId,
    }));
  });

  test('自用补货入库成功：应更新明细状态、写入入库并刷新缓存', async () => {
    const store = createStore();
    const { tx } = setupPrisma(store);
    const { POST } = await import('@/app/api/factory-shipments/[id]/inbound/route');

    const response = await POST(
      {
        json: async () => ({ itemIds: ['item-self-1'] }),
      } as any,
      {
        params: { id: 'fs-1' },
      } as any
    );

    expect(response.status).toBe(200);
    expect(executeMinimalInboundTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'product-1',
        quantity: 60,
        unitCost: 8,
        reason: 'purchase',
        supplierId: 'supplier-1',
        batchNumber: 'B001',
        remarks: '厂家发货单FS-001自用补货入库',
        userId: 'user-1',
      }),
      { tx }
    );

    const updatedItem = store.order.items.find(item => item.id === 'item-self-1');
    expect(updatedItem?.selfInboundStatus).toBe('received');
    expect(updatedItem?.inboundReceivedAt).toBeInstanceOf(Date);

    expect(invalidateInventoryCache).toHaveBeenCalledWith('product-1');
    expect(revalidateProducts).toHaveBeenCalledWith('product-1');

    const body = await response.json();
    expect(body.fulfillmentSummary).toEqual({
      customerOwnedAmount: 240,
      selfOwnedAmount: 480,
    });
  });

  test('选中非自用明细时应返回 400，且不执行入库', async () => {
    const store = createStore();
    setupPrisma(store);
    const { POST } = await import('@/app/api/factory-shipments/[id]/inbound/route');

    const response = await POST(
      {
        json: async () => ({ itemIds: ['item-customer-1'] }),
      } as any,
      {
        params: { id: 'fs-1' },
      } as any
    );

    expect(response.status).toBe(400);
    expect(executeMinimalInboundTransaction).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body).toEqual({
      success: false,
      error: '存在非自用补货明细，无法标记入库',
    });
  });

  test('缺少 piecesPerUnit 时应返回 400，且不执行错误入库', async () => {
    const store = createStore({
      items: [
        {
          ...createStore().order.items[0],
          piecesPerUnit: null,
          product: {
            code: 'SELF-A',
            unit: 'piece',
            piecesPerUnit: null,
          },
        },
      ],
    });
    setupPrisma(store);
    const { POST } = await import('@/app/api/factory-shipments/[id]/inbound/route');

    const response = await POST(
      {
        json: async () => ({ itemIds: ['item-self-1'] }),
      } as any,
      {
        params: { id: 'fs-1' },
      } as any
    );

    expect(response.status).toBe(400);
    expect(executeMinimalInboundTransaction).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body).toEqual({
      success: false,
      error: '自用货A 按件录入时必须维护“每件片数”后才能继续',
    });

    const updatedItem = store.order.items.find(item => item.id === 'item-self-1');
    expect(updatedItem?.selfInboundStatus).toBe('pending');
    expect(updatedItem?.inboundReceivedAt).toBeNull();
  });

  test('重复提交同一自用明细时，不应生成第二笔入库', async () => {
    const store = createStore();
    setupPrisma(store);
    const { POST } = await import('@/app/api/factory-shipments/[id]/inbound/route');

    const firstResponse = await POST(
      {
        json: async () => ({ itemIds: ['item-self-1'] }),
      } as any,
      {
        params: { id: 'fs-1' },
      } as any
    );

    const secondResponse = await POST(
      {
        json: async () => ({ itemIds: ['item-self-1'] }),
      } as any,
      {
        params: { id: 'fs-1' },
      } as any
    );

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(executeMinimalInboundTransaction).toHaveBeenCalledTimes(1);
  });
});
