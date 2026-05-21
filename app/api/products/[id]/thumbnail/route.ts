import { type NextRequest } from 'next/server';

import { ApiError } from '@/lib/api/errors';
import { updateProductThumbnail } from '@/lib/api/handlers/products';
import { resolveParams } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/api-helpers';
import { productThumbnailUpdateSchema } from '@/lib/validations/product';

/**
 * 快速更新产品缩略图
 */
export const PATCH = withAuth(
  async (request: NextRequest, context) => {
    const { id } = await resolveParams(context.params);
    const body = await request.json();
    const validatedData = productThumbnailUpdateSchema.parse(body);

    if (validatedData.thumbnailUrl === undefined) {
      throw ApiError.badRequest('请提供缩略图地址');
    }

    const product = await updateProductThumbnail(
      id,
      validatedData.thumbnailUrl
    );

    return successResponse(product, 200, '缩略图更新成功');
  },
  { permissions: ['products:edit'] }
);
