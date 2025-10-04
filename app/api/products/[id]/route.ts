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
import { productUpdateSchema } from '@/lib/validations/product';

/**
 * 获取单个产品信息
 */
export const GET = withAuth(
  async (request: NextRequest, context) => {
    const { id } = await resolveParams(context.params);

    const product = await getProductById(id);
    if (!product) {
      throw ApiError.notFound('产品');
    }

    return successResponse(product);
  },
  { permissions: ['products:view'] }
);

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
