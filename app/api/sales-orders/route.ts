import {
  createSalesOrder,
  getSalesOrders,
  salesOrderQuerySchema,
} from '@/lib/api/handlers/sales-orders';
import { withAuth, withErrorHandling } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/response';
import {
  buildCacheKey,
  CACHE_STRATEGY,
  getOrSetJSON,
  revalidateSalesOrders,
} from '@/lib/cache';
import { salesOrderCreateSchema } from '@/lib/validations/sales-order';

/**
 * 获取销售订单列表
 */
export const GET = withErrorHandling(
  withAuth(async (request, _context, _session) => {
    const { searchParams } = new URL(request.url);
    const rawParams = {
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      search: searchParams.get('search'),
      sortBy: searchParams.get('sortBy'),
      sortOrder: searchParams.get('sortOrder'),
      status: searchParams.get('status'),
      customerId: searchParams.get('customerId'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
    };

    // 验证查询参数
    const validatedParams = salesOrderQuerySchema.parse(rawParams);

    // 构建缓存键
    const cacheKey = buildCacheKey('sales-orders:list', validatedParams);

    // 使用缓存包装查询
    const result = await getOrSetJSON(
      cacheKey,
      async () => {
        return await getSalesOrders(validatedParams);
      },
      CACHE_STRATEGY.dynamicData.redisTTL, // 销售订单数据，使用5分钟缓存
      {
        enableRandomTTL: true, // 防止缓存雪崩
        enableNullCache: true, // 防止缓存穿透
      }
    );

    return successResponse(result);
  })
);

/**
 * 创建销售订单
 */
export const POST = withErrorHandling(
  withAuth(async (request, _context, session) => {
    const body = await request.json();

    // 验证请求数据
    const validatedData = salesOrderCreateSchema.parse(body);

    const order = await createSalesOrder(
      validatedData,
      session?.user?.id || ''
    );

    // 使用统一的缓存失效系统（自动级联失效相关缓存）
    await revalidateSalesOrders();

    return successResponse(order, 201, '销售订单创建成功');
  })
);
