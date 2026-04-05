jest.mock('@/lib/auth/api-helpers', () => ({
  withAuth:
    (handler: any) =>
    async (request: any, context: any = {}) =>
      handler(request, {
        ...context,
        user: {
          id: 'user-1',
          name: '测试管理员',
          email: 'admin@example.com',
        },
      }),
}));

jest.mock('@/lib/db', () => ({
  prisma: {
    salesOrder: {
      findMany: jest.fn(),
    },
    inventory: {
      findMany: jest.fn(),
    },
  },
}));

describe('notifications fallback route', () => {
  const { prisma } = jest.requireMock('@/lib/db') as {
    prisma: {
      salesOrder: {
        findMany: jest.Mock;
      };
      inventory: {
        findMany: jest.Mock;
      };
    };
  };

  function createRequest(
    path: string,
    cookies: Record<string, string> = {}
  ): {
    cookies: {
      get: (name: string) => { value: string } | undefined;
    };
    nextUrl: URL;
  } {
    return {
      nextUrl: new URL(`http://localhost${path}`),
      cookies: {
        get: (name: string) =>
          cookies[name] ? { value: cookies[name] } : undefined,
      },
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();

    prisma.salesOrder.findMany
      .mockResolvedValueOnce([
        {
          id: 'sales-order-1',
          orderNumber: 'SO-2026-0001',
          status: 'draft',
          totalAmount: 1280,
          createdAt: new Date('2026-03-24T08:00:00.000Z'),
          customer: {
            name: '测试客户',
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'sales-order-2',
          orderNumber: 'SO-2026-0002',
          status: 'confirmed',
          totalAmount: 980,
          createdAt: new Date('2026-03-10T08:00:00.000Z'),
          customer: {
            name: '老客户',
          },
        },
      ]);

    prisma.inventory.findMany.mockResolvedValue([
      {
        id: 'inventory-1',
        productId: 'product-1',
        quantity: 0,
        updatedAt: new Date('2026-03-24T09:00:00.000Z'),
        product: {
          id: 'product-1',
          name: '岩板-800',
          code: 'P-800',
        },
      },
    ]);
  });

  test('GET 在没有 Notification 模型时应回退为仪表盘待办通知', async () => {
    const { GET } = await import('@/app/api/notifications/route');
    const response = await GET(createRequest('/api/notifications') as any);

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.unreadCount).toBe(3);
    expect(body.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'todo:inventory-inventory-1',
          title: '岩板-800 库存不足',
          type: 'error',
          href: '/inventory',
          isRead: false,
        }),
        expect.objectContaining({
          id: 'todo:sales-sales-order-1',
          title: '确认销售订单 SO-2026-0001',
          type: 'warning',
          href: '/sales-orders/sales-order-1',
          isRead: false,
        }),
      ])
    );
  });

  test('标记已读后再次获取，应正确反映 fallback 通知已读状态', async () => {
    const { POST } = await import('@/app/api/notifications/[id]/read/route');
    const readResponse = await POST(
      createRequest('/api/notifications/todo:sales-sales-order-1/read') as any,
      {
        params: Promise.resolve({
          id: 'todo:sales-sales-order-1',
        }),
      } as any
    );

    expect(readResponse.status).toBe(200);
    const setCookieHeader = decodeURIComponent(
      readResponse.headers.get('set-cookie') ?? ''
    );
    expect(setCookieHeader).toContain('fb_notifications_read_user-1=');
    expect(setCookieHeader).toContain('todo:sales-sales-order-1');

    prisma.salesOrder.findMany.mockReset();
    prisma.inventory.findMany.mockReset();
    prisma.salesOrder.findMany
      .mockResolvedValueOnce([
        {
          id: 'sales-order-1',
          orderNumber: 'SO-2026-0001',
          status: 'draft',
          totalAmount: 1280,
          createdAt: new Date('2026-03-24T08:00:00.000Z'),
          customer: {
            name: '测试客户',
          },
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.inventory.findMany.mockResolvedValue([]);

    const { GET } = await import('@/app/api/notifications/route');
    const response = await GET(
      createRequest('/api/notifications', {
        'fb_notifications_read_user-1': 'todo:sales-sales-order-1',
      }) as any
    );

    const body = await response.json();
    expect(body.unreadCount).toBe(0);
    expect(body.notifications).toEqual([
      expect.objectContaining({
        id: 'todo:sales-sales-order-1',
        isRead: true,
      }),
    ]);
  });

  test('忽略后再次获取，应从 fallback 通知列表中移除', async () => {
    const { DELETE } = await import('@/app/api/notifications/[id]/route');
    const deleteResponse = await DELETE(
      createRequest('/api/notifications/todo:inventory-inventory-1') as any,
      {
        params: Promise.resolve({
          id: 'todo:inventory-inventory-1',
        }),
      } as any
    );

    expect(deleteResponse.status).toBe(200);
    const setCookieHeader = decodeURIComponent(
      deleteResponse.headers.get('set-cookie') ?? ''
    );
    expect(setCookieHeader).toContain('fb_notifications_hidden_user-1=');
    expect(setCookieHeader).toContain('todo:inventory-inventory-1');

    prisma.salesOrder.findMany.mockReset();
    prisma.inventory.findMany.mockReset();
    prisma.salesOrder.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prisma.inventory.findMany.mockResolvedValue([
      {
        id: 'inventory-1',
        productId: 'product-1',
        quantity: 0,
        updatedAt: new Date('2026-03-24T09:00:00.000Z'),
        product: {
          id: 'product-1',
          name: '岩板-800',
          code: 'P-800',
        },
      },
    ]);

    const { GET } = await import('@/app/api/notifications/route');
    const response = await GET(
      createRequest('/api/notifications', {
        'fb_notifications_hidden_user-1': 'todo:inventory-inventory-1',
      }) as any
    );

    const body = await response.json();
    expect(body.notifications).toEqual([]);
    expect(body.unreadCount).toBe(0);
  });
});
