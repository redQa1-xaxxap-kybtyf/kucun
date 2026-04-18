import { type NextRequest, NextResponse } from 'next/server';

import { createDateTimeResponse } from '@/lib/api/datetime-middleware';
import {
  createProductRecord,
  formatCreatedProduct,
} from '@/lib/api/handlers/product-create';
import {
  computeStockStatusFromInventoryLike,
  stripSensitiveKeysDeep,
} from '@/lib/api/mini-program-sanitize';
import { parseOffsetPagination } from '@/lib/api/pagination';
import type { ProductListQueryParams } from '@/lib/api/products';
import { getProductsForServer } from '@/lib/api/products-server';
import { successResponse, withAuth } from '@/lib/auth/api-helpers';
import { publishDataUpdate, revalidateProducts } from '@/lib/cache';
import { PRODUCT_DEFAULT_SORT } from '@/lib/config/product';
import { productConfig } from '@/lib/env';
import { logger } from '@/lib/logger';
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

  const { page, limit } = parseOffsetPagination(searchParams, {
    strict: true,
    pageFieldLabel: '页码',
    limitFieldLabel: '每页数量',
  });
  const search = searchParams.get('search') || undefined;
  const categoryId = searchParams.get('categoryId') || undefined;
  const status = searchParams.get('status') || undefined;
  const sortBy = searchParams.get('sortBy') || PRODUCT_DEFAULT_SORT.sortBy;
  const sortOrder = (searchParams.get('sortOrder') ||
    PRODUCT_DEFAULT_SORT.sortOrder) as 'asc' | 'desc';

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

function isMiniProgramAdmin(request: NextRequest): boolean {
  // x-user-role 由 auth middleware 在已认证请求上注入
  return request.headers.get('x-user-role') === 'admin';
}

function attachStockStatusToProductListPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;
  const typed = payload as Record<string, any>;
  const products = Array.isArray(typed.data) ? typed.data : [];

  return {
    ...typed,
    data: products.map((product: any) => {
      const inventory =
        product && typeof product === 'object' ? product.inventory : undefined;
      const stockStatus = computeStockStatusFromInventoryLike(inventory ?? {});
      return {
        ...product,
        inventory: {
          ...(inventory && typeof inventory === 'object' ? inventory : {}),
          stockStatus,
        },
      };
    }),
  };
}

/**
 * 实际处理产品列表查询的函数（不做认证）
 */
async function handleGetProducts(request: NextRequest) {
  // 解析查询参数（分页错误返回 400，避免落入 500）
  let params: ProductListQueryParams & { includeBatchSpecs?: boolean };
  try {
    params = parseProductQueryParams(request.nextUrl.searchParams);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '分页参数格式不正确',
      },
      { status: 400 }
    );
  }

  try {
    // 调用服务器端函数（复用缓存和逻辑）
    const data = await getProductsForServer(params);

    // 小程序游客：脱敏库存数值，仅保留 stockStatus 等非敏感字段
    if (
      request.headers.get('x-client-from') === 'mini-program' &&
      !isMiniProgramAdmin(request)
    ) {
      const enriched = attachStockStatusToProductListPayload(data);
      const sanitized = stripSensitiveKeysDeep(enriched);
      return successResponse(sanitized);
    }

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
}

/**
 * 获取产品列表 API
 *
 * - 小程序游客（请求头带 x-client-from=mini-program）直接放行，不需要登录
 * - 其他客户端依然通过 withAuth 做权限校验
 */
export const GET = async (request: NextRequest) => {
  const clientFrom = request.headers.get('x-client-from');

  // 小程序游客访问：跳过认证，直接返回数据
  if (clientFrom === 'mini-program') {
    return handleGetProducts(request);
  }

  // 其他客户端：保持原有权限校验逻辑
  const authedGet = withAuth(
    async (req: NextRequest) => handleGetProducts(req),
    { permissions: ['products:view'] }
  );

  return authedGet(request);
};

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

    const product = await createProductRecord(validationResult.data);
    const formattedProduct = formatCreatedProduct(product);

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
