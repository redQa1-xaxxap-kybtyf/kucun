import { type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import {
  deleteProduct,
  getProductById,
  updateProduct,
} from '@/lib/api/handlers/products';
import { withErrorHandling } from '@/lib/api/middleware';
import {
  errorResponse,
  notFoundResponse,
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from '@/lib/api/response';
import { authOptions } from '@/lib/auth';
import { env } from '@/lib/env';
import { productUpdateSchema } from '@/lib/validations/product';

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function ensureAuthorized() {
  if (env.NODE_ENV === 'development') {
    return true;
  }

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
      return unauthorizedResponse('请先登录');
    }

    const params = await resolveParams(context);
    if (!params) {
      return errorResponse('参数缺失', 400);
    }

    const product = await getProductById(params.id);
    if (!product) {
      return notFoundResponse('产品不存在');
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
      return unauthorizedResponse('请先登录');
    }

    const params = await resolveParams(context);
    if (!params) {
      return errorResponse('参数缺失', 400);
    }

    const body = await request.json();
    const validationResult = productUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return validationErrorResponse(
        '产品数据格式不正确',
        validationResult.error.errors
      );
    }

    try {
      const product = await updateProduct(params.id, validationResult.data);
      return successResponse(product, 200, '产品更新成功');
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : '产品更新失败',
        400
      );
    }
  }
);

/**
 * 删除产品
 */
export const DELETE = withErrorHandling<{ id: string }>(
  async (request: NextRequest, context: RouteContext) => {
    if (!(await ensureAuthorized())) {
      return unauthorizedResponse('请先登录');
    }

    const params = await resolveParams(context);
    if (!params) {
      return errorResponse('参数缺失', 400);
    }

    try {
      const result = await deleteProduct(params.id);
      return successResponse(result, 200, '产品删除成功');
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : '产品删除失败',
        400
      );
    }
  }
);
