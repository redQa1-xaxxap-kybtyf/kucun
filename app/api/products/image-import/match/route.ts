import { type NextRequest } from 'next/server';

import { matchProductImageImportItems } from '@/lib/api/handlers/products';
import { successResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/api-helpers';
import { productImageImportMatchSchema } from '@/lib/validations/product';

/**
 * 批量图片导入：按文件名推断的产品编码匹配产品档案
 */
export const POST = withAuth(
  async (request: NextRequest) => {
    const body = await request.json();
    const validatedData = productImageImportMatchSchema.parse(body);
    const result = await matchProductImageImportItems(validatedData.items);

    return successResponse(result, 200, '图片匹配完成');
  },
  { permissions: ['products:edit'] }
);
