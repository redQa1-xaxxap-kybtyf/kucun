import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { ApiError } from '@/lib/api/errors';
import { resolveParams } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/api-helpers';
import { invalidateProductCache } from '@/lib/cache/product-cache';
import { prisma } from '@/lib/db';

const productStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
});

/**
 * 单独更新产品状态（给小白用户用：不用进编辑页，也不用传完整表单）
 */
export const PATCH = withAuth(
  async (request: NextRequest, context) => {
    const { id } = await resolveParams(context.params);
    const body = await request.json();
    const { status } = productStatusSchema.parse(body);

    const existing = await prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw ApiError.notFound('产品');
    }

    await prisma.product.update({
      where: { id },
      data: { status },
    });

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/products', 'page');
    revalidatePath(`/products/${id}`, 'page');

    await invalidateProductCache(id);

    return successResponse({ id, status }, 200, '产品状态已更新');
  },
  { permissions: ['products:edit'] }
);

