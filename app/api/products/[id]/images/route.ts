import { type NextRequest } from 'next/server';

import { updateProductMedia } from '@/lib/api/handlers/products';
import { resolveParams } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/api-helpers';
import { productMediaUpdateSchema } from '@/lib/validations/product';

/**
 * 快速更新产品图片资料
 */
export const PATCH = withAuth(
  async (request: NextRequest, context) => {
    const { id } = await resolveParams(context.params);
    const body = await request.json();
    const validatedData = productMediaUpdateSchema.parse(body);

    const product = await updateProductMedia(id, validatedData);

    return successResponse(product, 200, '产品图片已保存');
  },
  { permissions: ['products:edit'] }
);
