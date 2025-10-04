import { type NextRequest, NextResponse } from 'next/server';

import { createDateTimeResponse } from '@/lib/api/datetime-middleware';
import { successResponse, withAuth } from '@/lib/auth/api-helpers';
import {
  buildCacheKey,
  getOrSetJSON,
  revalidateProducts,
  publishDataUpdate,
  CACHE_STRATEGY,
} from '@/lib/cache';
import { getBatchCachedInventorySummary } from '@/lib/cache/inventory-cache';
import { prisma } from '@/lib/db';
import { paginationConfig, productConfig } from '@/lib/env';
import { paginationValidations } from '@/lib/validations/base';
import { productCreateSchema } from '@/lib/validations/product';
import { publishWs } from '@/lib/ws/ws-server';

const DEFAULT_INVENTORY = {
  totalQuantity: 0,
  reservedQuantity: 0,
  availableQuantity: 0,
};

// 获取产品列表
export const GET = withAuth(
  async (request: NextRequest, { user }) => {
    const { searchParams } = new URL(request.url);

    const includeInventory = searchParams.get('includeInventory')
      ? searchParams.get('includeInventory') === 'true'
      : productConfig.defaultIncludeInventory;
    const includeStatistics = searchParams.get('includeStatistics')
      ? searchParams.get('includeStatistics') === 'true'
      : productConfig.defaultIncludeStatistics;

    // 性能优化：限制聚合查询的使用
    const requestLimit = parseInt(
      searchParams.get('limit') || paginationConfig.defaultPageSize.toString()
    );
    // 降低阈值以减少数据库负载，统计数据通常只在详情页需要
    const shouldLimitAggregation = requestLimit > 20; // 超过20条记录时限制聚合查询

    const finalIncludeStatistics = includeStatistics && !shouldLimitAggregation;

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
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { page, limit, search, sortBy, sortOrder } = validationResult.data;

    // 构建查询条件
    const where: Record<string, unknown> = {};

    // 搜索条件 - 优化为使用索引的查询
    // code使用startsWith可以利用索引，name使用contains有索引支持
    // 移除specification搜索以避免全表扫描
    if (search) {
      where.OR = [
        { code: { startsWith: search } }, // 可以使用索引的前缀匹配
        { name: { contains: search } }, // name字段有索引
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
      includeStatistics: finalIncludeStatistics,
      uncategorized: filterUncategorized,
    });

    // 性能监控：记录查询开始时间
    const queryStartTime = Date.now();

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

        const productSelect = finalIncludeStatistics
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
          // 使用缓存优化的批量库存查询（已在顶部导入，避免动态导入延迟）
          inventoryMap = await getBatchCachedInventorySummary(productIds);
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
      CACHE_STRATEGY.dynamicData.redisTTL, // 使用统一的动态数据缓存策略 (5分钟)
      {
        enableRandomTTL: true, // 防止缓存雪崩
        enableNullCache: true, // 防止缓存穿透
      }
    );

    // 性能监控：记录慢查询
    const queryDuration = Date.now() - queryStartTime;
    if (queryDuration > 1000) {
      console.warn(`[性能警告] 产品列表查询耗时过长: ${queryDuration}ms`, {
        cacheKey,
        includeInventory,
        includeStatistics: finalIncludeStatistics,
        search,
        page,
        limit,
      });
    }

    return createDateTimeResponse(cached);
  },
  { permissions: ['products:view'] }
);

// 创建产品
export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    const body = await request.json();

    // 验证请求数据
    const validationResult = productCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '产品数据格式不正确',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const {
      code,
      name,
      specification,
      description,
      unit,
      thickness,
      categoryId,
      thumbnailUrl,
      images,
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
          description,
          unit,
          thickness,
          categoryId: processedCategoryId,
          thumbnailUrl,
          images: images ? JSON.stringify(images) : null,
          status: 'active',
        },
        select: {
          id: true,
          code: true,
          name: true,
          specification: true,
          description: true,
          unit: true,
          piecesPerUnit: true,
          weight: true,
          thickness: true,
          status: true,
          categoryId: true,
          thumbnailUrl: true,
          images: true,
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
      description: product.description,
      unit: product.unit,
      piecesPerUnit: product.piecesPerUnit,
      weight: product.weight,
      thickness: product.thickness,
      status: product.status,
      categoryId: product.categoryId,
      thumbnailUrl: product.thumbnailUrl,
      images: product.images ? JSON.parse(product.images as string) : [],
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

    // 使用新的统一缓存失效系统
    await revalidateProducts(); // 自动级联失效相关缓存

    // 发布实时更新事件
    await publishDataUpdate('products', formattedProduct.id, 'create');

    // WebSocket 推送（向后兼容）
    publishWs('products', {
      type: 'created',
      id: formattedProduct.id,
      code: formattedProduct.code,
    });

    return createDateTimeResponse(formattedProduct, 201, '产品创建成功');
  },
  { permissions: ['products:create'] }
);
