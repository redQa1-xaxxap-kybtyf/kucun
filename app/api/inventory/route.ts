import { type NextRequest, NextResponse } from 'next/server';

import { formatPaginatedResponse } from '@/lib/api/inventory-formatter';
import {
  getInventoryCount,
  getOptimizedInventoryList,
} from '@/lib/api/inventory-query-builder';
import {
  computeStockStatusFromInventoryLike,
  stripSensitiveKeysDeep,
} from '@/lib/api/mini-program-sanitize';
import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';
import {
  inventoryAdjustSchema,
  inventoryQuerySchema,
} from '@/lib/validations/inventory';

// 获取库存列表
// ✅ 性能优化：移除 Redis 缓存层
// - Server Component 已通过 HydrationBoundary 预取数据（不经过此API）
// - Client Component 通过 TanStack Query 缓存（staleTime=Infinity）
// - Redis 低命中率场景下反而增加 20-50ms 延迟
async function handleGetInventory(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // 直接传递字符串参数给验证器，让验证器自己转换
  const rawQueryParams = {
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    search: searchParams.get('search'),
    sortBy: searchParams.get('sortBy'),
    sortOrder: searchParams.get('sortOrder'),
    productId: searchParams.get('productId'),
    batchNumber: searchParams.get('batchNumber'),
    location: searchParams.get('location'),
    categoryId: searchParams.get('categoryId'),

    lowStock: searchParams.get('lowStock'),
    hasStock: searchParams.get('hasStock'),
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
    // 移除悬空的变体相关参数
    // groupByVariant: searchParams.get('groupByVariant'),
    // includeVariants: searchParams.get('includeVariants'),
  };

  // 验证查询参数 - 使用专门的库存查询验证规则
  const validationResult = inventoryQuerySchema.safeParse(rawQueryParams);
  if (!validationResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: '查询参数格式不正确',
        details: validationResult.error.issues,
      },
      { status: 400 }
    );
  }

  const queryParams = validationResult.data;

  // ✅ 直接查询数据库，移除 Redis 缓存层以减少延迟
  const [inventoryRecords, total] = await Promise.all([
    getOptimizedInventoryList(queryParams),
    getInventoryCount(queryParams),
  ]);

  // 格式化响应数据
  const response = formatPaginatedResponse(
    inventoryRecords,
    total,
    queryParams.page,
    queryParams.limit
  );

  return NextResponse.json({ success: true, data: response });
}

function isMiniProgramAdmin(request: NextRequest): boolean {
  // x-user-role 由 auth middleware 在已认证请求上注入
  return request.headers.get('x-user-role') === 'admin';
}

function attachStockStatusToInventoryListBody(body: any): any {
  const inventories = body?.data?.inventories;
  if (!Array.isArray(inventories)) return body;

  return {
    ...body,
    data: {
      ...body.data,
      inventories: inventories.map((inv: any) => ({
        ...inv,
        stockStatus: computeStockStatusFromInventoryLike(inv ?? {}),
      })),
    },
  };
}

const authedInventoryHandler = withAuth(
  async (request: NextRequest) => handleGetInventory(request),
  { permissions: ['inventory:view'] }
);

export const GET = withRateLimit(RateLimitType.READ)(async (
  request: NextRequest
) => {
  const clientFrom = request.headers.get('x-client-from');

  // 小程序游客：允许直接查看库存列表（只读）
  if (clientFrom === 'mini-program') {
    const admin = isMiniProgramAdmin(request);
    if (admin) {
      return handleGetInventory(request);
    }

    const response = await handleGetInventory(request);
    const body = await response.json();
    const enriched = attachStockStatusToInventoryListBody(body);
    const sanitized = stripSensitiveKeysDeep(enriched);
    return NextResponse.json(sanitized, { status: response.status });
  }

  // 其他客户端：保持原有权限校验
  return authedInventoryHandler(request);
});

// 库存调整（已弃用 - 使用 /api/inventory/adjust 端点）
const postInventoryHandler = withAuth(
  async (request: NextRequest) => {
    const body = await request.json();

    // 验证输入数据
    const validationResult = inventoryAdjustSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '输入数据格式不正确',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { productId } = validationResult.data;

    // 验证产品是否存在（productId 已通过 Zod 验证，确保为 string）
    if (typeof productId !== 'string') {
      return NextResponse.json(
        { success: false, error: '产品ID格式不正确' },
        { status: 400 }
      );
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      return NextResponse.json(
        { success: false, error: '指定的产品不存在' },
        { status: 400 }
      );
    }

    // 返回错误：库存调整应通过专用端点处理
    return NextResponse.json(
      {
        success: false,
        error: '库存调整请使用 /api/inventory/adjust 端点',
      },
      { status: 400 }
    );
  },
  { permissions: ['inventory:adjust'] }
);

export const POST = withRateLimit(RateLimitType.WRITE)(postInventoryHandler);
