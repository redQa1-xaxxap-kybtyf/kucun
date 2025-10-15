import { type NextRequest, NextResponse } from 'next/server';

import { createDateTimeResponse } from '@/lib/api/datetime-middleware';
import type { ProductListQueryParams } from '@/lib/api/products';
import { getProductsForServer } from '@/lib/api/products-server';
import { successResponse, withAuth } from '@/lib/auth/api-helpers';
import { revalidateProducts, publishDataUpdate } from '@/lib/cache';
import { prisma } from '@/lib/db';
import { paginationConfig, productConfig } from '@/lib/env';
import { logger } from '@/lib/logger';
import { productCreateSchema } from '@/lib/validations/product';

/**
 * 解析 URLSearchParams 为产品查询参数
 * 遵循 Context 7 规范：函数不超过 50 行
 */
function parseProductQueryParams(
  searchParams: URLSearchParams
): ProductListQueryParams {
  const includeInventory = searchParams.get('includeInventory')
    ? searchParams.get('includeInventory') === 'true'
    : productConfig.defaultIncludeInventory;

  const includeStatistics = searchParams.get('includeStatistics')
    ? searchParams.get('includeStatistics') === 'true'
    : productConfig.defaultIncludeStatistics;

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
          throw new Error('指定的产品分类不存在');
        }

        if (category.status !== 'active') {
          throw new Error('指定的产品分类已被禁用');
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
        // 处理唯一约束冲突错误 (Prisma P2002)
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'P2002'
        ) {
          throw new Error('产品编码已存在');
        }
        throw error;
      }
    });

    // 转换数据格式
    // ✅ 类型安全的 JSON 解析（避免 as string 断言）
    let parsedImages: unknown[] = [];
    if (product.images) {
      try {
        const parsed = JSON.parse(
          typeof product.images === 'string'
            ? product.images
            : String(product.images)
        );
        parsedImages = Array.isArray(parsed) ? parsed : [];
      } catch (error: unknown) {
        logger.warn('products', '解析产品图片失败，使用空数组作为兜底', {
          productId: product.id,
          error: error instanceof Error ? error.message : String(error),
        });
        parsedImages = [];
      }
    }

    // 显式类型断言以访问 category 字段
    const productWithCategory = product as typeof product & {
      category: { id: string; name: string; code: string } | null;
    };

    const formattedProduct = {
      id: productWithCategory.id,
      code: productWithCategory.code,
      name: productWithCategory.name,
      specification: productWithCategory.specification,
      description: productWithCategory.description,
      unit: productWithCategory.unit,
      piecesPerUnit: productWithCategory.piecesPerUnit,
      weight: productWithCategory.weight,
      thickness: productWithCategory.thickness,
      status: productWithCategory.status,
      categoryId: productWithCategory.categoryId,
      thumbnailUrl: productWithCategory.thumbnailUrl,
      images: parsedImages,
      category: productWithCategory.category
        ? {
            id: productWithCategory.category.id,
            name: productWithCategory.category.name,
            code: productWithCategory.category.code,
          }
        : null,
      createdAt: productWithCategory.createdAt,
      updatedAt: productWithCategory.updatedAt,
    };

    // 使用新的统一缓存失效系统
    await revalidateProducts(); // 自动级联失效相关缓存

    // 发布实时更新事件
    await publishDataUpdate('products', formattedProduct.id, 'create');

    return createDateTimeResponse(formattedProduct, 201, '产品创建成功');
  },
  { permissions: ['products:create'] }
);
