import { type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { ApiError } from '@/lib/api/errors';
import {
  deleteProduct,
  getProductById,
  updateProduct,
} from '@/lib/api/handlers/products';
import { withErrorHandling } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/response';
import { authOptions } from '@/lib/auth';
import { productUpdateSchema } from '@/lib/validations/product';

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function ensureAuthorized() {
  // 始终验证用户权限,确保安全性
  const session = await getServerSession(authOptions);
  return Boolean(session?.user?.id);
}

async function resolveParams(context: RouteContext) {
  const params = await context.params;
  if (!params) {
    return null;
  }

  return params;
}

/**
 * 获取单个产品信息
 */
export const GET = withErrorHandling<{ id: string }>(
  async (request: NextRequest, context: RouteContext) => {
    if (!(await ensureAuthorized())) {
      throw ApiError.unauthorized('请先登录');
    }

    const params = await resolveParams(context);
    if (!params) {
      throw ApiError.badRequest('参数缺失');
    }

    const product = await getProductById(params.id);
    if (!product) {
      throw ApiError.notFound('产品');
    }

    return successResponse(product);
  }
);

/**
 * 更新产品信息
 */
export const PUT = withErrorHandling<{ id: string }>(
  async (request: NextRequest, context: RouteContext) => {
    if (!(await ensureAuthorized())) {
      throw ApiError.unauthorized('请先登录');
    }

    const params = await resolveParams(context);
    if (!params) {
      throw ApiError.badRequest('参数缺失');
    }

    const body = await request.json();
    const validatedData = productUpdateSchema.parse(body);

    const product = await updateProduct(params.id, validatedData);
    return successResponse(product, 200, '产品更新成功');
  }
);

/**
 * 删除产品
 */
export const DELETE = withErrorHandling<{ id: string }>(
  async (request: NextRequest, context: RouteContext) => {
    if (!(await ensureAuthorized())) {
      throw ApiError.unauthorized('请先登录');
    }

    const params = await resolveParams(context);
    if (!params) {
      throw ApiError.badRequest('参数缺失');
    }

    const result = await deleteProduct(params.id);
    return successResponse(result, 200, '产品删除成功');
  }
);
