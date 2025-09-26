import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { createDateTimeResponse } from '@/lib/api/datetime-middleware';
import { authOptions } from '@/lib/auth';
import { buildCacheKey, getOrSetJSON } from '@/lib/cache/cache';
import { invalidateProductCache } from '@/lib/cache/product-cache';
import { prisma } from '@/lib/db';
import { env, productConfig } from '@/lib/env';
import { paginationValidations } from '@/lib/validations/base';
import { productCreateSchema } from '@/lib/validations/product';
import { publishWs } from '@/lib/ws/ws-server';

const DEFAULT_INVENTORY = {
  totalQuantity: 0,
  reservedQuantity: 0,
  availableQuantity: 0,
};

// 获取产品列表
export async function GET(request: NextRequest) {
  try {
    // 验证用户权限 (开发环境下临时绕过)
    if (env.NODE_ENV !== 'development') {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json(
          { success: false, error: '未授权访问' },
          { status: 401 }
        );
      }
    }

    const { searchParams } = new URL(request.url);

    const includeInventory = searchParams.get('includeInventory')
      ? searchParams.get('includeInventory') === 'true'
      : productConfig.defaultIncludeInventory;
    const includeStatistics = searchParams.get('includeStatistics')
      ? searchParams.get('includeStatistics') === 'true'
      : productConfig.defaultIncludeStatistics;

    const rawStatus = searchParams.get('status');
    const rawCategoryId = searchParams.get('categoryId');
    const filterUncategorized = rawCategoryId === 'none';

    const queryParams = {
      page: searchParams.get('page') || '1',
      limit:
        searchParams.get('limit') ||
        paginationConfig.defaultPageSize.toString(),
      search: searchParams.get('search') || undefined,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
      status: rawStatus && rawStatus !== 'all' ? rawStatus : undefined,
      unit: searchParams.get('unit') || undefined,
      categoryId: filterUncategorized ? undefined : rawCategoryId || undefined,
    };

    // 验证查询参数
    const validationResult = paginationValidations.query.safeParse(queryParams);
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

    const { page, limit, search, sortBy, sortOrder } = validationResult.data;

    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
        { specification: { contains: search } },
      ];
    }

    if (queryParams.status) {
      (where as Record<string, unknown>).status = queryParams.status;
    }

    if (queryParams.unit) {
      (where as Record<string, unknown>).unit = queryParams.unit;
    }

    if (filterUncategorized) {
      (where as Record<string, unknown>).categoryId = null;
    } else if (queryParams.categoryId) {
      (where as Record<string, unknown>).categoryId = queryParams.categoryId;
    }

    // Redis 缓存键
    const cacheKey = buildCacheKey('products:list', {
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      status: queryParams.status,
      unit: queryParams.unit,
      categoryId: queryParams.categoryId,
      includeInventory,
      includeStatistics,
      uncategorized: filterUncategorized,
    });

    // 命中缓存则直接返回
    const cached = await getOrSetJSON(
      cacheKey,
      async () => {
        const baseProductSelect = {
          id: true,
          code: true,
          name: true,
          specification: true,
          unit: true,
          piecesPerUnit: true,
          weight: true,
          thickness: true,
          status: true,
          categoryId: true,
          category: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        } as const;

        const productSelect = includeStatistics
          ? {
              ...baseProductSelect,
              _count: {
                select: {
                  inventory: true,
                  salesOrderItems: true,
                  inboundRecords: true,
                },
              },
            }
          : baseProductSelect;

        const [products, total] = await Promise.all([
          prisma.product.findMany({
            where,
            select: productSelect,
            orderBy: { [sortBy as string]: sortOrder },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.product.count({ where }),
        ]);

        let inventoryMap = new Map<string, typeof DEFAULT_INVENTORY>();
        if (includeInventory && products.length > 0) {
          const productIds = products.map(product => product.id as string);
          const inventorySummary = await prisma.inventory.groupBy({
            by: ['productId'],
            where: {
              productId: { in: productIds },
            },
            _sum: {
              quantity: true,
              reservedQuantity: true,
            },
          });

          inventoryMap = new Map(
            inventorySummary.map(item => [
              item.productId,
              {
                totalQuantity: item._sum.quantity || 0,
                reservedQuantity: item._sum.reservedQuantity || 0,
                availableQuantity:
                  (item._sum.quantity || 0) - (item._sum.reservedQuantity || 0),
              },
            ])
          );
        }

        const formattedProducts = products.map(product => {
          const inventory = includeInventory
            ? (inventoryMap.get(product.id as string) ?? {
                ...DEFAULT_INVENTORY,
              })
            : { ...DEFAULT_INVENTORY };

          const counts =
            includeStatistics && '_count' in product
              ? (
                  product as {
                    _count: {
                      inventory: number;
                      salesOrderItems: number;
                      inboundRecords: number;
                    };
                  }
                )._count
              : undefined;

          return {
            id: product.id,
            code: product.code,
            name: product.name,
            specification: product.specification,
            unit: product.unit,
            piecesPerUnit: product.piecesPerUnit,
            weight: product.weight,
            thickness: product.thickness,
            status: product.status,
            categoryId: product.categoryId,
            category: product.category
              ? {
                  id: product.category.id,
                  name: product.category.name,
                  code: product.category.code,
                }
              : null,
            inventory,
            statistics: counts
              ? {
                  inventory: counts.inventory,
                  salesOrderItems: counts.salesOrderItems,
                  inboundRecords: counts.inboundRecords,
                }
              : undefined,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
          };
        });

        const totalPages = Math.ceil(total / limit);

        return {
          data: formattedProducts,
          pagination: {
            page,
            limit,
            total,
            totalPages,
          },
        } as const;
      },
      includeInventory
        ? productConfig.cacheWithInventoryTtl
        : productConfig.cacheWithoutInventoryTtl
    );

    return createDateTimeResponse(cached);
  } catch (error) {
    console.error('获取产品列表错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取产品列表失败',
      },
      { status: 500 }
    );
  }
}

// 创建产品
export async function POST(request: NextRequest) {
  try {
    if (env.NODE_ENV !== 'development') {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json(
          { success: false, error: '未授权访问' },
          { status: 401 }
        );
      }
    }

    const body = await request.json();

    // 验证请求数据
    const validationResult = productCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '产品数据格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const {
      code,
      name,
      specification,
      unit,
      piecesPerUnit,
      weight,
      thickness,
      categoryId,
    } = validationResult.data;

    // 检查产品编码是否已存在
    const existingProduct = await prisma.product.findUnique({
      where: { code },
    });

    if (existingProduct) {
      return NextResponse.json(
        { success: false, error: '产品编码已存在' },
        { status: 400 }
      );
    }

    // 处理分类ID：如果是"uncategorized"则设置为null
    const processedCategoryId =
      categoryId === 'uncategorized' ? null : categoryId;

    // 使用事务创建产品
    const product = await prisma.$transaction(async tx => {
      // 检查分类是否存在（如果提供了分类ID）
      if (processedCategoryId) {
        const category = await tx.category.findUnique({
          where: { id: processedCategoryId },
          select: { id: true, status: true },
        });

        if (!category) {
          throw new Error('指定的产品分类不存在');
        }

        if (category.status !== 'active') {
          throw new Error('指定的产品分类已被禁用');
        }
      }

      // 创建产品
      return await tx.product.create({
        data: {
          code,
          name,
          specification,
          unit,
          piecesPerUnit,
          weight,
          thickness,
          categoryId: processedCategoryId,
          status: 'active',
        },
        select: {
          id: true,
          code: true,
          name: true,
          specification: true,
          unit: true,
          piecesPerUnit: true,
          weight: true,
          thickness: true,
          status: true,
          categoryId: true,
          category: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    // 转换数据格式
    const formattedProduct = {
      id: product.id,
      code: product.code,
      name: product.name,
      specification: product.specification,
      unit: product.unit,
      piecesPerUnit: product.piecesPerUnit,
      weight: product.weight,
      thickness: product.thickness,
      status: product.status,
      categoryId: product.categoryId,
      category: product.category
        ? {
            id: product.category.id,
            name: product.category.name,
            code: product.category.code,
          }
        : null,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };

    // 缓存失效 & WebSocket 推送
    await invalidateProductCache();
    publishWs('products', {
      type: 'created',
      id: formattedProduct.id,
      code: formattedProduct.code,
    });

    return createDateTimeResponse(formattedProduct, 201, '产品创建成功');
  } catch (error) {
    console.error('创建产品错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '创建产品失败',
      },
      { status: 500 }
    );
  }
}
