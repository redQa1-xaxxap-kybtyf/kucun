import { type NextRequest, NextResponse } from 'next/server';

import { successResponse, withAuth } from '@/lib/auth/api-helpers';
import { formatPaginatedResponse } from '@/lib/api/inventory-formatter';
import {
  getInventoryCount,
  getOptimizedInventoryList,
} from '@/lib/api/inventory-query-builder';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/utils/console-logger';
import {
  inventoryAdjustSchema,
  inventoryQuerySchema,
} from '@/lib/validations/inventory';

// 获取库存列表
// ✅ 性能优化：移除 Redis 缓存层
// - Server Component 已通过 HydrationBoundary 预取数据（不经过此API）
// - Client Component 通过 TanStack Query 缓存（staleTime=Infinity）
// - Redis 低命中率场景下反而增加 20-50ms 延迟
export const GET = withAuth(
  async (request: NextRequest, { user }) => {
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
  },
  { permissions: ['inventory:view'] }
);

// 库存调整（已弃用 - 使用 /api/inventory/adjust 端点）
export const POST = withAuth(
  async (request: NextRequest, { user }) => {
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
