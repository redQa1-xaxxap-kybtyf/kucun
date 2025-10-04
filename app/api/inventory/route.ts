import { type NextRequest, NextResponse } from 'next/server';

import { successResponse, withAuth } from '@/lib/auth/api-helpers';
import { formatPaginatedResponse } from '@/lib/api/inventory-formatter';
import {
  getInventoryCount,
  getOptimizedInventoryList,
} from '@/lib/api/inventory-query-builder';
import { buildCacheKey, getOrSetJSON, CACHE_STRATEGY } from '@/lib/cache';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/utils/console-logger';
import {
  inventoryAdjustSchema,
  inventoryQuerySchema,
} from '@/lib/validations/inventory';

// 获取库存列表
export const GET = withAuth(
  async (request: NextRequest, { user }) => {
    const { searchParams } = new URL(request.url);

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

    // Redis 缓存键
    const cacheKey = buildCacheKey('inventory:list', queryParams);

    // 使用优化的查询构建器，解决N+1问题
    const cached = await getOrSetJSON(
      cacheKey,
      async () => {
        // 并行查询库存记录和总数
        const [inventoryRecords, total] = await Promise.all([
          getOptimizedInventoryList(queryParams),
          getInventoryCount(queryParams),
        ]);

        // 格式化响应数据
        return formatPaginatedResponse(
          inventoryRecords,
          total,
          queryParams.page,
          queryParams.limit
        );
      },
      CACHE_STRATEGY.volatileData.redisTTL, // 库存数据变动频繁，使用较短缓存 (2分钟)
      {
        enableRandomTTL: true, // 防止缓存雪崩
        enableNullCache: true, // 防止缓存穿透
      }
    );

    return NextResponse.json({ success: true, data: cached });
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

    // 验证产品是否存在
    const product = await prisma.product.findUnique({
      where: { id: productId as string },
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
