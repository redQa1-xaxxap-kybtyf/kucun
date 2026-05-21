jest.mock('next/server', () => {
  class MockNextResponse {
    readonly headers = new Map<string, string>();

    constructor(
      public readonly body: unknown,
      public readonly status: number
    ) {}

    async json() {
      return this.body;
    }
  }

  return {
    NextResponse: {
      json(data: unknown, init?: { status?: number }) {
        return new MockNextResponse(data, init?.status ?? 200);
      },
    },
  };
});

const mockPrisma: any = {};

jest.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

jest.mock('next-auth/jwt', () => ({
  encode: jest.fn(async () => 'mock-mini-program-image-token'),
}));

jest.mock('@/lib/rate-limit', () => {
  const buckets = new Map<string, number>();
  const RateLimitType = {
    GLOBAL: 'global',
    READ: 'read',
    WRITE: 'write',
  };

  function getGlobalLimit() {
    return Number(process.env.RATE_LIMIT_GLOBAL || 100);
  }

  return {
    RateLimitType,
    checkRateLimit: jest.fn(async () => ({ limited: false })),
    getRateLimiter: jest.fn(() => ({
      async checkLimit(key: string) {
        const limit = getGlobalLimit();
        const count = (buckets.get(key) || 0) + 1;
        buckets.set(key, count);
        const remaining = Math.max(0, limit - count);

        return {
          allowed: count <= limit,
          limit,
          remaining,
          resetAt: new Date(Date.now() + 60 * 1000),
        };
      },
      async reset(key: string) {
        buckets.delete(key);
      },
    })),
  };
});

const OWN_PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_OWN_PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const EXTERNAL_PRODUCT_ID = '33333333-3333-4333-8333-333333333333';

function createOwnProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: OWN_PRODUCT_ID,
    code: 'OWN-001',
    name: '雅士白罗马柱',
    specification: '800x800mm',
    unit: 'piece',
    piecesPerUnit: null,
    weight: null,
    description: '',
    thumbnailUrl: '/api/uploads/products/own.jpg',
    images: null,
    status: 'active',
    updatedAt: new Date('2026-05-20T10:00:00.000Z'),
    category: null,
    variants: [],
    inventory: [{ quantity: 10, reservedQuantity: 0 }],
    ...overrides,
  };
}

function createExternalProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: EXTERNAL_PRODUCT_ID,
    code: 'EXT-001',
    name: '外采罗马柱',
    specification: '600x600mm',
    unit: 'piece',
    thumbnailUrl: '/api/uploads/products/external.jpg',
    images: null,
    ...overrides,
  };
}

function createRequestBody(overrides: Record<string, unknown> = {}) {
  return {
    customerName: '张三',
    customerPhone: '138 0000 0000',
    contactAddress: '测试地址',
    remarks: '请尽快联系',
    items: [
      {
        productSource: 'own',
        productId: OWN_PRODUCT_ID,
        productCode: 'OWN-001',
        productName: '雅士白罗马柱',
        quantity: 1,
      },
    ],
    ...overrides,
  };
}

function mockBasePrisma(
  options: {
    ownProducts?: Array<Record<string, unknown>>;
    temporaryProducts?: Array<Record<string, unknown>>;
    catalogSettings?: Record<string, unknown> | null;
  } = {}
) {
  Object.assign(mockPrisma, {
    systemSetting: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          options.catalogSettings
            ? { value: JSON.stringify(options.catalogSettings) }
            : null
        ),
    },
    product: {
      findMany: jest
        .fn()
        .mockResolvedValue(options.ownProducts ?? [createOwnProduct()]),
    },
    inventory: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    batchSpecification: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    temporaryProduct: {
      findMany: jest.fn().mockResolvedValue(options.temporaryProducts ?? []),
    },
    miniProgramGoodsRequest: {
      create: jest.fn(async ({ data }: any) => ({
        id: 'request-1',
        requestNumber: data.requestNumber,
        lookupToken: data.lookupToken,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        contactAddress: data.contactAddress,
        remarks: data.remarks,
        status: 'pending',
        createdAt: new Date('2026-05-20T10:00:00.000Z'),
        updatedAt: new Date('2026-05-20T10:00:00.000Z'),
        items: data.items.create.map((item: any, index: number) => ({
          id: `item-${index + 1}`,
          ...item,
        })),
      })),
      findUnique: jest.fn(),
    },
  });
}

async function importRoute() {
  jest.resetModules();
  return import('@/app/api/miniprogram/goods-requests/route');
}

function createRequest(body: unknown, forwardedFor = '203.0.113.1') {
  return {
    json: async () => body,
    headers: {
      get(name: string) {
        if (name.toLowerCase() === 'x-forwarded-for') return forwardedFor;
        return null;
      },
    },
    nextUrl: new URL('http://localhost/api/miniprogram/goods-requests'),
  } as any;
}

function createLookupRequest(lookupToken?: string) {
  const url = new URL('http://localhost/api/miniprogram/goods-requests');
  if (lookupToken !== undefined) {
    url.searchParams.set('lookupToken', lookupToken);
  }

  return {
    headers: {
      get() {
        return null;
      },
    },
    nextUrl: url,
  } as any;
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(mockPrisma)) {
    delete mockPrisma[key];
  }
});

describe('/api/miniprogram/goods-requests 自有产品可见性', () => {
  test('POST：隐藏自有产品不能被公开报货接口快照', async () => {
    mockBasePrisma({
      catalogSettings: {
        productOverrides: {
          [OWN_PRODUCT_ID]: { visible: false },
        },
      },
    });
    const { POST } = await importRoute();

    const response = await POST(createRequest(createRequestBody()));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: '产品“雅士白罗马柱”已下架或不存在',
      })
    );
    expect(mockPrisma.miniProgramGoodsRequest.create).not.toHaveBeenCalled();
  });

  test('POST：隐藏分类下的自有产品不能被公开报货接口快照', async () => {
    mockBasePrisma({
      catalogSettings: {
        colorSeries: [{ id: 'yashi-white', visible: false }],
        productOverrides: {
          [OWN_PRODUCT_ID]: { seriesId: 'yashi-white' },
        },
      },
    });
    const { POST } = await importRoute();

    const response = await POST(createRequest(createRequestBody()));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: '产品“雅士白罗马柱”已下架或不存在',
      })
    );
    expect(mockPrisma.miniProgramGoodsRequest.create).not.toHaveBeenCalled();
  });

  test('POST：内部测试自有产品不能被公开报货接口快照', async () => {
    mockBasePrisma({
      ownProducts: [
        createOwnProduct({
          name: '测试产品罗马柱',
        }),
      ],
    });
    const { POST } = await importRoute();

    const response = await POST(
      createRequest(
        createRequestBody({
          items: [
            {
              productSource: 'own',
              productId: OWN_PRODUCT_ID,
              productCode: 'OWN-001',
              productName: '测试产品罗马柱',
              quantity: 1,
            },
          ],
        })
      )
    );

    expect(response.status).toBe(400);
    expect(mockPrisma.miniProgramGoodsRequest.create).not.toHaveBeenCalled();
  });
});

describe('/api/miniprogram/goods-requests 创建路径', () => {
  test('POST：目录可见自有产品仍可创建报货单', async () => {
    mockBasePrisma();
    const { POST } = await importRoute();

    const response = await POST(createRequest(createRequestBody()));

    expect(response.status).toBe(201);
    expect(mockPrisma.miniProgramGoodsRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerPhone: '138 0000 0000',
          items: {
            create: [
              expect.objectContaining({
                productId: OWN_PRODUCT_ID,
                productSource: 'own',
                productCode: 'OWN-001',
              }),
            ],
          },
        }),
      })
    );
  });

  test('POST：保留小程序提交的数量单位，避免用产品主档单位覆盖', async () => {
    mockBasePrisma();
    const { POST } = await importRoute();

    const response = await POST(
      createRequest(
        createRequestBody({
          items: [
            {
              productSource: 'own',
              productId: OWN_PRODUCT_ID,
              productCode: 'OWN-001',
              productName: '雅士白罗马柱',
              unit: '片',
              quantity: 20,
              remarks: '客户填报：2件；换算：1件=10片；折合20片',
            },
          ],
        })
      )
    );

    expect(response.status).toBe(201);
    expect(mockPrisma.miniProgramGoodsRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: {
            create: [
              expect.objectContaining({
                productId: OWN_PRODUCT_ID,
                productSource: 'own',
                productCode: 'OWN-001',
                unit: '片',
                quantity: 20,
                remarks: '客户填报：2件；换算：1件=10片；折合20片',
              }),
            ],
          },
        }),
      })
    );
  });

  test('POST：外采隐藏产品仍会被拒绝', async () => {
    mockBasePrisma({ ownProducts: [], temporaryProducts: [] });
    const { POST } = await importRoute();

    const response = await POST(
      createRequest(
        createRequestBody({
          items: [
            {
              productSource: 'external',
              temporaryProductId: EXTERNAL_PRODUCT_ID,
              productCode: 'EXT-001',
              productName: '外采罗马柱',
              quantity: 1,
            },
          ],
        })
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: '调货产品“外采罗马柱”已下架或不存在',
      })
    );
    expect(mockPrisma.miniProgramGoodsRequest.create).not.toHaveBeenCalled();
  });

  test('POST：外采可见产品仍可创建报货单', async () => {
    mockBasePrisma({
      ownProducts: [],
      temporaryProducts: [createExternalProduct()],
    });
    const { POST } = await importRoute();

    const response = await POST(
      createRequest(
        createRequestBody({
          items: [
            {
              productSource: 'external',
              temporaryProductId: EXTERNAL_PRODUCT_ID,
              productCode: 'EXT-001',
              productName: '外采罗马柱',
              quantity: 1,
            },
          ],
        })
      )
    );

    expect(response.status).toBe(201);
    expect(mockPrisma.miniProgramGoodsRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: {
            create: [
              expect.objectContaining({
                temporaryProductId: EXTERNAL_PRODUCT_ID,
                productSource: 'external',
                productCode: 'EXT-001',
              }),
            ],
          },
        }),
      })
    );
  });
});

describe('/api/miniprogram/goods-requests 查询路径', () => {
  test('GET：查询报货单命中读取限流时不访问数据库', async () => {
    mockBasePrisma();
    const { GET } = await importRoute();
    const { checkRateLimit, RateLimitType } = await import('@/lib/rate-limit');
    const request = createLookupRequest('lookup_token_1234567890');

    (checkRateLimit as jest.Mock).mockResolvedValueOnce({
      limited: true,
      response: {
        status: 429,
        json: async () => ({
          success: false,
          error: '读取请求过于频繁，请稍后再试',
        }),
      },
    });

    const response = await GET(request);

    expect(checkRateLimit).toHaveBeenCalledWith(request, RateLimitType.READ);
    expect(response.status).toBe(429);
    expect(mockPrisma.miniProgramGoodsRequest.findUnique).not.toHaveBeenCalled();
  });

  test('GET：查询报货单响应禁用缓存', async () => {
    mockBasePrisma();
    mockPrisma.miniProgramGoodsRequest.findUnique.mockResolvedValue({
      id: 'request-1',
      requestNumber: 'BH20260520100000ABCD',
      lookupToken: 'lookup_token_1234567890',
      customerName: '张三',
      customerPhone: '13800000000',
      contactAddress: '测试地址',
      remarks: null,
      status: 'pending',
      createdAt: new Date('2026-05-20T10:00:00.000Z'),
      updatedAt: new Date('2026-05-20T10:00:00.000Z'),
      items: [],
    });
    const { GET } = await importRoute();

    const response = await GET(createLookupRequest('lookup_token_1234567890'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(
      'private, no-store, max-age=0'
    );
    expect(response.headers.get('Pragma')).toBe('no-cache');
  });

  test('GET：拒绝格式异常的 lookupToken', async () => {
    mockBasePrisma();
    const { GET } = await importRoute();

    const response = await GET(createLookupRequest('../bad-token'));

    expect(response.status).toBe(400);
    expect(mockPrisma.miniProgramGoodsRequest.findUnique).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: '报货记录凭证格式不正确',
      })
    );
  });
});

describe('/api/miniprogram/goods-requests 内容限流', () => {
  test('POST：同一电话和产品集合更换 X-Forwarded-For 仍会命中限流', async () => {
    mockBasePrisma({
      ownProducts: [
        createOwnProduct(),
        createOwnProduct({
          id: OTHER_OWN_PRODUCT_ID,
          code: 'OWN-002',
          name: '爵士白罗马柱',
        }),
      ],
    });
    const { POST } = await importRoute();
    const body = createRequestBody();

    let response: any;
    for (let index = 0; index < 31; index += 1) {
      response = await POST(createRequest(body, `198.51.100.${index}`));
    }

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: false,
        error: '提交过于频繁，请稍后再试',
      })
    );
    expect(mockPrisma.miniProgramGoodsRequest.create).toHaveBeenCalledTimes(30);

    const differentBody = createRequestBody({
      items: [
        {
          productSource: 'own',
          productId: OTHER_OWN_PRODUCT_ID,
          productCode: 'OWN-002',
          productName: '爵士白罗马柱',
          quantity: 1,
        },
      ],
    });
    const differentResponse = await POST(
      createRequest(differentBody, '198.51.100.200')
    );

    expect(differentResponse.status).toBe(201);
  });
});

describe('/api/miniprogram/goods-requests 端点级限流', () => {
  test('POST：更换电话、商品和来源地址仍会命中端点级限流', async () => {
    const previousGlobalLimit = process.env.RATE_LIMIT_GLOBAL;
    process.env.RATE_LIMIT_GLOBAL = '3';

    mockBasePrisma({
      ownProducts: [
        createOwnProduct(),
        createOwnProduct({
          id: OTHER_OWN_PRODUCT_ID,
          code: 'OWN-002',
          name: '爵士白罗马柱',
        }),
      ],
    });

    try {
      const { POST } = await importRoute();
      const { getRateLimiter, RateLimitType } = await import(
        '@/lib/rate-limit'
      );
      await getRateLimiter(RateLimitType.GLOBAL).reset(
        'endpoint:miniprogram-goods-requests'
      );
      const buildVariedBody = (index: number) =>
        createRequestBody({
          customerPhone: `1390000000${index}`,
          items: [
            {
              productSource: 'own',
              productId:
                index % 2 === 0 ? OWN_PRODUCT_ID : OTHER_OWN_PRODUCT_ID,
              productCode: index % 2 === 0 ? 'OWN-001' : 'OWN-002',
              productName: index % 2 === 0 ? '雅士白罗马柱' : '爵士白罗马柱',
              quantity: 1,
            },
          ],
        });

      const responses = [];
      for (let index = 0; index < 4; index += 1) {
        responses.push(
          await POST(
            createRequest(buildVariedBody(index), `198.51.100.${index + 1}`)
          )
        );
      }

      expect(responses.map(response => response.status)).toEqual([
        201, 201, 201, 429,
      ]);
      await expect(responses[3].json()).resolves.toEqual(
        expect.objectContaining({
          success: false,
          error: '提交过于频繁，请稍后再试',
        })
      );
      expect(mockPrisma.miniProgramGoodsRequest.create).toHaveBeenCalledTimes(
        3
      );
    } finally {
      if (previousGlobalLimit === undefined) {
        delete process.env.RATE_LIMIT_GLOBAL;
      } else {
        process.env.RATE_LIMIT_GLOBAL = previousGlobalLimit;
      }
    }
  });
});
