import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { buildCacheKey, getOrSetJSON } from '@/lib/cache/cache';
import { prisma } from '@/lib/db';
import { cacheConfig } from '@/lib/env';
import { INVENTORY_THRESHOLDS } from '@/lib/types/inventory-status';
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

    const {
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      productId,
      batchNumber,
      location,
      categoryId,

      lowStock,
      hasStock,
    } = validationResult.data;

    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { product: { code: { contains: search } } },
        { product: { name: { contains: search } } },
        { batchNumber: { contains: search } },
        { location: { contains: search } },
      ];
    }

    if (productId) {
      where.productId = productId;
    }

    if (batchNumber) {
      where.batchNumber = batchNumber;
    }

    if (location) {
      where.location = location;
    }

    if (categoryId) {
      where.product = {
        ...((where.product as Record<string, unknown>) || {}),
        categoryId,
      };
    }

    // 处理库存筛选条件 - 避免条件冲突
    if (lowStock && hasStock) {
      // 同时筛选低库存和有库存：0 < 数量 <= 默认最小库存阈值
      where.quantity = {
        gt: 0,
        lte: INVENTORY_THRESHOLDS.DEFAULT_MIN_QUANTITY,
      };
    } else if (lowStock) {
      // 仅筛选低库存：数量 <= 默认最小库存阈值
      where.quantity = { lte: INVENTORY_THRESHOLDS.DEFAULT_MIN_QUANTITY };
    } else if (hasStock) {
      // 仅筛选有库存：数量 > 0
      where.quantity = { gt: 0 };
    }

    // Redis 缓存键
    const cacheKey = buildCacheKey('inventory:list', {
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      productId,
      batchNumber,
      location,
      categoryId,
      lowStock,
      hasStock,
    });

    const cached = await getOrSetJSON(
      cacheKey,
      async () => {
        const [inventoryRecords, total] = await Promise.all([
          prisma.inventory.findMany({
            where,
            select: {
              id: true,
              productId: true,
              batchNumber: true,
              quantity: true,
              reservedQuantity: true,
              location: true,
              unitCost: true,
              updatedAt: true,
              product: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  specification: true,
                  unit: true,
                  piecesPerUnit: true,
                  status: true,
                  categoryId: true,
                  category: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                    },
                  },
                },
              },
            },
            orderBy: { [sortBy as string]: sortOrder },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.inventory.count({ where }),
        ]);

        const totalPages = Math.ceil(total / limit);

        const formattedInventory = inventoryRecords.map(record => ({
          id: record.id,
          productId: record.productId,
          batchNumber: record.batchNumber,
          quantity: record.quantity,
          reservedQuantity: record.reservedQuantity,
          availableQuantity: record.quantity - record.reservedQuantity,
          location: record.location,
          unitCost: record.unitCost,
          product: record.product
            ? {
                ...record.product,
                specifications: record.product.specifications
                  ? JSON.parse(record.product.specifications as string)
                  : null,
              }
            : null,
          updatedAt: record.updatedAt,
        }));

        return {
          data: formattedInventory,
          pagination: {
            page,
            limit,
            total,
            totalPages,
          },
        } as const;
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
