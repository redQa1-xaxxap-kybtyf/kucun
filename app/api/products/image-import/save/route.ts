import { type NextRequest } from 'next/server';

import { saveProductImageImportItems } from '@/lib/api/handlers/products';
import { successResponse } from '@/lib/api/response';
import { withAuth } from '@/lib/auth/api-helpers';
import { productImageImportSaveSchema } from '@/lib/validations/product';

/**
 * 批量图片导入：批量保存产品缩略图、主图和效果图
 */
export const PATCH = withAuth(
  async (request: NextRequest) => {
    const body = await request.json();
    const validatedData = productImageImportSaveSchema.parse(body);
    const result = await saveProductImageImportItems(validatedData.items);

    return successResponse(result, 200, '产品图片已批量保存');
  },
  { permissions: ['products:edit'] }
);
