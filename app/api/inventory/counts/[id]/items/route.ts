// 添加盘点明细 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { resolveParams, withErrorHandling } from '@/lib/api/middleware';
import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { addCountItems } from '@/lib/services/inventory-count-service';
import { countIdSchema } from '@/lib/validations/inventory-count';

type CountParams = { id: string };

// 添加盘点明细的请求体验证规则
const addCountItemsSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid('产品信息格式有误'),
        variantId: z.string().uuid('规格信息格式有误').optional(),
        batchNumber: z.string().optional(),
        location: z.string().optional(),
        remarks: z.string().optional(),
      })
    )
    .min(1, '至少需要添加一条盘点明细'),
});

/**
 * POST /api/inventory/counts/[id]/items - 添加盘点明细
 * 权限：需要 inventory:manage 权限
 */
export const POST = withAuth(
  withErrorHandling(async (request: NextRequest, context) => {
    // 解析路径参数
    const { id } = await resolveParams<CountParams>(
      context.params as Promise<CountParams> | CountParams | undefined
    );

    // 验证路径参数
    const idValidationResult = countIdSchema.safeParse({ id });

    if (!idValidationResult.success) {
      return errorResponse(
        `提交内容有误： ${idValidationResult.error.issues[0]?.message}`,
        400
      );
    }

    // 解析请求体
    const body = await request.json();
    const validationResult = addCountItemsSchema.safeParse(body);

    if (!validationResult.success) {
      return errorResponse(
        `数据验证失败: ${validationResult.error.issues[0]?.message}`,
        400
      );
    }

    const { items } = validationResult.data;

    // 添加盘点明细
    const result = await addCountItems(id, items);

    return successResponse(result);
  }),
  { permissions: ['inventory:manage'] }
);

