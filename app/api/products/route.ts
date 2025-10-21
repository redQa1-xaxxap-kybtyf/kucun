import { type NextRequest, NextResponse } from 'next/server';

import { createDateTimeResponse } from '@/lib/api/datetime-middleware';
import { ApiError, handlePrismaError } from '@/lib/api/errors';
import type { ProductListQueryParams } from '@/lib/api/products';
import { getProductsForServer } from '@/lib/api/products-server';
import { successResponse, withAuth } from '@/lib/auth/api-helpers';
import { revalidateProducts, publishDataUpdate } from '@/lib/cache';
import { prisma } from '@/lib/db';
import { paginationConfig, productConfig } from '@/lib/env';
import { logger } from '@/lib/logger';
import { toProductResponse } from '@/lib/utils/product-transforms';
import { productCreateSchema } from '@/lib/validations/product';

/**
 * 解析 URLSearchParams 为产品查询参数
 * 遵循 Context 7 规范：函数不超过 50 行
 */
function parseProductQueryParams(
  searchParams: URLSearchParams
): ProductListQueryParams & { includeBatchSpecs?: boolean } {
  const includeInventory = searchParams.get('includeInventory')
    ? searchParams.get('includeInventory') === 'true'
    : productConfig.defaultIncludeInventory;

  const includeStatistics = searchParams.get('includeStatistics')
    ? searchParams.get('includeStatistics') === 'true'
    : productConfig.defaultIncludeStatistics;

  const includeBatchSpecs = searchParams.get('includeBatchSpecs') === 'true';

  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(
    searchParams.get('limit') || paginationConfig.defaultPageSize.toString(),
    10
  );
  const search = searchParams.get('search') || undefined;
  const categoryId = searchParams.get('categoryId') || undefined;
  const status = searchParams.get('status') || undefined;
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

  return {
    page,
    limit,
    search,
    categoryId,
    status: status as 'active' | 'inactive' | undefined,
    sortBy,
    sortOrder,
    includeInventory,
    includeStatistics,
    includeBatchSpecs,
  };
}

/**
 * 获取产品列表 API
 * 复用 products-server.ts 逻辑，避免代码重复
 * 遵循 Context 7 规范：函数不超过 50 行
 */
export const GET = withAuth(
  async (request: NextRequest) => {
    try {
      // 解析查询参数
      const params = parseProductQueryParams(request.nextUrl.searchParams);

      // 调用服务器端函数（复用缓存和逻辑）
      const data = await getProductsForServer(params);

      // 返回成功响应
      return successResponse(data);
    } catch (error) {
      logger.error('products', '产品列表查询失败', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : '获取产品列表失败',
        },
        { status: 500 }
      );
    }
  },
  { permissions: ['products:view'] }
);

// 创建产品
export const POST = withAuth(
  async (request: NextRequest) => {
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
      thickness,
      categoryId,
      thumbnailUrl,
      images,
    } = validationResult.data;

    // 处理分类ID：如果是"uncategorized"则设置为null
    const processedCategoryId =
      categoryId === 'uncategorized' ? null : (categoryId ?? null);

    // ✅ 使用事务和数据库唯一约束防止并发创建重复编码
    const product = await prisma.$transaction(async tx => {
      // 检查分类是否存在（如果提供了分类ID）
      if (processedCategoryId) {
        const category = await tx.category.findUnique({
          where: { id: processedCategoryId },
          select: { id: true, status: true },
        });

        if (!category) {
          throw ApiError.badRequest('指定的产品分类不存在');
        }

        if (category.status.toLowerCase() !== 'active') {
          throw ApiError.badRequest('指定的产品分类已被禁用');
        }
      }

      // 创建产品 - 依赖数据库唯一约束防止重复
      try {
        return await tx.product.create({
          data: {
            code,
            name: name || code, // 如果name为空,使用code作为name
            specification,
            description,
            unit: 'piece', // 默认单位为"件"
            thickness,
            categoryId: processedCategoryId ?? null,
            thumbnailUrl,
            images: images ? JSON.stringify(images) : null,
            status: 'active',
          },
          include: {
            category: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        });
      } catch (error: unknown) {
        // 使用统一的 Prisma 错误处理
        throw handlePrismaError(error);
      }
    });

    // 使用统一的转换工具处理产品数据
    // 显式类型断言以访问 category 字段
    const productWithCategory = product as typeof product & {
      category: { id: string; name: string; code: string } | null;
    };

    const formattedProduct = toProductResponse(productWithCategory);

    // ✅ Next.js 15最佳实践：使用revalidatePath确保服务端缓存失效
    // 这是创建数据后确保列表页面能立即看到新数据的关键
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/products', 'page'); // 失效产品列表页面缓存

    // 使用新的统一缓存失效系统（处理React Query和Redis缓存）
    await revalidateProducts(); // 自动级联失效相关缓存

    // 发布实时更新事件
    await publishDataUpdate('products', formattedProduct.id, 'create');

    return createDateTimeResponse(formattedProduct, 201, '产品创建成功');
  },
  { permissions: ['products:create'] }
);
