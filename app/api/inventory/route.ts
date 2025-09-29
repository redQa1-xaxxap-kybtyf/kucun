import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { formatPaginatedResponse } from '@/lib/api/inventory-formatter';
import {
  getInventoryCount,
  getOptimizedInventoryList,
} from '@/lib/api/inventory-query-builder';
import { authOptions } from '@/lib/auth';
import { buildCacheKey, getOrSetJSON } from '@/lib/cache/cache';
import { prisma } from '@/lib/db';
import { cacheConfig } from '@/lib/env';
import {
  inventoryAdjustSchema,
  inventoryQuerySchema,
} from '@/lib/validations/inventory';

// 获取库存列表
export async function GET(request: NextRequest) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    // 直接传递字符串参数给验证器，让验证器自己转换
    const queryParams = {
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
    const validationResult = inventoryQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '查询参数格式不正确',
          details: validationResult.error.errors,
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
      cacheConfig.inventoryTtl // 使用配置的库存缓存TTL
    );

    return NextResponse.json({ success: true, data: cached });
  } catch (error) {
    console.error('获取库存列表错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取库存列表失败',
      },
      { status: 500 }
    );
  }
}

// 库存调整
export async function POST(request: NextRequest) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // 验证输入数据
    const validationResult = inventoryAdjustSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '输入数据格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { productId } = validationResult.data;

    const pid = productId as string;

    try {
      await prisma.$transaction(async tx => {
        // 验证产品是否存在（事务内保证一致性）
        const product = await tx.product.findUnique({
          where: { id: pid },
        });
        if (!product) {
          throw new Error('BAD_REQUEST: 指定的产品不存在');
        }

        // 修复：库存调整应通过专用的 /api/inventory/adjust 端点处理
        // 这里只保留基本的库存查询功能，移除调整逻辑
        throw new Error(
          'BAD_REQUEST: 库存调整请使用 /api/inventory/adjust 端点'
        );
      });

      return NextResponse.json(
        {
          success: false,
          error: '库存调整请使用 /api/inventory/adjust 端点',
        },
        { status: 400 }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith('BAD_REQUEST:')) {
        return NextResponse.json(
          { success: false, error: msg.replace('BAD_REQUEST: ', '') },
          { status: 400 }
        );
      }
      throw err;
    }
  } catch (error) {
    console.error('库存调整错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '库存调整失败',
      },
      { status: 500 }
    );
  }
}
