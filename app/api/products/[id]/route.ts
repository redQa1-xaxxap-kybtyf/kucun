import { getServerSession } from 'next-auth';
import { type NextRequest } from 'next/server';

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

async function ensureAuthorized() {
  // 始终验证用户权限,确保安全性
  const session = await getServerSession(authOptions);
  return Boolean(session?.user?.id);
}

/**
 * 获取单个产品信息
 */
export const GET = withErrorHandling(
  async (
    request: NextRequest,
    { params }: { params?: Record<string, string> }
  ) => {
    if (!(await ensureAuthorized())) {
      throw ApiError.unauthorized('请先登录');
    }

    const id = params?.id;
    if (!id) {
      throw ApiError.badRequest('缺少必需的参数: id');
    }

    const product = await getProductById(id);
    if (!product) {
      throw ApiError.notFound('产品');
    }

    return successResponse(product);
  }
);

/**
 * 更新产品信息
 */
export const PUT = withErrorHandling(
  async (
    request: NextRequest,
    { params }: { params?: Record<string, string> }
  ) => {
    if (!(await ensureAuthorized())) {
      throw ApiError.unauthorized('请先登录');
    }

    const id = params?.id;
    if (!id) {
      throw ApiError.badRequest('缺少必需的参数: id');
    }

    const body = await request.json();
    const validatedData = productUpdateSchema.parse(body);

    const product = await updateProduct(id, validatedData);
    return successResponse(product, 200, '产品更新成功');
  }
);

/**
 * 删除产品
 */
export const DELETE = withErrorHandling(
  async (
    request: NextRequest,
    { params }: { params?: Record<string, string> }
  ) => {
    if (!(await ensureAuthorized())) {
      throw ApiError.unauthorized('请先登录');
    }

    const id = params?.id;
    if (!id) {
      throw ApiError.badRequest('缺少必需的参数: id');
    }

    const result = await deleteProduct(id);
    return successResponse(result, 200, '产品删除成功');
  }
);
