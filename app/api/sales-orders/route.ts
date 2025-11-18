import {
  createSalesOrder,
  getSalesOrders,
  salesOrderQuerySchema,
} from '@/lib/api/handlers/sales-orders';
import type { CreateInput } from '@/lib/api/handlers/sales-orders/types';
import { withErrorHandling } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/api-helpers';
import { buildCacheKey, CACHE_STRATEGY, getOrSetJSON } from '@/lib/cache';
import { logger } from '@/lib/logger';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';
import { salesOrderCreateSchema } from '@/lib/validations/sales-order';

/**
 * 获取销售订单列表
 */
const getSalesOrdersHandler = withErrorHandling(
  withAuth(
    async request => {
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
        orderType: searchParams.get('orderType'),
        hasReturns: searchParams.get('hasReturns'),
      };

      // 验证查询参数
      const validatedParams = salesOrderQuerySchema.parse(rawParams);

      // 构建缓存键
      const cacheKey = buildCacheKey('sales-orders:list', validatedParams);

      // 使用缓存包装查询
      const result = await getOrSetJSON(
        cacheKey,
        async () => getSalesOrders(validatedParams),
        CACHE_STRATEGY.dynamicData.redisTTL, // 销售订单数据，使用5分钟缓存
        {
          enableRandomTTL: true, // 防止缓存雪崩
          enableNullCache: true, // 防止缓存穿透
        }
      );

      return successResponse(result);
    },
    { permissions: ['sales:view'] }
  )
);

export const GET = withRateLimit(RateLimitType.READ)(getSalesOrdersHandler);

/**
 * 创建销售订单
 */
const createSalesOrderHandler = withErrorHandling(
  withAuth(
    async (request, { user }) => {
      const body = await request.json();

      // 验证请求数据
      const validatedData = salesOrderCreateSchema.parse(body);

      // 类型安全转换：Zod schema 验证后的数据符合 CreateInput 要求
      // validatedData 已通过 salesOrderCreateSchema 验证，确保数据完整性
      const createInput: CreateInput = {
        customerId: validatedData.customerId,
        status: validatedData.status,
        orderType: validatedData.orderType,
        transferMode: validatedData.transferMode,
        supplierId: validatedData.supplierId || undefined,
        costAmount: validatedData.costAmount ?? undefined,
        roundingAdjustment: validatedData.roundingAdjustment ?? undefined,
        usePrepayment: validatedData.usePrepayment,
        prepaymentAmount: validatedData.prepaymentAmount ?? undefined,
        remarks: validatedData.remarks || undefined,
        items: validatedData.items as CreateInput['items'],
        feeItems: validatedData.feeItems,
      };

      const order = await createSalesOrder(createInput, user.id);

      // ✅ P0修复：销售订单创建后，失效销售订单和应收款缓存
      const { invalidateSalesOrderAndReceivables } = await import(
        '@/lib/cache/finance-cache'
      );
      invalidateSalesOrderAndReceivables(order.id).catch(error => {
        logger.error('cache', '销售订单缓存失效失败', error, {
          orderId: order.id,
          operation: 'cache_invalidation',
        });
      });

      return successResponse(order, 201, '销售订单创建成功');
    },
    { permissions: ['sales:manage'] }
  )
);

export const POST = withRateLimit(RateLimitType.WRITE)(createSalesOrderHandler);
