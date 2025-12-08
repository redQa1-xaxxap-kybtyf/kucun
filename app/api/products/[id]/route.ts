import { type NextRequest } from 'next/server';

import { ApiError } from '@/lib/api/errors';
import {
  deleteProduct,
  getProductById,
  updateProduct,
} from '@/lib/api/handlers/products';
import { resolveParams } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/api-helpers';
import { getCachedProductInventorySummary } from '@/lib/cache/inventory-cache';
import { productUpdateSchema } from '@/lib/validations/product';

/**
 * 实际处理单个产品信息查询（不做认证）
 */
async function handleGetProductDetail(
  request: NextRequest,
  context: { params?: Promise<Record<string, string>> | Record<string, string> }
) {
  const { id } = await resolveParams(context.params);

  const product = await getProductById(id);
  if (!product) {
    throw ApiError.notFound('产品');
  }

  // 是否需要附带库存汇总信息（供小程序等前端使用）
  const includeInventory =
    request.nextUrl.searchParams.get('includeInventory') === 'true';

  if (!includeInventory) {
    return successResponse(product);
  }

  const inventorySummary = (await getCachedProductInventorySummary(id)) ?? {
    totalQuantity: 0,
    reservedQuantity: 0,
    availableQuantity: 0,
  };

  return successResponse({
    ...product,
    inventory: inventorySummary,
  });
}

/**
 * 获取单个产品信息
 *
 * - 小程序游客（x-client-from=mini-program）可以直接查看详情
 * - 其他客户端仍需 products:view 权限
 */
export const GET = async (
  request: NextRequest,
  context: {
    params?: Promise<Record<string, string>> | Record<string, string>;
  }
) => {
  const clientFrom = request.headers.get('x-client-from');

  if (clientFrom === 'mini-program') {
    return handleGetProductDetail(request, context);
  }

  const authedGet = withAuth(
    async (req: NextRequest, ctx) => handleGetProductDetail(req, ctx),
    { permissions: ['products:view'] }
  );

  return authedGet(request, context);
};

/**
 * 更新产品信息
 */
export const PUT = withAuth(
  async (request: NextRequest, context) => {
    const { id } = await resolveParams(context.params);

    const body = await request.json();
    const validatedData = productUpdateSchema.parse(body);

    const product = await updateProduct(id, validatedData);
    return successResponse(product, 200, '产品更新成功');
  },
  { permissions: ['products:edit'] }
);

/**
 * 删除产品
 */
export const DELETE = withAuth(
  async (request: NextRequest, context) => {
    const { id } = await resolveParams(context.params);

    const result = await deleteProduct(id);
    return successResponse(result, 200, '产品删除成功');
  },
  { permissions: ['products:delete'] }
);
